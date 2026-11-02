// 隐私止损验证：用真实姓名做搜索锚点，但只输出命中计数，绝不打印姓名明文。
// 锚点从 git 历史里取（工作区文件已删除），验证构建产物 dist/ 与源码中是否还有残留。
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');

// 从 git 历史取原名单（HEAD 上该文件还存在），不打印内容
let names = [];
try {
	const raw = execSync('git show HEAD:src/lib/data/rollcall-class.json', {
		cwd: root,
		encoding: 'utf8',
		stdio: ['pipe', 'pipe', 'pipe']
	});
	names = JSON.parse(raw).names || [];
} catch (e) {
	console.log('无法从 git 历史取到原名单：' + e.message);
	process.exit(1);
}

console.log('锚点姓名条数: ' + names.length + '（不打印明文）');

// 递归收集 dist 下所有文本文件内容
const collect = (dir, out = []) => {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) collect(p, out);
		else if (/\.(js|json|html|css|map|txt|xml|webmanifest)$/i.test(e.name)) out.push(p);
	}
	return out;
};

const files = collect(distDir);
console.log('dist 下受检文本文件数: ' + files.length);

const hits = [];
let checked = 0;
for (const f of files) {
	const content = fs.readFileSync(f, 'utf8');
	checked++;
	for (const n of names) {
		// 完整姓名匹配（单字会误命中二进制与游戏文本，必须用整名）
		if (n && n.length >= 2 && content.includes(n)) {
			hits.push({ file: path.relative(root, f), nameMasked: n[0] + '*'.repeat(n.length - 1) });
			break;
		}
	}
}

console.log('已扫描文件: ' + checked);
console.log('');
if (hits.length === 0) {
	console.log('结论: PASS —— dist 构建产物中已无任何真实姓名');
} else {
	console.log('结论: FAIL —— 仍有 ' + hits.length + ' 个文件含真实姓名:');
	hits.forEach((h) => console.log('  ' + h.file + '  (样例: ' + h.nameMasked + ')'));
	process.exit(1);
}

// 同时确认源码里已无名单数据文件
const srcFile = path.join(root, 'src/lib/data/rollcall-class.json');
console.log('');
console.log('源码 rollcall-class.json 是否还存在: ' + (fs.existsSync(srcFile) ? 'FAIL 仍在' : 'PASS 已删除'));
