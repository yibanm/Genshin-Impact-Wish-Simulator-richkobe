<script>
	import { onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { t } from 'svelte-i18n';

	import { assets } from '$lib/store/app-stores';
	import { playSfx } from '$lib/helpers/audio/audio';
	import { pushToast } from '$lib/helpers/toast';
	import {
		getListItems,
		addMembers,
		removeMember,
		renameMember,
		setMemberIcon,
		clearMemberIcon,
		ICON_MAX_BYTES
	} from '$lib/helpers/dataAPI/api-rollcall';

	import ButtonModal from '$lib/components/ButtonModal.svelte';
	import { memberDisplayName } from '$lib/helpers/rollcall/display';
	import {
		readNamesFile,
		pickNamesViaBridge,
		hasNativePicker
	} from '$lib/helpers/rollcall/import-txt';

	/**
	 * 名单编辑器（中文魔改版新增）
	 *
	 * 预置名单只读（内容由游戏数据自动生成，不可增删改，因此始终与游戏数据同步），
	 * 自定义名单可增删改，并支持为单条导入图标。
	 *
	 * 自定义名单的三种录入方式：
	 * 1. 批量粘贴（下方 textarea，一人一行）
	 * 2. 导入 TXT 文件（一人一行）：Electron 壳走系统原生文件对话框，
	 *    Web 走隐藏 <input type="file">，两者共用 import-txt.js 的解析与编码兜底
	 * 3. 逐条重命名 / 删除 / 换图标
	 */

	export let listId = '';

	let items = [];
	let listLabel = '';
	let isBuiltin = false;

	// 批量导入的多行文本
	let bulkText = '';
	// 正在重命名的条目 uid 与新名字
	let renamingUid = '';
	let renamingValue = '';

	// 图标 blob → objectURL 的缓存，避免每次渲染都重新读取 IndexedDB
	const iconUrls = new Map();
	let loadedIcons = {};

	const loadItems = async () => {
		items = getListItems(listId);
		// 名单标签与类型从主页面传入的 store 里查太重，这里直接从条目反推：
		// 预置名单的条目带 iconType 字段，自定义名单的带 iconKey 字段
		isBuiltin = items.length > 0 && items.every((it) => !!it.iconType);
		await loadIcons();
	};

	// 把需要显示的自定义图标从 IndexedDB 取出来转成 objectURL
	const loadIcons = async () => {
		const { getIconBlob } = await import('$lib/helpers/dataAPI/api-rollcall');
		let changed = false;
		for (const it of items) {
			if (!it.iconKey || iconUrls.has(it.iconKey)) continue;
			try {
				const blob = await getIconBlob(it.iconKey);
				if (blob) {
					iconUrls.set(it.iconKey, URL.createObjectURL(blob));
					changed = true;
				}
			} catch (e) {
				console.error('读取图标失败：', e);
			}
		}
		if (changed) loadedIcons = {}; // 触发响应式重算
	};

	// 每条的图标地址：自定义图标优先，其次预置素材
	const iconOf = (item) => {
		if (item.iconKey) return iconUrls.get(item.iconKey) || null;
		if (!item.name) return null;
		const map = $assets || {};
		if (item.iconType === 'char') return map[`face/${item.name}`] || null;
		if (item.iconType === 'weapon') return map[item.name] || null;
		return null;
	};

	onMount(loadItems);
	$: if (listId) loadItems();

	// 显示名：预置名单查语言包取中文名，自定义名单显示录入名（逻辑集中在 display.js）
	const displayName = (item) => memberDisplayName(item, $t);

	const handleBulkAdd = () => {
		const lines = bulkText.split(/\r?\n/);
		const added = addMembers(listId, lines);
		if (!added) {
			pushToast({ message: $t('rollcall.emptyInput'), type: 'error' });
			return;
		}
		playSfx('click2');
		bulkText = '';
		pushToast({ message: $t('rollcall.added', { values: { count: added } }), type: 'success' });
		loadItems();
	};

	// ---- TXT 文件导入（一人一行）----

	// Web 通道用的隐藏 file input 引用
	let txtFileInput;
	// 是否运行在 Electron 壳内（壳内有 preload 注入的原生文件对话框桥）
	let useNativePicker = false;
	let txtImporting = false;

	onMount(() => {
		// preload 的 contextBridge 是同步注入的，但仍在 onMount 检测，
		// 避免在 SSR/prerender 阶段访问 window
		useNativePicker = hasNativePicker();
	});

	/** 把解析出的姓名写入当前名单并提示结果 */
	const applyImportedNames = (names, fileName) => {
		if (!names || !names.length) {
			pushToast({ message: $t('rollcall.txtEmptyFile'), type: 'error' });
			return;
		}
		const added = addMembers(listId, names);
		if (!added) {
			pushToast({ message: $t('rollcall.txtEmptyFile'), type: 'error' });
			return;
		}
		playSfx('click2');
		pushToast({
			message: $t('rollcall.txtImported', {
				values: { count: added, name: fileName || '' }
			}),
			type: 'success'
		});
		loadItems();
	};

	const handleNativeImport = async () => {
		if (txtImporting) return;
		txtImporting = true;
		try {
			const res = await pickNamesViaBridge();
			if (res.canceled) return;
			if (res.error) {
				pushToast({
					message: $t('rollcall.txtReadFailed', { values: { error: res.error } }),
					type: 'error'
				});
				return;
			}
			applyImportedNames(res.names, res.fileName);
		} catch (e) {
			pushToast({
				message: $t('rollcall.txtReadFailed', { values: { error: String(e?.message || e) } }),
				type: 'error'
			});
		} finally {
			txtImporting = false;
		}
	};

	// Web 通道：隐藏 input 的 change 事件
	const handleTxtPick = async (event) => {
		const file = event.target.files?.[0];
		event.target.value = ''; // 清空以便连续选同一个文件
		if (!file) return;
		if (txtImporting) return;
		txtImporting = true;
		try {
			const { names, fileName } = await readNamesFile(file);
			applyImportedNames(names, fileName);
		} catch (e) {
			pushToast({
				message: $t('rollcall.txtReadFailed', { values: { error: String(e?.message || e) } }),
				type: 'error'
			});
		} finally {
			txtImporting = false;
		}
	};

	const handleTxtImport = () => {
		playSfx();
		if (useNativePicker) return handleNativeImport();
		// 触发隐藏的 file input
		txtFileInput?.click();
	};

	const handleRemove = async (item) => {
		playSfx();
		const ok = await removeMember(listId, item.uid);
		if (!ok) return pushToast({ message: $t('rollcall.deleteFailed'), type: 'error' });
		if (item.iconKey) iconUrls.delete(item.iconKey);
		loadItems();
	};

	const startRename = (item) => {
		playSfx();
		renamingUid = item.uid;
		renamingValue = item.chineseChar || item.name;
	};

	const commitRename = () => {
		const ok = renameMember(listId, renamingUid, renamingValue);
		renamingUid = '';
		if (!ok) return pushToast({ message: $t('rollcall.emptyInput'), type: 'error' });
		playSfx('click2');
		loadItems();
	};

	// 图标导入：每个条目一个隐藏的 file input，用 label 关联触发
	const fileInputs = {};
	const handleIconPick = async (item, event) => {
		const file = event.target.files?.[0];
		event.target.value = ''; // 允许连续选同一个文件
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			return pushToast({ message: $t('rollcall.notAnImage'), type: 'error' });
		}
		if (file.size > ICON_MAX_BYTES) {
			return pushToast({
				message: $t('rollcall.iconTooLarge', { values: { maxSize: '2MB' } }),
				type: 'error'
			});
		}
		try {
			await setMemberIcon(listId, item.uid, file);
			iconUrls.delete(item.iconKey || '');
			await loadItems();
			pushToast({ message: $t('rollcall.iconSet'), type: 'success' });
		} catch (e) {
			pushToast({ message: String(e.message || e), type: 'error' });
		}
	};

	const handleClearIcon = async (item) => {
		await clearMemberIcon(listId, item.uid);
		iconUrls.delete(item.iconKey || '');
		await loadItems();
	};
</script>

<div class="editor">
	<div class="editor-head">
		<h3>
			{isBuiltin ? $t('rollcall.presetList') : $t('rollcall.customList')}
			<span class="badge">{$t('rollcall.memberCount', { values: { count: items.length } })}</span>
		</h3>
	</div>

	{#if isBuiltin}
		<p class="tip">{$t('rollcall.presetTip')}</p>
	{:else}
		<div class="bulk-add">
			<textarea
				bind:value={bulkText}
				placeholder={$t('rollcall.bulkPlaceholder')}
				rows="3"
			/>
			<div class="bulk-actions">
				<button
					type="button"
					class="txt-import"
					class:disabled={txtImporting}
					disabled={txtImporting}
					on:click={handleTxtImport}
				>
					<i class="gi-upload" />
					<span>{txtImporting ? $t('rollcall.txtImporting') : $t('rollcall.importTxt')}</span>
				</button>
				<ButtonModal on:click={handleBulkAdd} disabled={!bulkText.trim()}>
					{$t('rollcall.bulkAdd')}
				</ButtonModal>
			</div>
			<p class="tip">{$t('rollcall.txtTip')}</p>
		</div>

		<!-- Web 通道用的隐藏文件选择器；Electron 壳走主进程对话框，不需要它。
		     独立放置而非嵌在 label 内，避免 label 点击同时触发原生选择与 on:click 造成弹两次框 -->
		{#if !useNativePicker}
			<input
				type="file"
				accept=".txt,.csv,.md,text/plain"
				hidden
				bind:this={txtFileInput}
				on:change={handleTxtPick}
			/>
		{/if}
	{/if}

	{#if !items.length}
		<div class="empty">{isBuiltin ? $t('rollcall.noData') : $t('rollcall.noMembers')}</div>
	{:else}
		<ul class="members" in:fade={{ duration: 150 }}>
			{#each items as item (item.uid)}
				<li class="member">
					<span class="thumb">
						{#if iconOf(item)}
							<img src={iconOf(item)} alt={item.name} loading="lazy" />
						{:else}
							<i class="gi-user" />
						{/if}
					</span>

					{#if renamingUid === item.uid}
						<!-- svelte-ignore a11y-autofocus -->
						<input
							class="rename-input"
							bind:value={renamingValue}
							autofocus
							on:blur={commitRename}
							on:keydown={(e) => {
								if (e.key === 'Enter') commitRename();
								if (e.key === 'Escape') renamingUid = '';
							}}
						/>
					{:else}
						<span class="name" title={displayName(item)}>{displayName(item)}</span>
					{/if}

					{#if item.rarity}
						<span class="rarity star{item.rarity}">
							{#each Array(item.rarity) as _, i (i)}<i class="gi-star" />{/each}
						</span>
					{/if}

					{#if !isBuiltin}
						<span class="ops">
							<label class="icon-btn" title={$t('rollcall.setIcon')}>
								<i class="gi-picture" />
								<input
									type="file"
									accept="image/*"
									hidden
									on:change={(e) => handleIconPick(item, e)}
								/>
							</label>
							{#if item.iconKey}
								<button class="icon-btn" title={$t('rollcall.clearIcon')} on:click={() => handleClearIcon(item)}>
									<i class="gi-close" />
								</button>
							{/if}
							<button class="icon-btn" title={$t('rollcall.rename')} on:click={() => startRename(item)}>
								<i class="gi-pen" />
							</button>
							<button class="icon-btn danger" title={$t('rollcall.delete')} on:click={() => handleRemove(item)}>
								<i class="gi-delete" />
							</button>
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	.editor-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h3 {
		margin: 0;
		font-size: 1.05rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.badge {
		font-size: 0.72rem;
		font-weight: 400;
		background-color: #e3a023;
		color: #fff;
		border-radius: 1rem;
		padding: 0.1rem 0.5rem;
	}

	.tip {
		font-size: 0.8rem;
		color: rgba(0, 0, 0, 0.55);
		margin: 0.4rem 0;
		line-height: 1.4;
	}

	.bulk-add {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin: 0.5rem 0 0.7rem;
	}

	textarea {
		width: 100%;
		border: 1px solid #cfc3ab;
		border-radius: 0.4rem;
		padding: 0.4rem 0.6rem;
		font-family: inherit;
		font-size: 0.85rem;
		resize: vertical;
		background-color: #fffdf8;
	}

	textarea:focus {
		outline: none;
		border-color: #e3a023;
	}

	/* 操作行：左侧导入 TXT，右侧批量添加 */
	.bulk-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.bulk-actions :global(button) {
		align-self: flex-end;
		margin-left: auto;
	}

	/* 导入 TXT 按钮：跟随原版皮肤的米色卡片配色，不引入新色系 */
	.txt-import {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-left: 0 !important;
		padding: 0.3rem 0.7rem;
		border: 1px solid #cfc3ab;
		border-radius: 2rem;
		background-color: #fffdf8;
		color: rgba(0, 0, 0, 0.7);
		font-family: inherit;
		font-size: 0.8rem;
		cursor: pointer;
		transition: background-color 0.15s, border-color 0.15s, color 0.15s;
	}

	.txt-import:hover {
		border-color: #e3a023;
		color: #000;
		background-color: #fff6e2;
	}

	.txt-import.disabled,
	.txt-import:disabled {
		opacity: 0.55;
		cursor: default;
	}

	.txt-import i {
		font-size: 0.9rem;
	}

	.empty {
		text-align: center;
		color: rgba(0, 0, 0, 0.4);
		padding: 1.5rem 0;
		font-size: 0.85rem;
	}

	.members {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}

	.member {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.3rem 0.4rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}

	.member:hover {
		background-color: rgba(255, 255, 255, 0.75);
	}

	.thumb {
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		border-radius: 0.35rem;
		background-color: #efe7d6;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		color: rgba(0, 0, 0, 0.3);
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.name {
		flex: 1;
		min-width: 0;
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.rename-input {
		flex: 1;
		min-width: 0;
		border: 1px solid #e3a023;
		border-radius: 0.3rem;
		padding: 0.15rem 0.4rem;
		font-size: 0.9rem;
		font-family: inherit;
	}

	.rarity {
		display: inline-flex;
		flex-shrink: 0;
		line-height: 1;
	}

	.rarity i {
		font-size: 0.6rem;
		color: #d3bc8e;
	}

	.rarity.star5 i {
		color: #d3a04a;
	}
	.rarity.star4 i {
		color: #b78bd0;
	}

	.ops {
		display: flex;
		gap: 0.15rem;
		flex-shrink: 0;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.member:hover .ops {
		opacity: 1;
	}

	.icon-btn {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 0.25rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background-color: transparent;
		color: rgba(0, 0, 0, 0.5);
		cursor: pointer;
		font-size: 0.85rem;
	}

	.icon-btn:hover {
		background-color: rgba(0, 0, 0, 0.08);
		color: #000;
	}

	.icon-btn.danger:hover {
		background-color: #ee6c4c;
		color: #fff;
	}

	:global(.mobile) .ops {
		opacity: 1;
	}
</style>
