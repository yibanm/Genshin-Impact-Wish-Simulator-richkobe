// import-txt.js 的离线单元测试：验证「一人一行」解析与 UTF-8/GBK 编码兜底。
// 不依赖浏览器，直接用 node 跑（import 语法通过 --experimental 或改用动态 import）。
const path = require('path');

const modPath = path.resolve(__dirname, '../src/lib/helpers/rollcall/import-txt.js');

let pass = 0;
let fail = 0;
const check = (name, actual, expected) => {
	const ok = JSON.stringify(actual) === JSON.stringify(expected);
	if (ok) {
		pass++;
		console.log('  PASS  ' + name);
	} else {
		fail++;
		console.log('  FAIL  ' + name);
		console.log('        期望: ' + JSON.stringify(expected));
		console.log('        实际: ' + JSON.stringify(actual));
	}
};

(async () => {
	const { parseNames, decodeBuffer, MAX_LINES_PER_FILE } = await import('file://' + modPath);

	console.log('=== parseNames：一人一行 ===');
	check('LF 换行', parseNames('张三\n李四\n王五'), ['张三', '李四', '王五']);
	check('CRLF 换行（Windows 记事本）', parseNames('张三\r\n李四\r\n'), ['张三', '李四']);
	check('CR 换行（老 Mac）', parseNames('张三\r李四'), ['张三', '李四']);
	check('空行被剔除', parseNames('张三\n\n\n李四\n   \n王五'), ['张三', '李四', '王五']);
	check('首尾空格被剔除', parseNames('  张三  \n\t李四\t'), ['张三', '李四']);
	check('同名重复被保留', parseNames('张三\n张三'), ['张三', '张三']);
	check('空输入返回空数组', parseNames(''), []);
	check('null 输入返回空数组', parseNames(null), []);
	check('非字符串输入返回空数组', parseNames(123), []);
	check('纯空行返回空数组', parseNames('\n\n\n'), []);
	check(
		'超过上限被截断',
		parseNames(Array.from({ length: MAX_LINES_PER_FILE + 50 }, (_, i) => 'name' + i).join('\n'))
			.length,
		MAX_LINES_PER_FILE
	);
	// 数组等非字符串输入应走类型保护返回空，而不是抛错
	check('数组输入返回空数组', parseNames(['张三', '李四']), []);

	console.log('');
	console.log('=== decodeBuffer：编码兜底 ===');
	const enc = new TextEncoder();
	check('UTF-8 正常解码', parseNames(decodeBuffer(enc.encode('张三\n李四'))), ['张三', '李四']);
	check(
		'UTF-8 带 BOM 时 BOM 被去掉',
		parseNames(decodeBuffer(new Uint8Array([0xef, 0xbb, 0xbf, ...enc.encode('张三\n李四')]))),
		['张三', '李四']
	);
	check('纯 ASCII 文件', parseNames(decodeBuffer(enc.encode('Tom\nJerry'))), ['Tom', 'Jerry']);

	// GBK 编码的「张三李四」= d5c5 c8fd c0ee cbc4
	const gbkBytes = new Uint8Array([0xd5, 0xc5, 0xc8, 0xfd, 0x0a, 0xc0, 0xee, 0xcb, 0xc4]);
	const gbkText = decodeBuffer(gbkBytes);
	console.log('  INFO  GBK 字节解码结果: ' + JSON.stringify(gbkText));
	check(
		'GBK 中文回退解码（姓名正确）',
		parseNames(gbkText),
		['张三', '李四']
	);

	console.log('');
	console.log('=== 汇总 ===');
	console.log('通过: ' + pass + ' | 失败: ' + fail);
	process.exit(fail > 0 ? 1 : 0);
})();
