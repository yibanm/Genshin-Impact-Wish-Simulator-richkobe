<script>
	import { getContext } from 'svelte';
	import { t } from 'svelte-i18n';
	import hotkeys from 'hotkeys-js';

	import { acquaint, genesis, intertwined, primogem } from '$lib/store/app-stores';
	import { playSfx } from '$lib/helpers/audio/audio';
	import Icon from '$lib/components/Icon.svelte';

	export let activeItem = '';

	const navigate = getContext('navigate');
	const handleCLose = () => {
		navigate('index');
		playSfx('close');
	};

	// G1：左上角搜索按钮（检索现有 + 自定义的所有角色）
	const openSearch = getContext('openSearch');
	const handleSearch = () => {
		playSfx();
		openSearch();
	};

	// shortcut
	hotkeys('esc', 'inventory', (e) => {
		e.preventDefault();
		handleCLose();
	});
</script>

<div class="search-slot">
	<button class="search-btn" on:click={handleSearch} title={$t('inventory.search')}>
		<i class="gi-search" />
	</button>
</div>

<h1 class="title">{$t('inventory.text')} / {$t(activeItem)}</h1>
<div class="budget">
	<button class="intertwined">
		<Icon
			height="70%"
			width="auto"
			style="position: absolute; left: 5px;top: 50%; transform: translateY(-50%);"
			type="intertwined"
		/>
		{$intertwined}
	</button>
	<button class="acquiant">
		<Icon
			height="70%"
			width="auto"
			style="position: absolute; left: 5px;top: 50%; transform: translateY(-50%);"
			type="acquaint"
		/>
		{$acquaint}
	</button>
	<button class="primogem">
		<Icon
			type="primogem"
			height="80%"
			width="auto"
			style="position: absolute; left: 5px;top: 50%; transform: translateY(-50%);"
		/>
		{$primogem}
	</button>
	<button class="genesis">
		<Icon
			type="genesis"
			height="80%"
			width="auto"
			style="position: absolute; left: 5px;top: 50%; transform: translateY(-50%);"
		/>
		{$genesis}
	</button>
</div>
<button class="close" on:click={handleCLose}>
	<i class="gi-close" />
</button>

<style>
	.title {
		color: #d2c69c;
		text-transform: capitalize;
		display: flex;
		align-items: center;
		text-align: left;
	}
	:global(.mobile) .title {
		font-size: small;
	}
	.budget {
		text-align: right;
		display: flex;
		justify-content: flex-end;
		align-items: center;
		margin-left: auto;
	}

	button:not(.close) {
		display: inline-block;
		max-width: 112px;
		height: 25px;
		overflow: hidden;
		background-color: rgba(0, 0, 0, 0.3);
		border-radius: 50px;
		color: #fff;
		vertical-align: middle;
		text-align: center;
		position: relative;
		margin: 0 0.3rem;
		padding: 0 15px 0 30px;
	}

	/* G1：左上角搜索按钮。必须覆盖上面的通用 button 规则（那条是给货币胶囊按钮的：
	   固定高 25px + 左 padding 30px 放图标），否则搜索按钮会被压成胶囊且图标错位 */
	.search-slot {
		margin-right: 0.5rem;
	}

	.search-btn {
		max-width: none;
		width: 2rem;
		height: 2rem;
		padding: 0;
		margin: 0;
		border-radius: 50%;
		background-color: rgba(0, 0, 0, 0.35);
		color: #d2c69c;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.search-btn:hover {
		background-color: rgba(227, 160, 35, 0.5);
		color: #fff;
	}

	.search-btn i {
		font-size: 1rem;
	}

	:global(.mobile) .close {
		margin-right: 4%;
	}

	@media screen and (max-width: 900px) {
		.title {
			font-size: small;
		}
		button {
			height: 20px;
			margin: 0 3px;
		}

		:global(main):not(.mobile) .budget {
			flex-wrap: wrap;
		}
	}
	@media screen and (max-width: 400px) {
		button {
			max-width: 80px;
		}
	}
</style>
