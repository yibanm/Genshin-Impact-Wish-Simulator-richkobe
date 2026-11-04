<script>
	import { getContext, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { t, locale } from 'svelte-i18n';
	import { assets } from '$lib/store/app-stores';
	import { itemList, listingAssets, blobAssets } from '$lib/helpers/assets';

	// 首屏文本不能用裸 $t：svelte-i18n 的 locale.set 在字典异步加载完成前 locale 仍为 null，
	// 此时 $t 直接 throw（SSR prerender 会整站 500）。locale 未就绪时回退默认中文，
	// 字典到达后 $t 响应式重渲染自动切到正确语言。
	$: connectingText = $locale ? $t('loader.connecting', { default: '加载中' }) : '加载中';
	$: errorTitleText = $locale
		? $t('loader.errorTitle', { default: '加载部分素材时出错，可能会影响你的祈愿体验。' })
		: '加载部分素材时出错，可能会影响你的祈愿体验。';
	$: errorHintText = $locale
		? $t('loader.errorHint', { default: '你可以尝试重新加载；若仍无法加载，也可以直接打开应用继续使用。' })
		: '你可以尝试重新加载；若仍无法加载，也可以直接打开应用继续使用。';
	$: reloadText = $locale ? $t('loader.reload', { default: '重新加载' }) : '重新加载';
	$: openAnywayText = $locale ? $t('loader.openAnyway', { default: '仍然打开' }) : '仍然打开';

	export let isBannerLoaded = false;
	export let directLoad = false;

	let anyError = false;
	let isLoaded = false;
	let current = -1;

	const loaded = getContext('loaded');
	const handleLoaded = () => {
		loaded();
		isLoaded = true;
	};

	const assetInit = async (param) => {
		const ispreview = param === 'preview';
		const arr = [];
		let i = 0;
		const raw = ispreview ? listingAssets('preview') : listingAssets();
		for await (const assetData of raw) {
			i++;
			const { path, asset } = assetData;
			const blob = await blobAssets(path);
			if (blob === 'error') anyError = true;
			arr.push({ url: blob, name: asset });
			current = (i / raw.length) * 100;
		}

		const loadedAssets = await Promise.all(arr);
		const list = await itemList();
		assets.update((pv) => {
			pv = {};
			loadedAssets.forEach(({ url, name }) => (pv[name] = url));
			return { ...pv, ...list };
		});

		if (anyError === false) handleLoaded();
	};

	onMount(() => {
		assetInit(directLoad ? 'preview' : '');
	});
</script>

{#if anyError && !isLoaded}
	<div class="modal">
		<div class="modal-content">
			<div class="msg">
				{errorTitleText}
				<br />
				<small>
					<small>
						{errorHintText}
					</small>
				</small>
			</div>
			<div class="btn">
				<button class="reload" on:click={() => window.location.reload()}>{reloadText}</button>
				<button class="open" on:click={handleLoaded}>{openAnywayText}</button>
			</div>
		</div>
	</div>
{/if}

{#if !((isBannerLoaded || directLoad) && isLoaded && current >= 100)}
	<div class="loader" out:fade={{ duration: 500, delay: 1000 }}>
		<div class="content">
			<div class="progress">
				<div class="icon">
					<i class="gi-pyro" />
					<i class="gi-hydro" />
					<i class="gi-anemo" />
					<i class="gi-electro" />
					<i class="gi-dendro" />
					<i class="gi-cryo" />
					<i class="gi-geo" />
				</div>
				<div class="blend">
					<div class="unfilled" />
					<div class="filled animate" style="width:{current.toFixed(2)}%" />
				</div>
			</div>

			{#if current < 0}
				<div class="text connecting" transition:fade>{connectingText}</div>
			{:else}
				<div class="text" in:fade>{current > 99 ? 100 : current.toFixed()}%</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal {
		position: fixed;
		z-index: 9999;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background-color: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(8px);
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
	}

	.modal-content {
		background-color: #fff;
		border-radius: 0.4rem;
		width: 500px;
		max-width: 80%;
		padding: 2%;
	}

	.btn {
		padding-top: 5%;
		width: 100%;
	}
	button {
		color: #fff;
		padding: 2% 6%;
	}

	.reload {
		background-color: #94866e;
	}

	.open {
		background-color: #353533;
	}

	.loader {
		display: flex;
		justify-content: center;
		align-items: center;
		font-size: 3.2vw;
		color: #666666;
		width: 100%;
		height: 100vh;
		position: fixed;
		top: 0;
		left: 0;
		background-color: #fff;
		z-index: 9998;
	}

	@media screen and (max-width: 600px) {
		.loader {
			font-size: 4vh;
		}
	}

	.content {
		display: block;
		text-align: center;
	}

	.text {
		font-size: 1rem;
		height: 1.5rem;
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		font-family: inherit;
	}

	.text.connecting::after {
		content: '..';
		display: inline-block;
		animation: dot 4s linear infinite;
	}

	.progress {
		width: max-content;
		position: relative;
	}
	.blend {
		mix-blend-mode: lighten;
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}

	.unfilled,
	.filled {
		display: block;
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
	}

	.unfilled {
		width: 100%;
		background-color: #f7f7f7;
	}
	.filled {
		background-color: #666666;
	}

	@keyframes dot {
		0% {
			content: '';
		}
		33% {
			content: '.';
		}
		66% {
			content: '..';
		}
		100% {
			content: '...';
		}
	}
</style>
