<script>
	import { t } from 'svelte-i18n';
	import { brief } from '$lib/data/updates.json';
	// 应用版本号由 vite.config.js 的 define 在构建期注入（字面量替换）。
	// 不能 import package.json：Vite dev server 对 /package.json?import 返回 403。
	const version = __APP_VERSION__;

	/**
	 * 关于页（E4，中文修改版新增）
	 *
	 * 内容：GitHub 仓库链接 + 求 star + issues 入口 + 简略更新日志。
	 * 更新日志比 GitHub 上的 CHANGELOG 简略（用户要求）：只列每版一句话级要点，
	 * 数据在 updates.json 的 brief 字段，与开屏弹窗的详细公告（data 字段）分开维护。
	 */
	const REPO = 'https://github.com/yibanm/Genshin-Impact-Wish-Simulator-richkobe';
</script>

<div class="about">
	<h2>{$t('menu.about')}</h2>
	<p class="ver">{$t('about.version')}: v{version}</p>

	<p class="intro">{$t('about.intro')}</p>

	<div class="links">
		<a href={REPO} target="_blank" rel="noopener noreferrer">
			{$t('about.repo')}
		</a>
		<a href={`${REPO}/issues`} target="_blank" rel="noopener noreferrer">
			{$t('about.issues')}
		</a>
	</div>

	<p class="star-hint">{$t('about.starHint')}</p>
	<a class="star-btn" href={REPO} target="_blank" rel="noopener noreferrer">
		{$t('about.star')}
	</a>

	<h3>{$t('about.changelog')}</h3>
	<ul class="changelog">
		{#each brief as { ver, lines }}
			<li class="ver-item">
				<strong>v{ver}</strong>
				<ul>
					{#each lines as line}
						<li>{line}</li>
					{/each}
				</ul>
			</li>
		{/each}
	</ul>

	<p class="license">{$t('about.license')}</p>
</div>

<style>
	.about {
		padding: 0.5rem 1rem 1.5rem;
		overflow-y: auto;
		height: 100%;
	}

	h2 {
		margin: 0 0 0.3rem;
	}

	h3 {
		margin: 1.2rem 0 0.5rem;
		font-size: 1rem;
		border-bottom: 1px dashed rgba(0, 0, 0, 0.2);
		padding-bottom: 0.3rem;
	}

	.ver {
		font-size: 0.85rem;
		color: rgba(0, 0, 0, 0.55);
	}

	.intro {
		font-size: 0.92rem;
		line-height: 1.6;
		margin: 0.6rem 0;
	}

	.links {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		margin: 0.6rem 0;
	}

	/* D3：可点击的一律带下划线（关于页链接是纯文本锚点，默认无下划线） */
	a {
		color: #b06205;
		text-decoration: underline;
	}

	a:hover {
		color: #e3a023;
	}

	.star-hint {
		font-size: 0.9rem;
		margin: 0.8rem 0 0.4rem;
		line-height: 1.6;
	}

	.star-btn {
		display: inline-block;
		padding: 0.35rem 1.2rem;
		border: 1px solid #e3a023;
		border-radius: 2rem;
		background-color: #fff6e2;
		color: #8a5a00;
		font-weight: 600;
	}

	.changelog {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.ver-item {
		margin-bottom: 0.8rem;
	}

	.ver-item > strong {
		display: block;
		color: #b06205;
		margin-bottom: 0.2rem;
	}

	.ver-item ul {
		list-style: disc;
		padding-left: 1.3rem;
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.6;
		color: rgba(0, 0, 0, 0.75);
	}

	.license {
		margin-top: 1.2rem;
		font-size: 0.8rem;
		color: rgba(0, 0, 0, 0.5);
		line-height: 1.6;
	}
</style>
