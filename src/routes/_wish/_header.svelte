<script>
	import { getContext } from 'svelte';
	import { fly } from 'svelte/transition';
	import { t } from 'svelte-i18n';
	import hotkeys from 'hotkeys-js';

	import { playSfx } from '$lib/helpers/audio/audio';
	import { exitApp } from '$lib/helpers/platform';
	import {
		acquaint,
		intertwined,
		mobileMode,
		primogem,
		stardust,
		starglitter,
		viewportHeight,
		assets,
		isPWA,
		isMobile,
		wishAmount,
		bannerList,
		activeBanner,
		editorMode,
		isCustomBanner
	} from '$lib/store/app-stores';

	import MyFund from '$lib/components/MyFund.svelte';
	import BannerButton from './_banner-button.svelte';

	export let bannerType = '';

	$: isEvent = bannerType.match(/(event|chronicled)/);
	$: balance = isEvent ? $intertwined : $acquaint;
	$: unlimitedWish = $wishAmount === 'unlimited';

	const inTransition = (node, args) => {
		return args.mobile
			? fly(node, { x: -20, duration: 1000 })
			: fly(node, { y: -20, duration: 1000 });
	};

	const selectBanner = (banner) => {
		if ($activeBanner === banner) return;
		activeBanner.set(banner);
		playSfx('changebanner');
	};

	const navigate = getContext('navigate');

	const previousClick = () => {
		navigate('allbanners');
		playSfx();
	};

	// 卡池历史入口（设置右边的时钟按钮）：往期卡池列表，不是左下角的祈愿历史记录
	const handleHistory = () => {
		navigate('allbanners');
		playSfx();
	};

	// 主界面右上角 X = 关闭程序（用户裁定）。
	// 有壳（Tauri/Electron/安卓）时真正退出；仅网页时没有「程序」可关，退化为刷新页面。
	// 注意：esc 快捷键仍走 previousClick（切往期卡池），不跟 X 同语义——
	// 键盘误触 esc 就直接关程序太激进。
	const closeOrReload = async () => {
		playSfx('close');
		const exited = await exitApp();
		if (!exited) window.location.reload();
	};

	const handleMenu = getContext('handleMenu');
	$: headerHeightstyle = $mobileMode ? `height: ${$viewportHeight}px` : '';
	$: fullscreen = $viewportHeight === window.screen.height;

	const handleFullscreen = () => {
		if (!fullscreen) {
			const body = document.body;
			if (body.requestFullscreen) return body.requestFullscreen();
			if (body.webkitRequestFullscreen) return body.webkitRequestFullscreen();
			if (body.msRequestFullscreen) return body?.msRequestFullscreen();
		} else {
			if (document.exitFullscreen) return document?.exitFullscreen();
			if (document.webkitExitFullscreen) return document?.webkitExitFullscreen();
			if (document.msExitFullscreen) return document?.msExitFullscreen();
		}
	};

	// Shortcut
	const onWish = getContext('onWish');
	hotkeys('esc', 'index', (e) => {
		if ($onWish) return;
		e.preventDefault();
		previousClick();
	});

	hotkeys('m', 'index', (e) => {
		if ($onWish) return;
		e.preventDefault();
		handleMenu();
	});
</script>

<div id="header" style={headerHeightstyle}>
	<div class="top" in:fly={{ y: -20, duration: 800 }}>
		<h1 class="wish-title">
			<img src={$assets['brand.png']} alt="Brand" crossorigin="anonymous" />

			{#if !$editorMode}
				<span> {$t('wish.wishTitle')} </span>
			{:else}
				<span> {$t('customBanner.title')} </span>
			{/if}

			<button class="help" on:click={handleMenu} title="设置" aria-label="设置">
				<i class="gi-gear" />
			</button>

			<!-- 卡池历史入口，放在设置右边（用户指定位置）：往期卡池列表。
			     图标用内联 SVG 时钟：图标字体 gi-* 无时钟/书本类字形（全量 88 个已核），
			     乱猜字形会显示成方块（经验 #30/#44）；SVG 与全屏按钮同款做法。 -->
			<button class="help" on:click={handleHistory} title={$t('wish.banner.previous')} aria-label={$t('wish.banner.previous')}>
				<svg viewBox="0 0 24 24" width="1.15rem" height="1.15rem" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<circle cx="12" cy="12" r="9" />
					<polyline points="12 7 12 12 15.5 14" />
				</svg>
			</button>

			{#if !$isPWA || !$isMobile}
				<button
					class="fullscreen"
					on:click={handleFullscreen}
					title={fullscreen ? '退出全屏' : '全屏'}
					aria-label={fullscreen ? '退出全屏' : '全屏'}
				>
					<!-- 图标字体里没有标准的全屏字形（原 gi-fullscreen 形似「外部链接」易误读），
					     改用内联 SVG 的四角括号：展开=进入全屏，收拢=退出全屏 -->
					{#if !fullscreen}
						<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
							<path
								d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					{:else}
						<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
							<path
								d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					{/if}
				</button>
			{/if}
		</h1>
		<div class="budget">
			{#if !$editorMode}
				<div class="fates">
					{#if $mobileMode}
						<MyFund type="starglitter">
							{$starglitter}
						</MyFund>
						<MyFund type="stardust">
							{$stardust}
						</MyFund>
					{/if}

					<MyFund type="primogem" plusbutton>
						{unlimitedWish ? '∞' : $primogem}
					</MyFund>
					<MyFund type={isEvent ? 'intertwined' : 'acquaint'}>
						{unlimitedWish ? '∞' : balance}
					</MyFund>
				</div>

				<!-- 主界面 X = 关闭程序（有壳）/ 刷新（纯网页），用户裁定 -->
				<button class="close" on:click={closeOrReload} title={$t('closeApp')}>
					<i class="gi-close" />
				</button>
			{:else}
				<button
					class="close"
					title="取消编辑"
					on:click={() => {
						editorMode.set(false);
						playSfx('close');
					}}
				>
					<i class="gi-close" />
				</button>
			{/if}
		</div>
	</div>

	<!-- C1：自定义卡池现在是列表里的一个页签，页签栏不再因 isCustomBanner 隐藏。
	     只有整页编辑模式（editorMode）才隐藏页签栏。 -->
	{#if !$editorMode}
		<div class="banner-button" in:inTransition={{ mobile: $mobileMode }}>
			<div class="bg" style={headerHeightstyle}>
				<img src={$assets['brand.png']} alt="Brand" crossorigin="anonymous" />
			</div>

			<!-- C3：页签过多时横向滚动（不再换行堆高顶走卡面）。
			     滚动条样式在 app.css 已全局定义（5px 细条），横屏下天然可见。 -->
			<div class="button-wrapper" class:scrollable={$bannerList.length > 5}>
				{#each $bannerList as { type, featured, character, region, images }, i}
					<BannerButton
						{type}
						{character}
						index={i}
						featured={featured || region}
						thumbnail={type === 'custom' ? images?.thumbnail : ''}
						active={$activeBanner === i}
						on:click={() => selectBanner(i)}
					/>
				{/each}
			</div>
		</div>
	{:else}
		<div class="banner-button" in:inTransition={{ mobile: $mobileMode }}>
			<div class="bg" />
			<div class="button-wrapper" />
		</div>
	{/if}
</div>

<style>
	#header {
		position: relative;
		display: block;
		width: 100%;
		padding: 30px 2%;
		z-index: 5;
	}

	h1 button {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		color: #fff;
		margin-left: 0.7rem;
		line-height: 0;
		transition: all 0.2s;
	}

	h1 button:hover {
		background-color: var(--tertiary-color);
		color: #3a4156;
	}

	.help {
		border-radius: 50px;
		border: 0.15rem solid #fff;
		width: 1.7rem;
		height: 1.7rem;
	}

	.fullscreen,
	.chat {
		border-color: transparent;
		transform: scale(1.3);
		width: 1.3rem;
		height: 1.3rem;
	}

	.chat {
		border-radius: 100%;
	}

	.bg {
		display: none;
	}
	.top {
		display: flex;
		justify-content: space-between;
		width: 100%;
		position: relative;
	}

	.wish-title {
		color: #fff;
		text-transform: capitalize;
		display: flex;
		align-items: center;
		text-align: left;
		font-size: 110%;
	}

	.wish-title img {
		width: 30px;
		margin-right: 15px;
	}

	.budget {
		text-align: right;
		display: flex;
		justify-content: flex-end;
		align-items: center;
	}

	.banner-button,
	.button-wrapper {
		text-align: center;
		display: flex;
		justify-content: center;
		position: relative;
		z-index: 10;
	}

	/* C3：页签超过一屏时横向滚动，不换行堆高（堆高会顶走卡面）。
	   滚动条用 app.css 的全局细条样式（5px），暗示可滑动。 */
	.button-wrapper.scrollable {
		flex-wrap: nowrap;
		overflow-x: auto;
		overflow-y: hidden;
		justify-content: flex-start;
		scrollbar-width: thin;
	}

	/* flex 子项默认 flex-shrink:1：容器不够时页签会被压缩变形（aspect-ratio 破坏）
	   而不是产生滚动条。置 0 后溢出才真正触发滚动（横竖两向同理）。
	   必须 :global()——button 在子组件 BannerButton 里，父组件的 scoped 选择器
	   编译后带本组件 hash，子组件元素上没有，不加 :global 规则不生效。 */
	.button-wrapper :global(button) {
		flex-shrink: 0;
	}

	/* mobile */

	:global(.mobile) #header {
		padding: 0 !important;
	}

	:global(.mobile) .top {
		position: fixed;
		top: 0;
		/* B2 安全边距：横屏时挖孔在左右两侧，右边贴边元素要避开 --sar。
		   width 必须同步扣掉 --sar，否则 fixed 元素的左边界会被推出屏幕外。 */
		right: calc(2% + var(--sar));
		width: calc(100% - 100px - var(--sar));
		display: flex;
		justify-content: space-between;
		padding-right: 4%;
	}

	:global(.mobile) .wish-title img {
		display: none;
	}

	:global(.mobile) .button-wrapper {
		flex-direction: column;
		align-items: center;
		width: 120px;
		margin-top: 0;
		height: 100%;
		justify-content: flex-start;
		padding-top: 2.5rem;
		/* C3：移动端页签是竖列且高度固定，页签多了必须能竖向滚动，
		   否则第 6 个之后的页签（含自定义池）直接溢出屏幕外点不到。
		   此选择器特异性高于 .scrollable，横滚规则在这里要改回竖滚。 */
		overflow-y: auto;
		overflow-x: hidden;
		flex-wrap: nowrap;
	}

	:global(.mobile) .bg {
		display: block;
		position: absolute;
		top: 0;
		left: 50%;
		width: 40px;
		background-color: rgba(0, 0, 0, 0.4);
		z-index: -1;
		transform: translateX(-50%);
		text-align: center;
		border: solid rgba(207, 186, 143, 0.5);
		border-width: 0 2px;
	}
	.bg > img {
		width: 60%;
		margin-top: 3px;
	}

	@media screen and (min-width: 975px) {
		:global(main):not(.mobile) .banner-button {
			position: absolute;
			max-width: 50%;
			top: 20px;
			left: 50%;
			transform: translateX(-50%);
			margin-top: 0;
		}
	}
	@media screen and (max-width: 975px) {
		:global(main):not(.mobile) .button-wrapper {
			flex-wrap: wrap;
		}
	}
</style>
