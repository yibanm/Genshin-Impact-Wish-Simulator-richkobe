// 量「立绘更清晰 + 更小」的技术空间：测当前 webp 编码参数与重压收益。
// 用法：node scripts/measure-art-quality.cjs
// 输出：当前 bpp（每像素比特数，越高越清晰）、重压各 quality 档的体积与 SSIM 近似对比。
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const DIRS = ['src/images/banner', 'src/images/characters'];

const stats = async (file) => {
	const buf = fs.readFileSync(file);
	const m = await sharp(buf).metadata();
	const bpp = (buf.length * 8) / (m.width * m.height);
	return { file: path.basename(file), w: m.width, h: m.height, kb: buf.length / 1024, bpp };
};

const run = async () => {
	const samples = [];
	const walk = (dir) => {
		for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
			const p = path.join(dir, e.name);
			if (e.isDirectory()) walk(p);
			else if (e.name.endsWith('.webp')) allFiles.push(p);
		}
	};
	const allFiles = [];
	for (const d of DIRS) walk(path.join(root, d));
	allFiles.sort();
	// 抽样：取体积最大的 6 个（大文件重压收益最明显）
	const withSize = allFiles.map((f) => [f, fs.statSync(f).size]).sort((a, b) => b[1] - a[1]);
	console.log('立绘文件总数:', allFiles.length, '合计', (withSize.reduce((s, x) => s + x[1], 0) / 1048576).toFixed(1) + 'MB');
	for (const [f] of withSize.slice(0, 6)) samples.push(await stats(f));
	console.log('=== 当前编码抽样（bpp = 每像素比特数，经验值 >1.2 为高质量）===');
	samples.forEach((s) =>
		console.log(
			`${s.file.padEnd(34)} ${s.w}x${s.h}  ${(s.kb / 1024).toFixed(2)}MB  bpp=${s.bpp.toFixed(2)}`
		)
	);

	// 重压对比：取最大样本，quality 80/70/60/50 四档，看体积收益
	const srcFile = withSize[0][0];
	const one = samples[0];
	console.log('\n=== 重压对比样本:', path.relative(root, srcFile), '===');
	for (const q of [80, 70, 60, 50]) {
		const out = await sharp(srcFile).webp({ quality: q }).toBuffer();
		const ratio = ((out.length / (one.kb * 1024)) * 100).toFixed(0);
		console.log(`quality ${q}: ${(out.length / 1024 / 1024).toFixed(2)}MB（原体积 ${ratio}%）`);
	}
};

run().catch((e) => {
	console.error(e.message);
	process.exit(1);
});
