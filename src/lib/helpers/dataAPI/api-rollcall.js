import { writable } from 'svelte/store';
import { AssetManager } from './api-indexeddb';
import { builtinLists, builtinListById } from '../rollcall/presets';

/**
 * 点名名单管理（中文魔改版新增功能，上游没有）
 *
 * 存储分层：
 * - 名单配置与勾选状态：localStorage（同步读写，UI 响应快）
 * - 自定义导入的图标：IndexedDB 的 assets store（复用 AssetManager，blob 不适合塞进 localStorage）
 * - 洗牌池进度：localStorage，保证刷新页面后不会重复点到同一个人
 *
 * 名单形态：预置名单（builtin，从游戏数据自动生成，带图标）+ 自定义名单（默认纯文字，可导入图标）。
 * 抽卡时可勾选启用多套，支持单选/多选/混用；也可全部不勾预置、只用自定义。
 */

const STORAGE_KEY = 'rollcall';
const ICON_KEY_PREFIX = 'rollcall-icon-';

// 单个自定义名单的数据形状
// { id, label, builtin:false, items:[{ uid, name, iconKey|null, rarity|null }], createdAt }

/** localStorage 里的完整状态 */
const defaults = () => ({
	// 用户自建的名单列表
	customLists: [],
	// 当前勾选启用的名单 id 集合（预置 id 见 presets.js，自定义 id 形如 custom-<时间戳>）
	// 默认不勾选任何名单：预置名单只有游戏角色/武器，真实人物名单须由用户自己导入 TXT，
	// 首次使用时在名单管理页勾选或导入即可。
	selected: [],
	// 洗牌池：{ [listId]: [尚未被点到的条目 uid/name...] }，用于保证一轮内不重复
	pool: {},
	// 自增序号，避免 id 撞车
	seq: 1
});

const readState = () => {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return defaults();
		const parsed = JSON.parse(raw);
		// 兼容旧数据缺字段，避免 undefined 崩溃
		return { ...defaults(), ...parsed };
	} catch (e) {
		console.error('点名名单数据解析失败，已重置为默认：', e);
		return defaults();
	}
};

const writeState = (state) => {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (e) {
		// localStorage 满（配额约 5MB）时不能静默失败，否则用户以为保存成功了
		console.error('点名名单写入失败（可能超出浏览器存储配额）：', e);
		throw e;
	}
};

let state = null;

// 对外暴露的 store，供 UI 订阅
export const rollcallStore = writable(null);

const getState = () => {
	if (state === null) state = readState();
	return state;
};

const commit = () => {
	writeState(state);
	// 每次变更都推送完整快照，UI 只需订阅这一个 store
	rollcallStore.set(snapshot());
};

/**
 * 返回给 UI 的快照：预置名单（运行时生成，不落库）+ 自定义名单 + 勾选状态
 * 预置名单每次实时生成，因此游戏数据更新后名单自动同步，无需用户操作
 */
const snapshot = () => {
	const s = getState();
	const preset = builtinLists.map(({ id, label, items }) => ({
		id,
		label,
		builtin: true,
		count: items.length
	}));
	const custom = s.customLists.map(({ id, label, items, createdAt }) => ({
		id,
		label,
		builtin: false,
		count: items.length,
		createdAt
	}));
	return {
		lists: [...preset, ...custom],
		selected: [...s.selected],
		poolRemaining: Object.fromEntries(
			Object.entries(s.pool).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])
		)
	};
};

/** 初始化并推送首次快照（在应用启动时调用一次） */
export const initRollcall = () => {
	state = readState();
	// 清理指向已不存在名单的勾选与池数据（例如用户删了某个自定义名单）
	const validIds = new Set([
		...builtinLists.map((l) => l.id),
		...state.customLists.map((l) => l.id)
	]);
	const before = state.selected.length;
	state.selected = state.selected.filter((id) => validIds.has(id));
	Object.keys(state.pool).forEach((id) => {
		if (!validIds.has(id)) delete state.pool[id];
	});
	if (state.selected.length !== before) writeState(state);
	rollcallStore.set(snapshot());
	return snapshot();
};

/** 取某份名单的全部条目（预置实时生成，自定义从存储读） */
export const getListItems = (listId) => {
	const preset = builtinListById(listId);
	if (preset) return preset.items.map((it, i) => ({ ...it, uid: `${listId}#${i}` }));
	const s = getState();
	const custom = s.customLists.find((l) => l.id === listId);
	return custom ? custom.items : [];
};

/** 勾选/取消勾选名单（可单选可多选，返回是否变更成功） */
export const toggleSelect = (listId) => {
	const s = getState();
	const exists = builtinListById(listId) || s.customLists.some((l) => l.id === listId);
	if (!exists) return false;
	const idx = s.selected.indexOf(listId);
	if (idx >= 0) s.selected.splice(idx, 1);
	else s.selected.push(listId);
	// 取消勾选时该名单的池进度无意义，清掉避免下次勾选时用了陈旧状态
	if (idx >= 0) delete s.pool[listId];
	commit();
	return true;
};

/** 清空已抽进度（全部名单重洗），点名重复了或要重新开始一轮时用 */
export const resetPool = () => {
	const s = getState();
	s.pool = {};
	commit();
};

/** 新建自定义名单 */
export const createList = (label) => {
	const s = getState();
	const id = `custom-${Date.now()}-${s.seq++}`;
	s.customLists.push({ id, label, builtin: false, items: [], createdAt: new Date().toISOString() });
	commit();
	return id;
};

/** 重命名名单（仅自定义名单可改名，预置名单名固定） */
export const renameList = (listId, label) => {
	const s = getState();
	const list = s.customLists.find((l) => l.id === listId);
	if (!list) return false;
	list.label = label;
	commit();
	return true;
};

/** 删除自定义名单（同时清理图标与池进度） */
export const deleteList = async (listId) => {
	const s = getState();
	const idx = s.customLists.findIndex((l) => l.id === listId);
	if (idx < 0) return false;
	const [removed] = s.customLists.splice(idx, 1);
	// 逐个删图标 blob，避免 IndexedDB 里留垃圾（删除失败不影响名单删除本身）
	for (const item of removed.items) {
		if (item.iconKey) {
			try {
				await AssetManager.delete(item.iconKey);
			} catch (e) {
				console.error('清理名单图标失败：', e);
			}
		}
	}
	s.selected = s.selected.filter((id) => id !== listId);
	delete s.pool[listId];
	commit();
	return true;
};

/** 批量添加条目（支持粘贴多行文本一次导入） */
export const addMembers = (listId, names) => {
	const s = getState();
	const list = s.customLists.find((l) => l.id === listId);
	if (!list) return 0;
	// 去空白、去空行；同名允许重复（点名场景可能真有两个同名的人）
	const cleaned = names
		.map((n) => String(n).trim())
		.filter((n) => n.length > 0);
	if (!cleaned.length) return 0;
	cleaned.forEach((name, i) => {
		list.items.push({
			uid: `${listId}#${Date.now()}-${i}`,
			name,
			chineseChar: name,
			iconKey: null,
			rarity: null
		});
	});
	// 名单内容变了，旧池进度作废
	delete s.pool[listId];
	commit();
	return cleaned.length;
};

/** 删除单个条目 */
export const removeMember = async (listId, uid) => {
	const s = getState();
	const list = s.customLists.find((l) => l.id === listId);
	if (!list) return false;
	const idx = list.items.findIndex((it) => it.uid === uid);
	if (idx < 0) return false;
	const [removed] = list.items.splice(idx, 1);
	if (removed.iconKey) {
		try {
			await AssetManager.delete(removed.iconKey);
		} catch (e) {
			console.error('清理名单图标失败：', e);
		}
	}
	delete s.pool[listId];
	commit();
	return true;
};

/** 重命名单个条目 */
export const renameMember = (listId, uid, name) => {
	const s = getState();
	const list = s.customLists.find((l) => l.id === listId);
	if (!list) return false;
	const item = list.items.find((it) => it.uid === uid);
	if (!item) return false;
	const cleaned = String(name).trim();
	if (!cleaned) return false;
	item.name = cleaned;
	item.chineseChar = cleaned;
	commit();
	return true;
};

/**
 * 为条目导入图标（用户自选图片）。
 * blob 存进 IndexedDB 的 assets store，名单里只记 iconKey，
 * 避免把 base64 塞进 localStorage 撑爆配额。
 * @returns {Promise<string>} 成功返回 iconKey，失败抛错
 */
export const setMemberIcon = async (listId, uid, blob) => {
	const s = getState();
	const list = s.customLists.find((l) => l.id === listId);
	if (!list) throw new Error('名单不存在');
	const item = list.items.find((it) => it.uid === uid);
	if (!item) throw new Error('条目不存在');
	if (!blob || !blob.size) throw new Error('图片为空');
	// 限制 2MB，防止用户塞进大图把 IndexedDB 撑满
	if (blob.size > 2 * 1024 * 1024) throw new Error('图片过大（上限 2MB）');

	const iconKey = `${ICON_KEY_PREFIX}${listId}-${uid}`;
	await AssetManager.put({ key: iconKey, blob, type: blob.type || 'image/png' });
	// 换图时旧 key 与新 key 同名，put 直接覆盖，无需先删
	item.iconKey = iconKey;
	commit();
	return iconKey;
};

/** 移除条目图标，回到纯文字显示 */
export const clearMemberIcon = async (listId, uid) => {
	const s = getState();
	const list = s.customLists.find((l) => l.id === listId);
	const item = list && list.items.find((it) => it.uid === uid);
	if (!item || !item.iconKey) return false;
	try {
		await AssetManager.delete(item.iconKey);
	} catch (e) {
		console.error('删除图标失败：', e);
	}
	item.iconKey = null;
	commit();
	return true;
};

/** 读取图标 blob（UI 用 URL.createObjectURL 转成可显示地址） */
export const getIconBlob = async (iconKey) => {
	if (!iconKey) return null;
	const record = await AssetManager.get(iconKey);
	return record?.blob || null;
};

/**
 * 取当前所有已勾选名单合并后的完整池子。
 * 多套名单混用时在这里合并成一个池，抽卡只认这一个池。
 * @returns {Array} 条目数组，含 fromList 标记来源
 */
export const getEnabledPool = () => {
	const s = getState();
	const merged = [];
	s.selected.forEach((listId) => {
		const listLabel =
			builtinListById(listId)?.label ||
			s.customLists.find((l) => l.id === listId)?.label ||
			listId;
		getListItems(listId).forEach((item) => {
			merged.push({ ...item, fromList: listId, fromLabel: listLabel });
		});
	});
	return merged;
};

/**
 * 池状态的唯一读写入口（点名进度的单一数据源）。
 *
 * 为什么不让抽卡逻辑自己读写 localStorage：本模块的 state 是内存缓存，
 * 改名/换图标等操作会调 commit() 整体回写。若抽卡逻辑另行直写同一份存储，
 * 下一次 commit() 就会用缓存里的陈旧 pool 覆盖掉刚推进的进度，
 * 表现为「同一个人被点到两次」。因此 pool 只经这两个函数进出。
 */

/**
 * 池的 key = 当前勾选名单组合的指纹。
 * 勾选变了 key 就变，旧进度自动作废，
 * 避免用户改了勾选后沿用旧池导致某些人这一轮永远点不到。
 */
const poolKeyOf = (full) =>
	full
		.map(({ fromList, uid }) => `${fromList}:${uid}`)
		.sort()
		.join('|');

/**
 * 读取当前池里尚未点到的人的索引。
 * @param {Array} full getEnabledPool() 的结果
 * @returns {Array<number>} 索引数组；尚未开始抽时返回空数组（由调用方负责重洗）
 */
export const readPoolRemaining = (full) => {
	const s = getState();
	const key = poolKeyOf(full);
	const remaining = s.pool[key];
	return Array.isArray(remaining) ? remaining : [];
};

/**
 * 回写池进度，并只保留当前组合的池（清理陈旧组合，防止 localStorage 无限增长）。
 * @param {Array} full getEnabledPool() 的结果
 * @param {Array<number>} remaining 剩余索引
 */
export const writePoolRemaining = (full, remaining) => {
	const s = getState();
	const key = poolKeyOf(full);
	s.pool = { [key]: remaining };
	// 不推送 snapshot：抽卡过程中连续推送会让名单管理页无谓重渲染。
	// 抽卡结束后调用方自行调 refreshRollcall() 刷新一次即可。
	writeState(s);
};

/** 主动推送一次快照（抽卡结束后刷新池进度显示） */
export const refreshRollcall = () => {
	rollcallStore.set(snapshot());
};

/**
 * 池进度统计，供卡面与名单管理页显示「本轮已点 x / 共 y 人」。
 * 尚未开始抽时，remaining 视为满额。
 */
export const getPoolStats = () => {
	const full = getEnabledPool();
	if (!full.length) return { total: 0, remaining: 0, drawn: 0 };
	const remaining = readPoolRemaining(full);
	// 空数组有两种可能：还没开始抽、或这一轮刚好点完。
	// 两者对用户的含义都是「下一抽会重洗」，因此都按满额显示。
	const rest = remaining.length ? remaining.length : full.length;
	return { total: full.length, remaining: rest, drawn: full.length - rest };
};

// 导出常量供 UI 使用（例如上传图标时校验大小）
export const ICON_MAX_BYTES = 2 * 1024 * 1024;
