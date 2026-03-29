#![no_std]
#![allow(clippy::too_many_arguments)]

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, token, Address, BytesN, Env,
    Symbol,
};

/// Default platform fee: 2.5%
pub const DEFAULT_FEE_BPS: u32 = 250;
pub const BPS_DENOM: i128 = 10_000;
/// Default minimum bid step: 5% of current highest (at least 1 stroop)
pub const DEFAULT_MIN_BID_INCREMENT_BPS: u32 = 500;

#[contractclient(name = "NftClient")]
pub trait NftContractInterface {
    fn transfer(env: Env, from: Address, to: Address, token_id: u64);
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ListingType {
    Fixed,
    Auction,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ListingStatus {
    Active,
    Sold,
    Cancelled,
    Expired,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Listing {
    pub seller: Address,
    pub nft_contract: Address,
    pub token_id: u64,
    /// Fixed: sale price. Auction: starting / reserve price.
    pub price: i128,
    pub payment_token: Address,
    pub listing_type: ListingType,
    pub expires_at: u64,
    pub status: ListingStatus,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct AuctionData {
    pub listing_id: BytesN<32>,
    pub highest_bidder: Option<Address>,
    pub highest_bid: i128,
    pub bid_count: u32,
    pub end_time: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    PlatformRecipient,
    FeeBps,
    MinBidIncrementBps,
    ListingNonce,
    Listing(BytesN<32>),
    Auction(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ContractError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    ListingNotFound = 3,
    NotActive = 4,
    Unauthorized = 5,
    InvalidAmount = 6,
    WrongListingType = 7,
    BidTooLow = 8,
    AuctionNotEnded = 9,
    NoBidsToFinalize = 10,
    InvalidFeeBps = 11,
    Overflow = 12,
    Expired = 13,
    AuctionClosed = 14,
    /// Auction has bids; use `finalize_auction` instead of `claim_expired`.
    AuctionHasBids = 15,
}

#[contract]
pub struct NftMarketplaceContract;

impl NftMarketplaceContract {
    fn assert_init(env: &Env) -> Result<(), ContractError> {
        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::NotInitialized);
        }
        Ok(())
    }

    fn admin(env: &Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
    }

    fn platform_recipient(env: &Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::PlatformRecipient)
            .ok_or(ContractError::NotInitialized)
    }

    fn fee_bps(env: &Env) -> Result<u32, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::FeeBps)
            .ok_or(ContractError::NotInitialized)
    }

    fn min_bid_increment_bps(env: &Env) -> Result<u32, ContractError> {
        Ok(env
            .storage()
            .instance()
            .get(&DataKey::MinBidIncrementBps)
            .unwrap_or(DEFAULT_MIN_BID_INCREMENT_BPS))
    }

    fn allocate_listing_id(env: &Env) -> Result<BytesN<32>, ContractError> {
        let mut n: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ListingNonce)
            .unwrap_or(0);
        n = n.checked_add(1).ok_or(ContractError::Overflow)?;
        env.storage().instance().set(&DataKey::ListingNonce, &n);
        let seq = env.ledger().sequence();
        let mut arr = [0u8; 32];
        for (i, b) in n.to_be_bytes().iter().enumerate() {
            arr[24 + i] = *b;
        }
        for (i, b) in seq.to_be_bytes().iter().enumerate() {
            arr[16 + i] = *b;
        }
        Ok(BytesN::from_array(env, &arr))
    }

    fn load_listing(env: &Env, listing_id: &BytesN<32>) -> Result<Listing, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Listing(listing_id.clone()))
            .ok_or(ContractError::ListingNotFound)
    }

    fn save_listing(env: &Env, listing_id: &BytesN<32>, listing: &Listing) {
        env.storage()
            .persistent()
            .set(&DataKey::Listing(listing_id.clone()), listing);
    }

    fn min_next_bid(env: &Env, listing: &Listing, auction: &AuctionData) -> Result<i128, ContractError> {
        let inc_bps = Self::min_bid_increment_bps(env)? as i128;
        if auction.bid_count == 0 {
            if listing.price <= 0 {
                return Err(ContractError::InvalidAmount);
            }
            return Ok(listing.price);
        }
        let step = auction
            .highest_bid
            .checked_mul(inc_bps)
            .ok_or(ContractError::Overflow)?
            .checked_div(BPS_DENOM)
            .ok_or(ContractError::Overflow)?;
        let step = step.max(1);
        auction
            .highest_bid
            .checked_add(step)
            .ok_or(ContractError::Overflow)
    }

    /// Return NFT to seller for expired **fixed** listings, or expired **empty** auctions.
    /// Does nothing useful if auction has bids (use `finalize_auction`). Returns `Ok` only when state is committed.
    fn execute_expiry_settlement(env: &Env, listing_id: &BytesN<32>) -> Result<(), ContractError> {
        let mut listing = Self::load_listing(env, listing_id)?;
        if listing.status != ListingStatus::Active {
            return Err(ContractError::NotActive);
        }
        let now = env.ledger().timestamp();
        if now <= listing.expires_at {
            return Err(ContractError::NotActive);
        }

        if listing.listing_type == ListingType::Auction {
            if let Some(auction) = env
                .storage()
                .persistent()
                .get::<_, AuctionData>(&DataKey::Auction(listing_id.clone()))
            {
                if auction.bid_count > 0 {
                    return Err(ContractError::AuctionHasBids);
                }
                env.storage()
                    .persistent()
                    .remove(&DataKey::Auction(listing_id.clone()));
            }
        }

        let mp = env.current_contract_address();
        let nft = NftClient::new(env, &listing.nft_contract);
        nft.transfer(&mp, &listing.seller, &listing.token_id);

        listing.status = ListingStatus::Expired;
        Self::save_listing(env, listing_id, &listing);

        env.events().publish(
            (
                Symbol::new(env, "listing_expired"),
                listing_id.clone(),
            ),
            (listing.seller.clone(), listing.token_id, now),
        );

        Ok(())
    }

    fn platform_fee(amount: i128, fee_bps: u32) -> Result<i128, ContractError> {
        if amount <= 0 {
            return Ok(0);
        }
        let fee = (amount as i128)
            .checked_mul(fee_bps as i128)
            .ok_or(ContractError::Overflow)?
            .checked_div(BPS_DENOM)
            .ok_or(ContractError::Overflow)?;
        Ok(fee)
    }
}

#[contractimpl]
impl NftMarketplaceContract {
    /// One-time setup: admin, fee recipient, fee in basis points (10000 = 100%). Max 2500 (25%).
    pub fn init(
        env: Env,
        admin: Address,
        platform_recipient: Address,
        fee_bps: u32,
    ) -> Result<(), ContractError> {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        if fee_bps > 2500 {
            return Err(ContractError::InvalidFeeBps);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::PlatformRecipient, &platform_recipient);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage()
            .instance()
            .set(&DataKey::MinBidIncrementBps, &DEFAULT_MIN_BID_INCREMENT_BPS);
        env.storage().instance().set(&DataKey::ListingNonce, &0u64);
        Ok(())
    }

    pub fn admin_set_fee_bps(env: Env, new_fee_bps: u32) -> Result<(), ContractError> {
        let a = Self::admin(&env)?;
        a.require_auth();
        if new_fee_bps > 2500 {
            return Err(ContractError::InvalidFeeBps);
        }
        env.storage().instance().set(&DataKey::FeeBps, &new_fee_bps);
        Ok(())
    }

    pub fn admin_set_min_bid_increment_bps(env: Env, bps: u32) -> Result<(), ContractError> {
        let a = Self::admin(&env)?;
        a.require_auth();
        if bps > 10_000 {
            return Err(ContractError::InvalidFeeBps);
        }
        env.storage()
            .instance()
            .set(&DataKey::MinBidIncrementBps, &bps);
        Ok(())
    }

    pub fn get_listing(env: Env, listing_id: BytesN<32>) -> Result<Listing, ContractError> {
        Self::assert_init(&env)?;
        Self::load_listing(&env, &listing_id)
    }

    pub fn get_auction(env: Env, listing_id: BytesN<32>) -> Result<AuctionData, ContractError> {
        Self::assert_init(&env)?;
        env.storage()
            .persistent()
            .get(&DataKey::Auction(listing_id))
            .ok_or(ContractError::ListingNotFound)
    }

    /// Permissionless: after `expires_at`, return escrowed NFT to seller for fixed listings or empty auctions.
    /// Auctions with bids must use `finalize_auction` (or seller `cancel_listing`).
    pub fn claim_expired(env: Env, listing_id: BytesN<32>) -> Result<(), ContractError> {
        Self::assert_init(&env)?;
        Self::execute_expiry_settlement(&env, &listing_id)
    }

    /// Escrow NFT from seller into the marketplace until sold, cancelled, or expired.
    pub fn list_fixed(
        env: Env,
        seller: Address,
        nft: Address,
        token_id: u64,
        price: i128,
        payment_token: Address,
        duration: u64,
    ) -> Result<BytesN<32>, ContractError> {
        Self::assert_init(&env)?;
        seller.require_auth();
        if price <= 0 {
            return Err(ContractError::InvalidAmount);
        }
        if duration == 0 {
            return Err(ContractError::InvalidAmount);
        }

        let listing_id = Self::allocate_listing_id(&env)?;
        let mp = env.current_contract_address();
        let nft_client = NftClient::new(&env, &nft);
        nft_client.transfer(&seller, &mp, &token_id);

        let now = env.ledger().timestamp();
        let expires_at = now.checked_add(duration).ok_or(ContractError::Overflow)?;

        let listing = Listing {
            seller: seller.clone(),
            nft_contract: nft,
            token_id,
            price,
            payment_token,
            listing_type: ListingType::Fixed,
            expires_at,
            status: ListingStatus::Active,
        };
        Self::save_listing(&env, &listing_id, &listing);

        env.events().publish(
            (Symbol::new(&env, "listed_fixed"), listing_id.clone()),
            (
                seller.clone(),
                listing.nft_contract.clone(),
                token_id,
                price,
                listing.payment_token.clone(),
                expires_at,
            ),
        );

        Ok(listing_id)
    }

    pub fn list_auction(
        env: Env,
        seller: Address,
        nft: Address,
        token_id: u64,
        start_price: i128,
        payment_token: Address,
        duration: u64,
    ) -> Result<BytesN<32>, ContractError> {
        Self::assert_init(&env)?;
        seller.require_auth();
        if start_price <= 0 {
            return Err(ContractError::InvalidAmount);
        }
        if duration == 0 {
            return Err(ContractError::InvalidAmount);
        }

        let listing_id = Self::allocate_listing_id(&env)?;
        let mp = env.current_contract_address();
        let nft_client = NftClient::new(&env, &nft);
        nft_client.transfer(&seller, &mp, &token_id);

        let now = env.ledger().timestamp();
        let expires_at = now.checked_add(duration).ok_or(ContractError::Overflow)?;

        let listing = Listing {
            seller: seller.clone(),
            nft_contract: nft,
            token_id,
            price: start_price,
            payment_token,
            listing_type: ListingType::Auction,
            expires_at,
            status: ListingStatus::Active,
        };
        Self::save_listing(&env, &listing_id, &listing);

        let auction = AuctionData {
            listing_id: listing_id.clone(),
            highest_bidder: None,
            highest_bid: 0,
            bid_count: 0,
            end_time: expires_at,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Auction(listing_id.clone()), &auction);

        env.events().publish(
            (Symbol::new(&env, "listed_auction"), listing_id.clone()),
            (
                seller.clone(),
                listing.nft_contract.clone(),
                token_id,
                start_price,
                listing.payment_token.clone(),
                expires_at,
            ),
        );

        Ok(listing_id)
    }

    /// Fixed-price buy: one atomic balance movement — buyer pays, fee split, NFT to buyer.
    pub fn buy(env: Env, buyer: Address, listing_id: BytesN<32>) -> Result<(), ContractError> {
        Self::assert_init(&env)?;
        buyer.require_auth();

        let mut listing = Self::load_listing(&env, &listing_id)?;
        if listing.status != ListingStatus::Active {
            return Err(ContractError::NotActive);
        }
        if listing.listing_type != ListingType::Fixed {
            return Err(ContractError::WrongListingType);
        }
        if env.ledger().timestamp() > listing.expires_at {
            return Err(ContractError::Expired);
        }

        let price = listing.price;
        let fee_bps = Self::fee_bps(&env)?;
        let fee = Self::platform_fee(price, fee_bps)?;
        let seller_net = price
            .checked_sub(fee)
            .ok_or(ContractError::Overflow)?;

        let mp = env.current_contract_address();
        let pay = token::Client::new(&env, &listing.payment_token);
        pay.transfer(&buyer, &mp, &price);

        pay.transfer(&mp, &listing.seller, &seller_net);
        if fee > 0 {
            let plat = Self::platform_recipient(&env)?;
            pay.transfer(&mp, &plat, &fee);
        }

        let nft = NftClient::new(&env, &listing.nft_contract);
        nft.transfer(&mp, &buyer, &listing.token_id);

        listing.status = ListingStatus::Sold;
        Self::save_listing(&env, &listing_id, &listing);

        env.events().publish(
            (Symbol::new(&env, "bought"), listing_id.clone()),
            (buyer, listing.seller, price, fee, listing.token_id),
        );

        Ok(())
    }

    pub fn bid(
        env: Env,
        bidder: Address,
        listing_id: BytesN<32>,
        amount: i128,
    ) -> Result<(), ContractError> {
        Self::assert_init(&env)?;
        bidder.require_auth();

        let listing = Self::load_listing(&env, &listing_id)?;
        if listing.status != ListingStatus::Active {
            return Err(ContractError::NotActive);
        }
        if listing.listing_type != ListingType::Auction {
            return Err(ContractError::WrongListingType);
        }

        let mut auction: AuctionData = env
            .storage()
            .persistent()
            .get(&DataKey::Auction(listing_id.clone()))
            .ok_or(ContractError::ListingNotFound)?;

        if env.ledger().timestamp() >= auction.end_time {
            return Err(ContractError::AuctionClosed);
        }

        let min = Self::min_next_bid(&env, &listing, &auction)?;
        if amount < min {
            return Err(ContractError::BidTooLow);
        }

        let mp = env.current_contract_address();
        let pay = token::Client::new(&env, &listing.payment_token);

        if auction.bid_count > 0 {
            if let Some(ref prev) = auction.highest_bidder {
                pay.transfer(&mp, prev, &auction.highest_bid);
            }
        }

        pay.transfer(&bidder, &mp, &amount);

        auction.highest_bidder = Some(bidder.clone());
        auction.highest_bid = amount;
        auction.bid_count = auction
            .bid_count
            .checked_add(1)
            .ok_or(ContractError::Overflow)?;

        env.storage()
            .persistent()
            .set(&DataKey::Auction(listing_id.clone()), &auction);

        env.events().publish(
            (Symbol::new(&env, "bid"), listing_id.clone()),
            (bidder, amount, auction.bid_count),
        );

        Ok(())
    }

    /// After `end_time`, settle auction: NFT to winner, proceeds to seller minus platform fee.
    pub fn finalize_auction(env: Env, listing_id: BytesN<32>) -> Result<(), ContractError> {
        Self::assert_init(&env)?;

        let mut listing = Self::load_listing(&env, &listing_id)?;
        if listing.status != ListingStatus::Active {
            return Err(ContractError::NotActive);
        }
        if listing.listing_type != ListingType::Auction {
            return Err(ContractError::WrongListingType);
        }

        let now = env.ledger().timestamp();
        let auction: AuctionData = env
            .storage()
            .persistent()
            .get(&DataKey::Auction(listing_id.clone()))
            .ok_or(ContractError::ListingNotFound)?;

        if now < auction.end_time {
            return Err(ContractError::AuctionNotEnded);
        }
        if auction.bid_count == 0 {
            let mp = env.current_contract_address();
            let nft = NftClient::new(&env, &listing.nft_contract);
            nft.transfer(&mp, &listing.seller, &listing.token_id);
            env.storage()
                .persistent()
                .remove(&DataKey::Auction(listing_id.clone()));
            listing.status = ListingStatus::Expired;
            Self::save_listing(&env, &listing_id, &listing);
            env.events().publish(
                (
                    Symbol::new(&env, "auction_finalized_no_bids"),
                    listing_id.clone(),
                ),
                (listing.seller.clone(), listing.token_id, now),
            );
            return Ok(());
        }
        let winner = auction
            .highest_bidder
            .clone()
            .ok_or(ContractError::NoBidsToFinalize)?;

        let amount = auction.highest_bid;
        let fee_bps = Self::fee_bps(&env)?;
        let fee = Self::platform_fee(amount, fee_bps)?;
        let seller_net = amount
            .checked_sub(fee)
            .ok_or(ContractError::Overflow)?;

        let mp = env.current_contract_address();
        let pay = token::Client::new(&env, &listing.payment_token);
        pay.transfer(&mp, &listing.seller, &seller_net);
        if fee > 0 {
            let plat = Self::platform_recipient(&env)?;
            pay.transfer(&mp, &plat, &fee);
        }

        let nft = NftClient::new(&env, &listing.nft_contract);
        nft.transfer(&mp, &winner, &listing.token_id);

        listing.status = ListingStatus::Sold;
        Self::save_listing(&env, &listing_id, &listing);
        env.storage()
            .persistent()
            .remove(&DataKey::Auction(listing_id.clone()));

        env.events().publish(
            (Symbol::new(&env, "auction_finalized"), listing_id.clone()),
            (winner, listing.seller, amount, fee),
        );

        Ok(())
    }

    /// Seller cancels. Refunds top auction bid if any; returns NFT to seller.
    pub fn cancel_listing(env: Env, seller: Address, listing_id: BytesN<32>) -> Result<(), ContractError> {
        Self::assert_init(&env)?;
        seller.require_auth();

        let mut listing = Self::load_listing(&env, &listing_id)?;
        if listing.status != ListingStatus::Active {
            return Err(ContractError::NotActive);
        }
        if listing.seller != seller {
            return Err(ContractError::Unauthorized);
        }

        let mp = env.current_contract_address();

        if listing.listing_type == ListingType::Auction {
            if let Some(auction) = env
                .storage()
                .persistent()
                .get::<_, AuctionData>(&DataKey::Auction(listing_id.clone()))
            {
                if auction.bid_count > 0 {
                    if let Some(ref bidder) = auction.highest_bidder {
                        let pay = token::Client::new(&env, &listing.payment_token);
                        pay.transfer(&mp, bidder, &auction.highest_bid);
                    }
                }
                env.storage()
                    .persistent()
                    .remove(&DataKey::Auction(listing_id.clone()));
            }
        }

        let nft = NftClient::new(&env, &listing.nft_contract);
        nft.transfer(&mp, &seller, &listing.token_id);

        listing.status = ListingStatus::Cancelled;
        Self::save_listing(&env, &listing_id, &listing);

        env.events().publish(
            (Symbol::new(&env, "listing_cancelled"), listing_id.clone()),
            (seller, listing.token_id),
        );

        Ok(())
    }
}

#[cfg(test)]
mod mock_nft;
#[cfg(test)]
mod test;
