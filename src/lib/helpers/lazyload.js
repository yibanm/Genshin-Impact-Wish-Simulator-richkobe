const options = {
	root: null,
	rootMargin: '0px',
	threshold: 0
};

/**
 * 懒加载图片 action。
 *
 * 修复（2026-11-04，安卓「抽卡一瞬间闪废图」根因）：原实现没有 update 钩子，
 * 且 src 为空时直接 return——若组件渲染时素材还没就绪（安卓 WebView 解码与
 * IndexedDB 读取比桌面慢），action 不挂 observer，素材后到也永远不填 src，
 * 图上就是空白/破图一闪。现在：src 为空也返回带 update 的对象，素材到达时补挂载。
 */
const mount = (image, src) => {
	const placeholder = image.getAttribute('data-placeholder');
	const imageSrc = src || placeholder;
	if (!imageSrc) return null;

	const loaded = () => {
		image.style.opacity = '1';
	};
	const observer = new IntersectionObserver((entries) => {
		if (entries[0].isIntersecting) {
			// image Loaded
			image.src = imageSrc;
			if (image.complete) {
				image.style.transition = 'unset';
				loaded();
			} else image.addEventListener('load', loaded);
		}
	}, options);

	observer.observe(image);
	return { observer, loaded };
};

export const lazyLoad = (image, src) => {
	image.style.opacity = '0';
	let mounted = mount(image, src);
	let mountedSrc = mounted ? src : null;

	return {
		update(newSrc) {
			// src 没变（含「仍为空」）就不动；素材后到或换图才重新挂载
			if (newSrc === mountedSrc) return;
			if (mounted) {
				mounted.observer.disconnect();
				image.removeEventListener('load', mounted.loaded);
			}
			mounted = mount(image, newSrc);
			mountedSrc = mounted ? newSrc : null;
		},
		destroy() {
			if (mounted) {
				mounted.observer.disconnect();
				image.removeEventListener('load', mounted.loaded);
			}
		}
	};
};
