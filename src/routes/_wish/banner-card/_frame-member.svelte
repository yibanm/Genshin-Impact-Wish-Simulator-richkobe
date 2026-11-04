<script>
	import { fly } from 'svelte/transition';
	import { t } from 'svelte-i18n';
	import { rollcallStore, getPoolStats } from '$lib/helpers/dataAPI/api-rollcall';
	import { highlightBannerName } from '$lib/helpers/nameText';

	/**
	 * 点名卡池卡面（本项目新增）
	 *
	 * 视觉沿用常驻祈愿（standard）的皮肤：同样的 .frame-content 结构、
	 * 同样的标题描边与配色，因此和其它卡池放在一起不违和。
	 * 差异只在文案与右侧的名单摘要——展示当前启用了哪些名单、
	 * 这一轮还剩多少人没被点到，让用户不用进设置就知道池子状态。
	 */

	// 订阅名单状态，勾选变化时卡面即时刷新
	$: rc = $rollcallStore;
	$: selectedLists = (rc?.lists || []).filter((l) => (rc?.selected || []).includes(l.id));
	// 依赖 rc 触发重算：抽卡结束后 doRoll 会调 refreshRollcall()，这里才会跟着更新
	$: stats = rc ? getPoolStats() : { total: 0, remaining: 0, drawn: 0 };

	// 展示的名单名，超过 3 个只列前 3 个 + 省略号
	const MAX_SHOW = 3;
	$: shownLabels = selectedLists.slice(0, MAX_SHOW).map((l) => l.label);
	$: moreCount = selectedLists.length > MAX_SHOW ? selectedLists.length - MAX_SHOW : 0;
</script>

<div class="frame-content member-frame">
	<div class="top bg-wanderlust">
		{$t('rollcall.bannerTag')}
	</div>

	<h1 in:fly={{ x: 10, duration: 700 }} class="card-stroke">
		{@html highlightBannerName($t('rollcall.bannerName'), 'wanderlust')}
	</h1>

	<div class="info" in:fly={{ x: 15, duration: 700 }}>
		{#if !selectedLists.length}
			<div class="hint">{$t('rollcall.noListSelected')}</div>
		{:else}
			<div class="pool-stat">
				{$t('rollcall.poolStat', { values: { remaining: stats.drawn, total: stats.total } })}
			</div>
			<div class="list-names">
				{#each shownLabels as label (label)}
					<span class="tag">{label}</span>
				{/each}
				{#if moreCount > 0}
					<span class="tag more">+{moreCount}</span>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.frame-content {
		width: 100%;
		height: 100%;
		position: relative;
		color: #565654;
		display: block;
		font-size: calc(1.8 / 100 * var(--content-width));
		line-height: 120%;
	}

	h1,
	.frame-content > div {
		text-align: left;
		position: absolute;
	}

	h1 {
		bottom: 73.5%;
		left: 0;
		margin: 0 4%;
		line-height: 125%;
		font-size: calc(4.5 / 100 * var(--content-width));
	}

	/* 中文标题笔画多，需要和 zh-CN 常驻祈愿标题一样放大，否则糊在一起 */
	:global(.zh-CN) h1,
	:global(.ja-JP) h1 {
		font-size: calc(7 / 100 * var(--content-width));
	}

	.top {
		color: #fff;
		background-color: #c9a07b;
		padding: 0.3% 1.4%;
		border-bottom-left-radius: 2rem;
		border-top-left-radius: 2rem;
		border-bottom-right-radius: 4rem;
		top: 0;
		left: 0;
		transform: translate(-3%, -15%);
	}

	.info {
		left: 0;
		top: 34%;
		width: 42%;
		padding-left: 4%;
	}

	.hint {
		color: #fff;
		background-color: #a4553f;
		padding: 2% 4%;
		border-radius: 0.5rem;
		font-size: calc(2.4 / 100 * var(--content-width));
		display: inline-block;
		filter: drop-shadow(0 0.2rem 0.3rem rgba(0, 0, 0, 0.4));
	}

	.pool-stat {
		color: #fff;
		font-size: calc(2.6 / 100 * var(--content-width));
		text-shadow: 0 0 0.2rem #000;
		filter: drop-shadow(0 0.2rem 0.3rem rgba(0, 0, 0, 0.5));
	}

	.list-names {
		display: flex;
		flex-wrap: wrap;
		gap: calc(0.8 / 100 * var(--content-width));
		margin-top: calc(2 / 100 * var(--content-width));
	}

	.tag {
		color: #4a3b2a;
		background-color: #e8dcc4;
		border: 0.08rem solid #c9b58d;
		border-radius: 2rem;
		padding: 1% 4%;
		font-size: calc(1.9 / 100 * var(--content-width));
		white-space: nowrap;
		filter: drop-shadow(0 0.15rem 0.25rem rgba(0, 0, 0, 0.35));
	}

	.tag.more {
		background-color: #d8c9a8;
	}
</style>
