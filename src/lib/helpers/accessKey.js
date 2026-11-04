import { proUser, showAd } from '$lib/store/app-stores';
import { cookie } from './dataAPI/api-cookie';

// 本项目说明：
// 上游此处会通过 fetch 请求作者的 GitHub gist 校验付费激活码（去广告 + 解锁自定义卡池数量），
// 离线时 retry() 会每 10 秒无限重试。本项目已删除赞赏/付费入口，改为全功能默认解锁，
// 因此不再请求任何外部地址，也不再读取激活码。保留 adKey 的接口签名是为了
// 兼容数据导入导出（export-import.js / data-merger.js）里对 accessKey 字段的读写，
// 避免旧备份文件导入时报错。

const adKey = {
	_set(key) {
		// 保留写入能力仅为兼容旧备份导入，不再做任何校验
		const reversed = String(key ?? '').trim().split('').reverse().join('');
		cookie.set('accessKey', reversed);
	},

	clear() {
		return cookie.set('accessKey', null);
	},

	async initialLoad() {
		const storedKey = cookie.get('accessKey');
		const reversedKey = storedKey?.split('').reverse().join('') ?? '';
		// 不再联网校验：一律视为有效，功能保持解锁
		return { validity: true, expiryDate: 'none', storedKey: reversedKey, status: 'ok' };
	},

	async verify() {
		// 激活码机制已移除，任何输入都直接成功
		return { validity: true, msg: 'success' };
	}
};

const verifyKey = () => {
	// 空操作：proUser 已在 store 中默认为 true，此处不再回写，
	// 否则会用「无激活码 → false」把已解锁的状态重新锁死
	proUser.set(true);
	showAd.set(false);
};

export { adKey, verifyKey };
