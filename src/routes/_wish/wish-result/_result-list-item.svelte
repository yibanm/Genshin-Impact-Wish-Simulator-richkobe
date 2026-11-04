<script>
	import { fade } from 'svelte/transition';
	import { t } from 'svelte-i18n';
	import { assets, customData } from '$lib/store/app-stores';
	import { getCssVarPosition } from '$lib/helpers/cssPosition';
	import { playSfx } from '$lib/helpers/audio/audio';
	import Icon from '$lib/components/Icon.svelte';
	import SvgIcon from '$lib/components/SVGIcon.svelte';
	import { memberDisplayName } from '$lib/helpers/rollcall/display';

	export let index;
	export let clientHeight;
	export let clientWidth;
	export let data = {};
	const {
		name,
		rarity,
		weaponType,
		type,
		vision,
		offset,
		stelaFortuna,
		isNew,
		bonusType,
		bonusQty,
		useOutfit,
		outfitName,
		custom,
		// 中文修改版：点名结果的图标与名单名字
		iconUrl,
		chineseChar,
		iconType
	} = data;
</script>

<div
	id="wish{index}"
	class="item star{rarity} {type}"
	class:duplicate={!isNew}
	on:mousedown|preventDefault={() => playSfx()}
>
	{#if isNew}
		<div class="new">{$t('wish.result.new')}</div>
	{/if}
	<div class="zoomist-container item-body {weaponType || ''}">
		<div class="zoomist-wrapper item-content" style="--bg: url({$assets['resultcard-bg.webp']})">
			{#if type === 'member'}
				<!-- 中文修改版：点名结果。有图标显示图标；无图标显示**完整姓名**，
				     竖排 + 毛笔字体（F10，用户要求不显示缩略的首字） -->
				<div class="zoomist-image member-cell">
					{#if iconUrl}
						<img src={iconUrl} alt={chineseChar || name} class="wishpic member-pic" />
					{:else}
						<span class="member-vertical">{chineseChar || name || ''}</span>
					{/if}
				</div>
			{:else if custom}
				{@const { images = {}, hostedImages = {}, status, artPosition } = $customData || {}}
				{@const { artURL } = status === 'owned' ? images : hostedImages}
				{@const { wishCard = {} } = artPosition || {}}
				<div class="zoomist-image" style={getCssVarPosition(wishCard, clientHeight, clientWidth)}>
					<img src={artURL} alt={name} class="wishpic" />
				</div>

				<!-- Weapon -->
			{:else if type === 'weapon'}
				<div class="zoomist-image weapon">
					<img src={$assets[name]} alt={name} class="wishpic" crossorigin="anonymous" />
				</div>

				<!-- Character -->
			{:else}
				<div
					class="zoomist-image"
					style={getCssVarPosition(offset?.wishCard || {}, clientHeight, clientWidth)}
				>
					<img
						src={$assets[`splash-art/${useOutfit ? outfitName : name}`]}
						alt={name}
						class="wishpic"
						crossorigin="anonymous"
					/>
				</div>
			{/if}

			<div class="info" in:fade={{ delay: 1000 }}>
				{#if type === 'member'}
					<!-- 中文修改版：点名的核心信息是名字，十连列表必须显示 -->
					<div class="member-name">{memberDisplayName({ name, chineseChar, iconType }, $t)}</div>
				{/if}
				<div class="icon" style="width: 100%;">
					{#if isNew || type === 'weapon'}
						{@const iconName = weaponType || vision}
						<SvgIcon name={iconName} />
					{/if}
				</div>

				{#if (isNew && type === 'character') || type === 'weapon'}
					<div class="star">
						{#each Array(rarity) as _, i}
							<div class="i gi-star" />
						{/each}
					</div>
				{/if}

				{#if type === 'character' && !isNew}
					<div class="masterless {bonusType}">
						<Icon type={bonusType} width="80%" />
						<span>{bonusQty}</span>
					</div>
				{/if}

				{#if stelaFortuna}
					<div class="stella stella{rarity}">
						<img src={$assets[`stella-fortuna-${rarity}star.webp`]} alt="Stella Fortuna" />
					</div>
				{/if}
			</div>

			{#if type === 'character' && !isNew}
				<div class="cover" in:fade={{ delay: 1000, duration: 1000 }} />
			{/if}
		</div>
	</div>
</div>

<style>
	.character.duplicate {
		animation: brighten forwards 1s;
		animation-delay: 1s;
	}

	.item {
		transition: all 0.2s;
		will-change: transform;
	}
	.item:hover,
	.item.hover {
		transform: scale(1.04);
		/* z-index: +10; */
	}
	.item:hover .cover,
	.item.hover .cover {
		background-color: rgba(0, 0, 0, 0);
	}

	.star5 .item-body {
		background-image: linear-gradient(
			to bottom,
			rgb(249, 170, 2),
			rgb(255, 255, 255),
			rgb(249, 170, 2)
		);
	}

	.star4 .item-body {
		background-image: linear-gradient(
			to bottom,
			rgb(196, 77, 218),
			rgb(255, 255, 255),
			rgb(196, 77, 218)
		);
	}

	.new {
		position: absolute;
		z-index: 10;
		display: block;
		top: 3%;
		left: 80%;
		transform: translateX(-50%);
		padding: 0 0.4rem;
		border-radius: calc(2 / 100 * var(--card-height)) 0;
		color: #fffa66;
		background-color: #c3882a;
		border: 1px solid #fffa66;
		font-size: calc(3 / 100 * var(--card-height));
	}

	.cover {
		display: block;
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		width: 100%;
		transition: all 0.2s;
		background-color: rgba(0, 0, 0, 0.2);
	}

	.item-body {
		--scale: 2.05;
		height: 100%;
		clip-path: url(#wishframe);
		margin: 0 0.5px;
		display: flex;
		justify-content: center;
		align-items: center;
		touch-action: unset;
		background-image: linear-gradient(to bottom, #aac8f1, #fff, #aac8f1);
	}
	.item-body.catalyst {
		--scale: 1.3;
	}
	.character .item-body {
		--scale: 5;
		--translate-y: 150%;
	}

	.item-content {
		clip-path: url(#wishframe);
		transform: scaleX(0.98) scaleY(0.99);
		background-image: var(--bg);
		background-size: cover;
		background-position: center center;
		position: relative;
	}

	.item-content::after {
		content: '';
		display: block;
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 50%;
		background-image: linear-gradient(to top, rgba(0, 0, 0, 0.4) 60%, rgba(0, 0, 0, 0));
	}

	.zoomist-image {
		position: absolute;
		transform: translate(var(--translate-x, 0px), var(--translate-y, 0px)) scale(var(--scale, 0));
	}

	.zoomist-image.weapon {
		width: 100%;
		height: 100%;
	}

	/* 中文修改版：点名结果单元格 */
	.member-cell {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.member-cell img.member-pic {
		width: 78%;
		height: 78%;
		object-fit: contain;
		border-radius: 0.3rem;
	}

	/* 无图标的名单成员：显示姓名首字，底色按星级区分 */
	/* F10：无图标的名单成员显示完整姓名，竖排 + 毛笔字体（马善政楷书，OFL-1.1）。
	   竖排从右往左读（vertical-rl），长名字自动换列不会溢出格子。 */
	.member-vertical {
		width: 78%;
		height: 86%;
		border-radius: 0.4rem;
		background-color: rgba(255, 255, 255, 0.88);
		color: #3a2c1a;
		display: flex;
		align-items: center;
		justify-content: center;
		writing-mode: vertical-rl;
		font-family: 'MaShanZheng', var(--gi-zh-font);
		font-size: 1.5rem;
		line-height: 1.35;
		letter-spacing: 0.12em;
		overflow: hidden;
		padding: 0.3rem 0;
	}

	.member-name {
		position: absolute;
		bottom: -1.4rem;
		left: 0;
		width: 100%;
		text-align: center;
		color: #fff;
		font-size: 0.85rem;
		text-shadow: 0 0.1rem 0.2rem #000;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: contain;
		object-position: center;
	}

	.weapon img.wishpic {
		filter: drop-shadow(0.2rem 0.2rem 0.02rem rgb(0, 0, 0));
	}

	.stella {
		margin-top: 10%;
	}

	.stella,
	.masterless {
		width: 60%;
		border-radius: 10%;
		overflow: hidden;
		display: flex;
		justify-content: center;
		align-items: center;
		aspect-ratio: 1/1;
		position: relative;
		box-shadow: 0 0 7px rgba(255, 255, 255, 0.7), 0 0 14px rgba(255, 255, 255, 0.5),
			0 0 21px rgba(255, 255, 255, 0.2), 0 0 42px rgba(255, 255, 255, 1);
	}
	.stella::after,
	.masterless span {
		width: 100%;
		font-size: calc(3 / 100 * var(--card-height));
		content: '1';
		display: block;
		position: absolute;
		left: 0;
		bottom: 0;
		color: #fff;
		text-align: center;
		background-color: rgba(0, 0, 0, 0.5);
	}

	.stella5,
	.starglitter {
		background-image: linear-gradient(to top, #ca8937, #a47853);
	}

	.stella4 {
		background-image: linear-gradient(to top, #a47ab9, #7e78a9);
	}

	.info {
		position: absolute;
		bottom: 10%;
		left: 0;
		width: 100%;
		z-index: 10;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.info .gi-star {
		color: #f7cf33;
		display: inline-block;
		font-size: calc(3.5 / 100 * var(--card-height));
	}
	.icon :global(svg) {
		width: 80%;
		aspect-ratio: 1/1;
	}

	@keyframes brighten {
		0% {
			filter: brightness(100%);
		}
		50% {
			filter: brightness(150%);
		}
		100% {
			filter: brightness(100%);
		}
	}
</style>
