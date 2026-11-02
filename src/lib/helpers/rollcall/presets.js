import { data as charsData } from '$lib/data/characters.json';
import { data as weaponsData } from '$lib/data/weapons.json';

/**
 * 预置名单（点名用）——从游戏数据自动生成，游戏数据更新到哪个版本，名单即同步到哪个版本。
 *
 * 与自定义名单的区别：
 * - 预置名单 builtin=true，运行时由数据生成，不落库，因此「同步更新」无需用户操作；
 * - 预置名单的每一项自带 rarity（来自 characters.json / weapons.json 的真实稀有度），
 *   点名结果直接沿用该稀有度，卡面金光/紫光与原版皮肤表现一致；
 * - 自定义名单默认纯文字、无 rarity，点名时按随机规则分配星级（复刻原版壳层体验），
 *   用户可为单条导入图标。
 *
 * icon 字段是 assets.js 里的键名（不是路径）：
 * - 角色头像键名为 `face/<name>`（见 assets.js 的 `key.match(/face\//)` 分支）
 * - 武器图标键名为 `<weaponName>`（见 assets.js 的 `(banner|weapons)` 分支，无前缀）
 *
 * 注意：预置名单只包含游戏角色与武器，不包含任何真实人物名单。
 * 班级/小组这类真实姓名名单必须由用户自己在本地导入 TXT（一人一行），
 * 存入 localStorage，既不进代码仓库也不进构建产物。
 */

// 角色按稀有度分档，与 face 图目录划分一致
const char5 = charsData.filter(({ rarity }) => rarity === 5);
const char4 = charsData.filter(({ rarity }) => rarity === 4);

// 武器按稀有度分档
const weapon5 = weaponsData.filter(({ rarity }) => rarity === 5);
const weapon4 = weaponsData.filter(({ rarity }) => rarity === 4);

const toMember = (item, iconKey) => ({
	name: item.name,
	// 预置名单不写 chineseChar：它的中文名要经语言包查询（角色是 `${name}.name`，
	// 武器是 `${name}`），写死会在切换语言时出错。展示统一走 memberDisplayName()。
	chineseChar: null,
	rarity: item.rarity,
	// iconType 决定 UI 用哪种样式取图：char 走 face/<name>，weapon 走武器键名
	iconType: iconKey,
	// 预置项不存自定义图片，UI 直接用 assets 里的现成素材
	icon: null
});

export const builtinLists = [
	{
		id: 'preset-char-5star',
		label: '五星角色',
		builtin: true,
		items: char5.map((c) => toMember(c, 'char'))
	},
	{
		id: 'preset-char-4star',
		label: '四星角色',
		builtin: true,
		items: char4.map((c) => toMember(c, 'char'))
	},
	{
		id: 'preset-char-all',
		label: '全部角色',
		builtin: true,
		items: [...char5, ...char4].map((c) => toMember(c, 'char'))
	},
	{
		id: 'preset-weapon-5star',
		label: '五星武器',
		builtin: true,
		items: weapon5.map((w) => toMember(w, 'weapon'))
	},
	{
		id: 'preset-weapon-4star',
		label: '四星武器',
		builtin: true,
		items: weapon4.map((w) => toMember(w, 'weapon'))
	},
	{
		id: 'preset-weapon-all',
		label: '全部武器',
		builtin: true,
		items: [...weapon5, ...weapon4].map((w) => toMember(w, 'weapon'))
	}
];

export const builtinListById = (id) => builtinLists.find((l) => l.id === id) || null;
