import { writable } from 'svelte/store';
import { initialAmount, version, wishPhase } from '$lib/data/wish-setup.json';

const { fates, genesis: igen, primogem: ipri } = initialAmount;

export const preloadVersion = writable({ patch: version, phase: wishPhase });
export const activeVersion = writable({ patch: version, phase: wishPhase });
export const bannerList = writable([]);
export const activeBanner = writable(0);

// Beginner
export const showBeginner = writable(true);
export const beginnerRemaining = writable(20);

// Epitomized Path
export const isFatepointSystem = writable(false); // Weapon
export const course = writable({ selected: null, point: 0 });
export const chronicledCourse = writable({ selected: null, type: null, point: 0 });

// Game Currencies
export const genesis = writable(igen);
export const primogem = writable(ipri);
export const acquaint = writable(fates);
export const intertwined = writable(fates);
export const stardust = writable(0);
export const starglitter = writable(0);
export const pricelist = writable({});

// Settings
export const autoskip = writable(false);
export const wishAmount = writable('default');
export const multipull = writable(10);

// other
// 中文修改版：停用上游的付费解锁机制（proUser 原为 false 需激活码解锁，限制自定义卡池 3 个）
// 本项目已删除赞赏与激活码入口，直接默认全解锁，且不显示广告
export const proUser = writable(true);
export const showAd = writable(false);
export const mobileMode = writable(false);
export const isMobile = writable(false);
export const isPWA = writable(false);
export const viewportHeight = writable(0);
export const viewportWidth = writable(0);

export const notice = writable([]);
export const assets = writable([]);
export const toastMsg = writable([]);

export const editorMode = writable(false);
export const editID = writable(0);
export const customData = writable({});
export const isCustomBanner = writable(false);

// 中文修改版：打开菜单时指定要直达的子页（如从点名卡池卡面直达名单管理）。
// 空字符串表示用菜单自己的默认页。
export const menuTarget = writable('');
// 中文修改版：名单管理浮层小窗开关。
// 点名卡池卡面的「名单管理」按钮不再跳转整页菜单，而是弹出浮层——
// 小屏/横屏窄窗口下整页菜单会把抽卡界面完全顶走，浮层可边看卡池边勾选。
export const rollcallPanel = writable(false);
