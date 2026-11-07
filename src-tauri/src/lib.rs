// 数据明文镜像：exe 同级 data/ 目录的读写命令（桌面专用；安卓走 Capacitor Directory.External）
fn desktop_data_dir() -> std::path::PathBuf {
  std::env::current_exe()
    .map(|p| p.parent().unwrap_or(std::path::Path::new(".")).join("data"))
    .unwrap_or_else(|_| std::path::PathBuf::from("data"))
}

#[tauri::command]
fn data_read_text(name: String) -> Result<Option<String>, String> {
  let p = desktop_data_dir().join(name);
  if !p.exists() {
    return Ok(None);
  }
  std::fs::read_to_string(&p).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
fn data_write_text(name: String, content: String) -> Result<(), String> {
  let dir = desktop_data_dir();
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  std::fs::write(dir.join(name), content).map_err(|e| e.to_string())
}

#[tauri::command]
fn data_read_icons() -> Result<Vec<(String, String)>, String> {
  use base64::Engine;
  let dir = desktop_data_dir().join("icons");
  if !dir.exists() {
    return Ok(vec![]);
  }
  let mut out = vec![];
  for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
    let p = entry.map_err(|e| e.to_string())?.path();
    if !p.is_file() {
      continue;
    }
    let bytes = std::fs::read(&p).map_err(|e| e.to_string())?;
    let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
    out.push((name, base64::engine::general_purpose::STANDARD.encode(bytes)));
  }
  Ok(out)
}

#[tauri::command]
fn data_write_icon(name: String, base64: String) -> Result<(), String> {
  use base64::Engine;
  let dir = desktop_data_dir().join("icons");
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let bytes = base64::engine::general_purpose::STANDARD
    .decode(base64)
    .map_err(|e| e.to_string())?;
  std::fs::write(dir.join(name), bytes).map_err(|e| e.to_string())
}

#[tauri::command]
fn data_delete_icon(name: String) -> Result<(), String> {
  let p = desktop_data_dir().join("icons").join(name);
  if p.exists() {
    std::fs::remove_file(p).map_err(|e| e.to_string())?;
  }
  Ok(())
}

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
    .invoke_handler(tauri::generate_handler![
      data_read_text,
      data_write_text,
      data_read_icons,
      data_write_icon,
      data_delete_icon
    ])
    .setup(|app| {
      // 桌面数据明文镜像目录 = exe 同级 data/（启动即建；写失败只记日志不阻断，镜像层自己回落）。
      // 安卓不走这里：用户指定 /storage/emulated/0/Android/data/<包名>/files/data，
      // 由 JS 层 Capacitor Filesystem 的 Directory.External 映射并自动建目录
      if !cfg!(mobile) {
        if let Ok(exe) = std::env::current_exe() {
          let data_dir = exe.parent().unwrap_or(std::path::Path::new(".")).join("data");
          if let Err(e) = std::fs::create_dir_all(&data_dir) {
            log::warn!("创建数据目录失败 {:?}: {}", data_dir, e);
          }
        }
      }

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
