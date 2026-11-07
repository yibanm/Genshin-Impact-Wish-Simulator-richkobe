import { isNativeAndroid } from '../platform';
import { HistoryManager, BannerManager, AssetManager } from './api-indexeddb';

/**
 * 数据明文镜像层（用户裁定 2026-11-07）：全部用户数据分类存到
 * 桌面 = exe 同级 data/；安卓 = /storage/emulated/0/Android/data/<包名>/files/data。
 * 定位是「镜像 + 恢复源」：应用读写仍走 localStorage/IndexedDB（改动面最小），
 * 每次写入后防抖全量 dump 成明文文件；启动时本地为空则从文件恢复。
 * Web 环境无目录概念，整层 no-op。
 *
 * 原生桥包一律动态 import：静态 import 会把桥代码打进 Web 产物，浏览器下抛错（经验 61）。
 */

const isDesktop = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
const enabled = () => isDesktop() || isNativeAndroid();

// 两个桥的懒加载入口（每次调用现取模块引用，Vite 会拆成独立 chunk）
const inv = (...args) => import('@tauri-apps/api/core').then((m) => m.invoke(...args));
const capfs = () =>
	import('@capacitor/filesystem').then((m) => ({ FS: m.Filesystem, DIR: m.Directory }));

const CONFIG_KEY = 'WishSimulator.App';
const ROLLCALL_KEY = 'rollcall';
const MIRROR_EVENT = 'dataMirrorUpdate';

const extOf = (type) =>
	({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' })[type] ||
	'bin';

function bufToB64(buf) {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	let s = '';
	for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
	return btoa(s);
}

// ---------- 文本读写（桌面走自写 invoke 命令，安卓走 Capacitor External） ----------
async function readText(name) {
	if (isDesktop()) return await inv('data_read_text', { name });
	const { FS, DIR } = await capfs();
	try {
		const r = await FS.readFile({ path: `data/${name}`, directory: DIR.External });
		return typeof r.data === 'string' ? r.data : new TextDecoder().decode(r.data);
	} catch {
		return null; // 文件不存在
	}
}

async function writeText(name, content) {
	if (isDesktop()) return await inv('data_write_text', { name, content });
	const { FS, DIR } = await capfs();
	await FS.writeFile({
		path: `data/${name}`,
		data: content,
		directory: DIR.External,
		recursive: true
	});
}

// ---------- 图标读写 ----------
async function readIcons() {
	const manifestRaw = await readText('icons/_manifest.json');
	const manifest = manifestRaw ? JSON.parse(manifestRaw) : {};
	const toRecords = (pairs) =>
		pairs.map(([key, b64, type]) => {
			const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
			return { key, blob: new Blob([bin], { type: type || 'image/png' }) };
		});

	if (isDesktop()) {
		const pairs = await inv('data_read_icons'); // [[文件名, base64]]
		return toRecords(
			pairs
				.filter(([n]) => n !== '_manifest.json')
				.map(([n, b64]) => [n.slice(0, n.lastIndexOf('.')), b64, manifest[n.slice(0, n.lastIndexOf('.'))]?.type])
		);
	}
	const { FS, DIR } = await capfs();
	try {
		const list = await FS.readdir({ path: 'data/icons', directory: DIR.External });
		const out = [];
		for (const f of list.files) {
			if (f.name === '_manifest.json') continue;
			const r = await FS.readFile({ path: `data/icons/${f.name}`, directory: DIR.External });
			const b64 = typeof r.data === 'string' ? r.data : bufToB64(r.data);
			const key = f.name.slice(0, f.name.lastIndexOf('.'));
			out.push([key, b64, manifest[key]?.type]);
		}
		return toRecords(out);
	} catch {
		return [];
	}
}

async function writeIcons(records) {
	const manifest = {};
	const prepared = [];
	for (const { key, blob, type } of records) {
		manifest[key] = { type };
		prepared.push([key, bufToB64(new Uint8Array(await blob.arrayBuffer())), type]);
	}
	if (isDesktop()) {
		for (const [key, b64, type] of prepared) {
			await inv('data_write_icon', { name: `${key}.${extOf(type)}`, base64: b64 });
		}
		await writeText('icons/_manifest.json', JSON.stringify(manifest, null, 2));
		return;
	}
	const { FS, DIR } = await capfs();
	for (const [key, b64, type] of prepared) {
		await FS.writeFile({
			path: `data/icons/${key}.${extOf(type)}`,
			data: b64,
			directory: DIR.External,
			recursive: true
		});
	}
	await writeText('icons/_manifest.json', JSON.stringify(manifest, null, 2));
}

// ---------- 全量 dump（防抖） ----------
let timer = null;
export const scheduleMirror = () => {
	if (!enabled()) return;
	clearTimeout(timer);
	timer = setTimeout(dumpAll, 800);
};

async function dumpAll() {
	try {
		const cfg = localStorage.getItem(CONFIG_KEY);
		if (cfg) await writeText('config.json', JSON.stringify(JSON.parse(cfg), null, 2));
		const rc = localStorage.getItem(ROLLCALL_KEY);
		if (rc) await writeText('rollcall.json', JSON.stringify(JSON.parse(rc), null, 2));
		await writeText('history.json', JSON.stringify(await HistoryManager.getAllHistories(), null, 2));
		await writeText('banners.json', JSON.stringify(await BannerManager.getAll(), null, 2));
		const icons = await AssetManager.getAll();
		await writeIcons(icons.map((r) => ({ key: r.key, blob: r.blob, type: r.type })));
	} catch (e) {
		// 镜像失败不影响应用本体（数据仍在 localStorage/IDB），只记日志
		console.error('数据镜像写入失败：', e);
	}
}

// ---------- 启动恢复：本地为空则从文件回填 ----------
export async function initFileMirror() {
	if (!enabled()) return;
	try {
		if (!localStorage.getItem(CONFIG_KEY)) {
			const t = await readText('config.json');
			if (t) localStorage.setItem(CONFIG_KEY, t);
		}
		if (!localStorage.getItem(ROLLCALL_KEY)) {
			const t = await readText('rollcall.json');
			if (t) localStorage.setItem(ROLLCALL_KEY, t);
		}
		if ((await HistoryManager.historyCount()) === 0) {
			const t = await readText('history.json');
			for (const rec of t ? JSON.parse(t) : []) await HistoryManager.addHistory(rec);
		}
		if ((await BannerManager.getAll()).length === 0) {
			const t = await readText('banners.json');
			for (const rec of t ? JSON.parse(t) : []) await BannerManager.put(rec);
		}
		if ((await AssetManager.getAll()).length === 0) {
			for (const rec of await readIcons()) {
				await AssetManager.put({ key: rec.key, blob: rec.blob, type: rec.blob.type });
			}
		}
	} catch (e) {
		console.error('数据镜像恢复失败：', e);
	}
	// 挂监听：任一数据源变化都触发防抖 dump（storageUpdate=config、rollcallUpdate=名单、
	// dataMirrorUpdate=history/banner/图标）
	['storageUpdate', 'rollcallUpdate', MIRROR_EVENT].forEach((ev) =>
		document.addEventListener(ev, scheduleMirror)
	);
}

export const mirrorEventName = MIRROR_EVENT;
export const fireMirror = () => document.dispatchEvent(new Event(MIRROR_EVENT));
