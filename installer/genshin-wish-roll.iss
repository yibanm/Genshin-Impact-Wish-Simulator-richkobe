; 原神祈愿模拟器 — Inno Setup 安装脚本（现代向导 + 全中文 + 英文安装目录）
; 用户 2026-11-05 要求：安装文件夹名英文、现代免等待中文安装器。
; Inno 按需流式解压（不像 NSIS 启动先整包解压 121MB），WizardStyle=modern 为官方现代样式。
; 中文不依赖外部 .isl：官方语言包下载通道不稳，直接用 [Messages] 覆盖核心字符串（标准译法）。

#define MyAppName "GenshinWishRoll"
#define MyAppNameCN "原神祈愿模拟器"
#define MyAppVersion "1.0.1"
#define MyAppPublisher "richkobe"
#define MyAppURL "https://github.com/yibanm/Genshin-Impact-Wish-Simulator-richkobe"
#define MyAppExeName "GenshinWishRoll.exe"

[Setup]
AppId={{8F3A2C61-5D47-4B2E-9A18-6C0E5D7B2F31}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
; 安装目录英文名（用户要求）
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
; 免管理员（currentUser 级，与 Tauri installMode 对齐）
PrivilegesRequired=lowest
OutputDir=..\output
OutputBaseFilename=genshin-wish-roll-richkobe-{#MyAppVersion}-windows-x64-setup
SetupIconFile=..\src-tauri\icons\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppNameCN}
Compression=lzma2/max
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
; 茶话同款经典向导布局：左侧 banner 图 + 全中文（用户 2026-11-05 截图指定）
WizardImageFile=wizard.bmp
WizardSmallImageFile=wizard-small.bmp
DisableProgramGroupPage=yes
ShowLanguageDialog=no

[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
chinesesimp.LaunchProgram=立即运行 %1

; 核心界面字符串中文化（官方 ChineseSimplified 标准译法）
[Messages]
SetupAppTitle=安装
SetupWindowTitle=安装 - {#MyAppNameCN}
UninstallAppTitle=卸载
UninstallAppFullTitle=卸载 {#MyAppNameCN}
WelcomeLabel1=欢迎安装 [name]
WelcomeLabel2=现在将安装 [name/ver] 到您的电脑中。%n%n推荐您在继续安装前关闭所有其它应用程序。
SelectDirLabel3=安装程序将安装 [name] 到下列文件夹中。
SelectDirDesc=您想将 [name] 安装在哪里？
DiskSpaceMBLabel=程序至少需要 [mb] MB 的磁盘空间。
ButtonNext=下一步(&N) >
ButtonBack=< 上一步(&B)
ButtonInstall=安装(&I)
ButtonFinish=完成(&F)
ButtonCancel=取消
ButtonBrowse=浏览(&R)...
ReadyLabel1=准备安装
ReadyLabel2a=点击“安装”继续此安装，如果您想回顾或修改设置请点击“上一步”。
ReadyLabel2b=点击“安装”继续此安装。
ReadyMemoDir=安装目录：
FinishedHeadingLabel=[name] 安装完成
FinishedLabel=安装程序已在您的电脑中安装了 [name]。
FinishedLabelNoIcons=安装程序已在您的电脑中安装了 [name]。
ClickFinish=点击“完成”退出安装程序。
StatusExtractFiles=正在解压文件...
StatusCreateDirs=正在创建目录...
StatusCreateIcons=正在创建快捷方式...
StatusCreateIniEntries=正在创建 INI 条目...
StatusCreateRegistryEntries=正在创建注册表条目...
StatusRegisterFiles=正在注册文件...
StatusSavingUninstall=正在保存卸载信息...
StatusRunProgram=正在完成安装...
StatusRestartingApplications=正在重新启动应用程序...
StatusRollback=正在撤销更改...
ConfirmUninstall=您确实要卸载 [name] 及其所有组件吗？
UninstallStatusLabel=正在从您的电脑中卸载 [name] 及其所有组件。
OnlyAdminCanUninstall=此安装只能由有管理员权限的用户卸载。

[Files]
; Tauri 裸 exe 自带前端资源，单文件即完整程序
Source: "..\src-tauri\target\release\genshin-wish-roll.exe"; DestDir: "{app}"; DestName: "{#MyAppExeName}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppNameCN}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\卸载 {#MyAppNameCN}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppNameCN}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式(&D)"; Flags: unchecked

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppNameCN}}"; Flags: nowait postinstall skipifsilent
