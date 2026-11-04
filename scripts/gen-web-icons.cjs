// 用原石素材重生成全部 Web 侧图标（favicon.ico / PWA 各尺寸 / apple-touch-icon）。
//
// 背景：v1.0.0 的 build/ 目录没有 icon.ico，electron-builder 用了 Electron 默认蓝原子图标；
// web 侧的 favicon 与 PWA 图标也一直是上游遗留旧图。桌面端 Tauri 已换成原石图标，
// 本脚本把 web 侧补齐，保证所有入口图标同源同素材。
//
// ICO 编码：Vista 及以后的 Windows 支持 PNG 压缩的 ICO 条目，直接把 PNG 字节嵌进
// ICO 容器即可（比 BMP 编码简单且体积更小）。16/32/48 三档覆盖浏览器标签页与任务栏。
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const SRC = path.join(root, 'build', 'app-icon-source.png'); // 1024x1024 原石+米金底
const STATIC = path.join(root, 'static');

// PWA manifest 引用的尺寸（vite.config.js 的 iconSize 数组）
const PWA_SIZES = [16, 32, 72, 96, 128, 144, 152, 192, 256, 384, 512];
const ICO_SIZES = [16, 32, 48];

/** 最小 ICO 编码器：PNG 条目（Vista+ 支持） */
const encodeIco = (pngBuffers) => {
	const n = pngBuffers.length;
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0); // reserved
	header.writeUInt16LE(1, 2); // type = icon
	header.writeUInt16LE(n, 4);

	const dir = Buffer.alloc(16 * n);
	let offset = 6 + 16 * n;
	pngBuffers.forEach(({ size, buf }, i) => {
		const o = i * 16;
		dir[o] = size >= 256 ? 0 : size; // 0 表示 256
		dir[o + 1] = size >= 256 ? 0 : size;
		dir[o + 2] = 0; // palette
		dir[o + 3] = 0; // reserved
		dir.writeUInt16LE(1, o + 4); // color planes
		dir.writeUInt16LE(32, o + 6); // bpp
		dir.writeUInt32LE(buf.length, o + 8);
		dir.writeUInt32LE(offset, o + 12);
		offset += buf.length;
	});
	return Buffer.concat([header, dir, ...pngBuffers.map((p) => p.buf)]);
};

const run = async () => {
	// PWA 各尺寸 png
	for (const size of PWA_SIZES) {
		const out = path.join(STATIC, 'icons', `icon-${size}x${size}.png`);
		await sharp(SRC).resize(size, size).png().toFile(out);
	}

	// apple-touch-icon 固定 180x180
	await sharp(SRC)
		.resize(180, 180)
		.png()
		.toFile(path.join(STATIC, 'apple-touch-icon.png'));

	// mstile（Windows 磁贴）150x150
	await sharp(SRC)
		.resize(150, 150)
		.png()
		.toFile(path.join(STATIC, 'icons', 'mstile-150x150.png'));

	// favicon.ico：16/32/48 三档 PNG 条目
	const pngs = [];
	for (const size of ICO_SIZES) {
		const buf = await sharp(SRC).resize(size, size).png().toBuffer();
		pngs.push({ size, buf });
	}
	fs.writeFileSync(path.join(STATIC, 'favicon.ico'), encodeIco(pngs));

	// 回读校验
	const ico = fs.readFileSync(path.join(STATIC, 'favicon.ico'));
	console.log('favicon.ico 条目数 =', ico.readUInt16LE(4), '大小 =', ico.length, 'B');
	console.log('已重生成 PWA 图标', PWA_SIZES.length, '个 + apple-touch-icon + mstile');
};

run().catch((e) => {
	console.error('生成失败:', e.message);
	process.exit(1);
});
