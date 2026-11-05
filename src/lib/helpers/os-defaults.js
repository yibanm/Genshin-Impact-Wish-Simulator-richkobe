import { browser } from '$app/environment';
import OverlayScrollbars from 'overlayscrollbars';

// 灰条只在滑动时冒出来（用户 2026-11-05）：OverlayScrollbars v1 全局默认配置。
// 必须在模块求值期执行——各组件在 onMount 里创建实例，而 Svelte 的 onMount 是
// 子先父后，放 layout 的 onMount 就太迟；副作用导入保证早于一切实例化。
// ⚠️ 必须 browser 守卫：defaultOptions() 内部初始化 FakejQuery 要 document.querySelectorAll，
// SSR/prerender 无 document 会直接 TypeError 让整站构建 500（与首屏 $t 同款陷阱）。
if (browser) {
	OverlayScrollbars.defaultOptions({
		scrollbars: { autoHide: 'scroll', autoHideDelay: 400 }
	});
}
