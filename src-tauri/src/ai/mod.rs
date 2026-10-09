//! Smart (AI) features (PRD §7.3, ARCHITECTURE §9). Optional: nothing here runs until the
//! user has agreed to the consent screen and added their own Gemini key. Only the data a
//! single request needs is sent; the key lives in the OS keychain only.

pub mod gemini;
pub mod parse;
pub mod secrets;

use std::future::Future;

use serde_json::Value;

use crate::error::AppResult;

/// Something that answers a prompt with JSON matching `schema`. Gemini today; a local model
/// can be added later without touching the features.
pub trait AiProvider {
    fn generate_json(
        &self,
        prompt: &str,
        schema: &Value,
    ) -> impl Future<Output = AppResult<Value>> + Send;
}
