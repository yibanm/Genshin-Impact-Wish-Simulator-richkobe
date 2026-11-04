// 生成 Tauri 桌面图标的源图（1024x1024 PNG）。
//
// 素材选择：沿用安卓启动图标同源的「原石」(primogem.webp)——原石是抽卡行为
// 直接消耗的货币，最能代表本项目主题；保持桌面端与安卓端图标一致。
// 底色沿用原神卡面米金渐变（与安卓 ic_launcher_bg.xml 同一组色值）。
//
// 产出后由官方 `npx tauri icon` 生成全套多尺寸图标（ico/icns/各 png），
// 不在这里手写多尺寸逻辑。
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const SRC = path.join(root, 'src/images/utility/primogem.webp'); // 100x100
const OUT_DIR = path.join(root, 'src-tauri');
const OUT = path.join(OUT_DIR, 'app-icon-source.png');

const SIZE = 1024;
// 原神卡面米金（与安卓图标、Rollcall.svelte 的 #fbf6ee 同一色系）
const BG_TOP = '#fdfaf3';
const BG_BOT = '#efe3c8';

const bgSvg = `<svg width="${SIZE}" height="${SIZE}">
	<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
		<stop offset="0" stop-color="${BG_TOP}"/>
		<stop offset="1" stop-color="${BG_BOT}"/>
	</linearGradient></defs>
	<rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
</svg>`;

const run = async () => {
	// 原石先放大到高分辨率，sharp 缩放保质量（源只有 100x100）
	const gem = await sharp(SRC)
		.resize(768, 768, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.png()
		.toBuffer();

	// 居中合成，占画面 75%（与安卓 72% 接近，桌面图标视觉更饱满）
	await sharp(Buffer.from(bgSvg))
		.composite([{ input: gem, gravity: 'center' }])
		.png()
		.toFile(OUT);

	console.log('已生成图标源图:', path.relative(root, OUT));
	const stat = fs.statSync(OUT);
	console.log('大小:', (stat.size / 1024).toFixed(1) + 'KB');
};

run().catch((e) => {
	console.error('生成失败:', e.message);
	process.exit(1);
});
