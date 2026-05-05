use super::models::{ClientIdType, WhiteboardIdType};

use chrono::{self, Utc};

use mongodb::bson;

pub fn generate_unique_client_id(whiteboard_id: WhiteboardIdType, index: i32) -> ClientIdType {
    format!("{}.{}", whiteboard_id, index)
} // -- end generate_unique_client_id

pub fn dt_bson_to_chrono_utc(dt: &bson::DateTime) -> chrono::DateTime<Utc> {
    match chrono::DateTime::<Utc>::from_timestamp_millis(dt.timestamp_millis()) {
        Some(dt) => dt,
        None => {
            panic!("Could not parse bson datetime {} into chrono datetime", dt);
        }
    }
}

pub fn dt_chrono_utc_to_bson(dt: &chrono::DateTime<Utc>) -> bson::DateTime {
    bson::DateTime::from_millis(dt.timestamp_millis())
}
