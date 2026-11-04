/**
 * 点名结果的展示名（本项目）
 *
 * F3（2026-11-04）后预置角色/武器名单已全部删除，名单条目只有用户自建一种：
 * 录入时就是显示名，直接用 chineseChar / name。
 * 保留 iconType 兼容判断：历史数据里若残留预置条目（iconType 为 char/weapon），
 * 直接回退显示原始 name，不再查语言包（语言包键已无对应预置语义）。
 *
 * @param {Object} item 点名结果条目（含 name / chineseChar）
 * @returns {string} 展示名
 */
export const memberDisplayName = (item) => {
	if (!item) return '';
	return item.chineseChar || item.name || '';
};
