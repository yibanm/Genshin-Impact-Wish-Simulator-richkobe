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
 * 必须动态 import：静态 import 会把插件打进 Web 产物，而浏览器环境下
 * 插件内部访问原生桥会抛错。失败（非原生环境 / 插件缺失）返回 null，
 * 调用方自行回退到 Web 实现。
 */
const loadPlugin = async (pkg, name) => {
	try {
		const mod = await import(/* @vite-ignore */ pkg);
		return mod[name] ?? null;
	} catch (e) {
		return null;
	}
};

/**
 * 退出应用。
 * 安卓原生壳：App.exitApp() 结束 Activity（返回桌面）。
 * Tauri 桌面：当前窗口 close()（需 capability 的 core:window:allow-close）。
 * Electron 桌面：window.close() 可关顶层 BrowserWindow。
 * 纯浏览器：返回 false，由调用方决定回退行为（如刷新页面）。
 */
export const exitApp = async () => {
	if (isTauri()) {
		const getCurrent = await loadPlugin(
			'@tauri-apps/api/webviewWindow',
			'getCurrentWebviewWindow'
		);
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
		const App = await loadPlugin('@capacitor/app', 'App');
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
	const dialog = await loadPlugin('@tauri-apps/plugin-dialog', 'save');
	const fs = await loadPlugin('@tauri-apps/plugin-fs', 'writeTextFile');
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
 * 安卓导出：写缓存目录 + 唤起系统分享面板。
 * 为什么是这两步：WebView 无下载管理器；CACHE 目录不需要任何存储权限
 * （不必申请 WRITE_EXTERNAL_STORAGE）；分享面板让用户自己选去处（存文件/发微信/传电脑）。
 */
const saveTextFileAndroid = async (text, filename) => {
	const Filesystem = await loadPlugin('@capacitor/filesystem', 'Filesystem');
	const Share = await loadPlugin('@capacitor/share', 'Share');
	if (!Filesystem || !Share) return false;

	try {
		const written = await Filesystem.writeFile({
			path: filename,
			data: text,
			directory: 'CACHE',
			encoding: 'UTF8',
			// 同名备份文件直接覆盖，避免用户第二次导出时因文件已存在而失败
			recursive: true
		});

		await Share.share({
			title: filename,
			text: filename,
			url: written.uri,
			dialogTitle: filename
		});
		return true;
	} catch (e) {
		// 用户在分享面板点取消会走到这里，不算故障，但仍回退一次 Web 下载兜底
		return false;
	}
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

