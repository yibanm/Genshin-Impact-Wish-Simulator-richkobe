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
		videoContent.muted = !!muted;
		// 安卓闪屏根因之一：先 display 再 play，video 元素在首帧解码完成前就露出，
		// 底下是黑 wrapper 与页面内容的混合，观感为「闪一下废图」。
		// 改为等首帧可绘后再显示并播放；超时兜底仍显示，避免永久黑屏。
		// 竞态防护：blob URL 解码极快时 canplay 会在 addEventListener 之前触发，
		// 漏掉事件就得白等满超时——先查 readyState（>=3 即 HAVE_FUTURE_DATA，canplay 同义）。
		if (videoContent.readyState < 3) {
			await new Promise((resolve) => {
				let done = false;
				const finish = () => {
					if (done) return;
					done = true;
					videoContent.removeEventListener('canplay', finish);
					clearTimeout(timer);
					resolve();
				};
				const timer = setTimeout(finish, 1500);
				videoContent.addEventListener('canplay', finish);
				// 注册后再查一次：src 赋值到注册之间的窗口里事件可能已触发并推进了 readyState
				if (videoContent.readyState >= 3) finish();
			});
		}
		// 等待期间用户可能已跳过（esc/点击）：show 已被父级置 false，
		// 此时再显示播放会让「跳过的视频继续播」，直接放弃本次播放
		if (!show) return;
		videoContent.style.display = 'unset';
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
