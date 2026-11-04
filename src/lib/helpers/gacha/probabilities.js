import { probabilityRates } from '$lib/data/wish-setup.json';
import { localrate } from '../dataAPI/api-localstore';

export const rates = ({
	currentPity = 0,
	maxPity = 90,
	baseRate = 0.6,
	rateIncreasedAt = 74
} = {}) => {
	if (baseRate <= 0 && currentPity < maxPity) return 0;
	if (currentPity < rateIncreasedAt) return baseRate;

	if (currentPity >= maxPity) return 100;

	const rateIncreasedBy = (100 - baseRate) / (maxPity + 1 - rateIncreasedAt);
	const rateBeforeCurrentPity = (currentPity + 1 - rateIncreasedAt) * rateIncreasedBy;
	const increasedRate = rateBeforeCurrentPity + baseRate;
	return increasedRate;
};

// Random Item by probability
export const prob = (items) => {
	let chances = [];
	for (let i = 0; i < items.length; i++) {
		chances[i] = items[i].chance + (chances[i - 1] || 0);
	}
	const random = Math.random() * chances[chances.length - 1];
	const result = items[chances.findIndex((chance) => chance > random)];
	return result;
};

// Read Custom Probability
export const getRate = (banner, key) => {
	if (banner === 'beginner') {
		const initial = probabilityRates['character-event'];
		return initial[key];
	}

	// 自定义卡池页签（type: 'custom'）没有独立默认概率表，初始值沿用角色活动池；
	// 但用户修改存独立 'custom' 键，避免调自定义池概率时误改官方角色池。
	const tableKey = banner === 'custom' ? 'character-event' : banner;
	const initial = probabilityRates[tableKey];
	const local = localrate.get(banner);
	if (!(local[key] || local[key] >= 0)) return initial[key] || 0;

	const val = parseFloat(local[key]);
	if (isNaN(val)) return local[key] || 0;
	return val || 0;
};

export const setRate = (banner, key, val) => {
	const local = localrate.get(banner);
	if (typeof val === 'boolean') {
		local[key] = val;
	} else {
		const value = parseFloat(val);
		if (isNaN(value)) local[key] = val;
		else local[key] = value;
	}

	localrate.set(banner, local);
};
