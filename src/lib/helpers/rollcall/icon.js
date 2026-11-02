import { assets } from '$lib/store/app-stores';
import { get } from 'svelte/store';
import { getIconBlob } from '../dataAPI/api-rollcall';

/**
 * 把点名结果的图标解析成可直接给 <img src> 用的地址。
 *
 * 三种来源：
 * 1. 预置名单的角色：assets 里的 `face/<name>`（现成头像素材）
 * 2. 预置名单的武器：assets 里的 `<name>`（现成武器图标，无前缀）
 * 3. 自定义名单导入的图片：IndexedDB 里的 blob，需转成 objectURL
 *
 * blob → objectURL 是异步的，且每次转换都会占用内存，
 * 因此按 iconKey 缓存，同一个图标只创建一次。
 */

const urlCache = new Map();

const presetIcon = (item, assetsMap) => {
	if (!item.name) return null;
	if (item.iconType === 'char') return assetsMap[`face/${item.name}`] || null;
	if (item.iconType === 'weapon') return assetsMap[item.name] || null;
	return null;
};

/**
 * @param {Array} results drawMembers 的结果数组
 * @returns {Promise<Array>} 每条补上 iconUrl 字段（无图标则为 null）
 */
export const attachIconUrls = async (results) => {
	const assetsMap = get(assets) || {};

	const withIcon = await Promise.all(
		results.map(async (item) => {
			// 自定义导入的图标优先
			if (item.iconKey) {
				let url = urlCache.get(item.iconKey);
				if (!url) {
					try {
						const blob = await getIconBlob(item.iconKey);
						if (blob) {
							url = URL.createObjectURL(blob);
							urlCache.set(item.iconKey, url);
						}
					} catch (e) {
						console.error('读取点名图标失败：', e);
					}
				}
				return { ...item, iconUrl: url || null };
			}
			return { ...item, iconUrl: presetIcon(item, assetsMap) };
		})
	);

	return withIcon;
};
