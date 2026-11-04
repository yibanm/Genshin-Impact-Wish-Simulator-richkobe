import { writable } from 'svelte/store';
import { assets } from '$lib/store/app-stores';
import { AssetManager } from './dataAPI/api-indexeddb';
import { isSafari } from './mobileDetect';

const itemRarity = [3, 3, 4, 4, 5, 5];
const meteorList = [
	'bg.webm',
	'3star-single.mp4',
	'4star-single.mp4',
	'4star-multi.mp4',
	'5star-single.mp4',
	'5star-multi.mp4',
	'capturing-radiance.mp4'
];

export const check = async () => {
	const loadedData = [];

	// Load video from network directly if user use Safari browser
	if (isSafari()) return safariMeteorLoader();

	// Read blob data from storage if using chrome
	for (let i = 0; i < meteorList.length; i++) {
		const key = meteorList[i];
		const storedData = await AssetManager.get(key);
		if (!storedData) continue;
		loadedData.push(storedData);
	}

	const allComplete = loadedData.length === meteorList.length;
	if (allComplete) {
		const DOMURL = window.URL || window.webkitURL;
		assets.update((v) => {
			loadedData.forEach(({ key, blob }) => (v[key] = DOMURL.createObjectURL(blob)));
			return v;
		});
	}
	return allComplete;
};

const safariMeteorLoader = () => {
	assets.update((v) => {
		meteorList.forEach((vid) => (v[vid] = `/videos/${vid}`));
		return v;
	});
	return true;
};

export const loadProggress = writable({ rarity: '', progress: 0, totalItem: 0, itemNumber: 0 });

/**
 * 拉取单个视频并存入 IDB，失败重试一次。
 * 原 loadAnimation 无容错：7 个视频串行 fetch，任一失败整链 throw，
 * 调用方也没 catch → readyToPull 永远 false、祈愿按钮永久灰色（用户报的 bug）。
 */
const fetchAndStore = async (key) => {
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const response = await fetch(`/videos/${key}`);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = new Response(streamResponse(response));
			const blob = await data.blob();
			if (!blob.size) throw new Error('empty blob');
			await AssetManager.put({ key, blob });
			const DOMURL = window.URL || window.webkitURL;
			return { asset: key, url: DOMURL.createObjectURL(blob) };
		} catch (e) {
			console.error(`流星视频 ${key} 第 ${attempt + 1} 次加载失败：`, e);
			if (attempt === 1) return null;
		}
	}
	return null;
};

export const loadAnimation = async () => {
	const results = [];
	const totalItem = meteorList.length;
	for (let i = 0; i < totalItem; i++) {
		loadProggress.set({ rarity: itemRarity[i], progress: 0, totalItem, itemIndex: i });
		const one = await fetchAndStore(meteorList[i]);
		if (one) results.push(one);
	}
	return results;
};

/**
 * 后台补齐流星素材（2026-11-04 用户裁定：修后台预载失败，不绕过门控）。
 * 启动后自动调用：IDB 缺哪个补哪个，单个失败不影响其余；
 * 全部就绪才把素材挂上 assets store 并返回 true。
 * 不弹进度 UI（后台静默），手动「加载」按钮仍作为兜底入口保留。
 */
export const ensureMeteorAssets = async () => {
	if (isSafari()) return safariMeteorLoader();

	const missing = [];
	const loadedData = [];
	for (const key of meteorList) {
		const stored = await AssetManager.get(key).catch(() => null);
		if (stored) loadedData.push(stored);
		else missing.push(key);
	}

	for (const key of missing) {
		const one = await fetchAndStore(key);
		if (one) {
			const stored = await AssetManager.get(key).catch(() => null);
			if (stored) loadedData.push(stored);
		}
	}

	const allComplete = loadedData.length === meteorList.length;
	if (allComplete) {
		const DOMURL = window.URL || window.webkitURL;
		assets.update((v) => {
			loadedData.forEach(({ key, blob }) => (v[key] = DOMURL.createObjectURL(blob)));
			return v;
		});
	}
	return allComplete;
};

const streamResponse = (response) => {
	const contentLength = response.headers.get('content-length');
	return new ReadableStream({
		start(controller) {
			const reader = response.body.getReader();
			readStream(controller, reader, contentLength);
		}
	});
};

let loaded = 0;
const readStream = (controller, reader, contentLength) => {
	reader.read().then((progressEvent) => {
		if (progressEvent.done) {
			controller.close();
			loaded = 0;
			return;
		}

		loadProggress.update((v) => {
			loaded += progressEvent.value.byteLength;
			v.progress = Math.round((loaded / contentLength) * 100);
			return v;
		});
		controller.enqueue(progressEvent.value);
		readStream(controller, reader, contentLength);
	});
};
