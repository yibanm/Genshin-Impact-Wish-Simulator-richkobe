// 扫描 src 下所有 i18n 键引用，与语言包定义做差集，找出真正的死键
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

// 匹配 $t('key') / $json('key') / t('key') / json('key') 里的字符串键
const used = new Set();
const re = /\$?(?:t|json)\(\s*['"`]([A-Za-z0-9_.\-]+)['"`]/g;
let m;
while ((m = re.exec(src))) used.add(m[1]);

// 动态调用（键来自变量）无法静态解析，统计出来评估漏判风险
const dyn = src.match(/\$?t\(\s*[a-zA-Z_]/g) || [];

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
const defined = new Set(Object.keys(zh));
const dead = [...defined].filter((k) => !used.has(k)).sort();

console.log('扫描文件数:', files.length);
console.log('静态解析出的键引用数:', used.size);
console.log('动态 $t(变量) 调用数:', dyn.length, '(这部分无法静态判定，死键结果需人工复核)');
console.log('语言包键总数:', defined.size);
console.log('代码未引用的候选死键:', dead.length);
console.log('--- 候选死键清单 ---');
dead.forEach((k) => console.log(k));
