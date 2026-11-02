// 验证 orphan 新历史的所有文本 blob 中不含真实姓名（隐私止损的推送前门禁）。
// 只输出命中计数与文件路径，绝不打印姓名明文。
const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 * 300, stdio: ['pipe', 'pipe', 'pipe'] });

const NEW_REF = process.argv[2] || 'clean-history';
// 锚点来源 ref（可选）：本地分支已 force 指向干净历史后，旧提交只能靠 reflog 里的 SHA 取。
// 用法：node verify-history-privacy.cjs <新历史ref> <旧SHA或ref>
const ANCHOR_REF = process.argv[3] || null;

// 锚点姓名从旧历史取（工作区文件已删）
let names = [];
const candidates = ANCHOR_REF
	? [ANCHOR_REF]
	: ['release~1', 'release', 'dev', 'master'];
for (const ref of candidates) {
	try {
		const raw = run(`git show ${ref}:src/lib/data/rollcall-class.json`);
		names = JSON.parse(raw).names || [];
		if (names.length) {
			console.log('锚点来源: ' + ref);
			break;
		}
	} catch (e) {
		// 该 ref 不含此文件，试下一个
	}
}

if (!names.length) {
	console.log('FAIL: 无法取得锚点姓名，验证无法进行');
	process.exit(1);
}
console.log('锚点姓名条数: ' + names.length + '（不打印明文）');

// 新历史的提交数（orphan 重建后通常是 1，允许更多，但必须无名单文件）
const commits = parseInt(run(`git rev-list --count ${NEW_REF}`).trim(), 10);
console.log('新历史提交数: ' + commits);

// 整条历史里不得出现名单数据文件（逐个提交查，不只看 tip）
const rosterCommits = run(
	`git log --oneline ${NEW_REF} -- src/lib/data/rollcall-class.json`
)
	.split('\n')
	.filter(Boolean);
console.log('历史中含名单文件的提交数: ' + rosterCommits.length);

// 扫新历史**所有提交**的全部文本 blob（rev-list --objects 覆盖整条链，而非只 tip）
const objLines = run(`git rev-list --objects ${NEW_REF}`).split('\n').filter(Boolean);
const textExt = /\.(js|json|html|css|md|svelte|txt|xml|cjs|mjs|yml|yaml|webmanifest|svg|ts|tsx|jsx)$/i;
let scanned = 0;
const hits = [];
const seenSha = new Set();

for (const line of objLines) {
	const [sha, ...rest] = line.split(' ');
	const filePath = rest.join(' ');
	if (!textExt.test(filePath)) continue;
	if (seenSha.has(sha)) continue;
	seenSha.add(sha);
	let content;
	try {
		content = run(`git cat-file blob ${sha}`);
	} catch (e) {
		continue;
	}
	scanned++;
	for (const n of names) {
		if (n && n.length >= 2 && content.includes(n)) {
			hits.push({ filePath, masked: n[0] + '*'.repeat(Math.max(1, n.length - 1)) });
			break;
		}
	}
}

console.log('扫描文本 blob 数（含全部历史提交）: ' + scanned);
console.log('');
if (hits.length === 0 && rosterCommits.length === 0) {
	console.log('结论: PASS —— ' + commits + ' 个提交、无名单文件、' + scanned + ' 个文本 blob 零姓名命中');
	process.exit(0);
}
console.log('结论: FAIL');
if (rosterCommits.length) console.log('  - 历史中仍有含名单文件的提交: ' + rosterCommits.join(', '));
hits.forEach((h) => console.log('  - 含姓名的 blob: ' + h.filePath + ' (样例 ' + h.masked + ')'));
process.exit(1);
