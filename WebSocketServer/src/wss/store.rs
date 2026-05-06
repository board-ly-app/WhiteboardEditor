// === store.rs ====================================================================================
//
// Contains specifications of traits that an interface for some form of storage (i.e. a database)
// should implement to allow calling functions to fetch objects. Enables creating mocks for database
// storage.
//
// =================================================================================================

use super::models::{User, UserIdType, WhiteboardIdType, WhiteboardMetadata};

// === UserStore ==================================================================================
//
// Trait that defines a way for fetching users by ID. Depending on this trait rather than directly
// on a database client allows the implementation of unit tests without using a database client.
//
// Read-only: does not implement setting, updating, or deleting users.
//
// ================================================================================================
pub trait UserStore {
    fn get_user_by_id(
        &self,
        user_id: &UserIdType,
    ) -> impl futures::Future<Output = Result<Option<User>, Box<dyn std::error::Error + Send + Sync>>>;
} // -- end trait UserStore

// === WhiteboardMetadataStore ====================================================================
//
// Trait that defines a way for fetching whiteboard metadata by ID. Depending on this trait rather
// than directly on a database client allows the implementation of unit tests without using a
// database client.
//
// Read-only: does not implement setting, updating, or deleting whiteboards.
//
// ================================================================================================
pub trait WhiteboardMetadataStore {
    fn get_whiteboard_metadata_by_id(
        &self,
        whiteboard_id: &WhiteboardIdType,
    ) -> impl futures::Future<
        Output = Result<Option<WhiteboardMetadata>, Box<dyn std::error::Error + Send + Sync>>,
    >;
} // -- end trait WhiteboardMetadataStore
