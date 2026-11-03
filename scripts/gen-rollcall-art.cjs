// 生成群星点名卡池的专用海报与标签图标（不贴现成常驻海报）。
// 主视觉用游戏内「5star-special」星形素材（与「群星点名」主题最贴切），
// 海报 1000x574（与 standard 海报同尺寸）：星空渐变底 + 主星居右 +
// 原石点缀；左侧留白给前端渲染标题与说明文字。
// 标签图标 100x100：透明底主星。
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const STAR = path.join(root, 'src/images/utility/5star-special.webp'); // 256x256
const PRIMOGEM = path.join(root, 'src/images/utility/primogem.webp'); // 100x100
const OUT_DIR = path.join(root, 'src/images/banner/member');
const POSTER = path.join(OUT_DIR, 'rollcall-poster.webp');
const TAB = path.join(OUT_DIR, 'rollcall-tab.webp');

fs.mkdirSync(OUT_DIR, { recursive: true });

// 星空渐变底 + 星点（固定种子，保证可复现）
const starField = (w, h) => {
	let seed = 42;
	const rnd = () => {
		seed = (seed * 1103515245 + 12345) % 2147483648;
		return seed / 2147483648;
	};
	let stars = '';
	for (let i = 0; i < 60; i++) {
		const x = (rnd() * w).toFixed(0);
		const y = (rnd() * h).toFixed(0);
		const r = (0.8 + rnd() * 2.2).toFixed(1);
		const o = (0.25 + rnd() * 0.6).toFixed(2);
		stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`;
	}
	return Buffer.from(
		`<svg width="${w}" height="${h}">
			<defs>
				<linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stop-color="#2b2f5e"/>
					<stop offset="0.55" stop-color="#4a3f7a"/>
					<stop offset="1" stop-color="#6d5aa8"/>
				</linearGradient>
				<radialGradient id="glow" cx="0.68" cy="0.5" r="0.5">
					<stop offset="0" stop-color="#b9a7ff" stop-opacity="0.55"/>
					<stop offset="1" stop-color="#b9a7ff" stop-opacity="0"/>
				</radialGradient>
			</defs>
			<rect width="${w}" height="${h}" fill="url(#sky)"/>
			<rect width="${w}" height="${h}" fill="url(#glow)"/>
			${stars}
		</svg>`
	);
};

const run = async () => {
	// 海报：主星放在右侧 60% 处，占高约 82%
	const W = 1000, H = 574;
	const bg = await sharp(starField(W, H)).png().toBuffer();
	const star = Math.round(H * 0.82);
	const starBuf = await sharp(STAR)
		.resize(star, star, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.png()
		.toBuffer();
	// 原石与四星素材做点缀
	const gem1 = await sharp(PRIMOGEM).resize(84, 84, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
	const gem2 = await sharp(PRIMOGEM).resize(52, 52, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

	await sharp(bg)
		.composite([
			{ input: starBuf, left: Math.round(W * 0.6), top: Math.round((H - star) / 2) },
			{ input: gem1, left: Math.round(W * 0.48), top: Math.round(H * 0.14) },
			{ input: gem2, left: Math.round(W * 0.87), top: Math.round(H * 0.72) }
		])
		.webp({ quality: 82 })
		.toFile(POSTER);
	console.log('海报: ' + path.relative(root, POSTER) + ' ' + W + 'x' + H);

	// 标签图标：透明底主星
	await sharp(STAR)
		.resize(100, 100, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.webp({ quality: 88 })
		.toFile(TAB);
	console.log('标签图标: ' + path.relative(root, TAB) + ' 100x100');
};

run().catch((e) => {
	console.error('生成失败:', e.message);
	process.exit(1);
});
