import { get } from 'svelte/store';
import { standard } from '$lib/data/banners/standard.json';
import { fatepointManager } from '../dataAPI/api-localstore';
import {
	course as wpCourse,
	chronicledCourse,
	activeBanner,
	bannerList
} from '$lib/store/app-stores';
import characterWish from './wishCharacter';
import beginerWish from './wishBeginner';
import weaponWish from './wishWeapon';
import standardWish from './wishStandard';
import roll from './roll';
import chronicledWish from './wishChronicled';
import { get5StarItem } from './itemdrop-base';

const initLoadFatepoint = (version, phase) => {
	['weapon-event', 'chronicled'].forEach((banner) => {
		const localFate = fatepointManager.init({ phase, version, banner });
		const { selected, point, type } = localFate.getInfo();
		if (banner.match('weapon')) return wpCourse.set({ point, selected });
		chronicledCourse.set({ point, selected, type });
	});
};

const WISH = {
	async init(version, phase, customData) {
		this._version = version;
		this._phase = phase;

		if (version.match(/(custom|local)/gi)) return this._initCustom(customData);
		const { data } = await import(`../../data/banners/events/${version}.json`);
		const { standardVersion, weapons, events, chronicled } = data.find(
			(d) => d.phase === phase
		).banners;
		initLoadFatepoint(version, phase);

		this._characters = events;
		this._isDualBanner = events.featured?.length > 1;
		this._weapons = weapons;
		this._chronicled = chronicled;
		this._standardVer = standardVersion;
		this._customData = {};
		return this;
	},

	_initCustom(customData) {
		this._customData = customData;
		this._standardVer = standard.reverse()[0].version;
		const { character = '', rateup = [], bannerName = '' } = customData;
		this._characters = {
			rateup,
			featured: [{ bannerName, character }]
		};
		return this;
	},

	_characterWish(rarity, indexOfBanner) {
		const { featured, rateup } = this._characters;
		const eventBanner = characterWish.init({
			version: this._version,
			phase: this._phase,
			stdver: this._standardVer,
			customData: this._customData,
			indexOfBanner,
			featured,
			rateup
		});

		const result = eventBanner.get(rarity);
		result.bannerName = featured[indexOfBanner].bannerName;
		return result;
	},

	_weaponWish(rarity) {
		const { _weapons, _phase: phase, _version: version } = this;
		const { fatepointsystem: fatesystem = false, featured, rateup } = _weapons;
		const weaponBanner = weaponWish.init({
			fatesystemON: fatesystem,
			featured,
			phase,
			version,
			rateup
		});
		const result = weaponBanner.get(rarity);
		result.bannerName = _weapons.bannerName;
		return result;
	},

	_chronicledWish(rarity) {
		const { _chronicled } = this;
		const { bannerName, characters, weapons, region } = _chronicled;
		const chronicledBanner = chronicledWish.init({
			version: this._version,
			phase: this._phase,
			stdver: this._standardVer,
			characters,
			weapons,
			region
		});
		const result = chronicledBanner.get(rarity);
		result.bannerName = bannerName;
		return result;
	},

	_beginnerWish(rarity) {
		const result = beginerWish(rarity);
		result.bannerName = 'beginner';
		return result;
	},

	_standardWish(rarity) {
		const { _standardVer: stdver, _phase: phase, _version: version } = this;
		const standardBanner = standardWish.init({ stdver, phase, version });
		const result = standardBanner.get(rarity);
		result.bannerName = `wanderlust-invocation-${stdver}`;
		return result;
	},

	/**
	 * 自定义卡池页签（type: 'custom'）的出物通道。
	 * 数据从「当前页签」读（bannerList 里 type=custom 的那条），不从实例的
	 * _customData 读——实例现在按官方版本初始化，_customData 是空的。
	 * 五星走自定义角色（itemdrop-base 的 customData 分支），三四星走通用池，
	 * 与旧版「整实例 custom 模式」的出物语义一致。
	 */
	_customWish(rarity) {
		const list = get(bannerList);
		const entry = list[get(activeBanner)];
		const customData = entry && entry.type === 'custom' ? entry : {};
		const bannerName = customData.bannerName || '';

		if (rarity === 5) {
			// get5StarItem 的自定义分支条件是 useRateup && banner 匹配 character，
			// 两个参数缺一不可，否则落到通用五星池（出官方角色而非自定义角色）
			const result = get5StarItem({
				banner: 'character-event',
				useRateup: true,
				customData
			});
			result.bannerName = bannerName;
			return result;
		}

		const wish = characterWish.init({
			version: this._version,
			phase: this._phase,
			stdver: this._standardVer,
			customData: {},
			indexOfBanner: 0,
			featured: [{ bannerName: '', character: '' }],
			rateup: []
		});
		const result = wish.get(rarity);
		result.bannerName = bannerName;
		return result;
	},

	getItem(rarity, banner, indexOfBanner) {
		const date = new Date();
		const time = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
		const resultObj = { time, banner };

		if (banner === 'beginner') return { ...resultObj, ...this._beginnerWish(rarity) };
		if (banner === 'standard') return { ...resultObj, ...this._standardWish(rarity) };
		if (banner === 'weapon-event') return { ...resultObj, ...this._weaponWish(rarity) };
		if (banner === 'chronicled') return { ...resultObj, ...this._chronicledWish(rarity) };
		if (banner === 'custom') return { ...resultObj, ...this._customWish(rarity) };
		if (banner === 'character-event') {
			return { ...resultObj, ...this._characterWish(rarity, indexOfBanner) };
		}

		return { type: null, rarity: 0, name: null };
	}
};

export { roll };
export default WISH;
