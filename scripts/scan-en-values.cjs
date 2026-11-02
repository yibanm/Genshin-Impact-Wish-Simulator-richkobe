// 扫描 zh-CN.json 中值仍为英文的键（漏译检测）
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const zh = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/zh-CN.json'), 'utf8'));

const flat = (o, p = '', out = {}) => {
	for (const k in o) {
		const v = o[k];
		const np = p ? p + '.' + k : k;
		if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, np, out);
		else out[np] = v;
	}
	return out;
};

const f = flat(zh);
const hits = [];
for (const k in f) {
	const v = f[k];
	if (typeof v !== 'string') continue;
	// 剥掉 {占位符} 与 <标签> 后，若剩下的仍是一串英文单词，即视为漏译
	const stripped = v.replace(/\{[^}]*\}/g, '').replace(/<[^>]*>/g, '').trim();
	if (!stripped) continue;
	if (!/[A-Za-z]{3,}/.test(stripped)) continue;
	// 含任一 CJK 字符则视为已译
	if (/[一-鿿぀-ヿ가-힯]/.test(stripped)) continue;
	hits.push([k, v]);
}

console.log('zh-CN.json 中值仍为英文的键：' + hits.length + ' 条');
hits.forEach(([k, v]) => console.log('  ' + k + ' = ' + JSON.stringify(v)));

// 同样扫 items/zh-CN.json（角色武器名语言包）
const itemsPath = path.join(root, 'src/locales/items/zh-CN.json');
if (fs.existsSync(itemsPath)) {
	const items = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
	const fi = flat(items);
	const hits2 = [];
	for (const k in fi) {
		const v = fi[k];
		if (typeof v !== 'string') continue;
		if (/[一-鿿]/.test(v)) continue;
		if (/[A-Za-z]{3,}/.test(v)) hits2.push([k, v]);
	}
	console.log('');
	console.log('items/zh-CN.json 中值仍为英文的键：' + hits2.length + ' 条');
	hits2.slice(0, 40).forEach(([k, v]) => console.log('  ' + k + ' = ' + JSON.stringify(v)));
	if (hits2.length > 40) console.log('  ... 还有 ' + (hits2.length - 40) + ' 条');
}
