// 给 zh-CN.json 的 rollcall 段补 TXT 导入相关的 6 个键。
// 用脚本而非手工编辑，避免破坏 467 键的缩进与顺序，并顺带做键数校验。
const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/locales/zh-CN.json');
const before = JSON.parse(fs.readFileSync(file, 'utf8'));

const countKeys = (o) => {
	let n = 0;
	for (const k in o) {
		const v = o[k];
		if (v && typeof v === 'object' && !Array.isArray(v)) n += countKeys(v);
		else n++;
	}
	return n;
};

const beforeTotal = countKeys(before);
const rc = before.rollcall || {};

const adds = {
	importTxt: '导入 TXT',
	txtImporting: '导入中…',
	txtTip: '导入 TXT：一人一行，自动去空行；支持 UTF-8 与 GBK 编码',
	txtImported: '已从{name}导入 {count} 个名字',
	txtReadFailed: '读取文件失败：{error}',
	txtEmptyFile: '文件里没有可识别的名字（需一人一行）'
};

let added = 0;
for (const k in adds) {
	if (!(k in rc)) {
		rc[k] = adds[k];
		added++;
	}
}
before.rollcall = rc;

fs.writeFileSync(file, JSON.stringify(before, null, '\t') + '\n', 'utf8');

const after = JSON.parse(fs.readFileSync(file, 'utf8'));
const afterTotal = countKeys(after);
console.log('新增键: ' + added);
console.log('键总数: ' + beforeTotal + ' -> ' + afterTotal + ' (应为 +' + added + ')');
console.log('校验: ' + (afterTotal === beforeTotal + added ? 'PASS' : 'FAIL'));
// 回读确认值正确、无占位符残留
console.log('txtImported = ' + JSON.stringify(after.rollcall.txtImported));
