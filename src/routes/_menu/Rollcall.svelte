<script>
	import { fade } from 'svelte/transition';
	import { t } from 'svelte-i18n';
	import { onMount } from 'svelte';

	import { assets } from '$lib/store/app-stores';
	import { playSfx } from '$lib/helpers/audio/audio';
	import { pushToast } from '$lib/helpers/toast';
	import {
		rollcallStore,
		initRollcall,
		toggleSelect,
		resetPool,
		deleteList,
		getPoolStats,
		createList,
		renameList
	} from '$lib/helpers/dataAPI/api-rollcall';

	import CheckBox from '$lib/components/CheckBox.svelte';
	import ButtonModal from '$lib/components/ButtonModal.svelte';
	import ModalTpl from '$lib/components/ModalTpl.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import RollcallEditor from './_rollcall-editor.svelte';
	import { readNamesFile, pickNamesViaBridge, hasNativePicker } from '$lib/helpers/rollcall/import-txt';
	import { addMembers } from '$lib/helpers/dataAPI/api-rollcall';

	/**
	 * 名单管理页（中文修改版新增）
	 *
	 * 左半部分：勾选启用哪些名单 + 新建 / 导入 TXT 快捷入口。
	 * 右半部分：编辑选中的名单（增删条目、改星级、导入图标）。
	 *
	 * F3（2026-11-04）：预置角色/武器名单已全部删除，只剩用户自建名单，
	 * 因此不再有「角色/武器/我的」分组——单一列表即可，分组反而增加视觉噪音。
	 */

	// 进入页面时初始化（读取存储、清理失效勾选），并推送首次快照
	onMount(() => initRollcall());

	$: rc = $rollcallStore;
	$: lists = rc?.lists || [];
	$: selected = rc?.selected || [];
	// 正在编辑的名单 id，默认指向第一个已勾选的名单，没有则指向第一个名单
	let editingId = '';
	$: if (!editingId || !lists.some((l) => l.id === editingId)) {
		editingId = selected[0] || lists[0]?.id || '';
	}

	// 当前池子进度（已点 / 总数）。依赖 rc 触发重算，抽卡后 refreshRollcall() 会推来新快照
	$: stats = rc ? getPoolStats() : { total: 0, remaining: 0, drawn: 0 };

	const handleToggle = (listId) => {
		if (!toggleSelect(listId)) return;
		// 勾选状态变化会让池子作废，给用户一个提示，避免以为进度还在
		pushToast({ message: $t('rollcall.poolReset'), type: '' });
	};

	const handleResetPool = () => {
		playSfx();
		resetPool();
		pushToast({ message: $t('rollcall.poolResetDone'), type: '' });
	};

	// 删除名单的二次确认
	let listToDelete = null;
	const askDelete = (list) => {
		playSfx();
		listToDelete = list;
	};
	const confirmDelete = async () => {
		if (!listToDelete) return;
		const ok = await deleteList(listToDelete.id);
		if (ok) pushToast({ message: $t('rollcall.listDeleted'), type: '' });
		else pushToast({ message: $t('rollcall.deleteFailed'), type: 'error' });
		listToDelete = null;
	};
	const cancelDelete = () => (listToDelete = null);

	const openEditor = (listId) => {
		playSfx();
		editingId = listId;
	};

	// 新建 / 重命名名单共用一个输入弹窗：mode 为 'create' 或 'rename'
	let nameModal = null; // { mode, listId?, value }
	const openCreate = () => {
		playSfx();
		nameModal = { mode: 'create', value: '' };
	};
	const openRename = (list) => {
		playSfx();
		nameModal = { mode: 'rename', listId: list.id, value: list.label };
	};
	const cancelName = () => (nameModal = null);
	const confirmName = () => {
		const value = (nameModal?.value || '').trim();
		if (!value) {
			pushToast({ message: $t('rollcall.emptyInput'), type: 'error' });
			return;
		}
		if (nameModal.mode === 'create') {
			const id = createList(value);
			playSfx('click2');
			pushToast({ message: $t('rollcall.listCreated'), type: 'success' });
			// 新建后直接打开编辑，并默认勾选，省得用户再点一次
			editingId = id;
			if (id && !selected.includes(id)) toggleSelect(id);
		} else {
			const ok = renameList(nameModal.listId, value);
			playSfx('click2');
			if (!ok) pushToast({ message: $t('rollcall.deleteFailed'), type: 'error' });
		}
		nameModal = null;
	};

	// ---- F2：左栏「导入 TXT 名单」——选文件后直接建成一份新名单并打开编辑 ----
	let txtFileInput;
	let useNativePicker = false;
	let txtImporting = false;
	onMount(() => {
		useNativePicker = hasNativePicker();
	});

	/** 把导入的条目落成一份新名单（名单名取文件名去扩展名） */
	const createListFromMembers = (members, fileName) => {
		if (!members || !members.length) {
			pushToast({ message: $t('rollcall.txtEmptyFile'), type: 'error' });
			return;
		}
		const label = (fileName || '').replace(/\.[^.]+$/, '') || $t('rollcall.importedList');
		const id = createList(label);
		const added = addMembers(id, members);
		if (!added) {
			pushToast({ message: $t('rollcall.txtEmptyFile'), type: 'error' });
			return;
		}
		playSfx('click2');
		editingId = id;
		pushToast({
			message: $t('rollcall.txtImported', { values: { count: added, name: fileName || '' } }),
			type: 'success'
		});
	};

	const handleNativeImportNew = async () => {
		if (txtImporting) return;
		txtImporting = true;
		try {
			const res = await pickNamesViaBridge();
			if (res.canceled) return;
			if (res.error) {
				pushToast({ message: $t('rollcall.txtReadFailed', { values: { error: res.error } }), type: 'error' });
				return;
			}
			createListFromMembers(res.members, res.fileName);
		} catch (e) {
			pushToast({ message: $t('rollcall.txtReadFailed', { values: { error: String(e?.message || e) } }), type: 'error' });
		} finally {
			txtImporting = false;
		}
	};

	const handleTxtPickNew = async (event) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file || txtImporting) return;
		txtImporting = true;
		try {
			const { members, fileName } = await readNamesFile(file);
			createListFromMembers(members, fileName);
		} catch (e) {
			pushToast({ message: $t('rollcall.txtReadFailed', { values: { error: String(e?.message || e) } }), type: 'error' });
		} finally {
			txtImporting = false;
		}
	};

	const handleImportTxtNew = () => {
		playSfx();
		if (useNativePicker) return handleNativeImportNew();
		txtFileInput?.click();
	};
</script>

{#if listToDelete}
	<ModalTpl
		title={$t('rollcall.deleteList')}
		on:confirm={confirmDelete}
		on:cancel={cancelDelete}
	>
		<div class="confirm-text">
			{$t('rollcall.deleteListPrompt', { values: { name: listToDelete.label } })}
		</div>
	</ModalTpl>
{/if}

{#if nameModal}
	<ModalTpl
		title={nameModal.mode === 'create' ? $t('rollcall.newListTitle') : $t('rollcall.renameList')}
		on:confirm={confirmName}
		on:cancel={cancelName}
	>
		<div class="name-form">
			<label for="rollcall-list-name">{$t('rollcall.listNameLabel')}</label>
			<!-- svelte-ignore a11y-autofocus -->
			<input
				id="rollcall-list-name"
				type="text"
				bind:value={nameModal.value}
				placeholder={$t('rollcall.listNamePlaceholder')}
				autofocus
				on:keydown={(e) => {
					if (e.key === 'Enter') confirmName();
					if (e.key === 'Escape') cancelName();
				}}
			/>
		</div>
	</ModalTpl>
{/if}

<div class="content-container" in:fade={{ duration: 200 }} style="--bg-icon:url('{$assets['modal-bg-icon.png']}')">
	<div class="pane">
		<!-- F1：标题独占一行；操作按钮单独一行横排（原先标题+按钮挤在 pane-head 里，
		     窄屏下换行叠成一坨）。F2：TXT 导入放在左栏（名单列表侧），
		     因为它是「新建一份名单」的入口，与右侧「编辑某份名单」职责不同。 -->
		<div class="pane-head">
			<h2>{$t('rollcall.selectTitle')}</h2>
		</div>
		<div class="action-row">
			<!-- 不传 width="auto"：ButtonModal 的图标是 absolute 定位不占宽度，
			     auto 会让按钮收缩到纯文字宽（约 52px），居中文本与左侧图标重叠换行，
			     视觉上就是「挤在一坨」。默认 200px 宽度才是为避开图标设计的。 -->
			<ButtonModal on:click={openCreate}>{$t('rollcall.newList')}</ButtonModal>
			<button
				type="button"
				class="txt-import"
				class:disabled={txtImporting}
				disabled={txtImporting}
				on:click={handleImportTxtNew}
			>
				<i class="gi-plus" />
				<span>{txtImporting ? $t('rollcall.txtImporting') : $t('rollcall.importTxt')}</span>
			</button>
		</div>
		{#if !useNativePicker}
			<input
				type="file"
				accept=".txt,.csv,.md,text/plain"
				hidden
				bind:this={txtFileInput}
				on:change={handleTxtPickNew}
			/>
		{/if}
		<p class="desc">{$t('rollcall.selectDesc')}</p>

		<div class="pool-bar">
			<Icon type="acquaint" width="1.4rem" />
			<span>{$t('rollcall.poolStat', { values: { remaining: stats.drawn, total: stats.total } })}</span>
			<button class="link-btn" on:click={handleResetPool}>{$t('rollcall.resetPool')}</button>
		</div>

		{#if !lists.length}
			<div class="empty">{$t('rollcall.noLists')}</div>
		{:else}
			<ul class="list-group">
				{#each lists as list (list.id)}
					<li class="list-row" class:editing={editingId === list.id}>
						<div class="row-main" on:click={() => openEditor(list.id)} on:keydown={() => {}} role="button" tabindex="0">
							<span class="label">
								{list.label}
							</span>
							<span class="count">{$t('rollcall.memberCount', { values: { count: list.count } })}</span>
						</div>

						<div class="row-side">
							<CheckBox
								id={list.id}
								checked={selected.includes(list.id)}
								on:change={() => handleToggle(list.id)}
							>
								{$t('rollcall.enable')}
							</CheckBox>

							<button class="icon-btn" title={$t('rollcall.renameList')} on:click={() => openRename(list)}>
								<i class="gi-pen" />
							</button>
							<button class="icon-btn danger" title={$t('rollcall.deleteList')} on:click={() => askDelete(list)}>
								<i class="gi-delete" />
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="pane editor-pane">
		{#if editingId}
			<RollcallEditor listId={editingId} />
		{:else}
			<div class="empty">{$t('rollcall.pickListToEdit')}</div>
		{/if}
	</div>
</div>

<style>
	.content-container {
		background-color: #fbf6ee;
		background-image: var(--bg-icon);
		background-repeat: no-repeat;
		background-size: 45%;
		background-position: 50% 75%;
		border-radius: 0.5rem;
		color: var(--text-color);
		height: 100%;
		display: flex;
		gap: 1rem;
		padding: 1rem;
		overflow: hidden;
	}

	.pane {
		flex: 1;
		min-width: 0;
		background-color: rgba(255, 255, 255, 0.72);
		border-radius: 0.5rem;
		padding: 0.8rem 1rem;
		overflow-y: auto;
	}

	.editor-pane {
		flex: 1.1;
	}

	h2 {
		margin: 0 0 0.3rem;
		font-size: 1.3rem;
	}

	.pane-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.pane-head h2 {
		margin: 0;
	}

	/* F1：操作按钮独占一行横排（原先与标题挤在 pane-head，窄屏换行叠成一坨） */
	.action-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin: 0.4rem 0 0.2rem;
	}

	/* F2：左栏 TXT 导入按钮，样式与编辑器内同款（米色卡片配色，不引入新色系） */
	.txt-import {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.7rem;
		border: 1px solid #cfc3ab;
		border-radius: 2rem;
		background-color: #fffdf8;
		color: rgba(0, 0, 0, 0.7);
		font-family: inherit;
		font-size: 0.85rem;
		cursor: pointer;
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

	.name-form {
		padding: 1.2rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.name-form label {
		font-size: 0.9rem;
		color: rgba(0, 0, 0, 0.7);
	}

	.name-form input {
		border: 1px solid #cfc3ab;
		border-radius: 0.4rem;
		padding: 0.45rem 0.7rem;
		font-size: 0.95rem;
		font-family: inherit;
		background-color: #fffdf8;
	}

	.name-form input:focus {
		outline: none;
		border-color: #e3a023;
	}

	.desc {
		margin: 0 0 0.7rem;
		font-size: 0.85rem;
		color: rgba(0, 0, 0, 0.6);
		line-height: 1.4;
	}

	.pool-bar {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background-color: #efe7d6;
		border-radius: 2rem;
		padding: 0.35rem 0.9rem;
		font-size: 0.85rem;
		margin-bottom: 0.8rem;
	}

	.link-btn {
		margin-left: auto;
		color: #127399;
		font-size: 0.8rem;
		text-decoration: underline;
		background: none;
	}

	.empty {
		text-align: center;
		color: rgba(0, 0, 0, 0.45);
		padding: 2rem 0;
		font-size: 0.9rem;
	}

	.list-group {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	/* 分组：角色 / 武器 / 我的名单 */
	.list-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.45rem 0.6rem;
		border-radius: 0.4rem;
		transition: background-color 0.15s;
	}

	.list-row:hover {
		background-color: rgba(255, 255, 255, 0.7);
	}

	.list-row.editing {
		background-color: #fff6e2;
		box-shadow: inset 0 0 0 1px #e3c68a;
	}

	.row-main {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		cursor: pointer;
		min-width: 0;
	}

	.label {
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* 预置名单加个标记，让用户知道这些是自动生成的、不可改名删除 */
	.count {
		font-size: 0.75rem;
		color: rgba(0, 0, 0, 0.5);
		white-space: nowrap;
	}

	.row-side {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-shrink: 0;
	}

	.row-side :global(.checkbox) {
		margin: 0;
		font-size: 0.78rem;
	}

	.icon-btn {
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 0.3rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background-color: transparent;
		color: rgba(0, 0, 0, 0.55);
		transition: all 0.15s;
	}

	.icon-btn:hover {
		background-color: rgba(0, 0, 0, 0.07);
		color: #000;
	}

	.icon-btn.danger:hover {
		background-color: #ee6c4c;
		color: #fff;
	}

	.confirm-text {
		padding: 1.2rem 1.5rem;
		text-align: center;
		font-size: 0.95rem;
	}

	:global(.mobile) .content-container {
		flex-direction: column;
		background-size: 70%;
	}

	:global(.mobile) .pane {
		flex: none;
		max-height: 45%;
	}
</style>
