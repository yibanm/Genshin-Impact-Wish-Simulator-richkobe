import { writable } from 'svelte/store';
import { AssetManager } from './api-indexeddb';

/**
 * 点名名单管理（本项目新增功能，上游没有）
 *
 * 存储分层：
 * - 名单配置与勾选状态：localStorage（同步读写，UI 响应快）
 * - 自定义导入的图标：IndexedDB 的 assets store（复用 AssetManager，blob 不适合塞进 localStorage）
 * - 洗牌池进度：localStorage，保证刷新页面后不会重复点到同一个人
 *
 * 名单形态（F3，2026-11-04）：只有用户自建名单（导入 TXT / 批量添加 / 单条添加）。
 * 预置角色/武器名单已按用户要求全部删除——点名场景的真实需求是「点自己的人」，
 * 游戏角色名单与抽卡功能重复且占用界面。
 */

const STORAGE_KEY = 'rollcall';
const ICON_KEY_PREFIX = 'rollcall-icon-';

// 单个自定义名单的数据形状
// { id, label, builtin:false, items:[{ uid, name, iconKey|null, rarity|null }], createdAt }

/** localStorage 里的完整状态 */
const defaults = () => ({
	// 用户自建的名单列表
	customLists: [],
	// 当前勾选启用的名单 id 集合。新建名单默认自动勾选（见 createList），
	// 初始无名单时为空集
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
	// 数据明文镜像层监听此事件做防抖 dump（api-filestore）
	document.dispatchEvent(new Event('rollcallUpdate'));
};

/**
 * 返回给 UI 的快照：用户自建名单 + 勾选状态
 */
const snapshot = () => {
	const s = getState();
	const custom = s.customLists.map(({ id, label, items, createdAt }) => ({
		id,
		label,
		builtin: false,
		count: items.length,
		createdAt
	}));
	return {
		lists: custom,
		selected: [...s.selected],
		poolRemaining: Object.fromEntries(
			Object.entries(s.pool).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])
		)
	};
};

/** 初始化并推送首次快照（在应用启动时调用一次） */
export const initRollcall = () => {
	state = readState();
	// 清理指向已不存在名单的勾选与池数据（例如用户删了某个名单）
	const validIds = new Set(state.customLists.map((l) => l.id));
	const before = state.selected.length;
	state.selected = state.selected.filter((id) => validIds.has(id));
	Object.keys(state.pool).forEach((id) => {
		if (!validIds.has(id)) delete state.pool[id];
	});
	if (state.selected.length !== before) writeState(state);
	rollcallStore.set(snapshot());
	return snapshot();
};

/** 取某份名单的全部条目 */
export const getListItems = (listId) => {
	const s = getState();
	const custom = s.customLists.find((l) => l.id === listId);
	return custom ? custom.items : [];
};

/** 勾选/取消勾选名单（可单选可多选，返回是否变更成功） */
export const toggleSelect = (listId) => {
	const s = getState();
	const exists = s.customLists.some((l) => l.id === listId);
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
	// 新建即勾选：用户建名单就是为了马上用，还要手动勾一次是多余步骤
	if (!s.selected.includes(id)) s.selected.push(id);
	commit();
	return id;
};

/** 重命名名单 */
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

/**
 * 批量添加条目。
 * @param {string} listId 名单 id
 * @param {Array<string|{name:string,rarity:number|null}>} names
 *        字符串或带星级的对象（F5：TXT 的「张三 5」解析后传 {name:'张三', rarity:5}）
 * @returns {number} 实际添加条数
 */
export const addMembers = (listId, names) => {
	const s = getState();
	const list = s.customLists.find((l) => l.id === listId);
	if (!list) return 0;
	// 去空白、去空行；同名允许重复（点名场景可能真有两个同名的人）
	const cleaned = names
		.map((n) => (typeof n === 'string' ? { name: n, rarity: null } : n))
		.map((n) => ({ name: String(n.name ?? '').trim(), rarity: n.rarity ?? null }))
		.filter((n) => n.name.length > 0);
	if (!cleaned.length) return 0;
	cleaned.forEach(({ name, rarity }, i) => {
		list.items.push({
			uid: `${listId}#${Date.now()}-${i}`,
			name,
			chineseChar: name,
			iconKey: null,
			// F5：星级可自定义；null 表示未指定，点名时按最普通的三星展示（用户 2026-11-05 裁定）
			rarity: Number.isInteger(rarity) && rarity >= 3 && rarity <= 5 ? rarity : null
		});
	});
	// 名单内容变了，旧池进度作废
	delete s.pool[listId];
	commit();
	return cleaned.length;
};

/**
 * 修改单个条目的星级（F5）。
 * @param {number|null} rarity 3/4/5 或 null（null = 不指定，点名时随机）
 */
export const setMemberRarity = (listId, uid, rarity) => {
	const s = getState();
	const list = s.customLists.find((l) => l.id === listId);
	if (!list) return false;
	const item = list.items.find((it) => it.uid === uid);
	if (!item) return false;
	item.rarity = rarity === null ? null : Number(rarity);
	commit();
	return true;
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
		const listLabel = s.customLists.find((l) => l.id === listId)?.label || listId;
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
