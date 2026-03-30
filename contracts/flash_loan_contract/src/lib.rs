#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, token, Address, Bytes,
    BytesN, Env, Symbol,
};

#[derive(Clone)]
#[contracttype]
pub struct FlashLoanPool {
    pub token: Address,
    pub liquidity: i128,
    pub fee_bps: u32,
    pub total_fees_collected: i128,
    pub is_active: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct PoolInfo {
    pub token: Address,
    pub liquidity: i128,
    pub fee_bps: u32,
    pub total_fees_collected: i128,
    pub is_active: bool,
    pub total_shares: i128,
}

#[derive(Clone)]
#[contracttype]
pub struct LoanRecord {
    pub borrower: Address,
    pub token: Address,
    pub amount: i128,
    pub fee: i128,
    pub tx_hash: BytesN<32>,
    pub executed_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Pool(Address),
    TotalShares(Address),
    LpShares(Address, Address),
    LoanNonce,
    LoanRecord(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum FlashLoanError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    PoolNotFound = 5,
    PoolPaused = 6,
    InsufficientLiquidity = 7,
    InsufficientShares = 8,
    FlashLoanNotRepaid = 9,
    InvalidFeeBps = 10,
}

#[contractclient(name = "FlashLoanReceiverClient")]
pub trait FlashLoanReceiver {
    fn on_flash_loan(env: Env, token: Address, amount: i128, fee: i128, params: Bytes);
}

#[contract]
pub struct FlashLoanContract;

#[contractimpl]
impl FlashLoanContract {
    pub fn init(env: Env, admin: Address) -> Result<(), FlashLoanError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(FlashLoanError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    pub fn set_pool_active(
        env: Env,
        token: Address,
        is_active: bool,
    ) -> Result<(), FlashLoanError> {
        Self::require_admin(&env)?;
        let mut pool = Self::get_pool_or_default(&env, token.clone());
        pool.is_active = is_active;
        env.storage().instance().set(&DataKey::Pool(token.clone()), &pool);
        env.events().publish(
            (Symbol::new(&env, "flash_pool_status"), token),
            is_active,
        );
        Ok(())
    }

    pub fn set_fee_bps(env: Env, token: Address, fee_bps: u32) -> Result<(), FlashLoanError> {
        if fee_bps > 1000 {
            return Err(FlashLoanError::InvalidFeeBps);
        }
        Self::require_admin(&env)?;
        let mut pool = Self::get_pool_or_default(&env, token.clone());
        pool.fee_bps = fee_bps;
        env.storage().instance().set(&DataKey::Pool(token.clone()), &pool);
        env.events()
            .publish((Symbol::new(&env, "flash_fee_bps"), token), fee_bps);
        Ok(())
    }

    pub fn add_liquidity(
        env: Env,
        provider: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), FlashLoanError> {
        if amount <= 0 {
            return Err(FlashLoanError::InvalidAmount);
        }
        provider.require_auth();

        let mut pool = Self::get_pool_or_default(&env, token.clone());
        let total_shares = env
            .storage()
            .instance()
            .get::<_, i128>(&DataKey::TotalShares(token.clone()))
            .unwrap_or(0);

        let minted_shares = if total_shares == 0 || pool.liquidity == 0 {
            amount
        } else {
            (amount * total_shares) / pool.liquidity
        };

        let current_shares = env
            .storage()
            .instance()
            .get::<_, i128>(&DataKey::LpShares(token.clone(), provider.clone()))
            .unwrap_or(0);

        token::Client::new(&env, &token).transfer(&provider, &env.current_contract_address(), &amount);

        pool.liquidity += amount;
        env.storage().instance().set(&DataKey::Pool(token.clone()), &pool);
        env.storage()
            .instance()
            .set(&DataKey::TotalShares(token.clone()), &(total_shares + minted_shares));
        env.storage().instance().set(
            &DataKey::LpShares(token.clone(), provider.clone()),
            &(current_shares + minted_shares),
        );

        env.events().publish(
            (Symbol::new(&env, "flash_add_liq"), token, provider),
            (amount, minted_shares),
        );
        Ok(())
    }

    pub fn remove_liquidity(
        env: Env,
        provider: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), FlashLoanError> {
        if amount <= 0 {
            return Err(FlashLoanError::InvalidAmount);
        }
        provider.require_auth();

        let mut pool = Self::get_pool(&env, token.clone())?;
        if amount > pool.liquidity {
            return Err(FlashLoanError::InsufficientLiquidity);
        }

        let total_shares = env
            .storage()
            .instance()
            .get::<_, i128>(&DataKey::TotalShares(token.clone()))
            .unwrap_or(0);
        let provider_shares = env
            .storage()
            .instance()
            .get::<_, i128>(&DataKey::LpShares(token.clone(), provider.clone()))
            .unwrap_or(0);

        let shares_to_burn = (amount * total_shares) / pool.liquidity;
        if shares_to_burn <= 0 || provider_shares < shares_to_burn {
            return Err(FlashLoanError::InsufficientShares);
        }

        pool.liquidity -= amount;

        token::Client::new(&env, &token).transfer(&env.current_contract_address(), &provider, &amount);

        env.storage().instance().set(&DataKey::Pool(token.clone()), &pool);
        env.storage()
            .instance()
            .set(&DataKey::TotalShares(token.clone()), &(total_shares - shares_to_burn));
        env.storage().instance().set(
            &DataKey::LpShares(token.clone(), provider.clone()),
            &(provider_shares - shares_to_burn),
        );

        env.events().publish(
            (Symbol::new(&env, "flash_rem_liq"), token, provider),
            (amount, shares_to_burn),
        );
        Ok(())
    }

    pub fn flash_loan(
        env: Env,
        borrower: Address,
        token: Address,
        amount: i128,
        receiver: Address,
        params: Bytes,
    ) -> Result<(), FlashLoanError> {
        if amount <= 0 {
            return Err(FlashLoanError::InvalidAmount);
        }
        borrower.require_auth();

        let mut pool = Self::get_pool(&env, token.clone())?;
        if !pool.is_active {
            return Err(FlashLoanError::PoolPaused);
        }
        if amount > pool.liquidity {
            return Err(FlashLoanError::InsufficientLiquidity);
        }

        let token_client = token::Client::new(&env, &token);
        let pre_balance = token_client.balance(&env.current_contract_address());
        let fee = (amount * pool.fee_bps as i128) / 10_000;

        token_client.transfer(&env.current_contract_address(), &receiver, &amount);
        FlashLoanReceiverClient::new(&env, &receiver).on_flash_loan(&token, &amount, &fee, &params);

        let post_balance = token_client.balance(&env.current_contract_address());
        let required = pre_balance + fee;
        if post_balance < required {
            return Err(FlashLoanError::FlashLoanNotRepaid);
        }

        pool.total_fees_collected += fee;
        pool.liquidity += fee;
        env.storage().instance().set(&DataKey::Pool(token.clone()), &pool);

        let tx_hash = Self::next_loan_hash(&env, &borrower, &token, amount, fee);
        let record = LoanRecord {
            borrower: borrower.clone(),
            token: token.clone(),
            amount,
            fee,
            tx_hash: tx_hash.clone(),
            executed_at: env.ledger().timestamp(),
        };
        env.storage()
            .instance()
            .set(&DataKey::LoanRecord(tx_hash.clone()), &record);

        env.events().publish(
            (Symbol::new(&env, "flash_exec"), token, borrower, receiver),
            (amount, fee, tx_hash),
        );
        Ok(())
    }

    pub fn get_pool_info(env: Env, token: Address) -> Result<PoolInfo, FlashLoanError> {
        let pool = Self::get_pool(&env, token.clone())?;
        let total_shares = env
            .storage()
            .instance()
            .get::<_, i128>(&DataKey::TotalShares(token.clone()))
            .unwrap_or(0);
        Ok(PoolInfo {
            token,
            liquidity: pool.liquidity,
            fee_bps: pool.fee_bps,
            total_fees_collected: pool.total_fees_collected,
            is_active: pool.is_active,
            total_shares,
        })
    }

    fn get_pool(env: &Env, token: Address) -> Result<FlashLoanPool, FlashLoanError> {
        env.storage()
            .instance()
            .get(&DataKey::Pool(token))
            .ok_or(FlashLoanError::PoolNotFound)
    }

    fn get_pool_or_default(env: &Env, token: Address) -> FlashLoanPool {
        env.storage()
            .instance()
            .get(&DataKey::Pool(token.clone()))
            .unwrap_or(FlashLoanPool {
                token,
                liquidity: 0,
                fee_bps: 30,
                total_fees_collected: 0,
                is_active: true,
            })
    }

    fn require_admin(env: &Env) -> Result<Address, FlashLoanError> {
        let admin = env
            .storage()
            .instance()
            .get::<_, Address>(&DataKey::Admin)
            .ok_or(FlashLoanError::NotInitialized)?;
        admin.require_auth();
        Ok(admin)
    }

    fn next_loan_hash(
        env: &Env,
        borrower: &Address,
        token: &Address,
        amount: i128,
        fee: i128,
    ) -> BytesN<32> {
        let nonce = env
            .storage()
            .instance()
            .get::<_, u64>(&DataKey::LoanNonce)
            .unwrap_or(0)
            + 1;
        env.storage().instance().set(&DataKey::LoanNonce, &nonce);

        let mut bytes = [0u8; 32];
        let ts = env.ledger().timestamp();
        bytes[0..8].copy_from_slice(&nonce.to_be_bytes());
        bytes[8..16].copy_from_slice(&ts.to_be_bytes());
        bytes[16..24].copy_from_slice(&(amount as i64).to_be_bytes());
        bytes[24..32].copy_from_slice(&(fee as i64).to_be_bytes());

        let _ = borrower;
        let _ = token;
        BytesN::from_array(env, &bytes)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        contract, contractimpl,
        testutils::{Address as _, Ledger as _},
        Address, Env,
    };

    #[contract]
    struct BadReceiver;

    #[contractimpl]
    impl BadReceiver {
        pub fn on_flash_loan(_env: Env, _token: Address, _amount: i128, _fee: i128, _params: Bytes) {}
    }

    #[test]
    fn add_remove_liquidity_and_info() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let provider = Address::generate(&env);
        let token_admin = Address::generate(&env);

        let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_id = token_contract.address();
        let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
        token_admin_client.mint(&provider, &10_000);

        let contract_id = env.register_contract(None, FlashLoanContract);
        let client = FlashLoanContractClient::new(&env, &contract_id);

        client.init(&admin);
        client.add_liquidity(&provider, &token_id, &5_000);

        let pool = client.get_pool_info(&token_id);
        assert_eq!(pool.liquidity, 5_000);

        client.remove_liquidity(&provider, &token_id, &1_000);
        let pool_after = client.get_pool_info(&token_id);
        assert_eq!(pool_after.liquidity, 4_000);
    }

    #[test]
    fn flash_loan_reverts_when_not_repaid() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|l| l.timestamp = 100);

        let admin = Address::generate(&env);
        let provider = Address::generate(&env);
        let borrower = Address::generate(&env);
        let token_admin = Address::generate(&env);

        let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_id = token_contract.address();
        let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
        token_admin_client.mint(&provider, &10_000);

        let contract_id = env.register_contract(None, FlashLoanContract);
        let client = FlashLoanContractClient::new(&env, &contract_id);
        client.init(&admin);
        client.add_liquidity(&provider, &token_id, &5_000);

        let bad_receiver_addr = env.register_contract(None, BadReceiver);
        let res = client.try_flash_loan(
            &borrower,
            &token_id,
            &1_000,
            &bad_receiver_addr,
            &Bytes::new(&env),
        );
        assert!(res.is_err());
    }
}
