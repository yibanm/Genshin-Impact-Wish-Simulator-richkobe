import {
	getEnabledPool,
	readPoolRemaining,
	writePoolRemaining,
	getPoolStats
} from '../dataAPI/api-rollcall';

/**
 * 点名抽取算法（中文魔改版核心）
 *
 * 复刻原版 Electron 壳层已验证的做法：洗牌池 + pop 取人，保证「一轮内绝不重复」。
 * 与随机抽卡不同，点名的核心诉求是公平——每个人在一轮里被点到一次，
 * 点完一轮才重新洗牌开始下一轮。
 *
 * 池进度不自己读写 localStorage，而是走 api-rollcall 的 readPoolRemaining /
 * writePoolRemaining（单一数据源）。否则会和名单管理页的内存缓存互相覆盖，
 * 导致同一个人被点到两次。
 *
 * 星级规则：
 * - 预置名单条目自带真实 rarity（来自角色/武器数据），直接沿用，
 *   卡面金光/紫光与原版皮肤一致；
 * - 自定义名单条目无 rarity，按随机规则分配（复刻壳层）：
 *   单抽 50% 三星 / 30% 四星 / 20% 五星；
 *   十连第一个强制五星，其余 60% 三星 / 40% 四星。
 */

/** Fisher-Yates 洗牌（原地打乱并返回） */
const shuffle = (arr) => {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
};

/** 自定义名单条目的随机星级（复刻壳层规则） */
const randomRarity = (isFirstOfMulti) => {
	if (isFirstOfMulti) return 5;
	const r = Math.random();
	if (r < 0.6) return 3;
	return 4;
};

const singleRarity = () => {
	const r = Math.random();
	if (r < 0.5) return 3;
	if (r < 0.8) return 4;
	return 5;
};

/** 星辉/星尘结算数量，与原抽卡的里程碑规则保持一致 */
const bonusQtyOf = (rarity) => (rarity === 3 ? 15 : rarity === 4 ? 2 : 10);

/** 把池内索引转成与原抽卡结果对象兼容的条目 */
const toResult = (member, rarity) => ({
	type: 'member',
	name: member.name,
	chineseChar: member.chineseChar || member.name,
	rarity,
	iconKey: member.iconKey || null,
	iconType: member.iconType || null,
	fromLabel: member.fromLabel,
	// 下面这些是复用原结果卡渲染所需的字段，点名没有真实游戏物品，给固定值
	weaponType: 'catalyst',
	pity: 1,
	isNew: false,
	bonusType: 'starglitter',
	bonusQty: bonusQtyOf(rarity)
});

/**
 * 抽取 count 个人名。
 * @param {number} count 抽取数量（1 或十连）
 * @returns {Array} 结果数组；未勾选任何名单或名单为空时返回空数组
 */
export const drawMembers = (count = 1) => {
	const full = getEnabledPool();
	// 没勾选名单/名单为空时不能抽，由调用方（doRoll）负责提示
	if (!full.length) return [];

	let remaining = readPoolRemaining(full);
	const results = [];
	// 十连时池内人数不够，先把本轮已点的人整轮倒出（复刻壳层行为），再重洗补齐
	let carried = [];
	if (count > remaining.length) {
		carried = remaining.slice();
		remaining = [];
	}

	const refill = () => {
		// 池内存索引而非整份名单，避免把大名单反复序列化进 localStorage
		remaining = remaining.concat(shuffle(full.map((_, i) => i)));
	};

	if (!remaining.length) refill();

	for (let i = 0; i < count; i++) {
		if (!remaining.length) refill();
		const idx = remaining.pop();
		const member = full[idx];
		// 池索引可能因名单被编辑而越界，跳过并继续，避免崩溃
		if (!member) continue;
		const rarity = member.rarity || randomRarity(i === 0 && count > 1);
		results.push(toResult(member, rarity));
	}

	// 单抽抽空后立刻重洗，让下一抽直接从新一轮开始（复刻壳层 Ft.length===0 && $l(Hs)）
	if (count === 1 && !remaining.length) refill();

	writePoolRemaining(full, remaining);

	// 十连人数不足时，上一轮的人排在前面展示（他们本该在这一轮被点到）
	if (carried.length) {
		const carriedResults = carried
			.map((idx) => full[idx])
			.filter(Boolean)
			.map((m) => toResult(m, m.rarity || singleRarity()));
		return carriedResults.concat(results).slice(0, count);
	}

	return results;
};

/** 当前池进度（已点 / 总数），转发给 UI 使用 */
export { getPoolStats };
