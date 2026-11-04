// 立绘重压：分辨率不动，webp quality 80 重编码（2026-11-04 用户要求「更清晰的同时更小」）。
//
// 依据（scripts/measure-art-quality.cjs 实测）：
// - 当前 bpp 8.6~9.9（经验高质量线 1.2 的 7~8 倍），编码近乎无损、冗余极大
// - q80 重压 = 原体积 26%，分辨率不变 → 清晰度肉眼无损，体积省 74%
// - q60 以下收益趋平（23%/22%），不值得多损画质，故选 80
//
// 安全：只在新文件更小时覆盖（小图重压可能反而变大）；git 有原件可回滚。
// 范围：src/images/banner + src/images/characters 全部 webp（948 个，131.7MB）。
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const DIRS = ['src/images/banner', 'src/images/characters'];
const QUALITY = 80;

// Windows 下 Defender/索引服务会瞬时占用文件，writeFileSync 报 UNKNOWN: unknown error, open。
// 轻量重试（最多 3 次，间隔 200/600ms）覆盖绝大多数瞬时锁，避免整批误判为失败。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const writeWithRetry = async (f, buf) => {
	let lastErr;
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			fs.writeFileSync(f, buf);
			return true;
		} catch (e) {
			lastErr = e;
			if (attempt < 2) await sleep(200 + attempt * 400);
		}
	}
	throw lastErr;
};

const walk = (dir, out) => {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) walk(p, out);
		else if (e.name.endsWith('.webp')) out.push(p);
	}
	return out;
};

const run = async () => {
	const files = [];
	for (const d of DIRS) walk(path.join(root, d), files);
	console.log('待处理文件:', files.length);

	let saved = 0;
	let replaced = 0;
	let skipped = 0;
	let failed = 0;

	for (let i = 0; i < files.length; i++) {
		const f = files[i];
		const before = fs.statSync(f).size;
		try {
			// 必须先 readFileSync 成 Buffer 再交给 sharp：sharp(路径) 会让 libvips 保持文件句柄，
			// Windows 上紧接着 writeFileSync 同一文件触发共享冲突（UNKNOWN -4094）。
			const src = fs.readFileSync(f);
			const buf = await sharp(src).webp({ quality: QUALITY }).toBuffer();
			// 只在新文件更小时覆盖，避免小图反变大
			if (buf.length < before) {
				await writeWithRetry(f, buf);
				saved += before - buf.length;
				replaced++;
			} else {
				skipped++;
			}
		} catch (e) {
			failed++;
			console.error('重压失败:', path.relative(root, f), e.message);
		}
		if ((i + 1) % 100 === 0) console.log(`进度 ${i + 1}/${files.length}`);
	}

	console.log(
		`完成：替换 ${replaced}，跳过(不划算) ${skipped}，失败 ${failed}，共省 ${(saved / 1048576).toFixed(1)}MB`
	);
};

run();
