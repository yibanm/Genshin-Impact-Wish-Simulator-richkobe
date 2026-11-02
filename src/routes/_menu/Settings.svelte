<script>
	import { browser } from '$app/environment';
	import { getContext, onMount, setContext } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { locale, t } from 'svelte-i18n';
	import OverlayScrollbars from 'overlayscrollbars';

	import { autoskip, isCustomBanner, multipull, wishAmount } from '$lib/store/app-stores';
	import { localConfig } from '$lib/helpers/dataAPI/api-localstore';
	import { calculateByteSize } from '$lib/helpers/dataAPI/api-filesystem';
	import { pauseSfx, playSfx } from '$lib/helpers/audio/audio';
	import { check as meteorCheck } from '$lib/helpers/meteor-loader';
	import { factoryReset } from '$lib/helpers/dataAPI/storage-reset';
	import { pushToast } from '$lib/helpers/toast';

	import Modal from '$lib/components/ModalTpl.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import CheckBox from '$lib/components/CheckBox.svelte';
	import OptionMenu from './_options.svelte';

	let optionToShow = '';
	const handleOption = (selected) => (optionToShow = selected);
	setContext('handleOption', handleOption);
	let isMuted = localConfig.get('muted');

	// Handle Muted
	const handleMuted = ({ detail }) => {
		const { selected } = detail;
		isMuted = selected === 'yes';
		if (isMuted) pauseSfx('wishBacksound'); //stop sfx Before set config
		localConfig.set('muted', isMuted);
		if (!isMuted) playSfx('wishBacksound'); // Play SFX after set config
	};

	// AutoSkip
	const readyToPull = getContext('readyToPull');
	const handleAutoSkip = async ({ detail }) => {
		const { selected } = detail;
		const isAutoSkip = selected === 'yes';
		autoskip.set(isAutoSkip);
		localConfig.set('autoskip', isAutoSkip);
		if (isAutoSkip) return readyToPull.set(true);
		const cekExpress = await meteorCheck();
		readyToPull.set(cekExpress);
	};

	// Animated BG
	const handleAnimatedBG = getContext('animateBG');
	let animatedbg = browser ? !!localConfig.get('animatedBG') : false;
	const showAnimatedBG = (e) => {
		const { selected } = e.detail;
		localConfig.set('animatedBG', selected === 'yes');
		animatedbg = selected === 'yes';
		handleAnimatedBG();
	};

	// WishAmount
	let selectedAmount = localConfig.get('wishAmount') || 'default';
	const handleSelectAmount = ({ detail }) => {
		selectedAmount = detail;
		localConfig.set('wishAmount', detail);
		wishAmount.set(detail);
	};

	// Multipull Amount
	const setMultiPull = (value) => {
		localConfig.set('multipull', value);
		multipull.set(value || 1);
	};
	setContext('setMultiPull', setMultiPull);

	// Reset
	let showResetModal = false;
	let keepSetting = false;
	let clearCache = false;

	const getStorageSize = async () => {
		const storageApi = navigator?.storage || {};
		const { usageDetails = {} } = 'estimate' in storageApi ? await storageApi.estimate() : 0;
		const { caches = 0 } = usageDetails;
		const size = calculateByteSize(caches);
		return size;
	};

	const reset = () => {
		showResetModal = true;
		playSfx('modal');
	};
	setContext('factoryReset', reset);

	const confirmReset = async () => {
		playSfx();
		showResetModal = false;
		await factoryReset({ clearCache, keepSetting, isCustom: $isCustomBanner });
		pushToast({ message: $t('menu.resetSuccess'), type: 'success' });
		if (keepSetting) return;

		playSfx('wishBacksound');
		handleAnimatedBG();
		selectedAmount = 'default';
		setMultiPull(10);
	};

	const cancelReset = () => {
		showResetModal = false;
		playSfx('close');
	};

	let optionsContainer;
	onMount(() => {
		OverlayScrollbars(optionsContainer, { sizeAutoCapable: false, className: 'os-theme-light' });
	});
</script>

{#if showResetModal}
	<Modal title={$t('menu.resetTitle')} on:confirm={confirmReset} on:cancel={cancelReset}>
		<div class="confirmation">
			<caption>
				{@html $t('menu.resetPrompt')}
			</caption>

			<div class="delete-option">
				<CheckBox
					id="_setting"
					checked={keepSetting}
					on:change={({ detail }) => (keepSetting = !!detail.checked)}
				>
					<span> {@html $t('menu.keepSetting')}</span>
				</CheckBox>

				<CheckBox
					id="_cache"
					checked={clearCache}
					on:change={({ detail }) => (clearCache = !!detail.checked)}
				>
					{#await getStorageSize()}
						<span>..B</span>
					{:then size}
						<span>
							{@html $t('menu.clearCache', { values: { size: size } })}
						</span>
					{/await}
				</CheckBox>
			</div>
		</div>
	</Modal>
{/if}

<div in:fade={{ duration: 200 }} class="content-container" bind:this={optionsContainer}>
	<OptionMenu name="locale" activeIndicator={$locale} showOption={optionToShow === 'locale'}>
		{$t('menu.language')}
	</OptionMenu>

	<OptionMenu name="currency" showOption={optionToShow === 'currency'}>
		{$t('menu.currency')}
	</OptionMenu>

	<OptionMenu
		name="wishAmount"
		showOption={optionToShow === 'wishAmount'}
		activeIndicator={selectedAmount}
		on:select={handleSelectAmount}
	>
		{$t('menu.fates')}
	</OptionMenu>

	{#each ['intertwined', 'acquaint', 'starglitter', 'stardust', 'primogem'] as item, i}
		{#if selectedAmount === 'manual'}
			<div in:fly|local={{ y: -10, delay: Math.sqrt(i * 10000) }} out:fly|local={{ y: -10 }}>
				<OptionMenu useInput sub inputValue={item} name="currencyItem">
					<Icon type={item} style="margin: -1% 2% -1% 0" />
					{$t(`shop.item.${item}`)}
				</OptionMenu>
			</div>
		{/if}
	{/each}

	<OptionMenu name="multi" inputValue={$multipull} useInput>{$t('menu.multiRoll')}</OptionMenu>

	<OptionMenu
		showOption={optionToShow === 'audio'}
		name="audio"
		activeIndicator={isMuted}
		on:select={handleMuted}
	>
		{$t('menu.mute')}
	</OptionMenu>

	<OptionMenu
		showOption={optionToShow === 'autoskip'}
		name="autoskip"
		activeIndicator={$autoskip}
		on:select={handleAutoSkip}
	>
		{$t('menu.autoskip')}
	</OptionMenu>

	<OptionMenu
		showOption={optionToShow === 'animatedbg'}
		name="animatedbg"
		activeIndicator={animatedbg}
		on:select={showAnimatedBG}
	>
		{$t('menu.animatedbg')}
	</OptionMenu>

	<OptionMenu name="switchBanner">{$t('menu.switchBanner')}</OptionMenu>

	<OptionMenu name="reset">{$t('menu.factoryReset')}</OptionMenu>

	<h2>说明：</h2>
	<div class="notes">
		<ol>
			<li>
				本模拟器的保底机制尽量贴近游戏实际：根据你所抽卡池的不同，达到一定保底抽数后，获得高星物品的概率会逐步提升。具体概率数值可在卡池的【详情】页查看。
			</li>
			<li>
				本应用使用 LocalStorage 与 IndexedDB 保存你的祈愿记录，数据全部存储在你的浏览器/设备本地。若清除浏览器数据，与本应用相关的数据也会一并丢失且无法恢复——我们从不将你的数据上传到云端。
			</li>
			<li>
				本应用为中文魔改版，已移除上游版本中的广告、赞赏与全部第三方服务（评论区、云端同步、图床上传、激活码校验）。应用不收集、不上传任何可识别你身份的信息，可完全离线使用。
			</li>
		</ol>
	</div>
</div>

<style>
	.confirmation {
		display: flex;
		justify-content: center;
		align-items: center;
		flex-direction: column;
		width: 100%;
		height: 100%;
	}

	.delete-option {
		font-size: 80%;
		margin: 2% 0;
		width: 80%;
	}

	.delete-option :global(.checkbox) {
		margin-top: 3% !important;
	}

	.delete-option :global(label) {
		text-align: left;
		display: flex;
		align-items: center;
	}
	.delete-option :global(small) {
		display: block;
	}

	.delete-option :global(label i) {
		margin-right: 2%;
	}

	.notes {
		font-weight: 100;
		background-color: #fff;
		padding: 1rem 2.5rem 0.5rem;
		font-size: 0.87rem;
		border-radius: 0.3rem;
	}

	ol li {
		margin-bottom: 1rem;
	}
</style>
