import { get } from 'svelte/store';
import { beginner } from '$lib/data/banners/beginner.json';
import { standard } from '$lib/data/banners/standard.json';
import { version, wishPhase } from '$lib/data/wish-setup.json';

import { imageCDN } from './assets';
import { BannerManager } from './dataAPI/api-indexeddb';
import { localConfig, rollCounter } from './dataAPI/api-localstore';
import {
	activeBanner,
	activeVersion,
	bannerList,
	customData,
	editorMode,
	isCustomBanner,
	isFatepointSystem,
	preloadVersion,
	showBeginner
} from '$lib/store/app-stores';

const idb = BannerManager;

/**
 * 把 IDB 里的自定义卡池数据转成 bannerList 的一个元素。
 * C1/C2 重构核心：自定义池不再是「替换整个列表 + 隐藏页签栏」的特殊模式，
 * 而是页签栏里排在末尾的一个普通页签（type: 'custom'），与官方池同级可切换。
 */
const customEntryFromData = (data) => {
	const {
		bannerName = '',
		character = '',
		rateup = [],
		images = {},
		hostedImages = {},
		vision = 'pyro',
		charTitle = '',
		artPosition = {},
		watermark = '',
		status = null,
		itemID
	} = data || {};

	const dataIMG = status === 'owned' ? images : imageCDN(hostedImages);
	return {
		type: 'custom',
		itemID,
		bannerName,
		character,
		rateup,
		images: dataIMG,
		vision,
		charTitle,
		artPosition,
		watermark
	};
};

/** 读取当前自定义卡池（无则返回 null）。自定义池在本地只存一条记录。 */
const loadCustomEntry = async () => {
	try {
		const all = await idb.getAll();
		const alive = (all || []).filter((b) => b && !b.deleted);
		if (!alive.length) return null;
		// 多条时取最近修改的一条（本地单条语义，兼容历史多条目数据）
		alive.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
		return customEntryFromData(alive[0]);
	} catch (e) {
		console.error(e);
		return null;
	}
};

/**
 * 切到自定义卡池页签（编辑完成 / 从菜单进入时调用）。
 * 列表里还没有自定义页签就先追加，再把 activeBanner 指过去。
 *
 * ⚠️ 不改 activeVersion：抽卡引擎实例按 activeVersion 初始化（Wish.init 见到
 * 'Custom' 会走 _initCustom 整实例自定义通道），一旦改掉，官方页签的抽卡就会
 * 用自定义数据出物。自定义页签的出物走 Wish._customWish，从当前页签读数据，
 * 与实例初始化路径无关。
 */
export const switchToCustom = async (bannerID) => {
	const data = await idb.get(bannerID);
	if (!data) return preloadVersion.set({ patch: version, phase: wishPhase });

	const entry = customEntryFromData(data);

	let index = -1;
	bannerList.update((list) => {
		index = list.findIndex((b) => b.type === 'custom');
		if (index >= 0) list[index] = entry;
		else {
			list.push(entry);
			index = list.length - 1;
		}
		return list;
	});

	activeBanner.set(index);
	editorMode.set(false);
	localConfig.set('version', `Custom-${bannerID}`);
	return { status: 'ok' };
};

const useCustomBanner = async (bannerID) => switchToCustom(bannerID);

const checkBeginnerBanner = () => {
	const starterRollCount = rollCounter.get('beginner');
	const isShowBeginner = starterRollCount < 20;
	showBeginner.set(isShowBeginner);
	return isShowBeginner;
};

/**
 * 组装官方卡池列表（新手/角色/武器/混池/常驻 + 点名池）。
 * 从 initializeBanner 里抽出来，供「自定义模式启动」复用——
 * 自定义池现在是列表里的一个页签，官方池必须同时在列，否则页签栏只剩一项。
 */
const buildOfficialList = async (patch, phase) => {
	const list = checkBeginnerBanner() ? [{ type: 'beginner', ...beginner.featured }] : [];

	const { data } = await import(`$lib/data/banners/events/${patch}.json`);
	const { banners } = data.find((b) => b.phase === phase);
	const { events, weapons, standardVersion: stdver, chronicled = null } = banners;
	const { featured: stdFeatured } = standard.find(({ version }) => stdver === version) || {};

	const charEventBanner = {
		type: 'character-event',
		rateup: events.rateup,
		stdver
	};
	events.featured.forEach((eventdata) => list.push({ ...eventdata, ...charEventBanner }));
	list.push({ type: 'weapon-event', stdver, ...weapons });
	if (chronicled) list.push({ type: 'chronicled', stdver, ...chronicled });
	list.push({ type: 'standard', stdver, ...stdFeatured });

	// 中文修改版：点名卡池。放在列表末尾，与其它卡池同级。
	// 专用海报 rollcall-poster（星空+主星合成图，不贴常驻海报）；
	// 标签图标在 _banner-button 的 member 分支单独取 rollcall-tab。
	list.push({
		type: 'member',
		stdver,
		bannerName: 'rollcall-poster',
		character: stdFeatured?.character || ''
	});

	return { list, weapons };
};

/**
 * isCustomBanner / customData 由「当前页签」派生，而不是由进入路径设置。
 * 旧实现里 isCustomBanner 是全局模式开关，切页签不会复位，导致切到官方池后
 * 卡面仍按自定义数据渲染。现在订阅列表与当前下标，切到哪算哪。
 */
const syncCustomState = () => {
	const active = get(bannerList)[get(activeBanner)];
	const isCustom = active?.type === 'custom';
	isCustomBanner.set(isCustom);
	if (isCustom) {
		customData.set({ ...active, name: active.character });
	}
};
bannerList.subscribe(syncCustomState);
activeBanner.subscribe(syncCustomState);

export const initializeBanner = async ({ patch, phase }) => {
	try {
		if (!patch || !phase) return;

		// 自定义模式启动：先铺官方池（用默认版本），再把自定义页签追加并切过去
		if (patch.match(/(local|custom)/gi)) {
			const { list, weapons } = await buildOfficialList(version, wishPhase);
			bannerList.set(list);
			isFatepointSystem.set(!!weapons.fatepointsystem);
			return switchToCustom(phase);
		}

		const { list, weapons } = await buildOfficialList(patch, phase);

		// C2：已有自定义卡池时，页签直接追加在官方池后面（不隐藏页签栏）
		const customEntry = await loadCustomEntry();
		if (customEntry) list.push(customEntry);

		bannerList.set(list);
		isFatepointSystem.set(!!weapons.fatepointsystem);

		activeVersion.set({ patch, phase });
		// 默认停在第一个角色活动祈愿卡池（用户要求）：新手祈愿存在时它在 index 1，
		// 不存在时在 index 0；找不到角色活动池才回退 0
		const firstCharEvent = list.findIndex((b) => b.type === 'character-event');
		activeBanner.set(firstCharEvent >= 0 ? firstCharEvent : 0);
		localConfig.set('version', `${patch}-${phase}`);

		customData.set({});
		return { status: 'ok' };
	} catch (e) {
		console.error(e);
		return { status: 'error', e };
	}
};

export const handleShowStarter = (isShow) => {
	if (!isShow) {
		return bannerList.update((bn) => {
			return bn.filter(({ type }) => type !== 'beginner');
		});
	}
	return bannerList.update((bn) => {
		bn.unshift({ type: 'beginner', ...beginner.featured });
		return bn;
	});
};
