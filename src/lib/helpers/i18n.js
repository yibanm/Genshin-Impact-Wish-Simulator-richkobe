import { browser } from '$app/environment';
import { init, register } from 'svelte-i18n';
import { localConfig } from './dataAPI/api-localstore';

const supportedLocales = [
	'zh-CN',
	'zh-TW',
	'de-DE',
	'en-US',
	'fr-FR',
	'id-ID',
	'it-IT',
	'ja-JP',
	'ko-KR',
	'pt-BR',
	'ru-RU',
	'th-TH',
	'vi-VN'
];

const itemLocales = [
	'zh-CN',
	'zh-TW',
	'en-US',
	'de-DE',
	'it-IT',
	'ja-JP',
	'ko-KR',
	'pt-BR',
	'ru-RU',
	'vi-VN'
];

const checkLocale = () => {
	// 中文魔改版：首次启动一律默认简体中文，不跟随浏览器语言
	// （上游此处用 getLocaleFromNavigator()，英文系统会落到 en-US）
	const savedLocale = browser ? localConfig.get('locale') : null;
	if (!savedLocale) return 'zh-CN';
	// 用户手动选过的语言仍生效；存的是非法值时回退中文而不是英文
	const usedLocale = supportedLocales.find((langID) => langID === savedLocale);
	return usedLocale || 'zh-CN';
};

const mountLocale = () => {
	supportedLocales.forEach((langID) => {
		register(langID, () => import(`../../locales/${langID}.json`));
	});

	itemLocales.forEach((langID) => {
		register(langID, () => import(`../../locales/items/${langID}.json`));
	});

	const usedLocale = checkLocale();
	init({
		// 回退语言设为中文，保证漏译的键也不会冒出英文
		// （zh-CN 与 items/zh-CN 已 100% 覆盖 en-US 的全部键，正常情况下不会触发回退）
		fallbackLocale: 'zh-CN',
		initialLocale: usedLocale
	});
};

export { mountLocale, checkLocale };
