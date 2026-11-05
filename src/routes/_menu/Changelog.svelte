<script>
	import { t } from 'svelte-i18n';
	import { data as updates } from '$lib/data/updates.json';

	// 更新日志独立页（用户 2026-11-05 要求）：按版本 + 更新日期排列，整页可滚动；
	// 页面不再放赞赏码（用户改要求放关于页）。
</script>

<div class="changelog-page">
	<h2>{$t('menu.changelog')}</h2>

	{#each updates as entry (entry.date + entry.ver)}
		<div class="entry" class:featured={entry.featured}>
			<div class="head">
				<strong class="ver">v{entry.ver}</strong>
				<span class="date">{entry.date}</span>
				{#if entry.featured}<span class="badge">{$t('changelog.featured')}</span>{/if}
			</div>
			<ul>
				{#each entry.description as line}
					<li>{@html line}</li>
				{/each}
			</ul>
		</div>
	{/each}
</div>

<style>
	.changelog-page {
		padding: 0.5rem 1rem 1.5rem;
		overflow-y: auto;
		height: 100%;
		-webkit-overflow-scrolling: touch;
	}

	h2 {
		margin: 0 0 0.6rem;
	}

	.entry {
		margin-bottom: 1.2rem;
		padding: 0.6rem 0.9rem;
		border-left: 3px solid rgba(0, 0, 0, 0.15);
	}

	.entry.featured {
		border-left-color: #e3a023;
		background-color: rgba(227, 160, 35, 0.06);
		border-radius: 0 0.4rem 0.4rem 0;
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		margin-bottom: 0.3rem;
	}

	.ver {
		color: #b06205;
		font-size: 1rem;
	}

	.date {
		color: rgba(0, 0, 0, 0.5);
		font-size: 0.85rem;
	}

	.badge {
		padding: 0 0.5rem;
		border-radius: 1rem;
		background-color: #e3a023;
		color: #fff;
		font-size: 0.75rem;
	}

	.entry ul {
		list-style: disc;
		padding-left: 1.3rem;
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.7;
		color: rgba(0, 0, 0, 0.78);
	}
</style>
