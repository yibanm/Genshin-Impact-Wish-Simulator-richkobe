<script>
	import { getContext, onDestroy, setContext } from 'svelte';
	import { fade } from 'svelte/transition';
	import { t } from 'svelte-i18n';
	import hotkeys from 'hotkeys-js';

	import { editorMode, isMobile, mobileMode, menuTarget } from '$lib/store/app-stores';
	import { playSfx } from '$lib/helpers/audio/audio';

	// Components
	import Options from './Settings.svelte';
	import Updates from './Updates.svelte';
	import Sidebar from './_sidebar.svelte';
	import CustomBanner from './CustomBanner.svelte';
	import BackupRestore from './BackupRestore.svelte';
	import Rollcall from './Rollcall.svelte';

	// 中文魔改版：支持从别处（如点名卡池卡面）直达指定子页；无指定时用默认页
	const initialContent = () => {
		if ($menuTarget) return $menuTarget;
		return $editorMode ? 'customBanner' : 'options';
	};
	let activeContent = initialContent();

	// 打开菜单时若带着 target，应用后立即清空，避免下次打开还停在同一页
	menuTarget.subscribe((target) => {
		if (!target) return;
		activeContent = target;
		menuTarget.set('');
	});

	const selectMenu = (menu) => {
		if (activeContent === menu) return;
		activeContent = menu;
		playSfx('shopnav');
	};
	setContext('selectMenu', selectMenu);

	const handleClose = getContext('handleMenu');

	// Shortcut
	hotkeys('esc,m', 'menu', (e) => {
		e.preventDefault();
		handleClose();
	});

	hotkeys.setScope('menu');
	onDestroy(() => hotkeys.deleteScope('menu', 'index'));
</script>

<section transition:fade={{ duration: 200 }}>
	<div class="head">
		<h1>{$t('menu.text')} / {$t(`menu.${activeContent}`)}</h1>
		<button class="close" on:click={handleClose}>
			<i class="gi-close" />
		</button>
	</div>
	<div class="container">
		<Sidebar {activeContent} />

		<div class="content">
			{#if activeContent === 'options'}
				<Options />
			{:else if activeContent === 'updates'}
				<Updates />
			{:else if activeContent === 'customBanner'}
				<CustomBanner />
			{:else if activeContent === 'backupRestore'}
				<BackupRestore />
			{:else if activeContent === 'rollcall'}
				<Rollcall />
			{/if}

			{#if $isMobile && !$mobileMode}
				<div class="rotate">
					<i class="gi-rotate-phone" />
					<span>{$t('menu.rotate')} </span>
				</div>
			{/if}
		</div>
	</div>
</section>

<style>
	section {
		height: var(--screen-height);
		width: 100vw;
		display: block;
		position: fixed;
		top: 0;
		left: 0;
		backdrop-filter: blur(12px);
		background-color: rgba(0, 0, 0, 0.3);
		z-index: 100;
	}

	section :global(h2) {
		color: var(--tertiary-color);
		margin-top: 1rem;
		margin-bottom: 0.5rem;
	}

	section :global(.content-container) {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
	.container :global(a) {
		color: #f29f0f;
	}

	.head {
		display: flex;
		justify-content: space-between;
		margin: 2% 2% 1%;
		color: var(--tertiary-color);
	}
	:global(.mobile) .head {
		margin: 0.5rem 2%;
	}

	.container {
		display: flex;
		justify-content: center;
		margin: 0 2%;
		height: calc(100% - 7rem);
	}

	:global(.mobile) .container {
		height: calc(100% - 5rem);
	}

	.content {
		width: 70%;
		position: relative;
	}

	.rotate {
		position: fixed;
		bottom: 5%;
		left: 5%;
		color: #fff;
		display: flex;
		flex-direction: column;
		text-align: center;
	}

	.gi-rotate-phone {
		font-size: 3rem;
		animation: rotatePhone 1s infinite alternate;
	}

	:global(.mobile) .close {
		margin-right: 4%;
	}

	@media screen and (max-width: 900px) {
		:global(main):not(.mobile) .container {
			flex-direction: column;
		}

		:global(main):not(.mobile) .content {
			width: 100%;
			height: 100%;
			margin-top: 1.5rem;
		}
	}

	@keyframes rotatePhone {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(-90deg);
		}
	}
</style>
