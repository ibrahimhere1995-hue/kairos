//! Voice capture (PRD R20, P3-T14): hold to speak, release, and the words land in Quick
//! Capture or the Inbox note box. Uses the OS speech service (Windows.Media.SpeechRecognition);
//! only the text is kept, never the audio. Other systems get a friendly "not available yet".

use std::sync::Mutex;

use crate::error::{AppError, AppResult};

/// Live text while speaking (phrases so far + the current guess), for the capture box.
pub const PARTIAL_EVENT: &str = "voice:partial";

/// The recognised phrases as one line.
pub fn join(phrases: &[String]) -> String {
    phrases
        .iter()
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

/// What to tell the user for a Windows error code (HRESULT).
pub fn reason_for(code: i32) -> &'static str {
    // HRESULTs are u32 bit patterns stored in an i32.
    match code.cast_unsigned() {
        // SPERR_SPEECH_PRIVACY_POLICY_NOT_ACCEPTED: "Online speech recognition" is off.
        0x8004_5509 => "privacy",
        // E_ACCESSDENIED: microphone access is off for apps.
        0x8007_0005 => "microphone",
        _ => "failed",
    }
}

/// The one recording in progress, if any.
#[derive(Default)]
pub struct VoiceState(pub Mutex<Option<imp::Session>>);

#[cfg(windows)]
pub mod imp {
    use std::sync::{Arc, Mutex};

    use tauri::{AppHandle, Emitter};
    use windows::Foundation::TypedEventHandler;
    use windows::Media::SpeechRecognition::{
        SpeechContinuousRecognitionResultGeneratedEventArgs, SpeechContinuousRecognitionSession,
        SpeechRecognitionHypothesisGeneratedEventArgs, SpeechRecognitionResultStatus,
        SpeechRecognizer,
    };

    use super::{PARTIAL_EVENT, join, reason_for};
    use crate::error::{AppError, AppResult};

    pub struct Session {
        recognizer: SpeechRecognizer,
        phrases: Arc<Mutex<Vec<String>>>,
    }

    fn fail(error: &windows::core::Error) -> AppError {
        AppError::Voice(reason_for(error.code().0))
    }

    fn lock(phrases: &Mutex<Vec<String>>) -> Vec<String> {
        phrases.lock().map(|p| p.clone()).unwrap_or_default()
    }

    /// Starts dictation. Blocks briefly (compiling the grammar), so call it off the UI thread.
    pub fn start(app: AppHandle) -> AppResult<Session> {
        let recognizer = SpeechRecognizer::new().map_err(|e| fail(&e))?;
        let compiled = recognizer
            .CompileConstraintsAsync()
            .and_then(|op| op.join())
            .map_err(|e| fail(&e))?;
        if compiled.Status().map_err(|e| fail(&e))? != SpeechRecognitionResultStatus::Success {
            return Err(AppError::Voice("failed"));
        }
        let phrases = Arc::new(Mutex::new(Vec::new()));
        let session = recognizer
            .ContinuousRecognitionSession()
            .map_err(|e| fail(&e))?;

        let (found, app_found) = (phrases.clone(), app.clone());
        session
            .ResultGenerated(&TypedEventHandler::<
                SpeechContinuousRecognitionSession,
                SpeechContinuousRecognitionResultGeneratedEventArgs,
            >::new(move |_, args| {
                if let Some(args) = args.as_ref() {
                    let text = args.Result()?.Text()?.to_string_lossy();
                    if let Ok(mut all) = found.lock() {
                        all.push(text);
                    }
                    let _ = app_found.emit(PARTIAL_EVENT, join(&lock(&found)));
                }
                Ok(())
            }))
            .map_err(|e| fail(&e))?;

        let guessed = phrases.clone();
        recognizer
            .HypothesisGenerated(&TypedEventHandler::<
                SpeechRecognizer,
                SpeechRecognitionHypothesisGeneratedEventArgs,
            >::new(move |_, args| {
                if let Some(args) = args.as_ref() {
                    let guess = args.Hypothesis()?.Text()?.to_string_lossy();
                    let mut all = lock(&guessed);
                    all.push(guess);
                    let _ = app.emit(PARTIAL_EVENT, join(&all));
                }
                Ok(())
            }))
            .map_err(|e| fail(&e))?;

        session
            .StartAsync()
            .and_then(|op| op.join())
            .map_err(|e| fail(&e))?;
        Ok(Session {
            recognizer,
            phrases,
        })
    }

    /// Stops listening (the last phrase is finished first) and returns everything heard.
    pub fn stop(session: Session) -> AppResult<String> {
        let stopped = session
            .recognizer
            .ContinuousRecognitionSession()
            .and_then(|s| s.StopAsync())
            .and_then(|op| op.join());
        let text = join(&lock(&session.phrases));
        let _ = session.recognizer.Close();
        // Nothing heard and stopping failed: say why; otherwise keep what was heard.
        match stopped {
            Err(error) if text.is_empty() => Err(fail(&error)),
            _ => Ok(text),
        }
    }
}

#[cfg(not(windows))]
pub mod imp {
    use tauri::AppHandle;

    use crate::error::{AppError, AppResult};

    pub struct Session;

    pub fn start(_app: AppHandle) -> AppResult<Session> {
        Err(AppError::Voice("unsupported"))
    }

    pub fn stop(_session: Session) -> AppResult<String> {
        Ok(String::new())
    }
}

/// Starts a recording unless one is already running.
pub fn begin(state: &VoiceState, session: imp::Session) -> AppResult<()> {
    let mut slot = state.0.lock().map_err(|_| AppError::Lock)?;
    if slot.is_none() {
        *slot = Some(session);
    }
    Ok(())
}

/// The recording to stop, if one is running.
pub fn take(state: &VoiceState) -> AppResult<Option<imp::Session>> {
    Ok(state.0.lock().map_err(|_| AppError::Lock)?.take())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn joins_phrases_into_one_line() {
        let phrases = vec![
            "Call the bank ".into(),
            "".into(),
            " tomorrow at three".into(),
        ];
        assert_eq!(join(&phrases), "Call the bank tomorrow at three");
        assert_eq!(join(&[]), "");
    }

    #[test]
    fn explains_windows_errors_plainly() {
        assert_eq!(reason_for(0x8004_5509_u32.cast_signed()), "privacy");
        assert_eq!(reason_for(0x8007_0005_u32.cast_signed()), "microphone");
        assert_eq!(reason_for(-1), "failed");
    }
}
