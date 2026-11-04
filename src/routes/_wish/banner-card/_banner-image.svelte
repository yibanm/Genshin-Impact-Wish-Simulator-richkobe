<script>
	import { getContext } from 'svelte';
	import { assets } from '$lib/store/app-stores';
	import BannerArt from '../../_custom-banner/BannerEditor/BannerArt.svelte';

	export let src = '';
	export let alt = '';
	export let wrapperClass = '';
	export let isError = false;

	export let custom = false;
	export let vision = '';
	export let artPosition = {};
	export let rateup = [];

	const imageError = getContext('imageError');
</script>

<div
	class:image-error={isError}
	class="wrapper {wrapperClass}"
	style="min-height: 100px; width: 100%;"
>
	{#if !isError}
		{#if custom}
			<img
				src={$assets[`blank/character-${vision}`]}
				alt="background banner"
				crossorigin="anonymous"
				class="art-bg"
			/>
			{#key artPosition}
				<!-- C4 放宽必填后 artURL 可能为空：空 src 会渲染破图图标，
				     用元素底色兜底（米金渐变与卡面背景同色系），不显示破图 -->
				{#if src}
					<BannerArt artURL={src} bannerPosition={artPosition?.banner} {rateup} />
				{:else}
					<div class="art-missing" />
				{/if}
			{/key}
		{:else}
			<picture style="position: relative; width: 100%; overflow: hidden">
				<img {src} {alt} on:error={imageError} crossorigin="anonymous" />
			</picture>
		{/if}
	{/if}
</div>

<style>
	/* C4 放宽必填后自定义池可能没有上传立绘：用米金渐变占位，避免破图图标 */
	.art-missing {
		width: 100%;
		height: 100%;
		background-image: linear-gradient(to top, #eee8e3 50%, #f7f5f4);
	}

	picture,
	img {
		width: 100%;
		display: block;
	}
	.art-bg {
		aspect-ratio: 1080/533;
		position: absolute;
		bottom: 0;
		left: 0;
	}
	.image-error {
		background-image: linear-gradient(to top, #eee8e3 50%, #f7f5f4);
	}
</style>
