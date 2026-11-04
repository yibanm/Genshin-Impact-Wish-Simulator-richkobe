/**
 * 名单 TXT 导入（本项目新增）
 *
 * 规则：一人一行，自动去空白行与首尾空格。
 *
 * 两条通道共用同一套解析逻辑：
 * - Web：`<input type="file">` 拿到 File 对象，用 readNamesFile() 读取；
 * - Electron 壳：主进程弹系统对话框并把文本读回来（见 electron/main.cjs 的
 *   `pick-names-file`），渲染进程只需 parseNames() 解析。
 *
 * 编码兜底：中文名单常见 GBK/GB2312（Windows 记事本默认 ANSI）。
 * 一律先按 UTF-8 解码，若出现替换字符 U+FFFD 说明不是 UTF-8，回退 GBK。
 * 去掉 UTF-8 BOM（U+FEFF），否则第一行姓名会带上不可见字符。
 */

/** 名单文本的行数上限，防止误选超大文件把 localStorage 撑爆（配额约 5MB） */
export const MAX_LINES_PER_FILE = 2000;

// 替换字符 U+FFFD：解码失败时 TextDecoder 留下的占位符。
// 必须用转义字面量写，直接粘字符会在部分编辑器/传输环节丢失（曾实测变成空串，
// 而 String.includes('') 恒为 true，会让 GBK 兜底无条件触发）。
const REPLACEMENT_CHAR = '\uFFFD';

/**
 * 把文本按「一人一行」解析成姓名数组。
 * @param {string} text 文件全文
 * @returns {string[]} 清洗后的姓名列表（已去空行与首尾空格，保留同名重复）
 */
export const parseNames = (text) => {
	if (!text || typeof text !== 'string') return [];
	// 兼容 \r\n（Windows）、\n（Unix）、\r（老 Mac）三种换行
	return text
		.split(/\r\n|\r|\n/)
		.map((line) => line.trim())
		// 空行不算姓名；同名重复是允许的（点名场景可能真有两个同名的人）
		.filter((line) => line.length > 0)
		.slice(0, MAX_LINES_PER_FILE);
};

/**
 * F5：行尾「空格 + 数字 3/4/5」解析为自定义星级，例如「张三 5」= 五星角色张三。
 * 数字不在 3-5 范围（或没有数字）时 rarity 为 null，点名时按随机规则分配星级。
 * 名字本身以数字结尾的（如「王老 2」想当名字）会被误判——这是格式约定的代价，
 * 已在导入说明里写明规则。
 * @param {string} line 单行文本（已 trim）
 * @returns {{name: string, rarity: number|null}}
 */
export const splitRarity = (line) => {
	const m = line.match(/^(.*?)\s+([345])$/);
	if (!m) return { name: line, rarity: null };
	const name = m[1].trim();
	// 整行就是数字（如「5」）时不当星级处理，否则名字会变空串
	if (!name) return { name: line, rarity: null };
	return { name, rarity: Number(m[2]) };
};

/**
 * 解析成带星级的条目数组（F5/F6 批量添加共用）。
 * @param {string} text 文件全文或批量粘贴文本
 * @returns {Array<{name: string, rarity: number|null}>}
 */
export const parseMembers = (text) => parseNames(text).map(splitRarity);

/**
 * 把字节流解码成文本：UTF-8 优先，检出替换字符则回退 GBK。
 * @param {ArrayBuffer|Uint8Array} buf 文件字节
 * @returns {string} 解码后的文本（解码器不可用时保持 UTF-8 结果）
 */
export const decodeBuffer = (buf) => {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	let text = new TextDecoder('utf-8').decode(bytes);
	if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
	// 出现替换字符说明原文不是 UTF-8，试 GBK（中文 Windows 记事本默认的 ANSI 编码）
	if (text.includes(REPLACEMENT_CHAR)) {
		try {
			let gbk = new TextDecoder('gbk').decode(bytes);
			if (gbk.charCodeAt(0) === 0xfeff) gbk = gbk.slice(1);
			// GBK 解出来仍有替换字符说明两种编码都不对，保留 UTF-8 结果让用户自己看
			if (!gbk.includes(REPLACEMENT_CHAR)) return gbk;
		} catch (e) {
			// 运行环境不带 gbk 解码器时静默降级
		}
	}
	return text;
};

/**
 * Web 通道：从 `<input type="file">` 选中的 File 读出姓名。
 * @param {File} file 用户选中的文件
 * @returns {Promise<{names: string[], members: Array<{name, rarity}>, fileName: string}>}
 */
export const readNamesFile = async (file) => {
	if (!file) return { names: [], members: [], fileName: '' };
	const buf = await file.arrayBuffer();
	const members = parseMembers(decodeBuffer(buf));
	return { names: members.map((m) => m.name), members, fileName: file.name };
};

/** 当前是否运行在带名单导入桥的 Electron 壳内 */
export const hasNativePicker = () =>
	typeof window !== 'undefined' && typeof window.rollcallBridge?.pickNamesFile === 'function';

/**
 * Electron 通道：让主进程弹系统文件对话框并读回内容。
 * @returns {Promise<{canceled: boolean, names: string[], fileName: string, error?: string}>}
 */
export const pickNamesViaBridge = async () => {
	if (!hasNativePicker()) return { canceled: true, names: [], members: [], fileName: '' };
	const res = await window.rollcallBridge.pickNamesFile();
	if (!res || res.canceled) return { canceled: true, names: [], members: [], fileName: '' };
	if (res.error) return { canceled: false, names: [], members: [], fileName: '', error: res.error };
	const members = parseMembers(res.text || '');
	return {
		canceled: false,
		// 主进程已做 UTF-8/GBK 兜底，这里只按行解析
		names: members.map((m) => m.name),
		members,
		fileName: res.fileName || ''
	};
};
