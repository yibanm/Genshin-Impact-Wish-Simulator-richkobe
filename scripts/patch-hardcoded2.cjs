// 第二批：修正路径（_banner-item.svelte 带下划线）+ InitialLoader 错误框与进度文本
// + Settings 作者自宣段 + 其余 title 属性
const fs = require('fs');

const jobs = [
	{
		file: 'src/routes/_wish/_banner-item.svelte',
		pairs: [['title="Back to Default"', 'title="恢复默认"']]
	},
	{
		file: 'src/routes/_index/InitialLoader.svelte',
		// 错误提示框：移除作者 Discord 自宣（离线桌面版点了无效），文本中文化
		pairs: [
			[
				'An error occurred while trying to load some assets, this may affect your wish experience.',
				'加载部分素材时出错，可能会影响你的祈愿体验。'
			],
			['<button class="reload" on:click={() => window.location.reload()}>Reload</button>',
			 '<button class="reload" on:click={() => window.location.reload()}>重新加载</button>'],
			['<button class="open" on:click={handleLoaded}>Open Anyway</button>',
			 '<button class="open" on:click={handleLoaded}>仍然打开</button>'],
			['<div class="text connecting" transition:fade>Connecting</div>',
			 '<div class="text connecting" transition:fade>加载中</div>'],
			['Rotate for better experience', '旋转设备以获得更好体验']
		]
	},
	{
		file: 'src/routes/_wish/_header.svelte',
		pairs: [
			['title="Setting" aria-label="Setting"', 'title="设置" aria-label="设置"'],
			['title="FullScreen" aria-label="FullScreen"', 'title="全屏" aria-label="全屏"'],
			['title="Change Banner"', 'title="切换卡池"'],
			['title="Cancel Edit"', 'title="取消编辑"']
		]
	},
	{
		file: 'src/routes/_custom-banner/SplashArtEditor/SplashArt.svelte',
		pairs: [['WishSimulator.App', '原神抽卡点名器']]
	},
	{
		file: 'src/routes/privacy-policy/+page.svelte',
		pairs: [
			['Privacy Policy for WishSimulator.App', '原神抽卡点名器隐私政策'],
			['WishSimulator.App', '原神抽卡点名器']
		]
	}
];

let okCount = 0;
const misses = [];

for (const { file, pairs } of jobs) {
	if (!fs.existsSync(file)) {
		misses.push(`文件不存在: ${file}`);
		continue;
	}
	let s = fs.readFileSync(file, 'utf8');
	const before = s;
	for (const [a, b] of pairs) {
		if (!s.includes(a)) {
			misses.push(`${file} 未匹配: ${a.slice(0, 55)}`);
			continue;
		}
		s = s.split(a).join(b);
		okCount++;
	}
	if (s !== before) fs.writeFileSync(file, s);
}

console.log('成功替换:', okCount, '处');
if (misses.length) {
	console.log('\n未匹配（需人工核）:');
	misses.forEach((m) => console.log('  ' + m));
}
