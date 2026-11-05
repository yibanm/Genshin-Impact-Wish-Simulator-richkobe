import { AssetManager } from './api-indexeddb';
import {
	autoExport,
	fileData,
	fileHandle as storeHandle,
	savingToSystem
} from '$lib/store/filesystem-store';
import { browserDetect } from '../mobileDetect';
import { generateFileString, parseFileObj } from './export-import';

export const FSSupported = () => {
	const { isSupported: browserSupported } = browserDetect();
	const oldMethodSuppported = 'chooseFileSystemEntries' in window;
	const newMethodSupported = 'showSaveFilePicker' in window;
	return browserSupported && (oldMethodSuppported || newMethodSupported);
};

export const calculateByteSize = (size) => {
	if (isNaN(size)) return '...B';
	const mb = (size / (1024 * 1024)).toFixed(2);
	return `${mb}MB`;
};

const setFileStore = async (fileHandle) => {
	if (!fileHandle) return fileData.set({});
	const { name, size, webkitRelativePath, lastModified } = await fileHandle.getFile();
	fileData.set({ name, size, webkitRelativePath, lastModified });
};

const saveHandle = async (fileHandle) => {
	const data = { key: 'savedFile', fileHandle };
	const save = await AssetManager.put(data);
	return save;
};

export const readFileHandle = async () => {
	const { fileHandle } = (await AssetManager.get('savedFile')) || {};
	if (!fileHandle) return null;
	fileData.set({ name: fileHandle.name });
	storeHandle.set(fileHandle);
};

const clearLocalFile = async () => {
	await AssetManager.delete('savedFile');
	fileData.set({});
	autoExport.set(false);
};

export const checkFileExist = async (fileHandle) => {
	try {
		const fileExist = await fileHandle.getFile();
		return fileExist;
	} catch (e) {
		clearLocalFile();
		return false;
	}
};

export const verifyFSPermission = async (fileHandle, { checkOnly = false } = {}) => {
	if (!fileHandle) return false;
	const opts = { writable: true, mode: 'readwrite' };
	if (checkOnly) return (await fileHandle.queryPermission(opts)) === 'granted';
	if ((await fileHandle.queryPermission(opts)) === 'granted') return true;
	if ((await fileHandle.requestPermission(opts)) === 'granted') return true;
	return false;
};

const getNewFileHandle = () => {
	const date = new Date().toLocaleDateString();
	const suggestedName = `genshin-wish-roll_Backup_${date}.bin`;
	// For Chrome 86 and later...
	if ('showSaveFilePicker' in window) {
		const opts = {
			suggestedName,
			types: [
				{
					description: 'Text file',
					accept: { 'text/plain': ['.bin'] }
				}
			]
		};
		return window.showSaveFilePicker(opts);
	}

	// For Chrome 85 and earlier...
	const opts = {
		type: 'save-file',
		accepts: [
			{
				description: 'Text file',
				extensions: ['bin'],
				mimeTypes: ['text/plain']
			}
		]
	};
	return window.chooseFileSystemEntries({ opts });
};

const writeFile = async (fileHandle, contents) => {
	// Support for Chrome 82 and earlier.
	if (fileHandle.createWriter) {
		const writer = await fileHandle.createWriter();
		await writer.write(0, contents);
		await writer.close();
		return;
	}
	// For Chrome 83 and later.
	const writable = await fileHandle.createWritable();
	await writable.write(contents);
	await writable.close();
};

export const saveExport = async () => {
	try {
		savingToSystem.set(true);
		const fileHandle = await getNewFileHandle();
		const fileString = await generateFileString();
		await writeFile(fileHandle, fileString);
		await saveHandle(fileHandle);

		setFileStore(fileHandle);
		storeHandle.set(fileHandle);
		autoExport.set(true);
		savingToSystem.set(false);
		return fileHandle;
	} catch (e) {
		console.error('failed to save export', e);
		savingToSystem.set(false);
	}
};

export const renewSavedFile = async () => {
	try {
		savingToSystem.set(true);
		const { fileHandle } = await AssetManager.get('savedFile');
		if (!fileHandle) return savingToSystem.set(false); //no filehandle detected

		const isExist = await checkFileExist(fileHandle);
		if (!isExist) {
			throw new Error('Destination File does not exist, Auto Export will be turned off');
		}

		const fileString = await generateFileString();
		await writeFile(fileHandle, fileString);
		await setFileStore(fileHandle);
		savingToSystem.set(false);
	} catch (e) {
		console.error('Auto Export Failed:', e.message);
		savingToSystem.set(false);
	}
};

/**
 * 删除自动导出绑定的本地备份文件（2026-11-05 用户要求：删除名单时可选勾选）。
 * File System Access API 的 remove() 只删 handle 指向的那一个文件，不递归、不碰目录。
 * 无绑定文件、文件已不存在、或浏览器不支持 remove 时静默返回 false（不算故障）。
 */
export const deleteSavedBackupFile = async () => {
	try {
		const { fileHandle } = (await AssetManager.get('savedFile')) || {};
		if (!fileHandle) return false;
		if (typeof fileHandle.remove === 'function') await fileHandle.remove();
		await clearLocalFile();
		return true;
	} catch (e) {
		// 用户已手动删过文件、或权限失效：清掉内部绑定即可，不报错打扰
		console.error('删除本地备份文件失败（已解除绑定）：', e);
		await clearLocalFile();
		return false;
	}
};

// Read Import File
const getFileData = async (handle) => {
	const { fileHandle: currentHandle } = await AssetManager.get('savedFile');
	const isSameHandle = await handle.isSameEntry(currentHandle);
	if (isSameHandle) throw new Error('You cannot import the currently exported file.');

	const file = await handle.getFile();
	const parsedFile = await parseFileObj(file);
	return { handle, file, parsedFile };
};

export const readDropedFile = async (items) => {
	const fileHandlesPromises = [...items]
		.filter((item) => item.kind === 'file')
		.map((item) => item.getAsFileSystemHandle());

	for await (const handle of fileHandlesPromises) {
		if (handle.kind !== 'file') continue;
		return getFileData(handle);
	}
};

// export const showFilePicker = async () => {
// 	const pickerOptions = {
// 		types: [
// 			{
// 				accept: {
// 					'application/octet-stream': ['.bin'],
// 					'application/json': ['.json'],
// 					'text/plain': ['.txt']
// 				}
// 			}
// 		],
// 		excludeAcceptAllOption: true,
// 		multiple: false
// 	};
// 	const [handle] = await window.showOpenFilePicker(pickerOptions);
// 	return getFileData(handle);
// };

