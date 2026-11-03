/**
 * 点名结果的展示名（中文修改版）
 *
 * 三种来源的取法不同：
 * - 预置角色名单：名字是 slug（如 lauma），中文名在语言包 `${slug}.name`
 * - 预置武器名单：名字是 slug，中文名在语言包 `${slug}`（武器键不带 .name 后缀）
 * - 自定义名单：录入时就是显示名，直接用 chineseChar / name
 *
 * 语言包查不到时回退到原始 name，避免界面显示 undefined。
 *
 * @param {Object} item 点名结果条目（含 name / chineseChar / iconType）
 * @param {Function} translate svelte-i18n 的 t 函数（或 get(t) 的结果）
 * @returns {string} 展示名
 */
export const memberDisplayName = (item, translate) => {
	if (!item) return '';
	// 自定义名单：录入内容即显示内容
	if (!item.iconType) return item.chineseChar || item.name || '';
	if (typeof translate !== 'function') return item.name || '';

	if (item.iconType === 'char') {
		const key = `${item.name}.name`;
		const translated = translate(key);
		return translated === key ? item.name : translated;
	}
	if (item.iconType === 'weapon') {
		const translated = translate(item.name);
		return translated === item.name ? item.name : translated;
	}
	return item.chineseChar || item.name || '';
};
