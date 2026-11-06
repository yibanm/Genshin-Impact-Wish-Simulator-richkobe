#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // dialog：数据导出时弹「另存为」对话框（WebView2 下 <a download> 不生效，
    // 与安卓 WebView 同理，必须走原生通道，否则从 Electron 迁过来会弄坏导出功能）
    .plugin(tauri_plugin_dialog::init())
    // fs：把导出的 JSON 文本写到用户选定路径
    .plugin(tauri_plugin_fs::init())
    // opener：WebView 拦截 <a target="_blank">，外链须交给系统浏览器打开
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
