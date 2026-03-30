#![no_std]
#![allow(clippy::too_many_arguments)]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Bytes, BytesN, Env, Symbol,
};

/// Domain-separated commitment: binds viewing key (ed25519 pubkey) to note economics.
const DOM_COMMIT: &[u8] = b"PV1/COMMIT";
/// Nullifier derivation: unique per (pubkey, commitment).
const DOM_NULL: &[u8] = b"PV1/NULL";
const DOM_WITHDRAW: &[u8] = b"PV1/WITHDRAW";
const DOM_TRANSFER: &[u8] = b"PV1/TRANSFER";

/// Fixed layout: commitment (32) || ed25519 pubkey (32) || signature (64).
pub const PROOF_LEN: u32 = 128;

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct NoteRecord {
    pub owner: Address,
    pub commitment: BytesN<32>,
    /// Placeholder at deposit; logical nullifier is `derive_nullifier(pk, commitment)`.
    pub nullifier: BytesN<32>,
    pub is_spent: bool,
    pub created_at: u64,
    pub token: Address,
    pub amount: i128,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Note(BytesN<32>),
    Spent(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ContractError {
    NoteNotFound = 1,
    AlreadySpent = 2,
    InvalidProof = 3,
    ProofLength = 4,
    NullifierReuse = 5,
    CommitmentMismatch = 6,
    AmountMismatch = 7,
    CommitmentAlreadyExists = 8,
}

#[contract]
pub struct PrivatePaymentsContract;

fn append_address_strkey(_env: &Env, buf: &mut Bytes, addr: &Address) {
    let s = addr.to_string();
    let n = s.len() as usize;
    if n > 96 {
        panic!();
    }
    let mut tmp = [0u8; 96];
    s.copy_into_slice(&mut tmp[..n]);
    buf.extend_from_slice(&tmp[..n]);
}

fn append_bytes32(buf: &mut Bytes, x: &BytesN<32>) {
    let a = x.to_array();
    buf.extend_from_slice(&a);
}

pub(crate) fn build_commit_preimage(
    env: &Env,
    pubkey: &BytesN<32>,
    token: &Address,
    amount: i128,
    owner: &Address,
) -> Bytes {
    let mut b = Bytes::new(env);
    b.extend_from_slice(DOM_COMMIT);
    append_bytes32(&mut b, pubkey);
    append_address_strkey(env, &mut b, token);
    b.extend_from_slice(&amount.to_be_bytes());
    append_address_strkey(env, &mut b, owner);
    b
}

pub(crate) fn expected_commitment(
    env: &Env,
    pubkey: &BytesN<32>,
    token: &Address,
    amount: i128,
    owner: &Address,
) -> BytesN<32> {
    let pre = build_commit_preimage(env, pubkey, token, amount, owner);
    env.crypto().sha256(&pre).to_bytes()
}

pub(crate) fn derive_nullifier(
    env: &Env,
    pubkey: &BytesN<32>,
    commitment: &BytesN<32>,
) -> BytesN<32> {
    let mut b = Bytes::new(env);
    b.extend_from_slice(DOM_NULL);
    append_bytes32(&mut b, pubkey);
    append_bytes32(&mut b, commitment);
    env.crypto().sha256(&b).to_bytes()
}

pub(crate) fn build_withdraw_message(
    env: &Env,
    nullifier: &BytesN<32>,
    recipient: &Address,
    amount: i128,
    token: &Address,
    commitment: &BytesN<32>,
) -> Bytes {
    let mut b = Bytes::new(env);
    b.extend_from_slice(DOM_WITHDRAW);
    append_bytes32(&mut b, nullifier);
    append_address_strkey(env, &mut b, recipient);
    b.extend_from_slice(&amount.to_be_bytes());
    append_address_strkey(env, &mut b, token);
    append_bytes32(&mut b, commitment);
    b
}

pub(crate) fn build_transfer_message(
    env: &Env,
    old_nullifier: &BytesN<32>,
    new_commitment: &BytesN<32>,
    token: &Address,
    amount: i128,
    old_commitment: &BytesN<32>,
    owner: &Address,
) -> Bytes {
    let mut b = Bytes::new(env);
    b.extend_from_slice(DOM_TRANSFER);
    append_bytes32(&mut b, old_nullifier);
    append_bytes32(&mut b, new_commitment);
    append_address_strkey(env, &mut b, token);
    b.extend_from_slice(&amount.to_be_bytes());
    append_bytes32(&mut b, old_commitment);
    append_address_strkey(env, &mut b, owner);
    b
}

fn parse_proof(env: &Env, proof: &Bytes) -> Result<(BytesN<32>, BytesN<32>, BytesN<64>), ContractError> {
    if proof.len() != PROOF_LEN {
        return Err(ContractError::ProofLength);
    }
    let mut buf = [0u8; 128];
    proof.copy_into_slice(&mut buf);
    let mut c = [0u8; 32];
    let mut p = [0u8; 32];
    let mut s = [0u8; 64];
    c.copy_from_slice(&buf[0..32]);
    p.copy_from_slice(&buf[32..64]);
    s.copy_from_slice(&buf[64..128]);
    Ok((
        BytesN::from_array(env, &c),
        BytesN::from_array(env, &p),
        BytesN::from_array(env, &s),
    ))
}

impl PrivatePaymentsContract {
    fn load_note(env: &Env, commitment: &BytesN<32>) -> Result<NoteRecord, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Note(commitment.clone()))
            .ok_or(ContractError::NoteNotFound)
    }

    fn save_note(env: &Env, commitment: &BytesN<32>, note: &NoteRecord) {
        env.storage()
            .persistent()
            .set(&DataKey::Note(commitment.clone()), note);
    }

    fn mark_spent(env: &Env, nullifier: &BytesN<32>) -> Result<(), ContractError> {
        let key = DataKey::Spent(nullifier.clone());
        if env.storage().persistent().has(&key) {
            return Err(ContractError::NullifierReuse);
        }
        env.storage().persistent().set(&key, &true);
        Ok(())
    }
}

#[contractimpl]
impl PrivatePaymentsContract {
    /// Lock `amount` of `token` and record a note under `commitment`.
    /// The depositor must later prove knowledge of an ed25519 key whose derived commitment matches.
    pub fn deposit(
        env: Env,
        owner: Address,
        token_addr: Address,
        amount: i128,
        commitment: BytesN<32>,
    ) -> Result<(), ContractError> {
        owner.require_auth();
        if amount <= 0 {
            return Err(ContractError::AmountMismatch);
        }
        if env
            .storage()
            .persistent()
            .has(&DataKey::Note(commitment.clone()))
        {
            return Err(ContractError::CommitmentAlreadyExists);
        }

        let mp = env.current_contract_address();
        let pay = token::Client::new(&env, &token_addr);
        pay.transfer(&owner, &mp, &amount);

        let note = NoteRecord {
            owner: owner.clone(),
            commitment: commitment.clone(),
            nullifier: BytesN::from_array(&env, &[0u8; 32]),
            is_spent: false,
            created_at: env.ledger().timestamp(),
            token: token_addr,
            amount,
        };
        Self::save_note(&env, &commitment, &note);

        // No nullifier exists yet; omit amount/recipient from event surface.
        env.events().publish(
            (Symbol::new(&env, "note_committed"), commitment.clone()),
            (),
        );
        Ok(())
    }

    /// Verify ed25519 proof over the withdraw transcript and release tokens.
    /// Proof verification uses Soroban host crypto (`ed25519_verify`); invalid signatures trap (tx failure).
    pub fn withdraw(
        env: Env,
        proof: Bytes,
        nullifier: BytesN<32>,
        recipient: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        let (commitment, pubkey, sig) = parse_proof(&env, &proof)?;
        let mut note = Self::load_note(&env, &commitment)?;
        if note.is_spent {
            return Err(ContractError::AlreadySpent);
        }
        if amount != note.amount {
            return Err(ContractError::AmountMismatch);
        }

        let exp_commit = expected_commitment(&env, &pubkey, &note.token, note.amount, &note.owner);
        if exp_commit != commitment || commitment != note.commitment {
            return Err(ContractError::CommitmentMismatch);
        }

        let nul = derive_nullifier(&env, &pubkey, &commitment);
        if nul != nullifier {
            return Err(ContractError::InvalidProof);
        }

        let msg = build_withdraw_message(
            &env,
            &nullifier,
            &recipient,
            amount,
            &note.token,
            &commitment,
        );
        env.crypto().ed25519_verify(&pubkey, &msg, &sig);

        Self::mark_spent(&env, &nullifier)?;
        note.is_spent = true;
        note.nullifier = nullifier.clone();
        Self::save_note(&env, &commitment, &note);

        let mp = env.current_contract_address();
        let pay = token::Client::new(&env, &note.token);
        pay.transfer(&mp, &recipient, &amount);

        env.events()
            .publish((Symbol::new(&env, "nullifier_spent"), nullifier.clone()), ());
        Ok(())
    }

    /// Spend a note (reveals `old_nullifier`) and create a fresh note under `new_commitment` (same token/amount/owner).
    pub fn transfer_private(
        env: Env,
        proof: Bytes,
        old_nullifier: BytesN<32>,
        new_commitment: BytesN<32>,
    ) -> Result<(), ContractError> {
        let (old_commitment, pubkey, sig) = parse_proof(&env, &proof)?;
        let mut note = Self::load_note(&env, &old_commitment)?;
        if note.is_spent {
            return Err(ContractError::AlreadySpent);
        }

        let exp_commit =
            expected_commitment(&env, &pubkey, &note.token, note.amount, &note.owner);
        if exp_commit != old_commitment || old_commitment != note.commitment {
            return Err(ContractError::CommitmentMismatch);
        }

        let expected_nul = derive_nullifier(&env, &pubkey, &old_commitment);
        if expected_nul != old_nullifier {
            return Err(ContractError::InvalidProof);
        }

        if env
            .storage()
            .persistent()
            .has(&DataKey::Note(new_commitment.clone()))
        {
            return Err(ContractError::CommitmentAlreadyExists);
        }

        let msg = build_transfer_message(
            &env,
            &old_nullifier,
            &new_commitment,
            &note.token,
            note.amount,
            &old_commitment,
            &note.owner,
        );
        env.crypto().ed25519_verify(&pubkey, &msg, &sig);

        Self::mark_spent(&env, &old_nullifier)?;

        note.is_spent = true;
        note.nullifier = old_nullifier.clone();
        Self::save_note(&env, &old_commitment, &note);

        let new_note = NoteRecord {
            owner: note.owner.clone(),
            commitment: new_commitment.clone(),
            nullifier: BytesN::from_array(&env, &[0u8; 32]),
            is_spent: false,
            created_at: env.ledger().timestamp(),
            token: note.token.clone(),
            amount: note.amount,
        };
        Self::save_note(&env, &new_commitment, &new_note);

        env.events().publish(
            (Symbol::new(&env, "nullifier_spent"), old_nullifier.clone()),
            (),
        );
        Ok(())
    }

    pub fn is_spent(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Spent(nullifier))
    }

    pub fn get_commitment(env: Env, commitment: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Note(commitment))
    }

    pub fn get_note(env: Env, commitment: BytesN<32>) -> Result<NoteRecord, ContractError> {
        Self::load_note(&env, &commitment)
    }
}

#[cfg(feature = "testhelpers")]
pub mod testkit {
    //! Helpers for off-chain / integration test proof construction only.
    use soroban_sdk::{Address, Bytes, BytesN, Env};

    pub const PROOF_LEN: u32 = crate::PROOF_LEN;

    pub fn expected_commitment(
        env: &Env,
        pubkey: &BytesN<32>,
        token: &Address,
        amount: i128,
        owner: &Address,
    ) -> BytesN<32> {
        crate::expected_commitment(env, pubkey, token, amount, owner)
    }

    pub fn derive_nullifier(env: &Env, pubkey: &BytesN<32>, commitment: &BytesN<32>) -> BytesN<32> {
        crate::derive_nullifier(env, pubkey, commitment)
    }

    pub fn build_withdraw_message(
        env: &Env,
        nullifier: &BytesN<32>,
        recipient: &Address,
        amount: i128,
        token: &Address,
        commitment: &BytesN<32>,
    ) -> Bytes {
        crate::build_withdraw_message(env, nullifier, recipient, amount, token, commitment)
    }

    pub fn build_transfer_message(
        env: &Env,
        old_nullifier: &BytesN<32>,
        new_commitment: &BytesN<32>,
        token: &Address,
        amount: i128,
        old_commitment: &BytesN<32>,
        owner: &Address,
    ) -> Bytes {
        crate::build_transfer_message(
            env,
            old_nullifier,
            new_commitment,
            token,
            amount,
            old_commitment,
            owner,
        )
    }

    pub fn assemble_proof(
        env: &Env,
        commitment: BytesN<32>,
        pubkey_bytes: &[u8; 32],
        sig_bytes: &[u8; 64],
    ) -> Bytes {
        let mut buf = [0u8; 128];
        buf[0..32].copy_from_slice(&commitment.to_array());
        buf[32..64].copy_from_slice(pubkey_bytes);
        buf[64..128].copy_from_slice(sig_bytes);
        Bytes::from_slice(env, &buf)
    }
}

#[cfg(test)]
mod test;
