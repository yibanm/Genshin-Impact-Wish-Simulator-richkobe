<script>
	import { getContext, onMount, setContext } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { t } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import {
		activeBanner,
		bannerList,
		assets,
		activeVersion,
		wishAmount,
		acquaint,
		intertwined,
		stardust,
		starglitter,
		customData
	} from '$lib/store/app-stores';
	import { localBalance, localConfig } from '$lib/helpers/dataAPI/api-localstore';
	import { APP_TITLE } from '$lib/env';
	import { playSfx } from '$lib/helpers/audio/audio';
	import { pushToast } from '$lib/helpers/toast';
	import { HistoryManager } from '$lib/helpers/dataAPI/api-indexeddb';
	import WISH, { roll } from '$lib/helpers/gacha/Wish';
	// 中文修改版新增：点名（抽人名）功能
	import { drawMembers } from '$lib/helpers/rollcall/draw';
	import { attachIconUrls } from '$lib/helpers/rollcall/icon';
	import { refreshRollcall } from '$lib/helpers/dataAPI/api-rollcall';

	// Components
	import Header from './_header.svelte';
	import Footer from './_footer.svelte';
	import OutOfPrimogem from './_out-of-primogem.svelte';
	import BannerItem from './_banner-item.svelte';
	import EpitomizedModal from './epitomized-path/EpitomizedPath.svelte';
	import Meteor from './wish-result/_meteor.svelte';
	import WishResult from './wish-result/WishResult.svelte';
	// 中文修改版：名单管理浮层小窗（点名卡池「名单管理」按钮打开）
	import RollcallPanel from './_rollcall-panel.svelte';
	import { rollcallPanel } from '$lib/store/app-stores';

	let rollCount = 0;
	let result = [];
	let WishInstance;

	let type;
	$: nowBanner = $bannerList[$activeBanner] || {};
	$: ({ type } = nowBanner);
	$: bannerType = type || '';
	$: isEvent = bannerType.match(/(event|chronicled)/);
	$: currencyUsed = isEvent ? $intertwined : $acquaint;
	$: isUnlimited = $wishAmount === 'unlimited';

	// Load Wish Configuration When changing banner Version
	const initialWish = async ({ patch, phase }) => {
		if (!patch || !phase) return;
		WishInstance = await WISH.init(patch, phase, $customData);
	};
	onMount(() => activeVersion.subscribe(initialWish));

	const getIndexOfCharBanner = () => {
		const events = $bannerList.filter(({ type }) => type === 'character-event');
		const index = events.findIndex(({ character }) => character === nowBanner.character);
		return index;
	};

	// Epitomized Modal
	let openEpitomized = false;
	const handleEpitomizedModal = () => (openEpitomized = !openEpitomized);
	setContext('handleEpitomizedModal', handleEpitomizedModal);

	// Wish Roller
	let multi = false;
	let rollCost;
	let showConvertModal = false;
	let onWish = getContext('onWish');

	/**
	 * 点名结果写入祈愿历史。
	 * 复用原历史的字段结构（banner/type/name/rarity/itemID/time），
	 * 因此「历史」页无需改动即可列出点名记录；
	 * 额外带上 chineseChar 与 iconKey，让历史页能显示名单里的名字和图标。
	 * itemID 用 0 占位：点名对象不是游戏物品，没有对应 ID。
	 */
	const saveMemberHistory = async (item) => {
		try {
			const date = new Date();
			await HistoryManager.addHistory({
				time: `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`,
				banner: 'member',
				type: 'member',
				itemID: 0,
				name: item.name,
				chineseChar: item.chineseChar,
				iconKey: item.iconKey,
				iconType: item.iconType,
				rarity: item.rarity,
				// 历史页的 cell0 会渲染 pity 字段，缺失会显示 undefined；
				// 点名没有保底概念，固定写 1（与壳层结果对象的 pity:10 不同，这里取最小占位值）
				pity: 1
			});
		} catch (e) {
			// 写历史失败不该打断点名结果展示，仅记录日志
			console.error('点名记录写入失败：', e);
		}
	};

	const doRoll = async (count, bannerToRoll) => {
		rollCount = count;
		multi = count > 1;
		const tmp = [];

		rollCost = bannerToRoll === 'beginner' ? 8 : count;
		if (!isUnlimited && rollCost > currencyUsed) return (showConvertModal = true);
		const indexOfCharBanner = bannerToRoll === 'character-event' ? getIndexOfCharBanner() : 0;
		onWish.set(true);

		// 中文修改版：点名卡池不走游戏概率系统，改为从名单里抽人。
		// 名单为空时不能抽，提示用户去菜单里勾选名单（复刻原版壳层的 alert 行为，
		// 但用应用自己的 toast 组件，保持视觉一致）。
		if (bannerToRoll === 'member') {
			const members = drawMembers(count);
			if (!members.length) {
				onWish.set(false);
				pushToast({ message: get(t)('rollcall.emptyPool'), type: 'error' });
				return;
			}
			// 图标可能是 IndexedDB 里的 blob，需异步转成可显示的 URL
			const withIcons = await attachIconUrls(members);
			// 逐个写入祈愿历史，让「历史」页也能看到点名记录
			for (const item of withIcons) {
				tmp.push(item);
				await saveMemberHistory(item);
			}
			// 池进度已推进，刷新一次快照，让卡面与管理页的「本轮已点 x/y」同步
			refreshRollcall();
			result = tmp;
			handleMeteorAnimation();
			if (isUnlimited) return;
			updateMilestones();
			updateFatesBalance(bannerToRoll);
			return;
		}

		for (let i = 0; i < count; i++) {
			const result = await roll(bannerToRoll, WishInstance, indexOfCharBanner);
			tmp.push(result);
		}

		result = tmp;
		handleMeteorAnimation();
		if (isUnlimited) return;
		updateMilestones();
		updateFatesBalance(bannerToRoll);
	};
	setContext('doRoll', doRoll);

	const updateFatesBalance = (banner) => {
		// 中文修改版：点名卡池与常驻/新手一样消耗相遇之缘（点名不涉及限定角色，不该花纠缠之缘）
		const isAcquaint = ['beginner', 'standard', 'member'].includes(banner);
		const funds = isAcquaint ? acquaint : intertwined;
		funds.update((n) => {
			const afterUpdate = n - (banner === 'beginner' && rollCount > 1 ? 8 : rollCount);
			localBalance.set(isAcquaint ? 'acquaint' : 'intertwined', afterUpdate);
			return afterUpdate;
		});
	};

	const updateMilestones = () => {
		const update = (type) => {
			const qty = result.reduce((prev, { bonusQty, bonusType }) => {
				return prev + (bonusType === type ? bonusQty : 0);
			}, 0);

			const milestone = type === 'stardust' ? stardust : starglitter;
			milestone.update((n) => {
				const afterUpdate = n + qty;
				localBalance.set(type, afterUpdate);
				return afterUpdate;
			});
		};

		update('starglitter');
		update('stardust');
	};

	// Wish Result Handler
	let skipSplashArt = false;
	let showWishResult = false;
	let showMeteor = false;
	let single = true;
	let radiance = false;
	let meteorStar = 3;

	const closeResult = () => {
		showWishResult = false;
		onWish.set(false);
		checkObtained();
	};
	setContext('closeResult', closeResult);

	const showSplashArt = ({ skip = false } = {}) => {
		skipSplashArt = skip;
		showMeteor = false;
		showWishResult = true;
	};
	setContext('showSplashArt', showSplashArt);

	const handleMeteorAnimation = () => {
		const autoSkip = localConfig.get('autoskip');
		if (autoSkip) return showSplashArt({ skip: true });

		const stars = result.map(({ rarity }) => rarity);
		single = stars.length === 1;
		meteorStar = 3;
		if (stars.includes(4)) meteorStar = 4;
		if (stars.includes(5)) meteorStar = 5;
		const captureStatus = result.map(({ captured = false }) => captured);
		radiance = captureStatus.includes(true);
		showMeteor = true;
	};

	// Modal Convert
	const closeModal = () => {
		playSfx('close');
		showConvertModal = false;
	};
	setContext('closeModal', closeModal);

	const reroll = (amount) => {
		playSfx();
		const multiAmount = bannerType === 'beginner' ? 10 : amount;
		doRoll(multi ? multiAmount : 1, bannerType);
		showConvertModal = false;
	};
	setContext('reroll', reroll);

	// Obtained Bonus
	const countMilestone = (masterless) => {
		return result.reduce((a, { bonusType, bonusQty }) => {
			return a + (bonusType === masterless ? bonusQty : 0);
		}, 0);
	};

	const showObtained = getContext('openObtained');
	const checkObtained = () => {
		const stardustQty = countMilestone('stardust');
		const starglitterQty = countMilestone('starglitter');

		const obtainedItems = [
			{ item: 'stardust', qty: stardustQty },
			{ item: 'starglitter', qty: starglitterQty }
		];

		if (!stardustQty && !starglitterQty) return;
		showObtained(obtainedItems);
	};
</script>

<svelte:head>
	<title>{$t('title', { default: APP_TITLE })}</title>
</svelte:head>

<div class="overlay" in:fade|local />

<div class="wish-container" class:show={showMeteor || showWishResult}>
	<Meteor show={showMeteor} isSingle={single} rarity={meteorStar} {radiance} />
	{#if showWishResult}
		<WishResult list={result} skip={skipSplashArt} />
	{/if}
</div>

<section style="background-image: url('{$assets['wish-background.webp']}');">
	<div class="col top">
		<Header {bannerType} />
	</div>

	<div class="col banner">
		<div class="item">
			<BannerItem />
		</div>

		<div class="col button" in:fly={{ y: 20, duration: 1000 }}>
			<Footer {bannerType} />
		</div>
	</div>
</section>

{#if openEpitomized}
	<EpitomizedModal />
{/if}

{#if $rollcallPanel}
	<RollcallPanel />
{/if}

{#if showConvertModal}
	<OutOfPrimogem isEventBanner={isEvent} {rollCost} />
{/if}

<style>
	section {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		overflow: hidden;
		background-repeat: no-repeat;
		background-position: center;
		background-size: cover;
		background-position: 20%;
	}

	.overlay {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: block;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.08);
		box-shadow: 0 0 50vh rgba(0, 0, 0, 0.4) inset;
	}

	.wish-container {
		position: fixed;
		width: 100%;
		height: 100%;
		z-index: 15;
		top: 0;
		left: 0;
		pointer-events: none;
	}

	.wish-container.show {
		pointer-events: unset;
	}

	.top,
	.banner,
	.button,
	.item {
		display: block;
		width: 100%;
	}

	.top {
		min-height: 70px;
	}
	.banner,
	.item {
		height: 100%;
	}
	.item {
		position: relative;
	}
	.banner {
		display: flex;
		justify-content: center;
		flex-direction: column;
	}

	.button {
		height: 120px;
	}

	/* Mobile */
	:global(.mobile) section {
		flex-direction: row;
	}
	:global(.mobile) .top {
		height: 100%;
		width: min-content;
	}
	:global(.mobile) .banner {
		width: 120%;
		margin-left: -20px;
	}
	:global(.mobile) .button {
		height: 50px;
		margin-bottom: 0.2rem;
	}
</style>
