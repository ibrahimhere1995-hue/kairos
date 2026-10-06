#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Startup-fatal: if the Tauri runtime cannot start there is no app to recover into.
    #[allow(clippy::expect_used)]
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Kairos");
}
