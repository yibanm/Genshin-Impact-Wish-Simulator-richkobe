// F10（自定义名单竖排毛笔字）字体选型调研：核实候选毛笔字体的许可证与可获取性。
//
// 为什么必须查许可证：本项目曾因把真实个人数据放进公开仓库而重写 git 历史。
// 字体同理——许可证不明的字体进公开仓库 = 法律风险，且字体文件通常几 MB 起，
// 全量中文字库会吃掉体积预算。所以只考虑「明确允许免费商用 + 可再分发」的字体。
//
// 注意：不要用 `node -e` 跑这类脚本（bash 会吃掉 $ 与反引号，本项目已踩 4 次）。
const https = require('https');

const get = (url) =>
	new Promise((resolve) => {
		const req = https.get(
			url,
			{ headers: { 'User-Agent': 'richkobe-font-survey', Accept: 'application/vnd.github+json' } },
			(res) => {
				let data = '';
				res.on('data', (c) => (data += c));
				res.on('end', () => resolve({ status: res.statusCode, body: data }));
			}
		);
		req.on('error', (e) => resolve({ status: 0, body: String(e.message) }));
		req.setTimeout(25000, () => {
			req.destroy();
			resolve({ status: -1, body: 'timeout' });
		});
	});

// 候选：都是社区公认的免费商用中文字体，逐个核实仓库状态与许可证字段
const CANDIDATES = [
	{ name: '马善政毛笔楷书 Ma Shan Zheng', repo: 'google/fonts', note: 'Google Fonts 收录，预期 OFL-1.1' },
	{ name: '霞鹜文楷 LXGW WenKai', repo: 'lxgw/LxgwWenKai', note: '楷体非毛笔，作对比基线' },
	{ name: '郑庆科黄油体', repo: 'zheng-qingke/butter-font', note: '可能仓库名不对，仅探测' }
];

const run = async () => {
	console.log('=== GitHub 仓库核实 ===');
	for (const c of CANDIDATES) {
		const r = await get(`https://api.github.com/repos/${c.repo}`);
		if (r.status === 200) {
			try {
				const j = JSON.parse(r.body);
				console.log(
					`[OK] ${c.name}\n     repo=${j.full_name} stars=${j.stargazers_count} license=${
						j.license?.spdx_id || 'null(需读README确认)'
					} pushed=${String(j.pushed_at).slice(0, 10)}`
				);
			} catch (e) {
				console.log(`[PARSE-FAIL] ${c.name}: ${r.body.slice(0, 120)}`);
			}
		} else {
			console.log(`[MISS] ${c.name} repo=${c.repo} http=${r.status}`);
		}
	}

	// Google Fonts 里 Ma Shan Zheng 的官方 CSS（含 woff2 真实地址与 unicode-range，
	// unicode-range 存在即说明官方已做分片子集化，可只取需要的分片）
	console.log('\n=== Google Fonts: Ma Shan Zheng CSS 探测 ===');
	const css = await get('https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&display=swap');
	console.log('http=' + css.status);
	if (css.status === 200) {
		const faces = (css.body.match(/@font-face/g) || []).length;
		const ranges = (css.body.match(/unicode-range:[^;]+;/g) || []).length;
		const woff2 = (css.body.match(/https:\/\/[^)]+\.woff2/g) || []).slice(0, 3);
		console.log(`@font-face 数=${faces} unicode-range 分片数=${ranges}`);
		console.log('woff2 样例:', woff2.join('\n  '));
	} else {
		console.log('body:', css.body.slice(0, 200));
	}

	// OFL 许可证全文核实（Ma Shan Zheng 在 google/fonts 仓库的 OFL.txt）
	console.log('\n=== google/fonts 仓库内 Ma Shan Zheng 许可证文件探测 ===');
	const ofl = await get(
		'https://api.github.com/repos/google/fonts/contents/ofl/mashanzheng?per_page=20'
	);
	console.log('http=' + ofl.status);
	if (ofl.status === 200) {
		try {
			const files = JSON.parse(ofl.body).map((f) => `${f.name}(${f.size}B)`);
			console.log('目录内容:', files.join(', '));
		} catch (e) {
			console.log('parse fail');
		}
	} else {
		console.log('body:', ofl.body.slice(0, 150));
	}
};

run();
