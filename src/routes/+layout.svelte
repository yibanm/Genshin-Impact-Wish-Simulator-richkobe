<script>
	// Packagae
	import { registerSW } from 'virtual:pwa-register';
	import { isLoading, locale } from 'svelte-i18n';
	import { page } from '$app/stores';
	import { dev } from '$app/environment';
	import { onMount, setContext } from 'svelte';
	import 'zoomist/css';

	import {
		viewportHeight,
		viewportWidth,
		isMobile,
		mobileMode,
		isPWA
	} from '$lib/store/app-stores';
	import { IDBUpdater } from '$lib/helpers/migrator/IDBUpdater';
	import { storageLocal } from '$lib/helpers/dataAPI/api-localstore';
	import { HOST, DESCRIPTION, KEYWORDS, APP_TITLE } from '$lib/env';
	import { sync } from '$lib/helpers/dataAPI/sync';
	import { autoExport } from '$lib/store/filesystem-store';
	import { mountLocale } from '$lib/helpers/i18n';
	import { mobileDetect } from '$lib/helpers/mobileDetect';
	import { wakeLock } from '$lib/helpers/wakeLock';
	import { syncCustomBanner } from '$lib/helpers/banner-custom';
	// 本项目：点名名单 store 的应用级初始化入口
	import { initRollcall } from '$lib/helpers/dataAPI/api-rollcall';
	// 副作用导入：OverlayScrollbars 全局默认（灰条滑动时才显示），须早于子组件实例化
	import '$lib/helpers/os-defaults';
	// import { initializeDriveAPI } from '$lib/helpers/dataAPI/google-api';
	import '../app.css';

	import Toasts from '$lib/components/Toasts.svelte';
	import Loader from './_index/InitialLoader.svelte';

	let innerHeight;
	let innerWidth;
	let isBannerLoaded = false;
	let isloaded = false;

	setContext('bannerLoaded', () => (isBannerLoaded = true));
	setContext('loaded', () => (isloaded = true));

	let font = '';
	$: {
		const lc = $locale?.toLowerCase() || '';
		const isSpecial = lc.match(/(cn|ja|kr)/);
		font = isSpecial || lc.includes('th') ? lc.split('-')[0] : 'global';
	}

	$: viewportWidth.set(innerWidth);
	$: viewportHeight.set(innerHeight);

	let directLoad = false;
	let preview = false;

	const checkPath = () => {
		const path = $page.url.pathname.split('/');
		directLoad = !!path[1];
		preview = path[1] === 'screen';

		// 本项目：已移除 adkey（付费激活码页）与 bnlist（在线卡池列表，依赖作者后端 API_HOST），
		// 桌面离线版无外部服务，这两个路由不再存在
		const validPaths = ['install', 'privacy-policy', 'screen'];
		const isPathValid = validPaths.includes(path[1].toLowerCase());
		const redirect = path[1] && !isPathValid;
		return redirect;
	};

	const setMobileMode = () => {
		if ($isPWA) return mobileMode.set(true);
		const angle = screen.orientation?.angle || 0;
		const rotate = angle === 90 || angle === 270;
		mobileMode.set(rotate);
	};

	mountLocale();
	onMount(async () => {
		if (checkPath()) return window.location.replace('/');

		const url = new URL(window.location.href);
		const searchParams = new URLSearchParams(url.search);
		isPWA.set(searchParams.get('pwa') === 'true' || !!searchParams.get('pwasc'));

		isMobile.set(mobileDetect() || innerWidth < 601);
		if ($isMobile) setMobileMode();

		window.addEventListener('orientationchange', () => {
			if ($isMobile) setMobileMode();
		});

		storageLocal.initEvent(); //for autoexport
		registerSW(); // Service Worker for faster load
		wakeLock(); // Prevent screen off while open the app
		await IDBUpdater(); // Update site data to the newer Version
		syncCustomBanner(); // Sync Custom Banner
		// 本项目：点名名单 store 在应用启动时就初始化，
		// 否则点名卡池卡面读不到勾选状态，会一直显示「还没有勾选任何名单」
		initRollcall();

		// 灰条「滑动时才冒出来」的原生滚动侧实现：捕获阶段监听所有 scroll，
		// 给正在滚动的容器加 .is-scrolling（app.css 里 thumb/scrollbar-color 跟随它），
		// 停滚 400ms 后移除（与 OverlayScrollbars 的 autoHideDelay 对齐）
		const hideTimers = new WeakMap();
		window.addEventListener(
			'scroll',
			(e) => {
				const el = e.target;
				if (!(el instanceof Element)) return;
				el.classList.add('is-scrolling');
				clearTimeout(hideTimers.get(el));
				hideTimers.set(
					el,
					setTimeout(() => el.classList.remove('is-scrolling'), 400)
				);
			},
			true
		);
		// initializeDriveAPI(); // Drive API for cloud Sync

		document.addEventListener('storageUpdate', () => sync($autoExport));
		// prevent Righ click (hold on android) on production mode
		if (!dev) document.addEventListener('contextmenu', (e) => e.preventDefault());
	});
</script>

<svelte:window bind:innerHeight bind:innerWidth />

<svelte:head>
	<meta name="description" content={DESCRIPTION} />
	<meta name="keywords" content={KEYWORDS} />
	<meta property="al:web:url" content={HOST} />
	<link rel="fluid-icon" href="{HOST}/meta-picture.jpg" title={APP_TITLE} />

	<meta property="og:url" content={HOST} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={APP_TITLE} />
	<meta property="og:description" content={DESCRIPTION} />
	<meta property="og:image" content="{HOST}/meta-picture.jpg" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta property="twitter:domain" content={HOST.replace('https://', '').replace('http://', '')} />
	<meta property="twitter:url" content={HOST} />
	<meta name="twitter:title" content={APP_TITLE} />
	<meta name="twitter:description" content={DESCRIPTION} />
	<meta name="twitter:image" content="{HOST}/meta-picture.jpg" />

	<link
		rel="preload"
		href="/fonts/optimized_global_web.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>
	<link
		rel="preload"
		href="/fonts/optimized_th_web.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>
	<link
		rel="preload"
		href="/fonts/optimized_ja_web.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>
	<!-- 中文是默认语言，中文正文字体必须与 global 同批 preload：
	     否则首屏中文在 webfont 到达前无字可用（字体栈已按用户要求去掉系统字体回退）。
	     2026-11-05 起中文正文由 Noto_SC_Web 承担（GI_ZH 子集缺字已退场） -->
	<link
		rel="preload"
		href="/fonts/optimized_noto_sc_web.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>
	<link
		rel="preload"
		href="/fonts/optimized_ko_web.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>

	{#if !dev}
		<link rel="manifest" href="/appmanifest.json" />
	{/if}

</svelte:head>

<Loader {isBannerLoaded} {directLoad} />

<main
	class:mobile={$mobileMode}
	class:preview
	class={$locale}
	style="--screen-height: {$viewportHeight
		? `${$viewportHeight}px`
		: '100vh'};--screen-width: {$viewportWidth}px;
		--genshin-font: var(--gi-{font}-font);"
>
	<Toasts />

	{#if !$isLoading && isloaded}
		<slot />
	{/if}
	<a
		href="/"
		on:click|preventDefault={() => window.location.replace('/')}
		class="uid"
		title="来这个模拟器试试手气"
	>
		{APP_TITLE}
	</a>
</main>

<style global>
	@import '../../node_modules/overlayscrollbars/css/OverlayScrollbars.css';

	@font-face {
		font-family: 'GI_Global_Web';
		src: url('/fonts/optimized_global_web.woff2') format('woff2');
		font-weight: normal;
		font-style: normal;
	}

	@font-face {
		font-family: 'GI_JA_Web';
		src: url('/fonts/optimized_ja_web.woff2') format('woff2');
		font-weight: normal;
		font-style: normal;
	}

	@font-face {
		font-family: 'GI_KO_Web';
		src: url('/fonts/optimized_ko_web.woff2') format('woff2');
		font-weight: normal;
		font-style: normal;
	}

	@font-face {
		font-family: 'GI_TH_Web';
		src: url('/fonts/optimized_th_web.woff2') format('woff2');
		font-weight: normal;
		font-style: normal;
	}

	/* 中文正文兜底字体（2026-11-05）：Noto Sans SC / 思源黑体（OFL-1.1），
	   可变字体实例化 wght=400 后 woff2（scripts/make-zh-font.py 可复现）。
	   GI_ZH_Web 子集缺常用字导致逐字回退混排，中文正文改由它单一字体族承担。 */
	@font-face {
		font-family: 'Noto_SC_Web';
		src: url('/fonts/optimized_noto_sc_web.woff2') format('woff2');
		font-weight: normal;
		font-style: normal;
		font-display: swap;
	}

	/* F10：马善政毛笔楷书（OFL-1.1，google/fonts 仓库 ofl/mashanzheng）。
	   用于点名结果的姓名竖排展示。全量 TTF 5.86MB 不做子集化——
	   名单是用户自导入的 TXT，姓名用字不可预知，子集化会丢生僻字显示成豆腐块。
	   许可证文件随仓库保留：static/fonts/MaShanZheng-OFL.txt */
	@font-face {
		font-family: 'MaShanZheng';
		src: url('/fonts/MaShanZheng-Regular.ttf') format('truetype');
		font-weight: normal;
		font-style: normal;
		font-display: swap;
	}

	:global(.os-theme-light > .os-scrollbar > .os-scrollbar-track > .os-scrollbar-handle) {
		background-color: #d2c69c;
		opacity: 0.5;
	}
	:global(.os-theme-light > .os-scrollbar > .os-scrollbar-track > .os-scrollbar-handle:hover),
	:global(.os-theme-light > .os-scrollbar > .os-scrollbar-track > .os-scrollbar-handle:active) {
		background-color: #d2c69c;
		opacity: 1;
	}

	:global(.os-theme-light > .os-scrollbar-vertical) {
		width: 8px;
	}
	:global(.os-theme-light > .os-scrollbar-horizontal) {
		height: 8px;
	}

	main {
		display: block;
		width: var(--screen-width);
		height: var(--screen-height);
		font-family: var(--genshin-font);
		overflow: hidden;
	}

	.uid {
		display: block;
		position: fixed;
		/* B2：水印原本 bottom:0 贴死底边，叠加安全区避开手势条 */
		bottom: var(--sab);
		right: calc(2em + var(--sar));
		z-index: 9999;
		color: #fff;
		text-shadow: 0 0 1.5px rgba(0, 0, 0, 0.7);
		font-family: inherit;
		pointer-events: none;
		/* D3 例外：水印不可点击（pointer-events:none），全局「可点带下划线」规则不适用于它 */
		text-decoration: none;
	}

	.mobile .uid {
		right: calc(5% + var(--sar));
	}

	.preview .uid {
		pointer-events: unset;
		right: unset;
		left: 1rem;
		bottom: 1rem;
	}
</style>
