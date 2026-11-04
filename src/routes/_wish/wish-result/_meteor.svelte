<script>
	import { getContext, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { t } from 'svelte-i18n';
	import hotkeys from 'hotkeys-js';

	import { localConfig } from '$lib/helpers/dataAPI/api-localstore';
	import { playSfx } from '$lib/helpers/audio/audio';
	import { assets } from '$lib/store/app-stores';
	import { pushToast } from '$lib/helpers/toast';

	export let rarity = 3;
	export let show = false;
	export let isSingle = false;
	export let radiance = false;

	let videoContent;
	let showSkipButton = false;

	const showSplashArt = getContext('showSplashArt');
	const meteorEnd = ({ skip = false } = {}) => {
		showSplashArt({ skip });
		showSkipButton = false;
	};

	const skip = () => {
		playSfx();
		meteorEnd({ skip: true });
		videoContent.load();
		videoContent.style.display = 'none';
	};

	onMount(() => {
		videoContent.addEventListener('ended', () => {
			videoContent.style.display = 'none';
			videoContent.load();
			meteorEnd();
		});

		videoContent.addEventListener('error', () => {
			const statusCode = videoContent.error.message;
			const message = `${$t('wish.result.meteorFailed')} "${statusCode}" - ${videoContent.src}`;
			pushToast({ message });

			console.error(`Failed to load the Falling Star Animation`);
			return meteorEnd();
		});
	});

	const showVideoHandle = async (rarity, single = true, radiance) => {
		const muted = localConfig.get('muted');
		let vidSrc = '3star-single';
		if (radiance) {
			vidSrc = 'capturing-radiance';
		} else {
			if (single && rarity !== 3) {
				vidSrc = rarity === 5 ? '5star-single' : '4star-single';
			}
			if (!single && rarity !== 3) {
				vidSrc = rarity === 5 ? '5star-multi' : '4star-multi';
			}
		}

		videoContent.src = $assets[`${vidSrc}.mp4`];
		videoContent.style.display = 'unset';
		videoContent.muted = !!muted;
		await videoContent.play();
		return;
	};

	$: if (show) showVideoHandle(rarity, isSingle, radiance);

	// Shortcut
	hotkeys('esc', 'index', (e) => {
		if (!show) return;
		e.preventDefault();
		skip();
	});

	hotkeys('enter', 'index', (e) => {
		if (!show) return;
		e.preventDefault();
		if (showSkipButton) return skip();
		showSkipButton = true;
	});
</script>

<div class="meteor-wrapper" class:show on:mousedown={() => (showSkipButton = true)}>
	<div class="video">
		<video playsinline bind:this={videoContent} type="video/mp4">
			<track kind="captions" />
		</video>
		{#if showSkipButton}
			<button class="skip" on:click={skip} in:fade={{ duration: 250 }}>
				{$t('wish.result.skip')} <i class="gi-caret-up" />
			</button>
		{/if}
	</div>
</div>

<style>
	.meteor-wrapper {
		width: 100vw;
		height: var(--screen-height);
		position: absolute;
		top: 0;
		left: 0;
		opacity: 0;
		transition: opacity 0.25s;
	}
	.meteor-wrapper.show {
		display: block;
		/* 黑底而非白底：流星动画本身是深色星空，白底会在视频解码启动前硬闪一下
		   （安卓 WebView 解码慢，白闪尤其明显），黑底过渡自然 */
		background-color: #000;
		opacity: 1;
	}
	.video {
		position: relative;
		width: 100vw;
		height: 100%;
	}

	.skip {
		position: absolute;
		/* B2 安全边距：跳过按钮避开挖孔/圆角，否则横屏时压在孔位上不好点 */
		top: calc(30px + var(--sat));
		right: calc(2% + var(--sar));
		color: #fff;
		font-size: 1.2rem;
		z-index: 10;
	}

	.gi-caret-up {
		display: inline-block;
		transform: rotate(90deg) translateX(-0.1rem);
		vertical-align: middle;
		margin-left: -0.5em;
	}

	:global(.mobile) .skip {
		font-size: 0.8rem;
		/* 这条会覆盖上面的 .skip（安卓横屏下 mobileMode 为真），必须同样叠加安全区 */
		top: calc(0.3rem + var(--sat));
		right: calc(6% + var(--sar));
	}
	video {
		display: none;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 105%;
		height: 105%;
		object-fit: cover;
	}
</style>
