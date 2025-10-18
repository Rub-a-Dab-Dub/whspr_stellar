use starknet::ContractAddress;
#[derive(Drop, Serde, PartialEq, starknet::Store)]
pub struct UserProfile {
    pub username: felt252,
    pub user_wallet: ContractAddress,
    pub exists: bool,
}

#[starknet::contract]
mod GaslessGossipPayments {
    use core::num::traits::Zero;
    use gg_pay::interface::IGGPay;
    use gg_pay::wallet::{IWalletDispatcher, IWalletDispatcherTrait};
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::class_hash::ClassHash;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::syscalls::deploy_syscall;
    use starknet::{
        ContractAddress, SyscallResultTrait, contract_address_const, get_block_timestamp,
        get_caller_address, get_contract_address,
    };
    use super::UserProfile;
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    // ==================== STORAGE ====================

    #[storage]
    struct Storage {
        strk_token: ContractAddress,
        platform_fee_bps: u16, // Fee for all paid actions (200 = 2%)
        accumulated_fees: u256,
        wallet_class_hash: ClassHash,
        paymaster_address: ContractAddress,
        is_user_registered: Map<felt252, bool>,
        user_profiles: Map<felt252, UserProfile>,
        wallet_to_username: Map<ContractAddress, felt252>,
        paused: bool,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
    }

    // ==================== EVENTS ====================

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        TipSent: TipSent,
        RoomEntryPaid: RoomEntryPaid,
        TokensSent: TokensSent,
        FeesWithdrawn: FeesWithdrawn,
        PlatformFeeUpdated: PlatformFeeUpdated,
        ContractPaused: ContractPaused,
        UserRegistered: UserRegistered,
        UsernameUpdated: UsernameUpdated,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
    }


    #[derive(Drop, starknet::Event)]
    struct UserRegistered {
        username: felt252,
        wallet_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct UsernameUpdated {
        old_username: felt252,
        new_username: felt252,
        wallet_address: ContractAddress,
    }


    #[derive(Drop, starknet::Event)]
    pub struct TipSent {
        pub sender: ContractAddress,
        pub recipient: ContractAddress,
        pub amount: u256,
        pub platform_fee: u256,
        pub net_amount: u256,
        pub context: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RoomEntryPaid {
        pub user: ContractAddress,
        pub room_id: u256,
        pub room_creator: ContractAddress,
        pub entry_fee: u256,
        pub platform_fee: u256,
        pub creator_amount: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TokensSent {
        pub sender: ContractAddress,
        pub recipient: ContractAddress,
        pub amount: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct FeesWithdrawn {
        pub recipient: ContractAddress,
        pub amount: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PlatformFeeUpdated {
        pub old_fee_bps: u16,
        pub new_fee_bps: u16,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ContractPaused {
        pub paused: bool,
        pub timestamp: u64,
    }

    // ==================== ERRORS ====================

    mod Errors {
        pub const ZERO_ADDRESS: felt252 = 'Zero address not allowed';
        pub const SELF_TIP: felt252 = 'Cannot tip yourself';
        pub const SELF_SEND: felt252 = 'Cannot send to yourself';
        pub const ZERO_AMOUNT: felt252 = 'Amount must be positive';
        pub const CONTRACT_PAUSED: felt252 = 'Contract is paused';
        pub const INVALID_FEE: felt252 = 'Fee must be <= 1000 (10%)';
        pub const INSUFFICIENT_FEES: felt252 = 'Insufficient fees';
    }

    // ==================== CONSTRUCTOR ====================

    #[constructor]
    fn constructor(
        ref self: ContractState,
        admin: ContractAddress,
        strk_token: ContractAddress,
        platform_fee_bps: u16,
        wallet_class_hash: ClassHash,
    ) {
        assert(!admin.is_zero(), Errors::ZERO_ADDRESS);
        assert(!strk_token.is_zero(), Errors::ZERO_ADDRESS);
        assert(platform_fee_bps <= 1000, Errors::INVALID_FEE);

        self.ownable.initializer(admin);
        self.strk_token.write(strk_token);
        self.platform_fee_bps.write(platform_fee_bps);
        self.paused.write(false);
        self.wallet_class_hash.write(wallet_class_hash);
        self.paymaster_address.write(admin);
    }

    // ==================== EXTERNAL FUNCTIONS ====================

    #[abi(embed_v0)]
    impl GaslessGossipPaymentsImpl of IGGPay<ContractState> {
        fn tip_user(
            ref self: ContractState, recipient: ContractAddress, amount: u256, context: felt252,
        ) {
            self.assert_not_paused();
            let sender = get_caller_address();

            assert(!sender.is_zero(), Errors::ZERO_ADDRESS);
            assert(!recipient.is_zero(), Errors::ZERO_ADDRESS);
            assert(sender != recipient, Errors::SELF_TIP);
            assert(amount > 0, Errors::ZERO_AMOUNT);

            // Calculate platform fee (2%)
            let fee_bps: u256 = self.platform_fee_bps.read().into();
            let platform_fee = (amount * fee_bps) / 10000;
            let net_amount = amount - platform_fee;

            // Accumulate platform fees
            let current_fees = self.accumulated_fees.read();
            self.accumulated_fees.write(current_fees + platform_fee);

            // Transfer tokens
            let strk = IERC20Dispatcher { contract_address: self.strk_token.read() };
            let contract_addr = get_contract_address();

            // From sender to contract
            strk.transfer_from(sender, contract_addr, amount);

            // From contract to recipient
            strk.transfer(recipient, net_amount);

            // Emit event
            self
                .emit(
                    TipSent {
                        sender,
                        recipient,
                        amount,
                        platform_fee,
                        net_amount,
                        context,
                        timestamp: get_block_timestamp(),
                    },
                );
        }

        fn pay_room_entry(
            ref self: ContractState, room_id: u256, room_creator: ContractAddress, entry_fee: u256,
        ) {
            self.assert_not_paused();
            let user = get_caller_address();

            assert(!user.is_zero(), Errors::ZERO_ADDRESS);
            assert(!room_creator.is_zero(), Errors::ZERO_ADDRESS);
            assert(entry_fee > 0, Errors::ZERO_AMOUNT);

            // Calculate platform fee (2%)
            let fee_bps: u256 = self.platform_fee_bps.read().into();
            let platform_fee = (entry_fee * fee_bps) / 10000;

            // Creator gets the rest (98%)
            let creator_amount = entry_fee - platform_fee;

            // Accumulate platform fees
            let current_fees = self.accumulated_fees.read();
            self.accumulated_fees.write(current_fees + platform_fee);

            // Transfer tokens
            let strk = IERC20Dispatcher { contract_address: self.strk_token.read() };
            let contract_addr = get_contract_address();

            // From user to contract (full entry fee)
            strk.transfer_from(user, contract_addr, entry_fee);

            // From contract to room creator
            strk.transfer(room_creator, creator_amount);

            // Emit event
            self
                .emit(
                    RoomEntryPaid {
                        user,
                        room_id,
                        room_creator,
                        entry_fee,
                        platform_fee,
                        creator_amount,
                        timestamp: get_block_timestamp(),
                    },
                );
        }

        fn send_tokens(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            self.assert_not_paused();
            let sender = get_caller_address();

            assert(!sender.is_zero(), Errors::ZERO_ADDRESS);
            assert(!recipient.is_zero(), Errors::ZERO_ADDRESS);
            assert(sender != recipient, Errors::SELF_SEND);
            assert(amount > 0, Errors::ZERO_AMOUNT);

            // Direct transfer - NO FEES
            let strk = IERC20Dispatcher { contract_address: self.strk_token.read() };
            strk.transfer_from(sender, recipient, amount);

            // Emit event
            self.emit(TokensSent { sender, recipient, amount, timestamp: get_block_timestamp() });
        }

        fn withdraw_fees(ref self: ContractState, amount: u256, recipient: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(amount > 0, Errors::ZERO_AMOUNT);
            assert(!recipient.is_zero(), Errors::ZERO_ADDRESS);

            let current_fees = self.accumulated_fees.read();
            assert(amount <= current_fees, Errors::INSUFFICIENT_FEES);

            // Update accumulated fees
            self.accumulated_fees.write(current_fees - amount);

            // Transfer to recipient
            let strk = IERC20Dispatcher { contract_address: self.strk_token.read() };
            strk.transfer(recipient, amount);

            // Emit event
            self.emit(FeesWithdrawn { recipient, amount, timestamp: get_block_timestamp() });
        }

        fn set_platform_fee(ref self: ContractState, fee_bps: u16) {
            self.ownable.assert_only_owner();
            assert(fee_bps <= 1000, Errors::INVALID_FEE);

            let old_fee = self.platform_fee_bps.read();
            self.platform_fee_bps.write(fee_bps);

            self
                .emit(
                    PlatformFeeUpdated {
                        old_fee_bps: old_fee,
                        new_fee_bps: fee_bps,
                        timestamp: get_block_timestamp(),
                    },
                );
        }

        fn create_user(ref self: ContractState, username: felt252) -> ContractAddress {
            // let caller = get_caller_address();
            // assert(caller == self.paymaster_address.read(), 'Only Paymaster can call this');
            assert(username != 0, 'Invalid username');
            let zero_address: ContractAddress = contract_address_const::<'0x0'>();
            let is_registered = self.is_user_registered.read(username);
            assert(!is_registered, 'username already taken');
            self.is_user_registered.write(username, true);

            let paymaster_address = get_caller_address();
            assert(paymaster_address != zero_address, 'Invalid owner address');

            let wallet_class_hash = self.wallet_class_hash.read();

            let mut wallet_constructor_calldata = array![paymaster_address.into()];
            let salt: felt252 = get_block_timestamp().into();
            let (wallet_address, _) = deploy_syscall(
                wallet_class_hash, salt, wallet_constructor_calldata.span(), true,
            )
                .unwrap_syscall();
            assert(wallet_address != zero_address, 'Wallet deployment failed');

            let user_profile = UserProfile { username, user_wallet: wallet_address, exists: true };
            self.user_profiles.write(username, user_profile);
            self.wallet_to_username.write(wallet_address, username);
            self.emit(UserRegistered { username, wallet_address });

            wallet_address
        }

        fn update_username(ref self: ContractState, old_username: felt252, new_username: felt252) {
            let caller = get_caller_address();
            assert(caller == self.paymaster_address.read(), 'Only Paymaster can call this');
            //Read existing profile
            let old_user = self.user_profiles.read(old_username);
            assert(old_user.exists, 'Old username does not exist');

            //Prevent using a taken or same username
            let is_new_username_taken = self.is_user_registered.read(new_username);
            assert(!is_new_username_taken, 'New username already taken');
            assert(old_username != new_username, 'New username must be different');

            //Update registration mapping
            self.is_user_registered.write(old_username, false);
            self.is_user_registered.write(new_username, true);

            //Create new profile under new username
            let updated_user = UserProfile {
                username: new_username, user_wallet: old_user.user_wallet, exists: true,
            };
            self.user_profiles.write(new_username, updated_user);
            self.wallet_to_username.write(old_user.user_wallet, new_username);

            //Clear old profile completely (optional: exists = false)
            self
                .user_profiles
                .write(
                    old_username,
                    UserProfile {
                        username: old_username, user_wallet: old_user.user_wallet, exists: false,
                    },
                );

            // Emit event with wallet address
            self
                .emit(
                    UsernameUpdated {
                        old_username, new_username, wallet_address: old_user.user_wallet,
                    },
                );
        }

        fn withdraw_from_userwallet(
            ref self: ContractState,
            token: ContractAddress,
            username: felt252,
            recipient_address: ContractAddress,
            amount: u256,
        ) {
            let zero_address: ContractAddress = contract_address_const::<'0x0'>();
            let caller = get_caller_address();
            assert(caller == self.paymaster_address.read(), 'Only Paymaster can call this');
            assert(username != 0, 'Invalid username');
            assert(token != zero_address, 'Invalid token address');
            assert(recipient_address != zero_address, 'Invalid recipient address');
            assert(amount > 0, 'Amount must be positive');

            let user_profile = self.user_profiles.read(username);
            assert(user_profile.exists, 'Tag not registered');

            let wallet_dispatcher = IWalletDispatcher {
                contract_address: user_profile.user_wallet,
            };
            let wallet_balance = IERC20Dispatcher { contract_address: token }
                .balance_of(user_profile.user_wallet);
            assert(wallet_balance >= amount, 'Insufficient wallet balance');

            let success = wallet_dispatcher.withdraw(token, recipient_address, amount);
            assert(success, 'Wallet withdrawal failed');
        }


        fn set_paused(ref self: ContractState, paused: bool) {
            self.ownable.assert_only_owner();
            self.paused.write(paused);

            self.emit(ContractPaused { paused, timestamp: get_block_timestamp() });
        }

        fn get_platform_fee(self: @ContractState) -> u16 {
            self.platform_fee_bps.read()
        }

        fn get_accumulated_fees(self: @ContractState) -> u256 {
            self.accumulated_fees.read()
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }

        fn get_user_balance(self: @ContractState, user: ContractAddress) -> u256 {
            let strk = IERC20Dispatcher { contract_address: self.strk_token.read() };
            strk.balance_of(user)
        }

        fn get_balance(self: @ContractState) -> u256 {
            self.get_user_balance(get_caller_address())
        }

        fn get_user_onchain_address(self: @ContractState, username: felt252) -> ContractAddress {
            let user_profile = self.user_profiles.read(username);
            assert(user_profile.exists, 'Username does not exist');
            user_profile.user_wallet
        }

        fn get_username_by_wallet(self: @ContractState, wallet: ContractAddress) -> felt252 {
            let username = self.wallet_to_username.read(wallet);
            assert(username != 0, 'No username found for wallet');
            username
        }
    }

    // ==================== INTERNAL FUNCTIONS ====================

    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        fn assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), Errors::CONTRACT_PAUSED);
        }
    }
}
