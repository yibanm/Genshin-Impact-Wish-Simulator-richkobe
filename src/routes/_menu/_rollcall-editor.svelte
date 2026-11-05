<script>
	import { onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { t } from 'svelte-i18n';

	import { playSfx } from '$lib/helpers/audio/audio';
	import { pushToast } from '$lib/helpers/toast';
	import {
		getListItems,
		addMembers,
		removeMember,
		renameMember,
		setMemberRarity,
		setMemberIcon,
		clearMemberIcon,
		ICON_MAX_BYTES
	} from '$lib/helpers/dataAPI/api-rollcall';

	import ButtonModal from '$lib/components/ButtonModal.svelte';
	import ModalTpl from '$lib/components/ModalTpl.svelte';
	import { memberDisplayName } from '$lib/helpers/rollcall/display';
	import {
		readNamesFile,
		pickNamesViaBridge,
		hasNativePicker,
		parseMembers
	} from '$lib/helpers/rollcall/import-txt';

	/**
	 * 名单编辑器（本项目新增）
	 *
	 * F3（2026-11-04）后预置名单已删除，本编辑器只服务用户自建名单。
	 *
	 * 四种录入方式（F6/F7/F8 按用户要求拆分入口）：
	 * 1. 「添加」按钮：小弹窗，输入名字 + 选星级 + 选图像（单条）
	 * 2. 「批量添加」按钮：弹窗内多行粘贴，支持「名字 空格 星级」格式
	 * 3. 「导入 TXT」按钮：文件导入，与批量添加同解析规则（含星级后缀）
	 * 4. 列表内逐条：改名 / 改星级 / 换图标 / 删除（F4：编辑不止重命名）
	 */

	export let listId = '';

	let items = [];
	let listLabel = '';

	// 批量导入的多行文本
	let bulkText = '';
	// 正在重命名的条目 uid 与新名字
	let renamingUid = '';
	let renamingValue = '';

	// F7：单条添加小弹窗状态 { name, rarity, iconBlob }
	let addModal = null;
	// F6：批量添加弹窗状态（复用 bulkText）
	let bulkModal = false;

	// 多选模式（2026-11-05 用户要求）：勾选后可批量删除/设星级/设图标。
	// selected 用普通对象（uid→true）保证响应式，与 iconUrls 同款约定。
	let selectMode = false;
	let selected = {};
	// 单条删除确认弹窗（用户要求：单一删除弹确认）
	let memberToDelete = null;
	// 批量设图标的隐藏 file input
	let bulkIconInput;

	$: selectedCount = Object.keys(selected).filter((k) => selected[k]).length;

	const toggleSelectMode = () => {
		playSfx();
		selectMode = !selectMode;
		selected = {};
	};
	const toggleSelect = (uid) => {
		selected = { ...selected, [uid]: !selected[uid] };
	};
	const toggleSelectAll = () => {
		const all = items.every((it) => selected[it.uid]);
		const next = {};
		if (!all) items.forEach((it) => (next[it.uid] = true));
		selected = next;
	};

	const selectedUids = () => Object.keys(selected).filter((k) => selected[k]);

	const handleBulkDelete = async () => {
		const uids = selectedUids();
		if (!uids.length) return;
		playSfx();
		for (const uid of uids) {
			const item = items.find((it) => it.uid === uid);
			await removeMember(listId, uid);
			if (item?.iconKey) dropIconCache(item.iconKey);
		}
		selected = {};
		await loadItems();
		pushToast({ message: $t('rollcall.bulkDeleted', { values: { count: uids.length } }), type: 'success' });
	};

	const handleBulkRarity = async (rarity) => {
		const uids = selectedUids();
		if (!uids.length) return;
		playSfx('click2');
		uids.forEach((uid) => setMemberRarity(listId, uid, rarity));
		await loadItems();
	};

	// 批量设图标：选一张图应用到所有勾选条目（与单条换图同上限同存储）
	const handleBulkIconPick = async (event) => {
		const file = event.target.files?.[0];
		event.target.value = '';
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
		const uids = selectedUids();
		if (!uids.length) return;
		playSfx();
		let okCount = 0;
		for (const uid of uids) {
			try {
				await setMemberIcon(listId, uid, file);
				okCount++;
			} catch (e) {
				console.error('批量设图标失败：', uid, e);
			}
		}
		// 旧缓存全部作废，重新从 IDB 读
		uids.forEach((uid) => dropIconCache(items.find((it) => it.uid === uid)?.iconKey || ''));
		iconUrls = {};
		await loadItems();
		pushToast({
			message: $t('rollcall.bulkIconDone', { values: { count: okCount } }),
			type: okCount === uids.length ? 'success' : 'error'
		});
	};

	// 单条删除：先弹确认（用户 2026-11-05 要求），确认后才真删
	const askRemoveMember = (item) => {
		playSfx();
		memberToDelete = item;
	};
	const confirmRemoveMember = async () => {
		if (!memberToDelete) return;
		const item = memberToDelete;
		memberToDelete = null;
		const ok = await removeMember(listId, item.uid);
		if (!ok) return pushToast({ message: $t('rollcall.deleteFailed'), type: 'error' });
		if (item.iconKey) dropIconCache(item.iconKey);
		await loadItems();
	};

	// 图标 blob → objectURL 的缓存，避免每次渲染都重新读取 IndexedDB。
	// 必须是**普通对象**而非 Map：Svelte 的响应式只追踪普通变量的重新赋值，
	// Map.set() 不触发重渲染——曾导致「设置图标后缩略图不刷新」（用户报的 bug）。
	let iconUrls = {};

	const loadItems = async () => {
		items = getListItems(listId);
		await loadIcons();
	};

	// 把需要显示的自定义图标从 IndexedDB 取出来转成 objectURL
	const loadIcons = async () => {
		const { getIconBlob } = await import('$lib/helpers/dataAPI/api-rollcall');
		let changed = false;
		const next = { ...iconUrls };
		for (const it of items) {
			if (!it.iconKey || next[it.iconKey]) continue;
			try {
				const blob = await getIconBlob(it.iconKey);
				if (blob) {
					next[it.iconKey] = URL.createObjectURL(blob);
					changed = true;
				}
			} catch (e) {
				console.error('读取图标失败：', e);
			}
		}
		// 整体重新赋值才触发模板重渲染
		if (changed) iconUrls = next;
	};

	// 每条的图标地址：用户导入的自定义图标（F3 后无预置素材分支）
	const iconOf = (item) => {
		if (item.iconKey) return iconUrls[item.iconKey] || null;
		return null;
	};

	// 换图/清图/删条目时作废缓存：删键后整体重赋值触发重渲染
	const dropIconCache = (key) => {
		if (!key || !iconUrls[key]) return;
		const next = { ...iconUrls };
		delete next[key];
		iconUrls = next;
	};

	onMount(loadItems);
	$: if (listId) loadItems();

	// 显示名：录入内容即显示内容（逻辑集中在 display.js）
	const displayName = (item) => memberDisplayName(item);

	// F6：批量添加走弹窗，解析规则与 TXT 导入一致（含「名字 空格 星级」）
	const handleBulkAdd = () => {
		const members = parseMembers(bulkText);
		const added = addMembers(listId, members);
		if (!added) {
			pushToast({ message: $t('rollcall.emptyInput'), type: 'error' });
			return;
		}
		playSfx('click2');
		bulkText = '';
		bulkModal = false;
		pushToast({ message: $t('rollcall.added', { values: { count: added } }), type: 'success' });
		loadItems();
	};

	// F7：单条添加（小弹窗：名字 + 星级 + 图像）
	const openAddModal = () => {
		playSfx();
		addModal = { name: '', rarity: null, iconBlob: null, iconPreview: '' };
	};
	const cancelAddModal = () => (addModal = null);
	const confirmAddModal = async () => {
		const name = (addModal?.name || '').trim();
		if (!name) {
			pushToast({ message: $t('rollcall.emptyInput'), type: 'error' });
			return;
		}
		const added = addMembers(listId, [{ name, rarity: addModal.rarity }]);
		if (!added) return;
		// 单条添加带图标：先取刚加入的条目 uid 再挂图标。
		// 必须 await：setMemberIcon 把 iconKey 写进名单是异步的，不 await 就 loadItems
		// 会读到还没有 iconKey 的旧数据，图标缓存永远建不起来（缩略图不显示的根因）
		if (addModal.iconBlob) {
			const fresh = getListItems(listId);
			const last = fresh[fresh.length - 1];
			if (last) {
				try {
					await setMemberIcon(listId, last.uid, addModal.iconBlob);
				} catch (e) {
					pushToast({ message: $t('rollcall.iconFailed'), type: 'error' });
					console.error(e);
				}
			}
		}
		playSfx('click2');
		addModal = null;
		pushToast({ message: $t('rollcall.added', { values: { count: added } }), type: 'success' });
		await loadItems();
	};
	const pickAddIcon = (event) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file || !addModal) return;
		if (file.size > ICON_MAX_BYTES) {
			pushToast({ message: $t('rollcall.iconTooLarge'), type: 'error' });
			return;
		}
		addModal.iconBlob = file;
		addModal.iconPreview = URL.createObjectURL(file);
	};

	// F4：列表内改星级（3/4/5 或取消指定）
	const handleSetRarity = (item, rarity) => {
		playSfx('click2');
		setMemberRarity(listId, item.uid, rarity);
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

	/** 把解析出的条目（含星级）写入当前名单并提示结果 */
	const applyImportedMembers = (members, fileName) => {
		if (!members || !members.length) {
			pushToast({ message: $t('rollcall.txtEmptyFile'), type: 'error' });
			return;
		}
		const added = addMembers(listId, members);
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
			applyImportedMembers(res.members, res.fileName);
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
			const { members, fileName } = await readNamesFile(file);
			applyImportedMembers(members, fileName);
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
			dropIconCache(item.iconKey || '');
			await loadItems();
			pushToast({ message: $t('rollcall.iconSet'), type: 'success' });
		} catch (e) {
			pushToast({ message: String(e.message || e), type: 'error' });
		}
	};

	const handleClearIcon = async (item) => {
		await clearMemberIcon(listId, item.uid);
		dropIconCache(item.iconKey || '');
		await loadItems();
	};
</script>

<div class="editor">
	<div class="editor-head">
		<h3>
			{$t('rollcall.customList')}
			<span class="badge">{$t('rollcall.memberCount', { values: { count: items.length } })}</span>
		</h3>
	</div>

	<!-- F6/F7/F8：三个录入入口各自独立按钮，不再把 textarea 常驻在页面上
	     （常驻 textarea 是「新建名单按钮挤在一坨」观感的来源之一）。
	     单条添加与批量添加各走一个弹窗，TXT 导入直接触发文件选择。 -->
	<div class="action-bar">
		<ButtonModal on:click={openAddModal}>{$t('rollcall.addOne')}</ButtonModal>
		<ButtonModal on:click={() => (bulkModal = true)}>{$t('rollcall.bulkAdd')}</ButtonModal>
		<button
			type="button"
			class="txt-import"
			class:disabled={txtImporting}
			disabled={txtImporting}
			on:click={handleTxtImport}
		>
			<i class="gi-plus" />
			<span>{txtImporting ? $t('rollcall.txtImporting') : $t('rollcall.importTxt')}</span>
		</button>
	</div>
	<p class="tip">{$t('rollcall.txtTip')}</p>

	<!-- 多选模式工具栏（2026-11-05）：批量删除/设星级/设图标 -->
	<div class="select-bar">
		<ButtonModal on:click={toggleSelectMode}>
			{selectMode ? $t('rollcall.exitSelect') : $t('rollcall.enterSelect')}
		</ButtonModal>
		{#if selectMode}
			<button type="button" class="sel-op" on:click={toggleSelectAll}>
				{items.length && items.every((it) => selected[it.uid])
					? $t('rollcall.unselectAll')
					: $t('rollcall.selectAll')}
			</button>
			<span class="sel-count">{$t('rollcall.selectedCount', { values: { count: selectedCount } })}</span>
			<button type="button" class="sel-op danger" disabled={!selectedCount} on:click={handleBulkDelete}>
				{$t('rollcall.bulkDelete')}
			</button>
			<span class="sel-rarity">
				{#each [3, 4, 5] as r}
					<button type="button" class="sel-op" disabled={!selectedCount} on:click={() => handleBulkRarity(r)}>
						{$t('rollcall.setRarityTo', { values: { r } })}
					</button>
				{/each}
			</span>
			<button type="button" class="sel-op" disabled={!selectedCount} on:click={() => bulkIconInput?.click()}>
				{$t('rollcall.bulkSetIcon')}
			</button>
			<input
				type="file"
				accept="image/*"
				hidden
				bind:this={bulkIconInput}
				on:change={handleBulkIconPick}
			/>
		{/if}
	</div>

	<!-- 单条删除确认弹窗 -->
	{#if memberToDelete}
		<ModalTpl
			title={$t('rollcall.delete')}
			on:confirm={confirmRemoveMember}
			on:cancel={() => (memberToDelete = null)}
		>
			<div class="confirm-text">
				{$t('rollcall.deleteMemberPrompt', { values: { name: displayName(memberToDelete) } })}
			</div>
		</ModalTpl>
	{/if}

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

	<!-- F7：单条添加小弹窗（名字 + 星级 + 图像） -->
	{#if addModal}
		<ModalTpl title={$t('rollcall.addOne')} on:confirm={confirmAddModal} on:cancel={cancelAddModal}>
			<div class="add-form">
				<label for="rollcall-add-name">{$t('rollcall.memberNameLabel')}</label>
				<!-- svelte-ignore a11y-autofocus -->
				<input
					id="rollcall-add-name"
					type="text"
					bind:value={addModal.name}
					placeholder={$t('rollcall.memberNamePlaceholder')}
					autofocus
					on:keydown={(e) => e.key === 'Enter' && confirmAddModal()}
				/>

				<span class="field-label">{$t('rollcall.rarityLabel')}</span>
				<div class="rarity-picker">
					{#each [null, 3, 4, 5] as r}
						<button
							type="button"
							class="rarity-opt"
							class:on={addModal.rarity === r}
							on:click={() => (addModal.rarity = r)}
						>
							{#if r === null}
								{$t('rollcall.rarityRandom')}
							{:else}
								{#each Array(r) as _, i (i)}<i class="gi-star" />{/each}
							{/if}
						</button>
					{/each}
				</div>

				<span class="field-label">{$t('rollcall.iconLabel')}</span>
				<div class="icon-pick">
					{#if addModal.iconPreview}
						<img src={addModal.iconPreview} alt="icon preview" class="icon-preview" />
					{:else}
						<span class="thumb placeholder"><i class="gi-user" /></span>
					{/if}
					<label class="icon-btn" title={$t('rollcall.setIcon')}>
						<i class="gi-picture" />
						<input type="file" accept="image/*" hidden on:change={pickAddIcon} />
					</label>
				</div>
			</div>
		</ModalTpl>
	{/if}

	<!-- F6：批量添加弹窗（多行粘贴，支持「名字 空格 星级」） -->
	{#if bulkModal}
		<ModalTpl title={$t('rollcall.bulkAdd')} on:confirm={handleBulkAdd} on:cancel={() => (bulkModal = false)}>
			<div class="bulk-add">
				<textarea
					bind:value={bulkText}
					placeholder={$t('rollcall.bulkPlaceholder')}
					rows="6"
				/>
			</div>
		</ModalTpl>
	{/if}

	{#if !items.length}
		<div class="empty">{$t('rollcall.noMembers')}</div>
	{:else}
		<ul class="members" in:fade={{ duration: 150 }}>
			{#each items as item (item.uid)}
				<li class="member" class:selecting={selectMode}>
					{#if selectMode}
						<label class="pick">
							<input type="checkbox" checked={!!selected[item.uid]} on:change={() => toggleSelect(item.uid)} />
							<span class="box"><i class="gi-check" /></span>
						</label>
					{/if}
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

					<!-- F4：所有条目都可改（改名/改星级/换图标/删除），不再有只读名单 -->
					<span class="ops">
						<!-- F5：星级快捷改。当前星级高亮，点「随机」清除指定 -->
						<span class="rarity-ops" title={$t('rollcall.rarityLabel')}>
							{#each [3, 4, 5] as r}
								<button
									type="button"
									class="rarity-btn"
									class:on={item.rarity === r}
									on:click={() => handleSetRarity(item, item.rarity === r ? null : r)}
								>
									{r}
								</button>
							{/each}
						</span>
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
						<button class="icon-btn danger" title={$t('rollcall.delete')} on:click={() => askRemoveMember(item)}>
							<i class="gi-delete" />
						</button>
					</span>
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

	/* F6/F7/F8：三个录入入口横排一行，间距统一，不挤在一起 */
	.action-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin: 0.5rem 0 0.3rem;
	}

	/* F7 单条添加弹窗表单 */
	.add-form {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.add-form input[type='text'] {
		border: 1px solid #cfc3ab;
		border-radius: 0.4rem;
		padding: 0.4rem 0.6rem;
		font-family: inherit;
		font-size: 0.95rem;
		background-color: #fffdf8;
	}

	.field-label {
		font-size: 0.8rem;
		color: rgba(0, 0, 0, 0.6);
		margin-top: 0.3rem;
	}

	.rarity-picker {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.rarity-opt {
		display: inline-flex;
		align-items: center;
		gap: 0.1rem;
		padding: 0.25rem 0.6rem;
		border: 1px solid #cfc3ab;
		border-radius: 2rem;
		background-color: #fffdf8;
		color: rgba(0, 0, 0, 0.7);
		font-family: inherit;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.rarity-opt.on {
		border-color: #e3a023;
		background-color: #fff0cc;
		color: #000;
	}

	.rarity-opt i {
		color: #e3a023;
		font-size: 0.8rem;
	}

	.icon-pick {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.icon-preview {
		width: 2.6rem;
		height: 2.6rem;
		object-fit: contain;
		border-radius: 0.4rem;
		background-color: #fffdf8;
		border: 1px solid #cfc3ab;
	}

	.thumb.placeholder {
		background-color: #fffdf8;
	}

	/* F4/F5：列表内星级快捷改（3/4/5 三枚小按钮，当前星级高亮） */
	.rarity-ops {
		display: inline-flex;
		gap: 0.15rem;
		margin-right: 0.3rem;
	}

	.rarity-btn {
		min-width: 1.3rem;
		height: 1.3rem;
		border: 1px solid #cfc3ab;
		border-radius: 0.3rem;
		background-color: #fffdf8;
		color: rgba(0, 0, 0, 0.55);
		font-family: inherit;
		font-size: 0.72rem;
		cursor: pointer;
	}

	.rarity-btn.on {
		border-color: #e3a023;
		background-color: #e3a023;
		color: #fff;
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

	/* 多选工具栏 */
	.select-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin: 0.4rem 0;
	}

	.sel-op {
		padding: 0.2rem 0.7rem;
		border: 1px solid rgba(0, 0, 0, 0.2);
		border-radius: 1rem;
		background-color: #fff;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.sel-op:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.sel-op.danger {
		border-color: #c0392b;
		color: #c0392b;
	}

	.sel-count {
		font-size: 0.8rem;
		color: rgba(0, 0, 0, 0.55);
	}

	.sel-rarity {
		display: inline-flex;
		gap: 0.3rem;
	}

	/* 列表勾选框 */
	.pick {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		cursor: pointer;
	}

	.pick input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.pick .box {
		width: 1.15rem;
		height: 1.15rem;
		border: 1.5px solid rgba(0, 0, 0, 0.35);
		border-radius: 0.25rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: transparent;
		font-size: 0.8rem;
		background-color: #fff;
	}

	.pick input:checked + .box {
		background-color: #e3a023;
		border-color: #e3a023;
		color: #fff;
	}

	.confirm-text {
		font-size: 0.92rem;
		line-height: 1.6;
		padding: 0.3rem 0.2rem;
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

	/* 移动端（含安卓横屏）：操作按钮常驻可见 + 换行到名字下方。
	   原布局一行排「图标+名字+星级+5个操作按钮」，横屏窄高下按钮被挤出可视区，
	   用户「编辑不到」。换行后名单列表仍可滚动，触控目标也更大。 */
	:global(.mobile) .member {
		flex-wrap: wrap;
		row-gap: 0.2rem;
		padding: 0.4rem 0.4rem;
	}

	:global(.mobile) .ops {
		opacity: 1;
		width: 100%;
		justify-content: flex-end;
	}

	:global(.mobile) .icon-btn,
	:global(.mobile) .rarity-btn {
		width: 1.9rem;
		height: 1.9rem;
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
