// 精确区分「待译键」中哪些仍被代码引用（活键，需翻译）
// 与哪些已无引用（死键）。注意：存在大量 $t(变量) 动态调用，
// 动态拼出的键无法静态识别，因此本结果只能作为参考，不能直接据此批量删键。
const fs = require('fs');
const path = require('path');

const walk = (d, out = []) => {
	for (const e of fs.readdirSync(d, { withFileTypes: true })) {
		const p = path.join(d, e.name);
		if (e.isDirectory()) walk(p, out);
		else if (/\.(svelte|js)$/.test(e.name)) out.push(p);
	}
	return out;
};

const files = walk('src');
const src = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

// 匹配 $t('key') / $json('key') / t('key') / json('key') / $t("key", {...})
const used = new Set();
const re = /\$?(?:t|json)\(\s*['"`]([A-Za-z0-9_.\-]+)['"`]/g;
let m;
while ((m = re.exec(src))) used.add(m[1]);

// 动态调用：键来自变量或模板字符串，静态无法解析
const dyn = src.match(/\$?t\(\s*[a-zA-Z_]/g) || [];
const dynTpl = src.match(/\$?t\(\s*`/g) || [];

const flat = (o, p = '') => {
	let r = {};
	for (const k in o) {
		const v = o[k];
		const np = p ? p + '.' + k : k;
		if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(r, flat(v, np));
		else r[np] = v;
	}
	return r;
};

const zh = flat(JSON.parse(fs.readFileSync('src/locales/zh-CN.json', 'utf8')));
const hasCJK = (s) => /[一-鿿]/.test(String(s));
const bad = Object.keys(zh).filter((k) => !hasCJK(zh[k]));

const alive = bad.filter((k) => used.has(k)).sort();
const dead = bad.filter((k) => !used.has(k)).sort();

console.log('=== 统计 ===');
console.log('扫描文件数:', files.length);
console.log('静态解析出的键引用:', used.size);
console.log('动态 $t(变量) 调用:', dyn.length, '| 动态 $t(`模板`) 调用:', dynTpl.length);
console.log('zh-CN 键总数:', Object.keys(zh).length, '| 仍为英文:', bad.length);
console.log('  → 活键（代码静态引用，必须翻译）:', alive.length);
console.log('  → 无静态引用（可能死键，也可能动态引用，不可直接删）:', dead.length);
console.log('\n=== 活键清单（优先翻译）===');
alive.forEach((k) => console.log(k));
console.log('\n=== 无静态引用清单（需人工核，含动态引用风险）===');
dead.forEach((k) => console.log(k));

fs.writeFileSync(
	'/tmp/alive-keys.json',
	JSON.stringify(alive.map((k) => ({ key: k })), null, 1)
);
