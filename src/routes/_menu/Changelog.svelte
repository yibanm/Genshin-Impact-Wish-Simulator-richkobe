<script>
	import { t } from 'svelte-i18n';
	import { data as updates } from '$lib/data/updates.json';

	// 更新日志独立页（用户 2026-11-05 要求）：展示每期详细公告，
	// 页面底部为作者赞赏码（微信）。
</script>

<div class="changelog-page">
	<h2>{$t('menu.changelog')}</h2>

	{#each updates as entry (entry.date)}
		<div class="entry" class:featured={entry.featured}>
			<div class="date">
				{entry.date}
				{#if entry.featured}<span class="badge">{$t('changelog.featured')}</span>{/if}
			</div>
			<ul>
				{#each entry.description as line}
					<li>{@html line}</li>
				{/each}
			</ul>
		</div>
	{/each}

	<div class="tip">
		<h3>{$t('changelog.tipTitle')}</h3>
		<img src="/tip-qrcode.png" alt="{$t('changelog.tipTitle')}" />
		<p>{$t('changelog.tipHint')}</p>
	</div>
</div>

<style>
	.changelog-page {
		padding: 0.5rem 1rem 1.5rem;
		overflow-y: auto;
		height: 100%;
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

	.date {
		font-weight: 600;
		color: #b06205;
		margin-bottom: 0.3rem;
	}

	.badge {
		display: inline-block;
		margin-left: 0.5rem;
		padding: 0 0.5rem;
		border-radius: 1rem;
		background-color: #e3a023;
		color: #fff;
		font-size: 0.75rem;
		font-weight: 400;
	}

	.entry ul {
		list-style: disc;
		padding-left: 1.3rem;
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.7;
		color: rgba(0, 0, 0, 0.78);
	}

	.tip {
		margin-top: 2rem;
		padding-top: 1.2rem;
		border-top: 1px dashed rgba(0, 0, 0, 0.25);
		text-align: center;
	}

	.tip h3 {
		margin: 0 0 0.8rem;
		font-size: 1rem;
	}

	.tip img {
		width: 220px;
		max-width: 70%;
		border-radius: 0.5rem;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
	}

	.tip p {
		margin: 0.8rem auto 0;
		max-width: 26rem;
		font-size: 0.9rem;
		line-height: 1.7;
		color: rgba(0, 0, 0, 0.7);
	}
</style>
