<script>
	import { fade, fly } from 'svelte/transition';
	import { t } from 'svelte-i18n';
	import { rollcallPanel } from '$lib/store/app-stores';
	import { playSfx } from '$lib/helpers/audio/audio';
	import Rollcall from '../_menu/Rollcall.svelte';

	// 名单管理浮层小窗：在抽卡界面就地勾选/编辑名单，不跳整页菜单。
	// 小屏横屏下整页菜单会顶走卡池画面，浮层保留上下文。
	const close = () => {
		playSfx('close');
		rollcallPanel.set(false);
	};
</script>

<div class="panel-mask" in:fade={{ duration: 150 }} out:fade={{ duration: 100 }} on:mousedown|self={close}>
	<div class="panel" in:fly={{ y: 24, duration: 200 }} out:fly={{ y: 16, duration: 120 }}>
		<div class="panel-head">
			<h2>{$t('rollcall.selectTitle')}</h2>
			<button class="panel-close" on:click={close} title={$t('closeButton')} aria-label={$t('closeButton')}>
				<i class="gi-close" />
			</button>
		</div>
		<div class="panel-body">
			<Rollcall />
		</div>
	</div>
</div>

<style>
	.panel-mask {
		position: fixed;
		inset: 0;
		z-index: 996;
		background-color: rgba(0, 0, 0, 0.45);
		display: flex;
		justify-content: center;
		align-items: center;
		backdrop-filter: blur(2px);
	}

	.panel {
		width: min(56rem, 92vw);
		height: min(34rem, 88vh);
		background-color: #fbf6ee;
		border-radius: 0.6rem;
		box-shadow: 0 0.6rem 2.4rem rgba(0, 0, 0, 0.35);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		color: var(--text-color);
	}

	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		background-color: #f4ecdc;
	}

	.panel-head h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	.panel-close {
		width: 1.8rem;
		height: 1.8rem;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background-color: transparent;
		color: rgba(0, 0, 0, 0.55);
		cursor: pointer;
	}

	.panel-close:hover {
		background-color: rgba(0, 0, 0, 0.08);
		color: #000;
	}

	.panel-body {
		flex: 1;
		min-height: 0;
		padding: 0.6rem;
	}

	/* Rollcall 自带 .content-container 占满高度，浮层里去掉它的外边距圆角重复 */
	.panel-body :global(.content-container) {
		height: 100%;
		border-radius: 0.4rem;
	}
</style>
