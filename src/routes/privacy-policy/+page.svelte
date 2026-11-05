<script>
	import { t, locale } from 'svelte-i18n';
	import { APP_TITLE } from '$lib/env';
	import { html } from '$post/privacy.md';

	// prerender 首屏字典未加载完时 locale 为 null，$t 会 throw，回退兜底
	$: h1Text = $locale ? $t('privacy.h1', { default: '原神祈愿模拟器隐私政策' }) : '原神祈愿模拟器隐私政策';
	$: titleText = $locale ? $t('title', { default: APP_TITLE }) : APP_TITLE;
</script>

<svelte:head>
	<title>
		{h1Text} | {titleText}
	</title>
</svelte:head>

<section>
	<header>
		<h1>{h1Text}</h1>
		<h2>{titleText}</h2>
	</header>

	<article>
		{@html html}
	</article>
</section>

<style>
	section {
		width: 100%;
		height: 100%;
		overflow-y: auto;
		background-color: #ebebeb;
	}

	header {
		height: 20em;
		background-color: #458a74;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		color: #fff;
		position: relative;
	}
	header::after {
		content: '';
		width: 100%;
		height: 100%;
		position: absolute;
		top: 0;
		left: 0;
		background-color: rgba(0, 0, 0, 0.55);
	}
	header h1,
	header h2 {
		position: relative;
		z-index: +1;
	}

	header h1 {
		font-size: 2rem;
	}

	header h2 {
		font-size: large;
		margin-top: 1rem;
	}

	article {
		color: var(--text-color);
		padding: 2% 10%;
		font-family: inherit;
	}

	article :global(h2) {
		font-family: var(--genshin-font);
		padding: 1.5rem 0 0.5rem;
	}

	article :global(p) {
		padding: 0.4rem 0;
	}

	article :global(a) {
		color: #dda04f;
	}

	article :global(ul) {
		list-style-position: inside;
	}

	@media screen and (max-width: 900px) {
		header h1 {
			font-size: 1.2rem;
		}
		header h2 {
			font-size: 1rem;
			margin-top: 0.5rem;
		}

		article {
			padding: 2% 5%;
		}
	}
</style>
