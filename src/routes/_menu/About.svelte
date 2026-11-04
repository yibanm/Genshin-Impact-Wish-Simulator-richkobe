<script>
	import { t } from 'svelte-i18n';
	// 应用版本号由 vite.config.js 的 define 在构建期注入（字面量替换）。
	// 不能 import package.json：Vite dev server 对 /package.json?import 返回 403。
	const version = __APP_VERSION__;

	/**
	 * 关于页（E4，本项目新增）
	 *
	 * 内容：GitHub 仓库链接 + 求 star + issues 入口。
	 * 更新日志已独立成页（Changelog.svelte，用户 2026-11-05 要求）。
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

	.license {
		margin-top: 1.2rem;
		font-size: 0.8rem;
		color: rgba(0, 0, 0, 0.5);
		line-height: 1.6;
	}
</style>
