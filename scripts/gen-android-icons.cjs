// 生成安卓启动图标：以游戏内「原石」素材为主体（与抽卡主题最相关），
// 自适应图标前景层按 108dp 画布、内容收在中心 66dp 安全区内；
// 传统 mipmap 图标 = 米金底 + 原石居中。背景色同步原神皮肤米金。
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const SRC = path.join(root, 'src/images/utility/primogem.webp'); // 100x100
const RES = path.join(root, 'android/app/src/main/res');

// 原神卡面米金（与 Rollcall.svelte / _rollcall-editor 的 #fbf6ee 一致）
const BG_TOP = '#fdfaf3';
const BG_BOT = '#efe3c8';

// 各密度尺寸：传统图标 = 48dp 基准；自适应前景层 = 108dp 基准
const DENSITIES = [
	{ dir: 'mipmap-mdpi', scale: 1 },
	{ dir: 'mipmap-hdpi', scale: 1.5 },
	{ dir: 'mipmap-xhdpi', scale: 2 },
	{ dir: 'mipmap-xxhdpi', scale: 3 },
	{ dir: 'mipmap-xxxhdpi', scale: 4 }
];

// 米金竖向渐变背景 SVG
const bgSvg = (w, h) => Buffer.from(
	`<svg width="${w}" height="${h}">
		<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="${BG_TOP}"/>
			<stop offset="1" stop-color="${BG_BOT}"/>
		</linearGradient></defs>
		<rect width="${w}" height="${h}" fill="url(#g)"/>
	</svg>`
);

const run = async () => {
	// 原石放大到 512 备用（sharp 缩放保质量）
	const primogem512 = await sharp(SRC).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

	for (const { dir, scale } of DENSITIES) {
		const outDir = path.join(RES, dir);
		fs.mkdirSync(outDir, { recursive: true });

		// 传统图标：48dp * scale
		const legacy = Math.round(48 * scale);
		// 背景
		const bg = await sharp(bgSvg(legacy, legacy)).png().toBuffer();
		// 原石占 72% 居中
		const iconSize = Math.round(legacy * 0.72);
		const icon = await sharp(primogem512).resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
		const offset = Math.round((legacy - iconSize) / 2);
		await sharp(bg)
			.composite([{ input: icon, left: offset, top: offset }])
			.png()
			.toFile(path.join(outDir, 'ic_launcher.png'));
		// 圆形图标同图（系统会按 mask 裁）
		await sharp(bg)
			.composite([{ input: icon, left: offset, top: offset }])
			.png()
			.toFile(path.join(outDir, 'ic_launcher_round.png'));

		// 自适应前景层：108dp * scale，原石收在中心 66dp 安全区（66/108 ≈ 0.61）
		const fg = Math.round(108 * scale);
		const safeSize = Math.round(fg * 0.61);
		const fgIcon = await sharp(primogem512).resize(safeSize, safeSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
		const fgOffset = Math.round((fg - safeSize) / 2);
		await sharp({ create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
			.composite([{ input: fgIcon, left: fgOffset, top: fgOffset }])
			.png()
			.toFile(path.join(outDir, 'ic_launcher_foreground.png'));

		console.log(dir + ': legacy ' + legacy + 'px, foreground ' + fg + 'px');
	}

	// 背景色值同步米金（自适应图标 background 层）
	const colorXml = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG_BOT}</color>\n</resources>\n`;
	fs.writeFileSync(path.join(RES, 'values/ic_launcher_background.xml'), colorXml);
	console.log('ic_launcher_background 已改为 ' + BG_BOT);
};

run().catch((e) => {
	console.error('图标生成失败:', e.message);
	process.exit(1);
});
