// 把 import-txt.js 里的 REPLACEMENT_CHAR / BOM 常量改成纯 ASCII 转义序列。
// 原因：直接粘贴 U+FFFD 字面字符会在编辑/传输环节丢失变成空串，
// 而 String.includes('') 恒为 true，会让 GBK 兜底无条件触发（UTF-8 文件被错误重解码）。
const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/lib/helpers/rollcall/import-txt.js');
const lines = fs.readFileSync(file, 'utf8').split('\n');

let changed = 0;
for (let i = 0; i < lines.length; i++) {
	const l = lines[i];
	if (/^const REPLACEMENT_CHAR =/.test(l)) {
		lines[i] = "const REPLACEMENT_CHAR = '\\uFFFD';";
		changed++;
	} else if (/^const BOM =/.test(l)) {
		// BOM 未在本文件使用（解码处直接用 charCodeAt(0) === 0xfeff 判断），删掉避免死代码
		lines[i] = null;
		changed++;
	}
}

const out = lines.filter((l) => l !== null).join('\n');
fs.writeFileSync(file, out, 'utf8');
console.log('已改写行数: ' + changed);

// 回读校验：文件里不得再出现空的 includes('') 或未定义常量
const verify = fs.readFileSync(file, 'utf8');
console.log("含 includes('') 空串写法: " + /includes\(''\)/.test(verify));
console.log("含 \\uFFFD 转义: " + /\\uFFFD/.test(verify));
console.log("残留 const BOM: " + /^const BOM/m.test(verify));
