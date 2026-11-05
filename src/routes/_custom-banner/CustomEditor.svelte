<script>
	import { setContext } from 'svelte';
	import { fade } from 'svelte/transition';
	import { t } from 'svelte-i18n';
	import { pushToast } from '$lib/helpers/toast';
	import { activeVersion, assets, bannerList, editID } from '$lib/store/app-stores';
	import { BannerManager } from '$lib/helpers/dataAPI/api-indexeddb';

	import Icon from '$lib/components/Icon.svelte';
	import FrameCustom from '../_wish/banner-card/_frame-custom.svelte';
	import InfoButton from './BannerEditor/_info-face-button.svelte';
	import SplashartForm from './BannerEditor/_splashart-form.svelte';
	import MainArt from './BannerEditor/BannerArt.svelte';
	import VisionPicker from './BannerEditor/_vision-picker.svelte';
	import DetailsEditor from './BannerEditor/_details-editor.svelte';
	import SplashArtEditor from './SplashArtEditor/SplashArt.svelte';

	let clientHeight;
	let clientWidth;
	let onBannerEdit = false;
	let isInfoEdit = false;
	let isSplashArtEdit = false;
	let isLoaded = false;
	let isEdited = false;

	// Banner Info
	let bannerID = $editID;
	let dataToEdit = {};
	let bannerName = '';
	let character = '';
	let charTitle = '';
	let vision = '';
	let watermark = '';
	let rateup = [];

	let imgChanged = { artURL: false, faceURL: false, thumbnail: false };
	let artPosition = { banner: {}, splashArt: {}, wishCard: {} };
	let images = {};

	const idb = BannerManager;
	const readIDB = async (id) => {
		if (isLoaded) return;
		isLoaded = true;
		dataToEdit = await idb.get(id);
		({
			bannerName = '',
			character = '',
			charTitle = '',
			watermark = '',
			vision = 'pyro',
			rateup = [],
			artPosition = {},
			images = {},
			imgChanged = {}
		} = dataToEdit);
	};

	// prettier-ignore
	$: bannerData = { bannerName, character, charTitle, watermark, vision, rateup, artPosition, images, imgChanged };

	const autoSave = async (data) => {
		if (!isLoaded) return;
		if (!isEdited) return (isEdited = true);
		const editedData = { ...dataToEdit, isChanged: true, itemID: $editID, ...data };
		delete editedData.lastModified; //renew LastModified
		await idb.put(editedData);

		// Update Store if banner is active
		// C1 重构后自定义池是列表里的一个页签（type: 'custom'），不再固定在 index 0
		const index = $bannerList.findIndex((b) => b.type === 'custom');
		if (index < 0) return;
		$bannerList[index] = { ...editedData, type: 'custom' };
		return;
	};
	$: autoSave(bannerData);

	// Splash Art
	const editSplashArt = (val) => (isSplashArtEdit = val);
	setContext('editSplashArt', editSplashArt);

	// Banner
	const setPosition = (type, pos) => (artPosition[type] = pos);
	setContext('setPosition', setPosition);

	const editBanner = (val) => (onBannerEdit = val);
	setContext('editBanner', editBanner);

	const editInfo = (val) => (isInfoEdit = val);
	setContext('editInfo', editInfo);

	const setVision = (vi) => (vision = vi);
	setContext('setVision', setVision);

	const setRateup = (chars) => (rateup = chars);
	setContext('setRateup', setRateup);

	const setCharName = (name) => (character = name);
	setContext('setCharName', setCharName);

	const setCharTitle = (title) => (charTitle = title);
	setContext('setCharTitle', setCharTitle);

	const setBannerName = (name) => (bannerName = name);
	setContext('setBannerName', setBannerName);

	const setWatermark = (text) => (watermark = text);
	setContext('setWatermark', setWatermark);

	// 上传图先降采样再进编辑器（2026-11-05 用户报「调整时特别卡」）：
	// 手机/相机原图常 4000px+，直接喂给 zoomist 每帧拖拽都要解码合成巨图，卡到不可用；
	// 限最长边 2048 并重编码 webp，显示无感知差异，拖拽与 IDB 存储都轻一个量级。
	const MAX_SIDE = 2048;
	const downscaleToDataURL = (file) =>
		new Promise((resolve, reject) => {
			const url = URL.createObjectURL(file);
			const img = new Image();
			img.onload = () => {
				try {
					const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
					// 小图不重编码，直接读原文件 dataURL，避免无谓的画质损失
					if (scale === 1 && file.type === 'image/webp') {
						const r = new FileReader();
						r.onload = () => {
							URL.revokeObjectURL(url);
							resolve(r.result);
						};
						r.onerror = () => {
							URL.revokeObjectURL(url);
							reject(r.error);
						};
						r.readAsDataURL(file);
						return;
					}
					const canvas = document.createElement('canvas');
					canvas.width = Math.round(img.width * scale);
					canvas.height = Math.round(img.height * scale);
					canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
					URL.revokeObjectURL(url);
					resolve(canvas.toDataURL('image/webp', 0.9));
				} catch (e) {
					URL.revokeObjectURL(url);
					reject(e);
				}
			};
			img.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error('图片解码失败'));
			};
			img.src = url;
		});

	const changeArt = (file) => {
		if (!file) return;
		downscaleToDataURL(file)
			.then((dataURL) => {
				images.artURL = dataURL;
				imgChanged.artURL = true;
				onBannerEdit = true;
			})
			.catch((e) => {
				console.error('立绘处理失败：', e);
				pushToast({ message: $t('rollcall.notAnImage'), type: 'error' });
			});
	};
	setContext('changeArt', changeArt);

	const changeFace = (file) => {
		if (!file) return;
		downscaleToDataURL(file)
			.then((dataURL) => {
				images.faceURL = dataURL;
				imgChanged.faceURL = true;
			})
			.catch((e) => console.error('头像处理失败：', e));
	};
	setContext('changeFace', changeFace);

	const changeThumbnail = (file) => {
		if (!file) return;
		downscaleToDataURL(file)
			.then((dataURL) => {
				images.thumbnail = dataURL;
				imgChanged.thumbnail = true;
			})
			.catch((e) => console.error('缩略图处理失败：', e));
	};
	setContext('changeThumbnail', changeThumbnail);
</script>

{#await readIDB(bannerID)}
	<div class="loading" out:fade>
		<div class="loader">
			<Icon type="loader" width="40px" />
		</div>
	</div>
{/await}

<div
	class="card"
	id="cardEditor"
	class:isLoaded
	bind:clientWidth
	bind:clientHeight
	style="--content-width:{clientWidth}px; --content-height:{clientHeight}px"
>
	<img
		src={$assets[`blank/character-${vision}`]}
		alt="Background Banner"
		crossorigin="anonymous"
		class="art-bg"
	/>

	<VisionPicker selected={vision} />
	{#key artPosition && rateup}
		<MainArt {onBannerEdit} {rateup} artURL={images?.artURL} bannerPosition={artPosition?.banner} />
	{/key}
	<SplashartForm {onBannerEdit} />
	<FrameCustom
		editorMode
		{onBannerEdit}
		{vision}
		{bannerName}
		{character}
		{charTitle}
		{watermark}
	/>
	<InfoButton faceURL={images?.faceURL} {onBannerEdit} />
</div>

{#if isInfoEdit}
	<DetailsEditor
		preview={images?.thumbnail}
		{rateup}
		{bannerName}
		{character}
		{charTitle}
		{watermark}
	/>
{/if}

{#if isSplashArtEdit}
	<SplashArtEditor
		on:close={() => editSplashArt(false)}
		artURL={images?.artURL}
		position={artPosition}
		{character}
		{vision}
	/>
{/if}

<style>
	.card {
		/* background-image: linear-gradient(to top, #eee8e3 50%, #f7f5f4); */
		position: relative;
	}

	.card {
		width: 100%;
		height: fit-content;
		aspect-ratio: 1080/533;
	}
	.card :global(h1 .block) {
		display: block;
	}

	img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: fill;
		object-position: center;
	}

	.loading {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 100%;
		height: 100%;
		transform: translate(-50%, -50%);
		z-index: +20;
		display: flex;
		justify-content: center;
		align-items: center;
		backdrop-filter: blur(8px);
		background-color: rgba(0, 0, 0, 0.2);
	}

	.loader {
		--text-color: rgba(248, 184, 22, 0.7);
		aspect-ratio: 1/1;
		display: flex;
		justify-content: center;
		align-items: center;
	}
</style>
