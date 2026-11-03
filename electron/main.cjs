const { app, BrowserWindow, Menu, shell, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL: toFileURL } = require('url');

/**
 * 原神抽卡点名器 —— Electron 主进程（中文修改版）
 *
 * 加载方式说明（重要）：
 * SvelteKit 的构建产物使用根路径资源引用（/internal/...、/icons.css），
 * 直接用 file:// 加载 index.html 会把这些路径解析到盘符根目录而全部 404。
 * 因此这里注册一个自定义特权协议 app://，把请求映射到 dist 目录下的文件，
 * 使根路径引用在桌面版里同样成立，且无需内嵌 HTTP 服务器（不打包 express）。
 *
 * 与原版壳层的差异：
 * - 原版内嵌 express 只为提供 /api/members 读取 names.txt；本版名单完全在前端
 *   （localStorage + IndexedDB），不需要后端。
 */

// 自定义协议名。必须在 app ready 之前注册 scheme 的特权属性
const SCHEME = 'app';
const HOST_NAME = 'wishroll';

protocol.registerSchemesAsPrivileged([
	{
		scheme: SCHEME,
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
			// 允许 localStorage / IndexedDB / Service Worker 在该 origin 下工作
			stream: true
		}
	}
]);

// 单实例锁：重复启动时聚焦已有窗口，而不是再开一个
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
	app.quit();
}

let win = null;

// 静态资源目录：开发时指向源码 dist，打包后指向 resources/dist
const distDir = app.isPackaged
	? path.join(process.resourcesPath, 'dist')
	: path.join(__dirname, '..', 'dist');

/** 把 app:// 请求路径映射到 dist 下的真实文件 */
const resolveDistFile = (urlPath) => {
	// 去掉查询串与首斜杠，规范化分隔符
	const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
	const target = clean === '' ? 'index.html' : clean;
	const abs = path.join(distDir, target);
	// 防目录穿越：解析后的路径必须仍在 distDir 内
	const rel = path.relative(distDir, abs);
	if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
	return fs.existsSync(abs) && fs.statSync(abs).isFile() ? abs : null;
};

const createWindow = () => {
	win = new BrowserWindow({
		width: 1280,
		height: 800,
		minWidth: 800,
		minHeight: 520,
		title: '原神抽卡点名器',
		autoHideMenuBar: true,
		backgroundColor: '#f5f0e6',
		webPreferences: {
			preload: path.join(__dirname, 'preload.cjs'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false
		}
	});

	// 屏蔽默认菜单（保留 F11 全屏与 DevTools 快捷键）
	Menu.setApplicationMenu(null);

	const indexFile = path.join(distDir, 'index.html');
	if (!fs.existsSync(indexFile)) {
		// 构建产物缺失时不要白屏，给出可读提示，方便排查
		win.loadURL(
			'data:text/html;charset=utf-8,' +
				encodeURIComponent(
					'<h2 style="font-family:sans-serif">找不到构建产物</h2>' +
						'<p style="font-family:sans-serif">期望路径：' +
						indexFile +
						'</p><p style="font-family:sans-serif">请先在项目根目录执行 <code>npm run build</code>。</p>'
				)
		);
		return;
	}

	win.loadURL(`${SCHEME}://${HOST_NAME}/`);

	// 外部链接（如上游仓库、隐私政策里的链接）用系统浏览器打开，不在应用内导航
	win.webContents.setWindowOpenHandler(({ url }) => {
		if (/^https?:/i.test(url)) shell.openExternal(url);
		return { action: 'deny' };
	});

	// 拦截应用内跳转到外部 http(s) 的情况，同样交给系统浏览器
	win.webContents.on('will-navigate', (event, url) => {
		if (!url.startsWith(`${SCHEME}://`)) {
			event.preventDefault();
			if (/^https?:/i.test(url)) shell.openExternal(url);
		}
	});

	win.on('closed', () => {
		win = null;
	});
};

// 注册 app:// 协议的文件服务
const registerAppProtocol = () => {
	protocol.handle(SCHEME, (request) => {
		const url = new URL(request.url);
		const abs = resolveDistFile(url.pathname);
		if (!abs) {
			// SPA 回退：未匹配到文件时返回 index.html，
			// 使客户端路由（如 /install、/privacy-policy）在桌面版可直接深链打开
			const fallback = path.join(distDir, 'index.html');
			if (fs.existsSync(fallback)) return net.fetch(toFileURL(fallback).toString());
			return new Response('Not Found', { status: 404 });
		}
		return net.fetch(toFileURL(abs).toString());
	});
};

// 渲染进程请求「选择名单文件并读回内容」时由主进程弹系统对话框。
// 文件内容只做 UTF-8/GBK 兜底解码后原样回传，解析交给渲染进程，
// 主进程不解释内容，避免把用户文件当代码执行。
ipcMain.handle('pick-names-file', async () => {
	try {
		const { dialog } = require('electron');
		const result = await dialog.showOpenDialog(win, {
			title: '选择名单文件',
			properties: ['openFile'],
			filters: [
				{ name: '文本文件', extensions: ['txt', 'csv', 'md'] },
				{ name: '所有文件', extensions: ['*'] }
			]
		});
		if (result.canceled || !result.filePaths.length) return { canceled: true };
		const filePath = result.filePaths[0];
		const buf = fs.readFileSync(filePath);
		// 中文名单常见 GBK 编码：先按 UTF-8 解，出现替换字符（U+FFFD）则回退 GBK
		let text = buf.toString('utf8');
		if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
		if (text.includes("\ufffd")) {
			try {
				const { TextDecoder } = require('util');
				text = new TextDecoder('gbk').decode(buf);
			} catch (e) {
				// Node 不带 full-icu 时 gbk 解码不可用，保持 UTF-8 结果
			}
		}
		return { canceled: false, fileName: path.basename(filePath), text };
	} catch (e) {
		return { canceled: false, error: String(e && e.message ? e.message : e) };
	}
});

app.on('second-instance', () => {
	// 第二次启动时把已有窗口拉到前台
	if (win) {
		if (win.isMinimized()) win.restore();
		win.focus();
	}
});

app.on('ready', () => {
	registerAppProtocol();
	createWindow();
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
	if (win === null) createWindow();
});
