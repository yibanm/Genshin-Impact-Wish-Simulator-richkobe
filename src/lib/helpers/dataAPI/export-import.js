import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { BannerManager, HistoryManager, AssetManager } from './api-indexeddb';
import { cookie } from './api-cookie';
import { storageLocal } from './api-localstore';
import { randomNumber } from '../gacha/itemdrop-base';
import { saveBlobWithPicker, saveTextFileNative } from '../platform';
import { fireMirror } from './api-filestore';

const generateExportID = () => {
	const { id } = storageLocal.get('export');
	const exportID = id || `GI${randomNumber(111111111, 999999999)}`;
	const date = new Date();
	storageLocal.set('export', { id: exportID, date });
};

/**
 * 收集全部用户数据（与 data/ 明文镜像同分类）。
 * 图标是二进制，单独放 icons/ 目录 + manifest 记 key→type。
 */
const collectAll = async () => {
	const banners = await BannerManager.getAll();
	const histories = await HistoryManager.getAllHistories();
	const accessKey = cookie.get('accessKey');
	generateExportID();
	const settings = storageLocal.getData();
	const rollcallRaw = localStorage.getItem('rollcall');
	const icons = await AssetManager.getAll();

	const files = {
		'config.json': strToU8(JSON.stringify({ settings, accessKey }, null, 2)),
		'history.json': strToU8(JSON.stringify(histories, null, 2)),
		'banners.json': strToU8(JSON.stringify(banners, null, 2)),
		'manifest.json': strToU8(
			JSON.stringify({ app: 'genshin-wish-roll', format: 'zip-plain', version: 2, exportedAt: new Date().toISOString() }, null, 2)
		)
	};
	if (rollcallRaw) files['rollcall.json'] = strToU8(JSON.stringify(JSON.parse(rollcallRaw), null, 2));
	const manifest = {};
	for (const rec of icons) {
		if (!rec?.key || !rec?.blob) continue;
		const type = rec.type || rec.blob.type || 'image/png';
		manifest[rec.key] = { type };
		// 图标在 zip 内直接存原始二进制（fflate 收 Uint8Array）
		files[`icons/${encodeURIComponent(rec.key)}.${extOf(type)}`] = new Uint8Array(
			await rec.blob.arrayBuffer()
		);
	}
	files['icons/_manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
	return files;
};

const extOf = (type) =>
	({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' })[type] || 'bin';

/** zip 文件名带日期时间（用户 2026-11-07 补加） */
export const stampFilename = () => {
	const d = new Date();
	const p = (n) => String(n).padStart(2, '0');
	return `genshin-wish-roll_Backup_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.zip`;
};

/**
 * 全量备份的 zip Blob（api-filesystem 的 FS handle 路径与 exportFileLegacy 共用）。
 * 名字保留 generateFileString 是因为 api-filesystem.js 按此名 import；
 * 返回类型从文本变为 zip Blob，写入端 createWritable 对 Blob 同样支持。
 */
export const generateFileString = async () => {
	const files = await collectAll();
	return new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' });
};

export const exportFileLegacy = async () => {
	const blob = await generateFileString();
	const filename = stampFilename();

	// 安卓弹系统选择器自选位置、桌面弹另存为；都失败才回 Web 下载
	const handled = await saveBlobWithPicker(blob, filename, 'application/zip');
	if (handled) {
		fireMirror();
		return;
	}
	const anchor = document.createElement('a');
	anchor.download = filename;
	anchor.href = (window.webkitURL || window.URL).createObjectURL(blob);
	anchor.click();
	fireMirror();
};

export const allowedType = 'application/octet-stream, application/json, text/plain, application/zip, application/x-zip-compressed';
const isValidBackupFile = (file) => {
	const checkExt = file.name.match(/\.(bin|json|txt|zip)$/);
	const checkType = allowedType.includes(file.type) || checkExt;
	return Boolean(checkType && checkExt);
};

/** zip → placeDataToAppDB 要的 {banners, histories, settings, accessKey} 形状 */
const parsedFromZip = async (buf) => {
	const entries = unzipSync(new Uint8Array(buf));
	const text = (name) => (entries[name] ? JSON.parse(strFromU8(entries[name])) : null);

	const cfg = text('config.json') || {};
	const histories = text('history.json') || [];
	const banners = text('banners.json') || [];
	const rollcall = text('rollcall.json');
	const iconManifest = text('icons/_manifest.json') || {};

	// 图标二进制回灌 IDB（zip 内即原始字节）
	for (const [path, u8] of Object.entries(entries)) {
		if (!path.startsWith('icons/') || path.endsWith('_manifest.json')) continue;
		const key = decodeURIComponent(path.slice(6, path.lastIndexOf('.')));
		const type = iconManifest[key]?.type || 'image/png';
		await AssetManager.put({ key, blob: new Blob([u8], { type }), type });
	}
	if (rollcall) localStorage.setItem('rollcall', JSON.stringify(rollcall));

	return {
		banners,
		histories,
		settings: cfg.settings || { data: {} },
		accessKey: cfg.accessKey || null
	};
};

const verifyBackupFile = async (file) => {
	try {
		const buf = await file.arrayBuffer();
		const u8 = new Uint8Array(buf);
		// 按内容魔数判 zip（PK\x03\x04），不按扩展名——旧 FS handle 是 .bin
		// 扩展名但自动导出已写入 zip 内容，按扩展名会误拒
		const isZip = u8[0] === 0x50 && u8[1] === 0x4b;
		if (isZip) {
			const parsed = await parsedFromZip(buf);
			if (!parsed?.settings) return null;
			return parsed;
		}
		const parsed = JSON.parse(new TextDecoder().decode(u8));
		const { id } = parsed?.settings?.data?.export || {};
		if (!id) return null;
		return parsed; // 旧单 JSON 备份兼容
	} catch (e) {
		return null;
	}
};

export const parseFileObj = async (file) => {
	if (!isValidBackupFile(file)) throw new Error('Not a valid Backup File');
	const parsedFile = await verifyBackupFile(file);
	if (!parsedFile) throw new Error('Failed to parse imported file');
	return parsedFile;
};

export const importFileLegacy = async (files) => {
	const file = files[0];
	const parsedFile = await parseFileObj(file);
	return { file, parsedFile };
};
