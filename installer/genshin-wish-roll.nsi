; 原神祈愿模拟器 — NSIS MUI2 安装脚本（茶话式外观，用户 2026-11-06 裁定「要用 MUI」）
; Tauri 自带模板是简化版无左图；本脚本用 NSIS 官方 MUI2 + SimpChinese 语言包复刻茶话外观。
; 编译：makensis genshin-wish-roll.nsi（脚本须 UTF-8 BOM）
Unicode true
!include "MUI2.nsh"

!define APPNAME "GenshinWishRoll"
!define APPNAME_CN "原神祈愿模拟器"
; 版本号与 package.json 同步；改版本时两处一起改。
; CI 用 package.json 版本做 Test-Path 校验产物名，不一致会红（不会静默发错版本）。
; 注：makensis 的 /DVERSION 不生效（!ifndef 检测不到命令行定义），故用硬编码。
!define VERSION "1.0.2"
!define PUBLISHER "richkobe"
!define URL "https://github.com/yibanm/Genshin-Impact-Wish-Simulator-richkobe"
!define EXE_SRC "..\src-tauri\target\release\genshin-wish-roll.exe"

Name "${APPNAME_CN} ${VERSION}"
OutFile "..\output\genshin-wish-roll-richkobe-${VERSION}-windows-x64-setup.exe"
; 安装目录英文 + currentUser 免管理员
InstallDir "$LOCALAPPDATA\${APPNAME}"
RequestExecutionLevel user
SetCompressor lzma

; 茶话式左 banner 与右上小图（164x314 / 55x58 BMP）
!define MUI_ICON "..\src-tauri\icons\icon.ico"
!define MUI_UNICON "..\src-tauri\icons\icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "wizard.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "wizard-small.bmp"
!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APPNAME}.exe"
!define MUI_FINISHPAGE_RUN_TEXT "立即运行 ${APPNAME_CN}"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"

Section "Install"
	SetOutPath "$INSTDIR"
	File /oname=${APPNAME}.exe "${EXE_SRC}"
	WriteUninstaller "$INSTDIR\uninstall.exe"
	WriteRegStr HKCU "Software\${APPNAME}" "InstallDir" "$INSTDIR"
	; 添加/删除程序条目
	WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME_CN}"
	WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayIcon" "$INSTDIR\${APPNAME}.exe"
	WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" "$INSTDIR\uninstall.exe"
	WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${PUBLISHER}"
	WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "HelpLink" "${URL}"
	WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoModify" 1
	WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoRepair" 1
	; 开始菜单（英文文件夹）+ 桌面快捷方式默认创建（用户上轮怒斥缺快捷方式）
	CreateDirectory "$SMPROGRAMS\${APPNAME_CN}"
	CreateShortcut "$SMPROGRAMS\${APPNAME_CN}\${APPNAME_CN}.lnk" "$INSTDIR\${APPNAME}.exe"
	CreateShortcut "$SMPROGRAMS\${APPNAME_CN}\卸载 ${APPNAME_CN}.lnk" "$INSTDIR\uninstall.exe"
	CreateShortcut "$DESKTOP\${APPNAME_CN}.lnk" "$INSTDIR\${APPNAME}.exe"
SectionEnd

Section "Uninstall"
	Delete "$DESKTOP\${APPNAME_CN}.lnk"
	Delete "$SMPROGRAMS\${APPNAME_CN}\${APPNAME_CN}.lnk"
	Delete "$SMPROGRAMS\${APPNAME_CN}\卸载 ${APPNAME_CN}.lnk"
	RMDir "$SMPROGRAMS\${APPNAME_CN}"
	Delete "$INSTDIR\${APPNAME}.exe"
	Delete "$INSTDIR\uninstall.exe"
	RMDir /r "$INSTDIR"
	DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
	DeleteRegKey HKCU "Software\${APPNAME}"
SectionEnd
