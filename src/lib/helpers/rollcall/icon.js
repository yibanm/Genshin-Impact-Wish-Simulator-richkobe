import { getIconBlob } from '../dataAPI/api-rollcall';

/**
 * 把点名结果的图标解析成可直接给 <img src> 用的地址。
 *
 * F3（2026-11-04）后预置角色/武器名单已删除，图标只有一种来源：
 * 用户为条目导入的图片（blob 存 IndexedDB，名单里记 iconKey）。
 *
 * blob → objectURL 是异步的，且每次转换都会占用内存，
 * 因此按 iconKey 缓存，同一个图标只创建一次。
 */

const urlCache = new Map();

/**
 * @param {Array} results drawMembers 的结果数组
 * @returns {Promise<Array>} 每条补上 iconUrl 字段（无图标则为 null）
 */
export const attachIconUrls = async (results) => {
	const withIcon = await Promise.all(
		results.map(async (item) => {
			if (!item.iconKey) return { ...item, iconUrl: null };
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
		})
	);

	return withIcon;
};
