<script lang="ts">
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';
	import { quintOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import { tasks, type Task } from '$lib/stores/tasks';
	import { boards, type Board } from '$lib/stores/boards';

	import { settings } from '$lib/stores/settings';

	const taskStore = tasks;
	const boardStore = boards;
	const settingsStore = settings;

	let newTitle = '';
	let newNote = '';
	let editingId: string | null = null;
	let editingTitle = '';
	let editingNote = '';
	let sortedTasks: Task[] = [];
	let visibleTasks: Task[] = [];
	let statusDropdownOpen: string | null = null;
	let currentBoardId = 'default';
	let editingBoardId: string | null = null;
	let editingBoardName = '';
	let boardToDelete: string | null = null;
	let showSettings = false;
	let mounted = false;

	onMount(() => {
		mounted = true;
	});

	const newTitleId = 'touche-new-title';
	const newNoteId = 'touche-new-note';

	$: {
		if ($boardStore.length > 0) {
			const hasCurrentBoard = $boardStore.some((board) => board.id === currentBoardId);
			if (!hasCurrentBoard) {
				currentBoardId = $boardStore[0].id;
			}
		}
	}

	$: currentBoardTasks = $taskStore.filter((task: Task) => task.boardId === currentBoardId);
	$: sortedTasks = [...currentBoardTasks].sort((a: Task, b: Task) => {
		if (a.status !== b.status) {
			const statusOrder = { active: 0, in_progress: 0, done: 1 };
			return statusOrder[a.status] - statusOrder[b.status];
		}

		return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
	});

	$: visibleTasks = $settingsStore.showCompleted
		? sortedTasks
		: sortedTasks.filter((task: Task) => task.status !== 'done');
	$: activeCount = currentBoardTasks.filter((task: Task) => task.status !== 'done').length;

	const resetEditor = () => {
		editingId = null;
		editingTitle = '';
		editingNote = '';
	};

	const handleCreate = () => {
		taskStore.addTask({ boardId: currentBoardId, title: newTitle, note: newNote });
		newTitle = '';
		newNote = '';
	};

	const beginEditing = (task: Task) => {
		editingId = task.id;
		editingTitle = task.title;
		editingNote = task.note;
	};

	const saveEditing = () => {
		if (!editingId) {
			return;
		}

		const trimmedTitle = editingTitle.trim();
		if (!trimmedTitle) {
			return;
		}

		taskStore.updateTask(editingId, { title: trimmedTitle, note: editingNote });
		resetEditor();
	};

	const toggleCompleted = (task: Task) => {
		taskStore.toggleCompleted(task.id);
	};

	const setStatus = (task: Task, status: 'active' | 'in_progress' | 'done') => {
		taskStore.setStatus(task.id, status);
		statusDropdownOpen = null;
	};

	const toggleStatusDropdown = (taskId: string) => {
		statusDropdownOpen = statusDropdownOpen === taskId ? null : taskId;
	};

	const switchBoard = (boardId: string) => {
		currentBoardId = boardId;
	};

	const createNewBoard = () => {
		const boardNumber = $boardStore.length + 1;
		const boardName = boardNumber === 1 ? 'Board' : `Board ${boardNumber}`;
		boardStore.addBoard({ name: boardName });
	};

	const beginEditingBoard = (board: Board) => {
		editingBoardId = board.id;
		editingBoardName = board.name;
	};

	const saveBoardEditing = () => {
		if (!editingBoardId || !editingBoardName.trim()) {
			return;
		}
		boardStore.updateBoard(editingBoardId, { name: editingBoardName.trim() });
		editingBoardId = null;
		editingBoardName = '';
	};

	const cancelBoardEditing = () => {
		editingBoardId = null;
		editingBoardName = '';
	};

	const confirmDeleteBoard = (boardId: string) => {
		const boards = $boardStore;
		const boardExists = boards.some((board) => board.id === boardId);

		if (!boardExists || boards.length <= 1) {
			boardToDelete = null;
			return;
		}

		if ($settingsStore.skipDeleteConfirmation) {
			boardToDelete = boardId;
			deleteBoard();
		} else {
			boardToDelete = boardId;
		}
	};

	const deleteBoard = () => {
		if (!boardToDelete) {
			return;
		}

		const boards = $boardStore;
		if (boards.length <= 1) {
			boardToDelete = null;
			return;
		}

		const boardExists = boards.some((board) => board.id === boardToDelete);
		if (!boardExists) {
			boardToDelete = null;
			return;
		}

		const remainingBoards = boards.filter((board) => board.id !== boardToDelete);
		const fallbackBoardId = remainingBoards[0]?.id ?? currentBoardId;

		const tasksToDelete = $taskStore.filter((task) => task.boardId === boardToDelete);
		tasksToDelete.forEach((task) => taskStore.deleteTask(task.id));

		boardStore.deleteBoard(boardToDelete);

		if (currentBoardId === boardToDelete && fallbackBoardId) {
			currentBoardId = fallbackBoardId;
		}

		boardToDelete = null;
	};

	const cancelDeleteBoard = () => {
		boardToDelete = null;
	};

	const removeTask = (id: string) => {
		taskStore.deleteTask(id);
		if (editingId === id) {
			resetEditor();
		}
	};
</script>

<main class="min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100">
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 py-16">
		<header class="flex flex-col gap-5 text-center md:text-left">
			<div
				class="mx-auto flex items-center justify-between gap-3 rounded-full border border-slate-200 bg-white/80 px-4 py-2 shadow-sm shadow-slate-200/60 backdrop-blur md:mx-0"
			>
				<div class="flex items-center gap-3">
					<div class="h-2.5 w-2.5 rounded-full bg-emerald-500"></div>
					<span class="text-sm uppercase tracking-widest text-slate-500">Touche</span>
				</div>
				<button
					type="button"
					class="shrink-0 rounded-full border border-slate-200 bg-white/70 p-2 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
					on:click={() => (showSettings = !showSettings)}
					title="Settings"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
						></path>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						></path>
					</svg>
				</button>
			</div>
			{#if mounted && !$settingsStore.hidePageTitle}
				<div class="flex flex-col gap-2">
					<h1 class="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">Touche</h1>
					<p class="text-base text-slate-600 md:text-lg">
						A lightning-fast, distraction-free board to capture, refine, and organize your notes.
					</p>
				</div>
			{/if}
		</header>

		<section class="space-y-6">
			<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<h2 class="text-xl font-semibold text-slate-900">
					{$boardStore.find((b) => b.id === currentBoardId)?.name || 'Board'}
				</h2>
				<div class="flex flex-wrap items-center gap-3 text-sm text-slate-500">
					<p class="hidden text-xs font-medium text-slate-500 md:block">
						{activeCount} pending · {sortedTasks.length} total
					</p>
					<p class="text-xs font-medium text-slate-500 md:hidden">
						{activeCount} pending · {sortedTasks.length} total
					</p>
					<label
						class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 transition hover:border-emerald-300 hover:text-emerald-600"
					>
						<input
							type="checkbox"
							class="h-4 w-4 rounded border border-slate-300 text-emerald-500 checked:border-transparent checked:bg-emerald-500 focus:ring-emerald-500"
							checked={$settingsStore.showCompleted}
							on:change={settingsStore.toggleShowCompleted}
						/>
						<span>Show completed</span>
					</label>
					<button
						type="button"
						class="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
						on:click={() => taskStore.clearCompleted()}
					>
						Clear completed ({currentBoardTasks.filter((t) => t.status === 'done').length})
					</button>
				</div>
			</div>

			<div
				class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60"
			>
				<!-- Board Tabs -->
				<div class="border-b border-slate-200 bg-slate-100/70 px-6 pt-3">
					<div class="-mx-1 overflow-x-auto">
						<div class="flex items-end gap-2 px-1 pb-1">
							{#each $boardStore as board (board.id)}
								{#if editingBoardId === board.id}
									<div
										class="-mb-[1px] flex items-center gap-2 rounded-t-xl border border-emerald-200 border-b-white bg-white px-3 py-2 text-sm font-medium text-emerald-700 shadow-sm"
									>
										<input
											bind:value={editingBoardName}
											class="w-28 rounded border border-emerald-200 bg-emerald-50/40 px-2 py-1 text-sm font-medium text-emerald-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
											on:keydown={(e) => {
												if (e.key === 'Enter') saveBoardEditing();
												if (e.key === 'Escape') cancelBoardEditing();
											}}
										/>
										<button
											class="rounded p-1 text-emerald-600 transition hover:bg-emerald-50"
											on:click={saveBoardEditing}
											title="Save board name"
										>
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M5 13l4 4L19 7"
												></path>
											</svg>
										</button>
										<button
											class="rounded p-1 text-slate-400 transition hover:bg-slate-100"
											on:click={cancelBoardEditing}
											title="Cancel editing"
										>
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M6 18L18 6M6 6l12 12"
												></path>
											</svg>
										</button>
									</div>
								{:else}
									<div class="group relative -mb-[4px]">
										<button
											class={`flex items-center gap-2 whitespace-nowrap rounded-t-xl px-4 py-2 pr-10 text-sm font-medium transition ${
												currentBoardId === board.id
													? '-mb-[1px] border border-slate-200 border-b-white bg-white text-slate-900 shadow-sm shadow-slate-200/70'
													: 'border border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-white/70 hover:text-slate-700'
											}`}
											on:click={() => switchBoard(board.id)}
											on:dblclick={() => beginEditingBoard(board)}
										>
											{board.name}
										</button>
										<button
											class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
											on:click|stopPropagation={() => confirmDeleteBoard(board.id)}
											title="Delete board"
										>
											<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M6 18L18 6M6 6l12 12"
												></path>
											</svg>
										</button>
									</div>
								{/if}
							{/each}
							<button
								class="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 transition hover:border-emerald-300 hover:text-emerald-600"
								on:click={createNewBoard}
								title="New board"
							>
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 4v16m8-8H4"
									></path>
								</svg>
							</button>
						</div>
					</div>
				</div>

				<div
					class="grid grid-cols-[32px_minmax(0,2.5fr)_minmax(0,1.7fr)_180px_160px] items-center gap-0 border-b border-slate-200 bg-slate-50 px-8 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400"
				>
					<div class="flex items-center justify-center border-r border-slate-200 pr-6">
						<span>#</span>
					</div>
					<div class="border-r border-slate-200 px-6">
						<span>Title</span>
					</div>
					<div class="border-r border-slate-200 px-6">
						<span>Notes</span>
					</div>
					<div class="border-r border-slate-200 px-6">
						<span>Status</span>
					</div>
					<div class="pl-6">
						<span class="text-right">Actions</span>
					</div>
				</div>

				<form
					class="grid grid-cols-[32px_minmax(0,2.5fr)_minmax(0,1.7fr)_180px_160px] items-center gap-0 border-b border-slate-100 px-8 py-4 text-sm text-slate-500"
					on:submit|preventDefault={handleCreate}
				>
					<div class="flex items-center justify-center border-r border-slate-200 pr-6">
						<span class="text-slate-300">New</span>
					</div>
					<div class="flex w-full items-center gap-3 border-r border-slate-200 px-6">
						<label for={newTitleId} class="sr-only">Title</label>
						<input
							id={newTitleId}
							bind:value={newTitle}
							placeholder="Type the note"
							class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
							required
						/>
					</div>
					<div class="flex w-full items-center gap-3 border-r border-slate-200 px-6">
						<label for={newNoteId} class="sr-only">Details</label>
						<input
							id={newNoteId}
							bind:value={newNote}
							placeholder="Details..."
							class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
						/>
					</div>
					<div class="border-r border-slate-200 px-6">
						<span
							class="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500"
						>
							Active
						</span>
					</div>
					<div class="flex justify-end pl-6">
						<button
							class="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-200/60 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
							type="submit"
							disabled={!newTitle.trim()}
						>
							Add task
						</button>
					</div>
				</form>

				{#if visibleTasks.length === 0}
					<div class="px-8 py-12 text-center text-sm text-slate-400" in:fade={{ duration: 200 }}>
						<p class="text-base font-medium text-slate-500">No tasks yet.</p>
						<p>Capture your next idea to keep the momentum.</p>
					</div>
				{:else}
					<div>
						{#each visibleTasks as task, index (task.id)}
							<div
								class="grid cursor-pointer grid-cols-[32px_minmax(0,2.5fr)_minmax(0,1.7fr)_180px_160px] items-center gap-0 border-b border-slate-200 px-8 py-4 text-sm text-slate-600 transition hover:bg-slate-50/80"
								in:fly={{ y: 12, opacity: 0.2, duration: 200, easing: quintOut }}
								out:fade={{ duration: 160 }}
								animate:flip={{ duration: 240, easing: quintOut }}
								on:click={() => toggleCompleted(task)}
								on:keydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										toggleCompleted(task);
									}
								}}
								role="button"
								tabindex="0"
							>
								<div class="flex items-center justify-center border-r border-slate-200 pr-6">
									<span
										class="cursor-pointer text-xs font-semibold text-slate-400"
										on:click|stopPropagation={() => toggleCompleted(task)}
										on:keydown|stopPropagation={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												toggleCompleted(task);
											}
										}}
										role="button"
										tabindex="0">{index + 1}</span
									>
								</div>
								<div class="flex items-center gap-3 border-r border-slate-200 px-6">
									<button
										type="button"
										class={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
											task.status === 'done'
												? 'border-purple-500 bg-purple-500 text-white shadow-sm shadow-purple-200/80 focus-visible:outline-purple-400'
												: 'border-emerald-400 bg-white text-emerald-500 hover:border-emerald-500 hover:bg-emerald-50 focus-visible:outline-emerald-400'
										}`}
										on:click|stopPropagation={() => toggleCompleted(task)}
										aria-pressed={task.status === 'done'}
										aria-label={task.status === 'done'
											? 'Mark task as active'
											: 'Mark task as done'}
									>
										<svg
											class={`h-3 w-3 transform transition-all duration-150 ${
												task.status === 'done' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
											}`}
											viewBox="0 0 20 20"
											fill="none"
											stroke="currentColor"
											stroke-width="2.4"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="m4.5 10.5 3.5 3.5L15.5 6.5" />
										</svg>
									</button>
									{#if editingId === task.id}
										<input
											bind:value={editingTitle}
											class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-emerald-200/60"
											on:click|stopPropagation
										/>
									{:else}
										<span
											class={`cursor-pointer text-sm font-medium transition-all duration-300 ${
												task.status === 'done'
													? 'text-slate-400 line-through decoration-slate-500 decoration-1'
													: 'text-slate-900'
											}`}
											on:click|stopPropagation={() => toggleCompleted(task)}
											on:keydown|stopPropagation={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													toggleCompleted(task);
												}
											}}
											role="button"
											tabindex="0"
										>
											{task.title}
										</span>
									{/if}
								</div>
								<div class="min-h-[24px] border-r border-slate-200 px-6">
									{#if editingId === task.id}
										<textarea
											bind:value={editingNote}
											rows="2"
											class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-emerald-200/60"
											on:click|stopPropagation
										></textarea>
									{:else}
										<span
											class={`text-sm ${task.note ? 'text-slate-600' : 'italic text-slate-300'}`}
										>
											{task.note || 'No details'}
										</span>
									{/if}
								</div>
								<div class="relative border-r border-slate-200 px-6">
									<button
										class={`inline-flex cursor-pointer items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold transition ${
											task.status === 'done'
												? 'border-purple-200 bg-purple-50 text-purple-600'
												: task.status === 'in_progress'
													? 'border-yellow-200 bg-yellow-50 text-yellow-600'
													: 'border-slate-200 bg-slate-100 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600'
										}`}
										on:click|stopPropagation={() => toggleStatusDropdown(task.id)}
									>
										{task.status === 'done'
											? 'Done'
											: task.status === 'in_progress'
												? 'In Progress'
												: 'Active'}
										<svg class="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 9l-7 7-7-7"
											></path>
										</svg>
									</button>
									{#if statusDropdownOpen === task.id}
										<div
											class="fixed z-50 min-w-[120px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
											data-dropdown
										>
											<button
												class="w-full px-3 py-2 text-left text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700"
												on:click|stopPropagation={() => setStatus(task, 'active')}
											>
												Active
											</button>
											<button
												class="w-full px-3 py-2 text-left text-xs font-semibold text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700"
												on:click|stopPropagation={() => setStatus(task, 'in_progress')}
											>
												In Progress
											</button>
											<button
												class="w-full px-3 py-2 text-left text-xs font-semibold text-purple-600 hover:bg-purple-50 hover:text-purple-700"
												on:click|stopPropagation={() => setStatus(task, 'done')}
											>
												Done
											</button>
										</div>
									{/if}
								</div>
								<div class="flex items-center justify-end gap-2 pl-6">
									{#if editingId === task.id}
										<button
											type="button"
											class="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-slate-300 hover:bg-slate-100"
											on:click|stopPropagation={resetEditor}
										>
											Cancel
										</button>
										<button
											type="button"
											class="rounded-full border border-emerald-200 bg-emerald-500/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-emerald-500 disabled:opacity-60"
											disabled={!editingTitle.trim()}
											on:click|stopPropagation={saveEditing}
										>
											Save
										</button>
									{:else}
										<button
											type="button"
											class="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600"
											on:click|stopPropagation={() => beginEditing(task)}
										>
											Edit
										</button>
										<button
											type="button"
											class="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-400 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-500"
											on:click|stopPropagation={() => removeTask(task.id)}
										>
											Delete
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</section>
	</div>
</main>

{#if showSettings}
	<div class="fixed inset-0 z-50 flex">
		<button
			type="button"
			class="fixed inset-0 bg-black/50"
			aria-label="Close settings panel"
			on:click={() => (showSettings = false)}
			on:keydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					showSettings = false;
				}
			}}
		></button>
		<div class="relative ml-auto h-full w-80 bg-white shadow-xl">
			<div class="flex items-center justify-between border-b border-slate-200 p-6">
				<h2 class="text-lg font-semibold text-slate-900">Settings</h2>
				<button
					class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
					on:click={() => (showSettings = false)}
					title="Close settings"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path>
					</svg>
				</button>
			</div>
			<div class="p-6">
				<div class="space-y-6">
					<div>
						<h3 class="mb-3 text-sm font-medium text-slate-900">Board Deletion</h3>
						<label class="flex items-center gap-3">
							<input
								type="checkbox"
								class="h-4 w-4 rounded border border-slate-300 text-emerald-500 checked:border-transparent checked:bg-emerald-500 focus:ring-emerald-500"
								checked={$settingsStore.skipDeleteConfirmation}
								on:change={settingsStore.toggleSkipDeleteConfirmation}
							/>
							<span class="text-sm text-slate-600">Skip delete confirmation</span>
						</label>
						<p class="mt-1 text-xs text-slate-500">
							When enabled, boards will be deleted immediately without asking for confirmation.
						</p>
					</div>
					<div>
						<h3 class="mb-3 text-sm font-medium text-slate-900">Page Display</h3>
						<label class="flex items-center gap-3">
							<input
								type="checkbox"
								class="h-4 w-4 rounded border border-slate-300 text-emerald-500 checked:border-transparent checked:bg-emerald-500 focus:ring-emerald-500"
								checked={$settingsStore.hidePageTitle}
								on:change={settingsStore.toggleHidePageTitle}
							/>
							<span class="text-sm text-slate-600">Hide page title and description</span>
						</label>
						<p class="mt-1 text-xs text-slate-500">
							When enabled, the page title and description will be hidden to save space.
						</p>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if boardToDelete}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-modal>
		<div class="mx-4 max-w-sm rounded-lg bg-white p-6 shadow-lg">
			<h3 class="mb-2 text-lg font-semibold text-slate-900">Delete Board</h3>
			<p class="mb-4 text-sm text-slate-600">
				Are you sure you want to delete "{$boardStore.find((b) => b.id === boardToDelete)?.name}"?
				This will also delete all tasks in this board.
			</p>
			<div class="mb-4 flex items-center justify-between">
				<label class="flex items-center gap-2 text-xs text-slate-500">
					<input
						type="checkbox"
						class="h-3 w-3 rounded border border-slate-300 text-emerald-500 checked:border-transparent checked:bg-emerald-500 focus:ring-emerald-500"
						checked={$settingsStore.skipDeleteConfirmation}
						on:change={settingsStore.toggleSkipDeleteConfirmation}
					/>
					Don't ask again
				</label>
			</div>
			<div class="flex justify-end gap-3">
				<button
					class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
					on:click={cancelDeleteBoard}
				>
					Cancel
				</button>
				<button
					class="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-600"
					on:click={deleteBoard}
				>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}

<svelte:window
	on:click={(e) => {
		// Only close dropdowns if clicking outside of them
		const target = e.target as HTMLElement;
		const isInsideDropdown = target.closest('[data-dropdown]');
		const isInsideModal = target.closest('[data-modal]');

		if (!isInsideDropdown) {
			statusDropdownOpen = null;
		}
		if (!isInsideModal) {
			boardToDelete = null;
		}
	}}
/>
