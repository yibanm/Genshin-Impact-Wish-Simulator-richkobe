// 扫描 .svelte 模板里的硬编码英文 UI 文字（未走 $t() 的）
// 判据：HTML 文本节点或常见文本属性里出现连续英文单词，且不在注释/style/script 的 JS 逻辑中
const fs = require('fs');
const path = require('path');

const walk = (d, out = []) => {
	for (const e of fs.readdirSync(d, { withFileTypes: true })) {
		const p = path.join(d, e.name);
		if (e.isDirectory()) walk(p, out);
		else if (e.name.endsWith('.svelte')) out.push(p);
	}
	return out;
};

const files = walk('src');
const results = [];

for (const f of files) {
	const raw = fs.readFileSync(f, 'utf8');
	// 只取模板区（最后一个 </script> 之后）与 <script> 内的字符串字面量
	const lastScriptEnd = raw.lastIndexOf('</script>');
	const template = lastScriptEnd >= 0 ? raw.slice(lastScriptEnd) : raw;

	const lines = template.split('\n');
	lines.forEach((line, i) => {
		// 跳过 style 块、HTML 注释、Svelte 指令、属性里的非文本值
		if (/^\s*(\/\*|\*|<!--|\.|:|\}|\{)/.test(line)) return;
		// 提取 > 与 < 之间的文本节点内容
		const textNodes = line.match(/>([^<>]+)</g) || [];
		for (const tn of textNodes) {
			const inner = tn.slice(1, -1);
			// 去掉纯 Svelte 表达式
			const cleaned = inner.replace(/\{[^}]*\}/g, ' ').trim();
			// 命中：含 2 个及以上连续英文字母组成的单词，且不含中文
			if (/[A-Za-z]{2,}/.test(cleaned) && !/[一-鿿]/.test(cleaned)) {
				results.push({ file: f, line: i, text: cleaned.slice(0, 90) });
			}
		}
		// 检查 title=/placeholder=/alt= 等属性里的英文字面量
		const attrs = line.match(/(title|placeholder|alt|aria-label)=["'][^"']*[A-Za-z]{2,}[^"']*["']/g) || [];
		for (const a of attrs) {
			if (/\{|\$t\(/.test(a)) continue;
			if (!/[一-鿿]/.test(a)) results.push({ file: f, line: i, text: a.slice(0, 90) });
		}
	});
}

// 按文件分组输出
const byFile = {};
results.forEach((r) => {
	byFile[r.file] = byFile[r.file] || [];
	byFile[r.file].push(r);
});
console.log('=== 命中总数:', results.length, '| 涉及文件:', Object.keys(byFile).length, '===');
Object.keys(byFile)
	.sort()
	.forEach((f) => {
		console.log('\n' + f);
		byFile[f].forEach((r) => console.log('  L' + (r.line + 1) + ': ' + r.text));
	});
