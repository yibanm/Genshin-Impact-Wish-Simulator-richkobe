// 中文修改版：原实现直接用 btoa/atob，只能处理 Latin1 字符。
// 点名结果的 name 是中文，btoa 会抛 InvalidCharacterError 并让整个结果组件崩溃。
// 改为 UTF-8 安全编码：先 encodeURIComponent 再 btoa。
// 旧链接内容是纯 ASCII，encodeURIComponent 对其无影响，因此向后兼容。
const utf8ToBase64 = (str) => window.btoa(encodeURIComponent(str));
const base64ToUtf8 = (encoded) => decodeURIComponent(window.atob(encoded));

const encodeAndMakeLink = (string, path = 'wishitem') => {
	const encoded = utf8ToBase64(string);
	const link = `${window.location.origin}/screen/${path}?a=${encoded}`;
	return link;
};

export const decodeAndReadData = {
	_read(decoded) {
		// prettier-ignore
		let [name, rarity, vision, stelaFortuna, bonusQty, bonusType, useOutfit, type, isNew] = decoded.split('/');

		rarity = parseInt(rarity);
		stelaFortuna = !!parseInt(stelaFortuna);
		bonusQty = parseInt(bonusQty);
		isNew = !!parseInt(isNew);
		useOutfit = !!parseInt(useOutfit);
		return { name, rarity, vision, stelaFortuna, bonusQty, bonusType, useOutfit, type, isNew };
	},

	single(encoded) {
		const decoded = base64ToUtf8(encoded);
		return this._read(decoded);
	},

	multi(encoded) {
		const decoded = base64ToUtf8(encoded);
		const arrData = decoded.split('|');
		const readData = arrData.map(this._read);
		return readData;
	}
};

const encodeData = {
	_createStringData(data) {
		// prettier-ignore
		const { bonusQty, bonusType, vision, rarity, name, stelaFortuna, type, isNew, useOutfit } = data;
		const string = `${name}/${rarity}/${vision}/${+!!stelaFortuna}/${bonusQty}/${bonusType}/${+!!useOutfit}/${type}/${+!!isNew}`;
		return string;
	},

	single(data) {
		const stringData = this._createStringData(data[0]);
		return encodeAndMakeLink(stringData);
	},

	multi(data) {
		const arrayDataStr = data.map(this._createStringData);
		const stringData = arrayDataStr.join('|');
		return encodeAndMakeLink(stringData, 'wishlist');
	}
};

export const createLink = (data = []) => {
	if (data.length > 1) return encodeData.multi(data);
	return encodeData.single(data);
};

