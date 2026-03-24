#![no_std]

use soroban_sdk::{contracterror, Address, Env, Symbol};

pub const CROSS_CONTRACT_API_VERSION: u32 = 1;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CommonError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    InsufficientBalance = 5,
    Overflow = 6,
    Underflow = 7,
    InvalidDecimals = 8,
    InvalidName = 9,
    InvalidSymbol = 10,
    Reentrancy = 11,
    RateLimited = 12,
    RegistryNotFound = 13,
    VersionMismatch = 14,
    InvalidInput = 15,
}

pub mod types {
    use super::CommonError;
    use soroban_sdk::{contracttype, Address};

    pub type SharedAddress = Address;

    #[contracttype]
    #[derive(Clone, Debug, Eq, PartialEq)]
    pub struct ConversationId(pub u64);

    impl ConversationId {
        pub fn new(value: u64) -> Result<Self, CommonError> {
            if value == 0 {
                return Err(CommonError::InvalidInput);
            }
            Ok(Self(value))
        }
    }

    #[contracttype]
    #[derive(Clone, Debug, Eq, PartialEq)]
    pub struct GroupId(pub u64);

    impl GroupId {
        pub fn new(value: u64) -> Result<Self, CommonError> {
            if value == 0 {
                return Err(CommonError::InvalidInput);
            }
            Ok(Self(value))
        }
    }

    #[contracttype]
    #[derive(Clone, Debug, Eq, PartialEq)]
    pub struct TokenAmount(pub i128);

    impl TokenAmount {
        pub fn new(value: i128) -> Result<Self, CommonError> {
            if value <= 0 {
                return Err(CommonError::InvalidAmount);
            }
            Ok(Self(value))
        }

        pub fn checked_add(&self, other: &Self) -> Result<Self, CommonError> {
            self.0
                .checked_add(other.0)
                .map(Self)
                .ok_or(CommonError::Overflow)
        }

        pub fn checked_sub(&self, other: &Self) -> Result<Self, CommonError> {
            self.0
                .checked_sub(other.0)
                .map(Self)
                .ok_or(CommonError::Underflow)
        }
    }
}

pub mod events {
    use soroban_sdk::{contracttype, Address, Symbol};

    #[contracttype]
    #[derive(Clone, Debug, Eq, PartialEq)]
    pub struct SharedEvent {
        pub topic: Symbol,
        pub actor: Address,
        pub conversation_id: u64,
        pub group_id: u64,
        pub amount: i128,
        pub version: u32,
    }
}

pub mod versioning {
    use super::CommonError;

    pub fn ensure_compatible(
        actual: u32,
        min_supported: u32,
        max_supported: u32,
    ) -> Result<(), CommonError> {
        if actual < min_supported || actual > max_supported {
            return Err(CommonError::VersionMismatch);
        }
        Ok(())
    }
}

pub mod registry {
    use super::{Address, CommonError, Env, Symbol};
    use soroban_sdk::contracttype;

    #[contracttype]
    pub enum RegistryKey {
        ContractAddress(Symbol),
        ContractVersion(Symbol),
    }

    pub fn set_contract(env: &Env, key: Symbol, address: Address, version: u32) {
        env.storage()
            .instance()
            .set(&RegistryKey::ContractAddress(key.clone()), &address);
        env.storage()
            .instance()
            .set(&RegistryKey::ContractVersion(key), &version);
    }

    pub fn get_contract(env: &Env, key: Symbol) -> Result<(Address, u32), CommonError> {
        let address: Address = env
            .storage()
            .instance()
            .get(&RegistryKey::ContractAddress(key.clone()))
            .ok_or(CommonError::RegistryNotFound)?;
        let version: u32 = env
            .storage()
            .instance()
            .get(&RegistryKey::ContractVersion(key))
            .ok_or(CommonError::RegistryNotFound)?;
        Ok((address, version))
    }
}

pub mod migration;
pub mod upgrade;

pub mod clients {
    use super::{registry, versioning, Address, CommonError, Env, Symbol};
    use soroban_sdk::{contractclient, Vec};

    #[contractclient(name = "HelloWorldContractClient")]
    pub trait HelloWorldContractClientTrait {
        fn version(env: Env) -> u32;
        fn hello(env: Env, to: Symbol) -> Vec<Symbol>;
    }

    #[contractclient(name = "WhsprTokenContractClient")]
    pub trait WhsprTokenContractClientTrait {
        fn version(env: Env) -> u32;
        fn balance(env: Env, addr: Address) -> i128;
    }

    pub fn hello_via_registry(
        env: &Env,
        registry_key: Symbol,
        to: Symbol,
        min_supported: u32,
        max_supported: u32,
    ) -> Result<Vec<Symbol>, CommonError> {
        let (address, version) = registry::get_contract(env, registry_key)?;
        versioning::ensure_compatible(version, min_supported, max_supported)?;
        let client = HelloWorldContractClient::new(env, &address);
        Ok(client.hello(&to))
    }

    pub fn token_balance_via_registry(
        env: &Env,
        registry_key: Symbol,
        owner: Address,
        min_supported: u32,
        max_supported: u32,
    ) -> Result<i128, CommonError> {
        let (address, version) = registry::get_contract(env, registry_key)?;
        versioning::ensure_compatible(version, min_supported, max_supported)?;
        let client = WhsprTokenContractClient::new(env, &address);
        Ok(client.balance(&owner))
    }
}

#[cfg(test)]
mod test {
    use super::clients::{hello_via_registry, token_balance_via_registry};
    use super::registry::{get_contract, set_contract};
    use super::types::{ConversationId, GroupId, TokenAmount};
    use super::versioning::ensure_compatible;
    use super::{CommonError, CROSS_CONTRACT_API_VERSION};
    use soroban_sdk::{
        contract, contractimpl, symbol_short, testutils::Address as _, vec, Address, Env, Symbol,
        Vec,
    };

    #[contract]
    pub struct MockHello;

    #[contractimpl]
    impl MockHello {
        pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
            vec![&env, symbol_short!("Hello"), to]
        }
    }

    #[contract]
    pub struct MockToken;

    #[contractimpl]
    impl MockToken {
        pub fn balance(_env: Env, _addr: Address) -> i128 {
            42
        }
    }

    #[contract]
    pub struct RegistryHarness;

    #[contractimpl]
    impl RegistryHarness {
        pub fn set(env: Env, key: Symbol, addr: Address, version: u32) {
            set_contract(&env, key, addr, version);
        }

        pub fn get(env: Env, key: Symbol) -> (Address, u32) {
            get_contract(&env, key).unwrap()
        }

        pub fn call_hello(env: Env, key: Symbol, to: Symbol, min: u32, max: u32) -> Vec<Symbol> {
            hello_via_registry(&env, key, to, min, max).unwrap()
        }

        pub fn call_balance(env: Env, key: Symbol, owner: Address, min: u32, max: u32) -> i128 {
            token_balance_via_registry(&env, key, owner, min, max).unwrap()
        }
    }

    #[test]
    fn test_ids_validation() {
        assert_eq!(
            ConversationId::new(0).unwrap_err(),
            CommonError::InvalidInput
        );
        assert_eq!(GroupId::new(0).unwrap_err(), CommonError::InvalidInput);
        assert_eq!(ConversationId::new(1).unwrap().0, 1);
        assert_eq!(GroupId::new(2).unwrap().0, 2);
    }

    #[test]
    fn test_token_amount_checked_math() {
        let a = TokenAmount::new(10).unwrap();
        let b = TokenAmount::new(5).unwrap();
        assert_eq!(a.checked_add(&b).unwrap().0, 15);
        assert_eq!(a.checked_sub(&b).unwrap().0, 5);
        assert_eq!(TokenAmount::new(0).unwrap_err(), CommonError::InvalidAmount);
    }

    #[test]
    fn test_registry_set_get() {
        let env = Env::default();
        let harness_id = env.register(RegistryHarness, ());
        let harness = RegistryHarnessClient::new(&env, &harness_id);
        let key = symbol_short!("hello");
        let addr = Address::generate(&env);
        harness.set(&key, &addr, &1);
        let (stored_addr, version) = harness.get(&symbol_short!("hello"));
        assert_eq!(stored_addr, addr);
        assert_eq!(version, 1);
    }

    #[test]
    fn test_version_compatibility() {
        assert!(ensure_compatible(1, 1, 2).is_ok());
        assert_eq!(
            ensure_compatible(0, 1, 2).unwrap_err(),
            CommonError::VersionMismatch
        );
        assert_eq!(
            ensure_compatible(3, 1, 2).unwrap_err(),
            CommonError::VersionMismatch
        );
    }

    #[test]
    fn test_cross_contract_hello_via_registry() {
        let env = Env::default();
        let harness_id = env.register(RegistryHarness, ());
        let harness = RegistryHarnessClient::new(&env, &harness_id);
        let hello_id = env.register(MockHello, ());
        harness.set(
            &symbol_short!("hello"),
            &hello_id,
            &CROSS_CONTRACT_API_VERSION,
        );
        let result = harness.call_hello(&symbol_short!("hello"), &symbol_short!("Dev"), &1, &1);
        assert_eq!(
            result,
            vec![&env, symbol_short!("Hello"), symbol_short!("Dev")]
        );
    }

    #[test]
    fn test_cross_contract_balance_via_registry() {
        let env = Env::default();
        let harness_id = env.register(RegistryHarness, ());
        let harness = RegistryHarnessClient::new(&env, &harness_id);
        let token_id = env.register(MockToken, ());
        let owner = Address::generate(&env);
        harness.set(
            &symbol_short!("token"),
            &token_id,
            &CROSS_CONTRACT_API_VERSION,
        );
        let balance = harness.call_balance(&symbol_short!("token"), &owner, &1, &1);
        assert_eq!(balance, 42);
    }

    #[test]
    #[should_panic(expected = "InvalidAction")]
    fn test_cross_contract_version_mismatch() {
        let env = Env::default();
        let harness_id = env.register(RegistryHarness, ());
        let harness = RegistryHarnessClient::new(&env, &harness_id);
        let hello_id = env.register(MockHello, ());
        harness.set(&symbol_short!("hello"), &hello_id, &99);
        harness.call_hello(&symbol_short!("hello"), &symbol_short!("Dev"), &1, &1);
    }
}
