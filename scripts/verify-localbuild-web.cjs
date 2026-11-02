// localbuild web zip 的隐私 + 结构校验
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const zip = path.join(root, 'dist-release/genshin-wish-roll-1.0.0-web-localbuild.zip');
const names = JSON.parse(execSync('git show 2a42f99:src/lib/data/rollcall-class.json', { cwd: root, encoding: 'utf8' })).names;

const tmp = path.join(root, 'dist-release/_chk');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
execSync(`unzip -o -q "${zip}" -d "${tmp}"`, { cwd: root, stdio: 'pipe' });

let hit = 0, n = 0, dirs = 0;
const walk = (d) => {
	for (const e of fs.readdirSync(d, { withFileTypes: true })) {
		const p = path.join(d, e.name);
		if (e.isDirectory()) { dirs++; walk(p); }
		else if (/\.(js|json|html|css|xml|webmanifest|txt)$/i.test(e.name)) {
			n++;
			const c = fs.readFileSync(p, 'utf8');
			for (const x of names) if (x && x.length >= 2 && c.includes(x)) { hit++; break; }
		}
	}
};
walk(tmp);
fs.rmSync(tmp, { recursive: true, force: true });

console.log('扫描文本文件: ' + n + ' | 子目录数: ' + dirs + ' | 姓名命中: ' + hit);
console.log('结构: ' + (dirs > 5 ? 'PASS 目录结构正常（正斜杠生效）' : 'FAIL 目录结构丢失'));
console.log('隐私: ' + (hit === 0 ? 'PASS 零姓名命中' : 'FAIL'));
process.exit(hit === 0 && dirs > 5 ? 0 : 1);
