import { BannerManager, HistoryManager } from './api-indexeddb';
import { cookie } from './api-cookie';
import { storageLocal } from './api-localstore';
import { randomNumber } from '../gacha/itemdrop-base';
import { saveTextFileNative } from '../platform';

const generateExportID = () => {
	const { id } = storageLocal.get('export');
	const exportID = id || `GI${randomNumber(111111111, 999999999)}`;
	const date = new Date();
	storageLocal.set('export', { id: exportID, date });
};

export const generateFileString = async () => {
	const banners = await BannerManager.getAll();
	const histories = await HistoryManager.getAllHistories();
	const accessKey = cookie.get('accessKey');

	generateExportID();
	const settings = storageLocal.getData();
	const dataToExport = { banners, histories, settings, accessKey };
	return JSON.stringify(dataToExport);
};

export const exportFileLegacy = async () => {
	const text = await generateFileString();
	const date = new Date().toLocaleDateString();
	const filename = `genshin-wish-roll_Backup_${date}.bin`;

	// 安卓原生壳里 WebView 没有下载管理器，下面的 <a download> 点击会被静默忽略
	// （表现就是「导出按钮失效」）。先走原生通道：写缓存目录 + 系统分享面板。
	const handledNatively = await saveTextFileNative(text, filename);
	if (handledNatively) return;

	const blob = new Blob([text], { type: 'text/plain' });
	const anchor = document.createElement('a');

	anchor.download = filename;
	anchor.href = (window.webkitURL || window.URL).createObjectURL(blob);
	anchor.dataset.downloadurl = ['text/plain', anchor.download, anchor.href].join(':');
	anchor.click();
};

export const allowedType = 'application/octet-stream, application/json, text/plain';
const isValidBackupFile = (file) => {
	const checkType = allowedType.match(file.type);
	const checkExt = file.name.match(/.(bin|json|txt)$/);
	const isValidFile = checkType && checkExt;
	return isValidFile;
};

const verifyBackupFile = async (file) => {
	try {
		const fileContent = await file.text();
		const parsed = JSON.parse(fileContent);
		const { id } = parsed?.settings?.data?.export || {};
		if (!id) return null;
		return parsed;
	} catch (e) {
		return null;
	}
};

export const parseFileObj = async (file) => {
	const isValidFile = isValidBackupFile(file);
	if (!isValidFile) throw new Error('Not a valid Backup File');

	const parsedFile = await verifyBackupFile(file);
	if (!parsedFile) throw new Error('Failed to parse imported file');
	return parsedFile;
};

export const importFileLegacy = async (files) => {
	const file = files[0];
	const parsedFile = await parseFileObj(file);
	return { file, parsedFile };
};

