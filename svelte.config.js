import path from 'path';
// 改用 adapter-static：输出纯静态站，无 SSR 依赖，可直接被 Electron 以 file:// 加载
import adapter from '@sveltejs/adapter-static';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		appDir: 'internal',
		adapter: adapter({
			// pages 与 assets 同目录输出，便于 Electron 壳层直接指向单一 dist 目录
			pages: 'dist',
			assets: 'dist',
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		alias: {
			$post: path.resolve('./src/post')
		}
	},
	preprocess: preprocess({ postcss: true })
};

export default config;
