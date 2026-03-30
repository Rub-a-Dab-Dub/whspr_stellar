#![allow(deprecated)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env,
};

use crate::mock_nft::MockNftContract;
use crate::mock_nft::MockNftContractClient;
use crate::{
    ContractError, ListingStatus, ListingType, NftMarketplaceContract, NftMarketplaceContractClient,
};

fn setup_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

fn deploy_marketplace(
    env: &Env,
) -> (
    Address,
    Address,
    Address,
    NftMarketplaceContractClient<'_>,
) {
    let id = env.register_contract(None, NftMarketplaceContract);
    let client = NftMarketplaceContractClient::new(env, &id);
    let admin = Address::generate(env);
    let platform = Address::generate(env);
    client.init(&admin, &platform, &250);
    (id, admin, platform, client)
}

fn deploy_mock_nft(env: &Env) -> Address {
    env.register_contract(None, MockNftContract)
}

fn mint_nft(env: &Env, nft: &Address, owner: &Address, token_id: u64) {
    let c = MockNftContractClient::new(env, nft);
    c.mint(owner, &token_id);
}

fn payment_token(env: &Env, holder: &Address) -> Address {
    let token_id = env
        .register_stellar_asset_contract_v2(holder.clone())
        .address();
    token::StellarAssetClient::new(env, &token_id).mint(holder, &100_000_000_000i128);
    token_id
}

#[test]
fn init_fails_duplicate() {
    let env = setup_env();
    let id = env.register_contract(None, NftMarketplaceContract);
    let c = NftMarketplaceContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    c.init(&admin, &platform, &250);
    let r = c.try_init(&admin, &platform, &300);
    assert_eq!(r.err(), Some(Ok(ContractError::AlreadyInitialized)));
}

#[test]
fn init_rejects_high_fee() {
    let env = setup_env();
    let id = env.register_contract(None, NftMarketplaceContract);
    let c = NftMarketplaceContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let r = c.try_init(&admin, &platform, &3000);
    assert_eq!(r.err(), Some(Ok(ContractError::InvalidFeeBps)));
}

#[test]
fn list_fixed_buy_atomic_fee_and_nft() {
    let env = setup_env();
    let (_, _admin, platform, mp) = deploy_marketplace(&env);
    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let nft = deploy_mock_nft(&env);
    mint_nft(&env, &nft, &seller, 7);
    let pay = payment_token(&env, &buyer);

    let listing_id = mp.list_fixed(&seller, &nft, &7u64, &10_000i128, &pay, &3600u64);

    mp.buy(&buyer, &listing_id);

    let listing = mp.get_listing(&listing_id);
    assert_eq!(listing.status, ListingStatus::Sold);
    assert_eq!(listing.listing_type, ListingType::Fixed);

    let nft_c = MockNftContractClient::new(&env, &nft);
    assert_eq!(nft_c.owner_of(&7u64), buyer);

    let tc = token::Client::new(&env, &pay);
    assert_eq!(tc.balance(&seller), 10_000 - 250);
    assert_eq!(tc.balance(&platform), 250);
}

#[test]
fn fixed_price_expires_returns_nft_on_next_touch() {
    let env = setup_env();
    let (_, _, _, mp) = deploy_marketplace(&env);
    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let nft = deploy_mock_nft(&env);
    mint_nft(&env, &nft, &seller, 2);
    let pay = payment_token(&env, &buyer);

    let listing_id = mp.list_fixed(&seller, &nft, &2u64, &5_000i128, &pay, &100u64);

    env.ledger().set_timestamp(env.ledger().timestamp() + 200);

    let r = mp.try_buy(&buyer, &listing_id);
    assert_eq!(r.err(), Some(Ok(ContractError::Expired)));

    mp.claim_expired(&listing_id);

    let nft_c = MockNftContractClient::new(&env, &nft);
    assert_eq!(nft_c.owner_of(&2u64), seller);

    let listing = mp.get_listing(&listing_id);
    assert_eq!(listing.status, ListingStatus::Expired);
}

#[test]
fn auction_bid_increment_enforced() {
    let env = setup_env();
    let (_, _, _, mp) = deploy_marketplace(&env);
    let seller = Address::generate(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let nft = deploy_mock_nft(&env);
    mint_nft(&env, &nft, &seller, 3);
    let pay = payment_token(&env, &a);
    token::StellarAssetClient::new(&env, &pay).mint(&b, &100_000_000_000i128);

    let listing_id = mp.list_auction(&seller, &nft, &3u64, &1_000i128, &pay, &10_000u64);

    mp.bid(&a, &listing_id, &1_000i128);
    let r = mp.try_bid(&b, &listing_id, &1_040i128);
    assert_eq!(r.err(), Some(Ok(ContractError::BidTooLow)));
    mp.bid(&b, &listing_id, &1_050i128);
}

#[test]
fn auction_bid_after_end_fails() {
    let env = setup_env();
    let (_, _, _, mp) = deploy_marketplace(&env);
    let seller = Address::generate(&env);
    let bidder = Address::generate(&env);
    let nft = deploy_mock_nft(&env);
    mint_nft(&env, &nft, &seller, 4);
    let pay = payment_token(&env, &bidder);

    let listing_id = mp.list_auction(&seller, &nft, &4u64, &500i128, &pay, &50u64);
    // One bid so the listing stays an active auction until end_time (empty auctions close via finalize/claim).
    mp.bid(&bidder, &listing_id, &500i128);

    let auc = mp.get_auction(&listing_id);
    env.ledger().set_timestamp(auc.end_time + 1);

    let r = mp.try_bid(&bidder, &listing_id, &1_000i128);
    assert_eq!(r.err(), Some(Ok(ContractError::AuctionClosed)));
}

#[test]
fn finalize_auction_pays_seller_fee_and_nft_to_winner() {
    let env = setup_env();
    let (_, _, platform, mp) = deploy_marketplace(&env);
    let seller = Address::generate(&env);
    let w = Address::generate(&env);
    let nft = deploy_mock_nft(&env);
    mint_nft(&env, &nft, &seller, 5);
    let pay = payment_token(&env, &w);

    let listing_id = mp.list_auction(&seller, &nft, &5u64, &2_000i128, &pay, &5_000u64);

    mp.bid(&w, &listing_id, &2_000i128);

    let auc = mp.get_auction(&listing_id);
    env.ledger().set_timestamp(auc.end_time);

    mp.finalize_auction(&listing_id);

    let tc = token::Client::new(&env, &pay);
    let fee = 50;
    assert_eq!(tc.balance(&seller), 2_000 - fee);
    assert_eq!(tc.balance(&platform), fee);

    let nft_c = MockNftContractClient::new(&env, &nft);
    assert_eq!(nft_c.owner_of(&5u64), w);
}

#[test]
fn cancel_auction_refunds_bidder_and_returns_nft() {
    let env = setup_env();
    let (_, _, _, mp) = deploy_marketplace(&env);
    let seller = Address::generate(&env);
    let bidder = Address::generate(&env);
    let nft = deploy_mock_nft(&env);
    mint_nft(&env, &nft, &seller, 6);
    let pay = payment_token(&env, &bidder);

    let listing_id = mp.list_auction(&seller, &nft, &6u64, &100i128, &pay, &10_000u64);

    mp.bid(&bidder, &listing_id, &500i128);
    let before = token::Client::new(&env, &pay).balance(&bidder);

    mp.cancel_listing(&seller, &listing_id);

    let after = token::Client::new(&env, &pay).balance(&bidder);
    assert_eq!(after, before + 500);

    let nft_c = MockNftContractClient::new(&env, &nft);
    assert_eq!(nft_c.owner_of(&6u64), seller);
}

#[test]
fn auction_no_bids_expires_and_returns_nft() {
    let env = setup_env();
    let (_, _, _, mp) = deploy_marketplace(&env);
    let seller = Address::generate(&env);
    let nft = deploy_mock_nft(&env);
    mint_nft(&env, &nft, &seller, 8);
    let pay = payment_token(&env, &seller);

    let listing_id = mp.list_auction(&seller, &nft, &8u64, &100i128, &pay, &30u64);

    env.ledger().set_timestamp(env.ledger().timestamp() + 100);

    mp.finalize_auction(&listing_id);

    let listing = mp.get_listing(&listing_id);
    assert_eq!(listing.status, ListingStatus::Expired);

    let nft_c = MockNftContractClient::new(&env, &nft);
    assert_eq!(nft_c.owner_of(&8u64), seller);
}

#[test]
fn buy_wrong_type_fails() {
    let env = setup_env();
    let (_, _, _, mp) = deploy_marketplace(&env);
    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let nft = deploy_mock_nft(&env);
    mint_nft(&env, &nft, &seller, 9);
    let pay = payment_token(&env, &buyer);

    let listing_id = mp.list_auction(&seller, &nft, &9u64, &100i128, &pay, &5000u64);

    let r = mp.try_buy(&buyer, &listing_id);
    assert_eq!(r.err(), Some(Ok(ContractError::WrongListingType)));
}

#[test]
fn admin_updates_fee_bps() {
    let env = setup_env();
    let (_, admin, platform, mp) = deploy_marketplace(&env);
    mp.admin_set_fee_bps(&500);

    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let nft = deploy_mock_nft(&env);
    mint_nft(&env, &nft, &seller, 10);
    let pay = payment_token(&env, &buyer);

    let listing_id = mp.list_fixed(&seller, &nft, &10u64, &10_000i128, &pay, &3600u64);
    mp.buy(&buyer, &listing_id);

    let tc = token::Client::new(&env, &pay);
    assert_eq!(tc.balance(&seller), 10_000 - 500);
    assert_eq!(tc.balance(&platform), 500);
    let _ = admin;
}

#[test]
fn outbid_refunds_previous_bidder() {
    let env = setup_env();
    let (_, _, _, mp) = deploy_marketplace(&env);
    let seller = Address::generate(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let nft = deploy_mock_nft(&env);
    mint_nft(&env, &nft, &seller, 11);
    let pay = payment_token(&env, &a);
    token::StellarAssetClient::new(&env, &pay).mint(&b, &100_000_000_000i128);

    let listing_id = mp.list_auction(&seller, &nft, &11u64, &1_000i128, &pay, &10_000u64);

    mp.bid(&a, &listing_id, &1_000i128);
    let bal_a_after_first = token::Client::new(&env, &pay).balance(&a);

    mp.bid(&b, &listing_id, &1_050i128);
    let bal_a_refunded = token::Client::new(&env, &pay).balance(&a);
    assert_eq!(bal_a_refunded, bal_a_after_first + 1_000i128);
}

#[test]
fn claim_expired_before_deadline_fails() {
    let env = setup_env();
    let (_, _, _, mp) = deploy_marketplace(&env);
    let seller = Address::generate(&env);
    let nft = deploy_mock_nft(&env);
    mint_nft(&env, &nft, &seller, 12);
    let pay = payment_token(&env, &seller);

    let listing_id = mp.list_fixed(&seller, &nft, &12u64, &1_000i128, &pay, &10_000u64);

    let r = mp.try_claim_expired(&listing_id);
    assert_eq!(r.err(), Some(Ok(ContractError::NotActive)));
}

#[test]
fn claim_expired_auction_with_bids_fails() {
    let env = setup_env();
    let (_, _, _, mp) = deploy_marketplace(&env);
    let seller = Address::generate(&env);
    let bidder = Address::generate(&env);
    let nft = deploy_mock_nft(&env);
    mint_nft(&env, &nft, &seller, 13);
    let pay = payment_token(&env, &bidder);

    let listing_id = mp.list_auction(&seller, &nft, &13u64, &100i128, &pay, &30u64);
    mp.bid(&bidder, &listing_id, &100i128);

    env.ledger().set_timestamp(env.ledger().timestamp() + 100);

    let r = mp.try_claim_expired(&listing_id);
    assert_eq!(r.err(), Some(Ok(ContractError::AuctionHasBids)));
}
