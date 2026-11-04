<script>
	import { t } from 'svelte-i18n';
	import { fade } from 'svelte/transition';
	import { getContext, onMount } from 'svelte';

	import { data as charDB } from '$lib/data/characters.json';
	import { BannerManager } from '$lib/helpers/dataAPI/api-indexeddb';
	import { playSfx } from '$lib/helpers/audio/audio';

	/**
	 * 仓库页搜索浮层（G1，本项目新增）
	 *
	 * 检索范围：现有全部角色（characters.json）+ 自定义卡池角色（IndexedDB 里
	 * 已补全立绘的条目）。武器不在检索范围——用户要求是「所有角色」。
	 * 匹配同时命中本地化显示名与英文 slug，中文用户输中文、英文用户输 slug 都能搜到。
	 *
	 * 点击结果：切到角色页签并关闭浮层（角色网格会含自定义条目，用户在那里看详情）。
	 * 不在浮层里直接开详情，是因为详情依赖当前页签的 itemList，跨页签开详情时序不稳。
	 */

	let query = '';
	let customChars = [];
	let inputEl;

	onMount(async () => {
		inputEl?.focus();
		try {
			const all = await BannerManager.getAll();
			customChars = (all || [])
				.filter((d) => d && !d.deleted && d.character && d.images?.artURL)
				.map((d) => ({ name: d.character, custom: true, rarity: 5 }));
		} catch (e) {
			console.error('读取自定义角色失败：', e);
			customChars = [];
		}
	});

	const localName = (name) => {
		const key = `${name}.name`;
		const translated = $t(key);
		return translated === key ? name : translated;
	};

	$: existing = charDB.map((c) => ({ name: c.name, custom: false, rarity: c.rarity }));
	$: all = [...customChars, ...existing];
	$: results = query.trim()
		? all.filter(({ name, custom }) => {
				const q = query.trim().toLowerCase();
				if (name.toLowerCase().includes(q)) return true;
				if (!custom && localName(name).toLowerCase().includes(q)) return true;
				return false;
			})
		: [];

	const showItem = getContext('showItem');
	const closeSearch = getContext('closeSearch');

	const pick = (item) => {
		playSfx('collectionitem');
		showItem('character');
		closeSearch();
	};
</script>

<div class="search-mask" in:fade={{ duration: 150 }} on:mousedown|self={() => closeSearch()}>
	<div class="search-panel">
		<div class="search-head">
			<!-- svelte-ignore a11y-autofocus -->
			<input
				bind:this={inputEl}
				type="text"
				bind:value={query}
				placeholder={$t('inventory.searchPlaceholder')}
				autofocus
				on:keydown={(e) => e.key === 'Escape' && closeSearch()}
			/>
			<button class="close" on:click={() => closeSearch()} title={$t('cancelButton')}>
				<i class="gi-close" />
			</button>
		</div>

		{#if query.trim() && !results.length}
			<div class="empty">{$t('inventory.searchEmpty')}</div>
		{:else if results.length}
			<ul class="results">
				{#each results as item (item.name + item.custom)}
					<li>
						<button class="result" on:click={() => pick(item)}>
							<span class="rname">
								{item.custom ? item.name : localName(item.name)}
							</span>
							{#if item.custom}
								<span class="tag custom">{$t('inventory.searchCustom')}</span>
							{/if}
							<span class="rarity star{item.rarity}">
								{#each Array(item.rarity || 3) as _, i (i)}<i class="gi-star" />{/each}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<div class="empty">{$t('inventory.searchHint')}</div>
		{/if}
	</div>
</div>

<style>
	.search-mask {
		position: fixed;
		inset: 0;
		z-index: 990;
		background-color: rgba(0, 0, 0, 0.55);
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding-top: 8vh;
	}

	.search-panel {
		width: min(34rem, 92vw);
		max-height: 76vh;
		display: flex;
		flex-direction: column;
		background-color: #fbf6ee;
		border-radius: 0.5rem;
		color: var(--text-color);
		overflow: hidden;
		box-shadow: 0 0.5rem 2rem rgba(0, 0, 0, 0.4);
	}

	.search-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.7rem 0.9rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.12);
	}

	.search-head input {
		flex: 1;
		border: 1px solid #cfc3ab;
		border-radius: 0.4rem;
		padding: 0.4rem 0.7rem;
		font-family: inherit;
		font-size: 0.95rem;
		background-color: #fffdf8;
	}

	.close {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		border: 2px solid #abbcc6;
		background-color: #e0ddd4;
		color: rgba(0, 0, 0, 0.7);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.results {
		list-style: none;
		margin: 0;
		padding: 0.3rem 0;
		overflow-y: auto;
	}

	.result {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0.9rem;
		background: none;
		border: none;
		font-family: inherit;
		font-size: 0.95rem;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.result:hover {
		background-color: rgba(227, 160, 35, 0.15);
	}

	.rname {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tag.custom {
		font-size: 0.68rem;
		background-color: #9bb0c9;
		color: #fff;
		border-radius: 0.6rem;
		padding: 0.05rem 0.4rem;
	}

	.rarity i {
		color: #e3a023;
		font-size: 0.7rem;
	}

	.rarity.star4 i {
		color: #c44dda;
	}

	.empty {
		padding: 1.4rem 1rem;
		text-align: center;
		color: rgba(0, 0, 0, 0.5);
		font-size: 0.9rem;
	}
</style>
