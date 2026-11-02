// 批量替换硬编码英文 → 中文；顺带移除作者的 Discord/GitHub 自宣链接。
// 逐文件用「单行内精确字符串」替换，避免 CRLF/缩进导致匹配失败。
const fs = require('fs');

const jobs = [
	{
		file: 'src/routes/+error.svelte',
		pairs: [
			['<title>Error {$page.status}</title>', '<title>出错了 {$page.status}</title>'],
			['<h1>Error {$page.status}</h1>', '<h1>出错了 {$page.status}</h1>'],
			[
				"<p>We find some problem with the page you're looking for ..</p>",
				'<p>你要找的页面出了点问题……</p>'
			],
			[
				'<a href="/"> <i class="gi-reply" /> Back To The Beginning .. </a>',
				'<a href="/"> <i class="gi-reply" /> 回到首页 </a>'
			]
		]
	},
	{
		file: 'src/routes/+layout.svelte',
		pairs: [['title="Try Your Luck by this Simulator"', 'title="来这个模拟器试试手气"']]
	},
	{
		file: 'src/routes/_allbanners/_form-box.svelte',
		pairs: [
			["title=\"Find by Character'", 'title="按角色搜索"'],
			['title="Reverse Group"', 'title="反转分组"']
		]
	},
	{
		file: 'src/routes/_inventory/_footer.svelte',
		pairs: [['title="Reverse Order"', 'title="反转排序"']]
	},
	{
		file: 'src/routes/_menu/backup-restore/_modal-import.svelte',
		pairs: [['title="Import Data"', 'title="导入数据"']]
	},
	{
		file: 'src/routes/_wish/banner-item.svelte',
		pairs: [['title="Back to Default"', 'title="恢复默认"']]
	},
	{
		file: 'src/routes/_custom-banner/BannerEditor/_details-editor.svelte',
		pairs: [['placeholder="Artwork By @Traveler"', 'placeholder="画师：@旅行者"']]
	},
	{
		file: 'src/routes/_menu/CustomBanner.svelte',
		pairs: [
			[
				'<span>Some Features are Disabled for Maintenance!</span>',
				'<span>部分功能因维护已停用！</span>'
			]
		]
	},
	{
		file: 'src/routes/_index/_screenshot-result.svelte',
		pairs: [
			['title="Copy link"', 'title="复制链接"'],
			['title="Save To Your Device"', 'title="保存到本地"'],
			['title="Share to Twitter"', 'title="分享到 Twitter"'],
			['title="Share to Facebook"', 'title="分享到 Facebook"'],
			['title="More Options"', 'title="更多选项"'],
			['Copied to Clipboard', '已复制到剪贴板']
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
			misses.push(`${file} 未匹配: ${a.slice(0, 50)}`);
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
