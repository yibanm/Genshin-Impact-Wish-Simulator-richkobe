import path from 'path';
import fs from 'fs';
import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { imagetools } from 'vite-imagetools';
import { marked } from 'marked';
import { config as envConfig } from 'dotenv';

// 替代 vite-plugin-markdown：该插件 peer 只支持 vite ^2||^3，与本项目 vite 4 冲突且无兼容版本。
// 保持原有 `import { html } from '$post/xxx.md'` 语法不变，使消费方组件零改动。
const markdownPlugin = () => ({
	name: 'markdown-html-loader',
	transform(code, id) {
		// 去掉 query 部分再判断扩展名，兼容 vite 的 ?import 等后缀
		if (!id.split('?')[0].endsWith('.md')) return null;
		const filePath = id.split('?')[0];
		let raw = code;
		try {
			raw = fs.readFileSync(filePath, 'utf8');
		} catch (err) {
			this.error(`读取 markdown 失败 ${filePath}: ${err.message}`);
		}
		const html = marked.parse(raw);
		// 同时导出 html（与原插件一致）与 attributes（原插件的 frontmatter，此处为空对象占位）
		return {
			code: `export const html = ${JSON.stringify(html)};\nexport const attributes = {};\nexport default ${JSON.stringify(html)};`,
			map: null
		};
	}
});

envConfig();
const { VITE_APP_TITLE, VITE_DESCRIPTION, VITE_HOST } = process.env;
const iconSize = [16, 32, 72, 96, 128, 144, 152, 192, 256, 384, 512];
const icons = iconSize.map((size) => {
	const iconObj = {
		src: `./icons/icon-${size}x${size}.png`,
		sizes: `${size}x${size}`,
		type: 'image/png'
	};
	if (size === 192) iconObj.purpose = 'maskable';
	if (size === 384) iconObj.purpose = 'any';
	return iconObj;
});

const screenshots = [
	{
		sizes: '591x1280',
		src: 'https://user-images.githubusercontent.com/13815468/200561929-52a32a57-bd2c-473c-b25d-dcd8877ce253.jpg',
		label: 'Section 1',
		type: 'image/jpg'
	},
	{
		sizes: '591x1280',
		src: 'https://user-images.githubusercontent.com/13815468/200561938-c8429695-d7fe-4cf2-8391-d3e78daa789c.jpg',
		label: 'Section 2',
		type: 'image/jpg'
	},
	{
		sizes: '591x1280',
		src: 'https://user-images.githubusercontent.com/13815468/200561909-2f965a06-6cdb-45a3-92c9-646546d514f8.jpg',
		label: 'Section 3',
		type: 'image/jpg'
	},
	{
		sizes: '591x1280',
		src: 'https://user-images.githubusercontent.com/13815468/200561919-b76b11e2-dbda-4534-845e-48714f60fc40.jpg',
		label: 'Section 4',
		type: 'image/jpg'
	}
];

const manifest = {
	orientation: 'landscape',
	name: VITE_APP_TITLE,
	description: VITE_DESCRIPTION,
	id: 'genshin-wish-roll',
	short_name: VITE_APP_TITLE,
	theme_color: '#ffffff',
	background_color: '#ffffff',
	display: 'fullscreen',
	display_override: [
		'fullscreen',
		'window-controls-overlay',
		'standalone',
		'minimal-ui',
		'browser'
	],
	scope: '/',

	start_url: '/?pwasc=homescreen',
	categories: ['games', 'utilities'],
	dir: 'auto',
	icons,
	screenshots,
	handle_links: 'preferred',
	prefer_related_applications: true,
	launch_handler: {
		client_mode: ['focus-existing', 'auto']
	},
	// 中文修改版：移除了 Google Play TWA 声明（本项目不发布安卓 App，原链接指向作者的商店页）
	edge_side_panel: {
		preferred_width: 412
	}
};

/** @type {import('vite').UserConfig} */
const config = {
	// 应用版本号注入（关于页用）。不能在浏览器侧 import package.json——
	// Vite dev server 对 /package.json?import 返回 403（fs 保护），实测菜单整页加载失败。
	// define 在构建期替换为字面量，dev 与 build 都安全。
	define: {
		__APP_VERSION__: JSON.stringify(JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).version)
	},
	plugins: [
		imagetools(),
		sveltekit(),
		markdownPlugin(),
		VitePWA({
			strategies: 'injectManifest',
			srcDir: 'src',
			// 输出目录与 svelte.config.js 的 adapter-static 保持一致（原为 .vercel/output/static）
			outDir: 'dist',
			filename: 'sw.js',
			registerType: 'prompt',
			manifestFilename: 'appmanifest.json',
			manifest
		})
	],
	resolve: {
		alias: {
			$post: path.resolve(__dirname, './src/post'),
			'@images': path.resolve(__dirname, './src/images')
		}
	},
	ssr: {
		// svelte-i18n → intl-messageformat → @formatjs/* 这条链是 CommonJS 包
		// （用 tslib __exportStar 动态转发导出），Node 的 cjs-module-lexer 无法静态识别
		// 其具名导出，而 svelte-i18n 的 runtime.esm.js 用的是具名 import，
		// prerender 阶段会报 "does not provide an export named 'IntlMessageFormat'" /
		// "'isArgumentElement'"。把这几个包交给 Vite 的 commonjs 插件做 interop。
		//
		// 注意：必须精确列出，不能用 noExternal: true。
		// 全量 bundle 会把 deepmerge（同为 svelte-i18n 的依赖，纯 CJS）也拖进来，
		// 它在 dev server 的 ESM 上下文里执行会抛 "module is not defined"
		// （生产构建因 rollup+commonjs 插件能容忍，但 dev 直接白屏）。
		// deepmerge 保持 external 时 Node 能正常加载它（runtime.esm.js 用的是默认导入）。
		noExternal: ['intl-messageformat', /^@formatjs\//]
	},
	build: {
		chunkSizeWarningLimit: 350,
		target: ['es2020']
	}
};

export default config;
