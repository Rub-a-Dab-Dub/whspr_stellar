use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MessagingError {
    Unauthorized = 1,
    ConversationNotFound = 2,
    MessageNotFound = 3,
    ConversationExpired = 4,
    AlreadyParticipant = 5,
    MessageAlreadyDeleted = 6,
    InvalidMessageHash = 7,
    InvalidTimestamp = 8,
    ConversationAlreadyExists = 9,
    TooManyMessages = 10,
}
