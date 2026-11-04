<script>
	import { t } from 'svelte-i18n';
	import { assets, customData } from '$lib/store/app-stores';
	import { removeAnimClass } from '$lib/helpers/transition';
	import { lazyLoad } from '$lib/helpers/lazyload';
	import { getCssVarPosition as pos } from '$lib/helpers/cssPosition';
	import { memberDisplayName } from '$lib/helpers/rollcall/display';

	export let name;
	export let type;
	export let outfitName;
	export let weaponType;
	export let useOutfit;
	export let custom;
	export let clientHeight = 0;
	export let clientWidth = 0;
	export let offset = {};
	// 中文修改版：点名结果的图标地址（预置素材 URL 或自定义 blob 的 objectURL）
	export let iconUrl = null;
	export let chineseChar = '';
	// 点名结果的图标类型，用于查语言包取中文显示名
	export let iconType = null;

	$: displayName = memberDisplayName({ name, chineseChar, iconType }, $t);
</script>

<div class="zoomist-wrapper splash-art anim {type}" style="overflow: visible;" use:removeAnimClass>
	<!-- 中文修改版：点名结果。有图标就显示图标（角色头像/武器图标/自定义导入图），
	     没有图标（纯文字名单）则显示姓名大字，保证结果卡永远有内容可看 -->
	{#if type === 'member'}
		{#if iconUrl}
			<div class="zoomist-image member-art">
				<img src={iconUrl} alt={displayName} />
			</div>
		{:else}
			<div class="zoomist-image member-text">
				<span>{displayName}</span>
			</div>
		{/if}

		<!-- Custom Art -->
	{:else if custom}
		{@const { images = {}, hostedImages = {}, status, artPosition } = $customData || {}}
		{@const { artURL } = status === 'owned' ? images : hostedImages}
		{@const { splashArt = {} } = artPosition || {}}
		<div class="zoomist-image" style={pos(splashArt, clientHeight, clientWidth)}>
			<img use:lazyLoad={artURL} alt={name} />
		</div>

		<!-- Weapon -->
	{:else if type === 'weapon'}
		<div class="zoomist-image weapon anim {weaponType}-parent" use:removeAnimClass>
			<img src={$assets[`bg-${weaponType}.webp`]} alt={weaponType} class="weaponbg" />
			<img use:lazyLoad={$assets[name]} alt={name} class={weaponType} />
		</div>

		<!-- Character OutFit -->
	{:else if type === 'outfit'}
		<div class="zoomist-image" style={pos(offset, clientHeight, clientWidth)}>
			<img use:lazyLoad={$assets[`splash-art/${outfitName}`]} alt={name} crossorigin="anonymous" />
		</div>

		<!-- Character Art -->
	{:else}
		<div class="zoomist-image" style={pos(offset, clientHeight, clientWidth)}>
			<img
				use:lazyLoad={$assets[`splash-art/${useOutfit ? outfitName : name}`]}
				alt={name}
				crossorigin="anonymous"
			/>
		</div>
	{/if}
</div>

<style>
	.zoomist-wrapper,
	.zoomist-image {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.zoomist-wrapper {
		--scale: 1.5;
		--translate-x: 0px;
		--translate-y: 0px;
		background-color: unset;
		position: relative;
	}
	.zoomist-wrapper.weapon {
		--scale: 1.1;
	}

	.zoomist-image {
		transform: translate(var(--translate-x, 0px), var(--translate-y, 0px)) scale(var(--scale, 0));
	}

	/* 点名结果：图标按 contain 居中显示，不裁切 */
	.member-art img {
		width: 70%;
		height: 90%;
		object-fit: contain;
		border-radius: 0.5rem;
	}

	/* 点名结果：无图标时显示姓名大字，描边风格与原版名字一致 */
	.member-text {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.member-text span {
		color: #fff;
		/* F10：毛笔字体 + 竖排（用户要求「特色的毛笔字体竖着排列」，不缩略）。
		   竖排从右往左；长名字自动换列，不会横向溢出画面。 */
		writing-mode: vertical-rl;
		font-family: 'MaShanZheng', var(--gi-zh-font);
		font-size: 5rem;
		font-weight: 400;
		-webkit-text-stroke: 0.06rem #000;
		filter: drop-shadow(0 0.3rem 0.6rem rgba(0, 0, 0, 0.6));
		letter-spacing: 0.35rem;
		max-height: 90%;
	}

	img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: contain;
		object-position: center;
	}

	.splash-art.anim {
		filter: brightness(0) opacity(0);
		animation: splashart forwards 1.5s 1;
	}
	.splash-art:not(.anim) {
		transform: translate(2%, 0);
	}

	.zoomist-image {
		position: relative;
		width: var(--width);
		height: var(--height);
	}
	.splash-art .weapon img {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	.splash-art .weapon img.weaponbg {
		height: 80%;
	}

	.splash-art .weapon.anim img.weaponbg {
		opacity: 0;
		animation: weaponbg forwards 1.5s 1;
	}

	.bow-parent .weaponbg {
		transform: translate(-53%, -50%) scale(1.1) !important;
	}
	.catalyst-parent .weaponbg {
		height: 90% !important;
	}

	.anim .bow,
	.anim .polearm,
	.anim .sword,
	.anim .claymore,
	.anim .catalyst {
		animation: weaponShadow forwards 0.1s 1;
		animation-delay: 1.2s;
		filter: drop-shadow(0 0 0 rgba(0, 0, 0, 0));
	}

	.bow,
	.polearm,
	.sword,
	.claymore,
	.catalyst {
		filter: drop-shadow(0.6rem 0.6rem 0.05rem rgb(0, 0, 0));
	}

	.bow {
		height: 115%;
	}

	.catalyst {
		height: 40%;
	}

	.polearm {
		transform: translate(-53%, -35%) scale(1.2) !important;
	}

	@keyframes splashart {
		0% {
			transform: scale(5) translate(0, -5%);
			filter: brightness(0);
		}

		20% {
			transform: scale(1);
			filter: brightness(0);
		}
		75% {
			transform: scale(1);
			filter: brightness(0);
		}
		95% {
			transform: scale(1) translate(2%, 0);
			filter: brightness(1);
		}
		100% {
			transform: scale(1) translate(2%, 0);
			filter: brightness(1);
		}
	}

	@keyframes weaponbg {
		80% {
			opacity: 0;
		}
		85% {
			opacity: 1;
		}
		100% {
			opacity: 1;
		}
	}

	@keyframes weaponShadow {
		to {
			filter: drop-shadow(0.7rem 0.6rem 0.2rem rgba(0, 0, 0, 0.7));
		}
	}
</style>
