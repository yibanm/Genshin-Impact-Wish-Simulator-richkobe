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

	/**
	 * 名单管理页（中文魔改版新增）
	 *
	 * 上半部分：勾选启用哪些名单。可单选、可多选（多选则合并成一个池子），
	 * 也可把预置名单全部取消勾选、只用自定义名单。
	 * 下半部分：编辑选中的名单（增删条目、导入图标）。
	 */

	// 进入页面时初始化（读取存储、清理失效勾选），并推送首次快照
	onMount(() => initRollcall());

	$: rc = $rollcallStore;
	$: lists = rc?.lists || [];
	$: selected = rc?.selected || [];

	// 分组：角色名单 / 武器名单 / 我的名单（自定义）。
	// 池子来源不同（角色池、武器池、自导入池），分组展示更贴合「不同池子」的心智模型。
	const groupOf = (list) => {
		if (!list.builtin) return 'custom';
		if (list.id.includes('char')) return 'char';
		if (list.id.includes('weapon')) return 'weapon';
		return 'char';
	};
	const groupMeta = [
		{ key: 'char', labelKey: 'rollcall.groupChar' },
		{ key: 'weapon', labelKey: 'rollcall.groupWeapon' },
		{ key: 'custom', labelKey: 'rollcall.groupCustom' }
	];
	$: grouped = groupMeta
		.map((g) => ({ ...g, items: lists.filter((l) => groupOf(l) === g.key) }))
		.filter((g) => g.items.length > 0);

	// 整组勾选/取消：组内全选或全不选
	const toggleGroup = (group) => {
		const ids = group.items.map((l) => l.id);
		const allOn = ids.every((id) => selected.includes(id));
		ids.forEach((id) => {
			const isOn = selected.includes(id);
			if (allOn && isOn) toggleSelect(id);
			else if (!allOn && !isOn) toggleSelect(id);
		});
		pushToast({ message: $t('rollcall.poolReset'), type: '' });
	};
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
		<div class="pane-head">
			<h2>{$t('rollcall.selectTitle')}</h2>
			<ButtonModal on:click={openCreate} width="auto">{$t('rollcall.newList')}</ButtonModal>
		</div>
		<p class="desc">{$t('rollcall.selectDesc')}</p>

		<div class="pool-bar">
			<Icon type="acquaint" width="1.4rem" />
			<span>{$t('rollcall.poolStat', { values: { remaining: stats.drawn, total: stats.total } })}</span>
			<button class="link-btn" on:click={handleResetPool}>{$t('rollcall.resetPool')}</button>
		</div>

		{#if !lists.length}
			<div class="empty">{$t('rollcall.noLists')}</div>
		{:else}
			{#each grouped as group (group.key)}
				<div class="group">
					<div class="group-head">
						<span class="group-label">{$t(group.labelKey)}</span>
						<button class="link-btn" on:click={() => toggleGroup(group)}>
							{$t('rollcall.groupSelectAll')}
						</button>
					</div>
					<ul class="list-group">
						{#each group.items as list (list.id)}
							<li class="list-row" class:editing={editingId === list.id}>
								<div class="row-main" on:click={() => openEditor(list.id)} on:keydown={() => {}} role="button" tabindex="0">
									<span class="label" class:preset={list.builtin}>
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

									{#if !list.builtin}
										<button class="icon-btn" title={$t('rollcall.renameList')} on:click={() => openRename(list)}>
											<i class="gi-pen" />
										</button>
										<button class="icon-btn danger" title={$t('rollcall.deleteList')} on:click={() => askDelete(list)}>
											<i class="gi-delete" />
										</button>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
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
	.group {
		margin-bottom: 0.6rem;
	}

	.group-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.15rem 0.2rem 0.25rem;
		border-bottom: 1px dashed rgba(0, 0, 0, 0.15);
		margin-bottom: 0.2rem;
	}

	.group-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: rgba(0, 0, 0, 0.6);
		letter-spacing: 0.05em;
	}

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
	.label.preset::after {
		content: '预置';
		font-size: 0.6rem;
		font-weight: 400;
		color: #fff;
		background-color: #9bb0c9;
		border-radius: 0.6rem;
		padding: 0.05rem 0.35rem;
		margin-left: 0.35rem;
		vertical-align: middle;
	}

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
