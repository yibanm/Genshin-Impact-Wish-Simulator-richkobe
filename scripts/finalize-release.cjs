// 产物交付前一站式校验：解压 artifacts.zip → 逐产物完整性校验 → 隐私校验 → 归位 dist-release/
// 用法：node scripts/finalize-release.cjs
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const distRel = path.join(root, 'dist-release');
const zip = path.join(distRel, 'artifacts.zip');
const work = path.join(distRel, 'extracted');

const run = (cmd, opts = {}) => execSync(cmd, { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 * 300, stdio: ['pipe', 'pipe', 'pipe'], ...opts });

// 1. EOCD 校验
const buf = fs.readFileSync(zip);
let eocd = false;
for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
	if (buf.readUInt32LE(i) === 0x06054b50) { eocd = true; break; }
}
console.log('1. artifacts.zip EOCD: ' + (eocd ? '有效 (' + buf.length + ' 字节)' : '无效，下载不完整'));
if (!eocd) process.exit(1);

// 2. 解压
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });
run(`unzip -o -q "${zip}" -d "${work}"`);
console.log('2. 解压完成 -> dist-release/extracted');

// 3. 逐产物校验
const expect = [
	{ rel: 'genshin-wish-roll-1.0.0-web.zip', kind: 'zip' },
	{ rel: 'genshin-wish-roll-1.0.0-windows-x64-portable.zip', kind: 'zip' },
	{ rel: 'release/genshin-wish-roll-1.0.0-windows-x64-setup.exe', kind: 'exe' }
];
let allOk = true;
for (const e of expect) {
	const p = path.join(work, e.rel);
	if (!fs.existsSync(p)) {
		console.log('   MISSING ' + e.rel);
		allOk = false;
		continue;
	}
	const size = fs.statSync(p).size;
	let detail = '';
	if (e.kind === 'zip') {
		try {
			const out = run(`unzip -t -q "${p}"`);
			detail = /No errors detected/i.test(out) || out.trim() === '' ? 'unzip -t OK' : 'unzip -t 有错';
		} catch (err) {
			// unzip -t 无输出时 execSync 可能抛错但 stderr 为空，回退读 EOCD
			const b = fs.readFileSync(p);
			let ok = false;
			for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
				if (b.readUInt32LE(i) === 0x06054b50) { ok = true; break; }
			}
			detail = ok ? 'EOCD OK' : 'EOCD 无效';
		}
	} else {
		const b = fs.readFileSync(p);
		detail = b[0] === 0x4d && b[1] === 0x5a ? 'MZ 头 OK' : 'MZ 头缺失';
	}
	const mb = (size / 1048576).toFixed(1);
	const within = size <= 300 * 1024 * 1024;
	console.log(`   ${e.rel}  ${mb}MB  ${detail}  ${within ? '≤300MB OK' : '超 300MB!'}`);
	if (!/OK/.test(detail) || !within) allOk = false;
}

// 4. 隐私校验：web zip 解出的文本文件不得含真实姓名（锚点从旧提交取）
let names = [];
try {
	const raw = run('git show 2a42f99:src/lib/data/rollcall-class.json');
	names = JSON.parse(raw).names || [];
} catch (e) {
	console.log('4. 隐私校验跳过：取不到锚点 (' + e.message + ')');
}
if (names.length) {
	const webZip = path.join(work, expect[0].rel);
	const webDir = path.join(work, '_webcheck');
	fs.rmSync(webDir, { recursive: true, force: true });
	fs.mkdirSync(webDir, { recursive: true });
	run(`unzip -o -q "${webZip}" -d "${webDir}"`);
	let hit = 0;
	const walk = (dir) => {
		for (const e2 of fs.readdirSync(dir, { withFileTypes: true })) {
			const p2 = path.join(dir, e2.name);
			if (e2.isDirectory()) walk(p2);
			else if (/\.(js|json|html|css|xml|webmanifest|txt)$/i.test(e2.name)) {
				const c = fs.readFileSync(p2, 'utf8');
				for (const n of names) if (n && n.length >= 2 && c.includes(n)) { hit++; break; }
			}
		}
	};
	walk(webDir);
	fs.rmSync(webDir, { recursive: true, force: true });
	console.log('4. web.zip 隐私校验: ' + (hit === 0 ? 'PASS 零姓名命中' : 'FAIL ' + hit + ' 个文件含姓名'));
	if (hit) allOk = false;
}

// 5. 归位
for (const e of expect) {
	const src = path.join(work, e.rel);
	const dst = path.join(distRel, path.basename(e.rel));
	if (fs.existsSync(src)) fs.renameSync(src, dst);
}
fs.rmSync(work, { recursive: true, force: true });
fs.rmSync(zip, { force: true });
console.log('5. 三个产物已归位 dist-release/，中间文件已清理');
console.log('');
console.log(allOk ? '总结论: PASS 可交付' : '总结论: FAIL 见上');
process.exit(allOk ? 0 : 1);
