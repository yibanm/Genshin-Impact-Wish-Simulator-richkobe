/**
 * 运行平台判定与各平台差异能力的适配层。
 *
 * 为什么需要：同一份 Web 产物跑在三种宿主里，能力差异很大——
 *   - 浏览器 / Electron / Tauri：有完整的 DOM 下载与窗口控制权
 *   - Capacitor 安卓壳：WebView 没有下载管理器，`<a download>` 点击被静默忽略；
 *     也没有「窗口」概念，退出要走原生 App.exitApp()
 * 直接写 `if (android)` 会散落到各组件，这里集中判定 + 集中实现。
 */

/** 是否运行在 Capacitor 原生壳内（安卓）。判定依据是 Capacitor 注入的全局对象。 */
export const isNativeAndroid = () =>
	typeof window !== 'undefined' &&
	Boolean(window.Capacitor?.isNativePlatform?.()) &&
	window.Capacitor?.getPlatform?.() === 'android';

/**
 * 是否运行在 Tauri 桌面壳内。
 * 判定依据是 Tauri v2 注入的 __TAURI_INTERNALS__（v1 是 __TAURI_IPC__，本项目只用 v2）。
 * 必须运行时判定而非 build-time：同一份 dist 产物要同时跑在 Web / Tauri / Capacitor 三处。
 */
export const isTauri = () =>
	typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

/** 是否运行在 Electron 桌面壳内（userAgent 带 Electron，preload 桥也存在） */
export const isElectron = () =>
	typeof window !== 'undefined' && /Electron/i.test(navigator.userAgent || '');

/** 是否运行在任意原生壳内（安卓 Capacitor、Tauri 桌面或 Electron 桌面）。 */
export const isNative = () => isNativeAndroid() || isTauri() || isElectron();

/**
 * 动态引入插件。
 * 注意：参数必须是**字面量字符串**——Vite/Rollup 在构建期静态分析 import() 的参数
 * 来生成 chunk；传变量（import(pkg)）构建后运行时无法解析裸模块名，
 * 插件永远加载失败并静默回退（v1.0.1 首轮导出按钮在安卓上失效的真因）。
 * 失败（非原生环境 / 插件缺失）返回 null，调用方回退 Web 实现。
 */
const loadDialogSave = () =>
	import('@tauri-apps/plugin-dialog')
		.then((m) => m.save)
		.catch(() => null);
const loadFsWriteText = () =>
	import('@tauri-apps/plugin-fs')
		.then((m) => m.writeTextFile)
		.catch(() => null);
const loadCapApp = () =>
	import('@capacitor/app')
		.then((m) => m.App)
		.catch(() => null);
// 自研原生插件（android/app/.../MediaSaverPlugin.java）：写系统公共 Download 目录。
// registerPlugin 按名字解析原生实现；非安卓平台调用方法会 reject，由调用方回退。
const loadMediaSaver = () =>
	import('@capacitor/core')
		.then((m) => m.registerPlugin('MediaSaver'))
		.catch(() => null);

/**
 * 退出应用。
 * 安卓原生壳：App.exitApp() 结束 Activity（返回桌面）。
 * Tauri 桌面：当前窗口 close()（需 capability 的 core:window:allow-close）。
 * Electron 桌面：window.close() 可关顶层 BrowserWindow。
 * 纯浏览器：返回 false，由调用方决定回退行为（如刷新页面）。
 */
export const exitApp = async () => {
	if (isTauri()) {
		const getCurrent = await import('@tauri-apps/api/webviewWindow')
			.then((m) => m.getCurrentWebviewWindow)
			.catch(() => null);
		try {
			const win = getCurrent?.();
			if (win?.close) {
				await win.close();
				return true;
			}
		} catch (e) {
			// 权限缺失等：落到下面的回退
		}
		return false;
	}
	if (isNativeAndroid()) {
		const App = await loadCapApp();
		if (!App) return false;
		try {
			await App.exitApp();
			return true;
		} catch (e) {
			return false;
		}
	}
	if (isElectron()) {
		window.close();
		return true;
	}
	return false;
};

/**
 * Tauri 桌面导出：弹系统「另存为」对话框拿路径，再用 fs 插件写文本。
 * 为什么必须走插件：WebView2 与安卓 WebView 一样不接管 `<a download>`，
 * 从 Electron 迁到 Tauri 若不补这条路，导出功能会从「能用」变成「点了没反应」。
 */
const saveTextFileTauri = async (text, filename) => {
	const dialog = await loadDialogSave();
	const fs = await loadFsWriteText();
	if (!dialog || !fs) return false;

	try {
		const path = await dialog({
			defaultPath: filename,
			filters: [{ name: '备份文件', extensions: ['bin', 'json', 'txt'] }]
		});
		// 用户点了取消，path 为 null：算「未保存」，但不是故障，不回退 Web 下载
		// （回退会再弹一次浏览器下载，用户会以为取消失败）
		if (!path) return true;
		await fs(path, text);
		return true;
	} catch (e) {
		return false;
	}
};

/**
 * 安卓保存：经自研 MediaSaver 插件写系统公共 Download 目录（用户 2026-11-05 要求）。
 * API 29+ 走 MediaStore.Downloads 免权限；24-28 落应用外部目录子文件夹（插件内回落）。
 * 旧的「缓存目录 + 分享面板」路线废弃：分享面板被取消后回退 <a download> 在 WebView
 * 被静默忽略，用户看到的就是「导出按钮无效」。
 *
 * @param {Blob|string} payload Blob（截图）或文本字符串（备份）
 * @param {string} filename 目标文件名
 * @param {string} mime MIME 类型
 * @returns {Promise<boolean>} true = 原生通道已处理；false = 调用方回退 Web 下载
 */
const saveViaMediaStore = async (payload, filename, mime) => {
	const saver = await loadMediaSaver();
	if (!saver?.saveToDownloads) return false;
	try {
		const base64 =
			typeof payload === 'string'
				? btoa(unescape(encodeURIComponent(payload)))
				: await blobToBase64(payload);
		const res = await saver.saveToDownloads({ name: filename, mime, base64 });
		return !!res?.path;
	} catch (e) {
		// 非安卓环境或插件未注册：回退
		console.error('MediaSaver 保存失败：', e);
		return false;
	}
};

// Blob → base64（去掉 data: 前缀），供插件的 Base64.decode 消费
const blobToBase64 = (blob) =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});

const saveTextFileAndroid = (text, filename) =>
	saveViaMediaStore(text, filename, 'application/octet-stream');

/**
 * 安卓保存截图到 Download 目录。非安卓返回 false 由调用方回退 saveAs。
 */
export const saveBlobNative = async (blob, filename, mime = 'image/png') => {
	if (isNativeAndroid()) return saveViaMediaStore(blob, filename, mime);
	return false;
};

/**
 * 把文本内容存成文件交给用户。
 * 按宿主分派：Tauri 桌面 → 另存为对话框；安卓 → 缓存+分享；浏览器/Electron → 返回 false
 * 由调用方走 `<a download>`。原生通道任一步失败也返回 false，保证按钮永远有反应（不做假按钮）。
 *
 * @returns {Promise<boolean>} true = 已由原生通道处理完毕；false = 调用方需回退 Web 下载
 */
export const saveTextFileNative = async (text, filename) => {
	if (isTauri()) return saveTextFileTauri(text, filename);
	if (isNativeAndroid()) return saveTextFileAndroid(text, filename);
	return false;
};

