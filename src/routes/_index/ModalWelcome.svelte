<script>
	import { getContext, onMount } from 'svelte';
	import { t } from 'svelte-i18n';
	import OverlayScrollbars from 'overlayscrollbars';

	import { data } from '$lib/data/updates.json';
	import { isPWA } from '$lib/store/app-stores';
	import { browserDetect } from '$lib/helpers/mobileDetect';
	import { playSfx } from '$lib/helpers/audio/audio';
	import Modal from '$lib/components/ModalTpl.svelte';

	// 中文修改版：已移除上游的付费激活码校验（adKey / verifyKey）与赞赏入口，
	// 本弹窗只保留「更新公告」职责，因此不再读取激活码，也不再有 key 过期提示分支。
	let content;
	let contentHeight;

	// E2：「不再提示」勾选框。勾上后确认时写入 localStorage，下次启动不弹本窗。
	// 键独立于 WishSimulator.App 主存储，避免与数据导入导出/重置逻辑耦合
	// （storage-reset 会保留 export 字段，但不应顺带重置用户的「不再提示」选择）。
	const HIDE_KEY = 'giws-hide-welcome';
	let dontShowAgain = false;

	const startApp = getContext('startApp');
	const updates = data.filter(({ featured }) => !!featured);

	onMount(() => {
		OverlayScrollbars(content, { sizeAutoCapable: false, className: 'os-theme-light' });
	});

	const handleConfirm = () => {
		playSfx();
		if (dontShowAgain) {
			try {
				localStorage.setItem(HIDE_KEY, '1');
			} catch (e) {
				// 隐私模式等写不进去的场景：静默降级为每次都提示，不影响进入应用
				console.error('写入「不再提示」失败：', e);
			}
		}
		startApp();
	};
</script>

<Modal confirmOnly title={$t('title')} on:confirm={handleConfirm}>
	<section bind:clientHeight={contentHeight} style="--modalHeight:{contentHeight}px">
		<p class="sp">
			{$t('fanmade')} <br />
			{#if !$isPWA}
				<!-- E1：文案从「安装到主屏幕/桌面的教程」改为「使用教程」 -->
				<a href="/install">{$t('installInstruction')}</a>
			{/if}
		</p>
		{#if !browserDetect().isSupported && isPWA}
			<div class="updates browserNote">
				<strong>
					<!-- 原为硬编码英文，此处改为走语言包 -->
					{@html $t('menu.recommendChrome')}
				</strong>
			</div>
		{:else}
			<div class="updates" bind:this={content}>
				{#each updates.reverse() as { description, date }, i (i)}
					<span>
						<i class="tgl"> {date} </i>
						{#if i === 0} {$t('menu.latestUpdate')} {/if}
					</span>
					{#each description as txt} <p>{@html txt}</p> {/each}
				{/each}
				<div style="height: .5rem" />
			</div>
		{/if}
		<!-- E2：原「本网站所有资源归米哈游所有」改为「不再提示」勾选框。
		     勾选并确认后，下次启动不再弹本窗（localStorage 记忆）。 -->
		<label class="dont-show">
			<input type="checkbox" bind:checked={dontShowAgain} />
			<span>{$t('dontShowAgain')}</span>
		</label>
	</section>
</Modal>

<style>
	section {
		width: 100%;
		height: 100%;
		padding: 0 1.5rem;
	}
	/* E2：不再提示勾选框，跟随弹窗米色面板配色 */
	.dont-show {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.4rem 0 0.2rem;
		font-size: 0.9rem;
		cursor: pointer;
		user-select: none;
	}

	.dont-show input {
		width: 1rem;
		height: 1rem;
		accent-color: #e3a023;
		cursor: pointer;
	}

	.updates {
		text-align: left;
		font-family: inherit;
		background-color: #fff;
		font-size: 0.97rem;
		height: calc(0.7 * var(--modalHeight));
		padding: 0 1rem;
		display: block;
		overflow: hidden;
	}

	:global(.mobile) .updates {
		height: calc(0.6 * var(--modalHeight));
	}

	.browserNote {
		text-align: center;
		font-size: 125%;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.updates span {
		font-weight: bold;
		color: #f7cf33;
		display: block;
		padding-top: 0.5rem;
	}
	.updates .tgl {
		color: #bd6932;
	}

	.updates :global(a) {
		color: #f29f0f;
	}
	.updates :global(a:hover) {
		text-decoration: underline;
	}
	.updates p {
		padding-left: 1rem;
		position: relative;
		line-height: 1rem;
		margin: 0.5rem 0;
	}
	.updates p::before {
		content: '*';
		display: inline-block;
		width: 10px;
		line-height: 0;
		font-size: 1.3rem;
		padding-top: 0.5rem;
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
	}

	.sp {
		font-size: 0.9rem;
		padding: 0rem 0 0.5rem;
	}

	a {
		transition: all 0.2s;
	}
	.sp a {
		font-weight: bold;
		color: #e3a023;
		font-family: inherit;
	}

	a:active {
		transform: scale(0.9);
	}
</style>
