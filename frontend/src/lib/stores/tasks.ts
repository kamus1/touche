import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'touche:tasks';

export type Task = {
	id: string;
	boardId: string;
	title: string;
	note: string;
	status: 'active' | 'in_progress' | 'done';
	createdAt: string;
	updatedAt: string;
};

type TaskDraft = {
	boardId: string;
	title: string;
	note?: string;
};

type TaskChanges = Partial<Omit<Task, 'id' | 'createdAt'>> & { completed?: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const toTaskArray = (value: unknown): Task[] => {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((item): Task | null => {
			if (!isRecord(item)) {
				return null;
			}

			const id = typeof item.id === 'string' && item.id.trim().length > 0 ? item.id : null;
			const boardId = typeof item.boardId === 'string' && item.boardId.trim().length > 0 ? item.boardId : 'default';
			const title =
				typeof item.title === 'string' && item.title.trim().length > 0
					? item.title.trim()
					: null;

			if (!id || !title) {
				return null;
			}

			const note = typeof item.note === 'string' ? item.note : '';
			const status = (typeof item.status === 'string' && ['active', 'in_progress', 'done'].includes(item.status))
				? item.status as 'active' | 'in_progress' | 'done'
				: (typeof item.completed === 'boolean' && item.completed ? 'done' : 'active');
			const createdAt =
				typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString();
			const updatedAt =
				typeof item.updatedAt === 'string' ? item.updatedAt : createdAt ?? new Date().toISOString();

			return { id, boardId, title, note, status, createdAt, updatedAt };
		})
		.filter((task): task is Task => task !== null);
};

const readFromStorage = (): Task[] => {
	if (!browser) {
		return [];
	}

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw) as unknown;
		return toTaskArray(parsed);
	} catch {
		return [];
	}
};

const persist = (tasks: Task[]) => {
	if (!browser) {
		return;
	}

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
	} catch {
		// Ignore write errors (e.g. quota full)
	}
};

const createId = () => {
	if (browser && typeof crypto?.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	return `task-${Math.random().toString(36).slice(2, 10)}`;
};

const now = () => new Date().toISOString();

const normaliseNote = (value: string | undefined) => (value ? value.trim() : '');

const createTaskStore = () => {
	const initialValue = readFromStorage();
	const { subscribe, update, set } = writable<Task[]>(initialValue);

	if (browser) {
		subscribe((tasks) => persist(tasks));

		const handleStorage = (event: StorageEvent) => {
			if (event.key === STORAGE_KEY) {
				set(readFromStorage());
			}
		};

		window.addEventListener('storage', handleStorage);
	}

	return {
		subscribe,
		addTask: ({ boardId, title, note }: TaskDraft) => {
			const trimmedTitle = title.trim();
			if (!trimmedTitle) {
				return;
			}

			const timestamp = now();
			const task: Task = {
				id: createId(),
				boardId,
				title: trimmedTitle,
				note: normaliseNote(note),
				status: 'active',
				createdAt: timestamp,
				updatedAt: timestamp
			};

			update((tasks) => [task, ...tasks]);
		},
		updateTask: (id: string, changes: TaskChanges) => {
			update((tasks) =>
				tasks.map((task) => {
					if (task.id !== id) {
						return task;
					}

					const trimmedTitle = typeof changes.title === 'string' ? changes.title.trim() : task.title;
					if (!trimmedTitle) {
						return task;
					}

					return {
						...task,
						title: trimmedTitle,
						note:
							typeof changes.note === 'string'
								? normaliseNote(changes.note)
								: task.note,
						status:
							typeof changes.completed === 'boolean'
								? (changes.completed ? 'done' : 'active')
								: task.status,
						updatedAt: now()
					};
				})
			);
		},
		toggleCompleted: (id: string) => {
			update((tasks) =>
				tasks.map((task) => {
					if (task.id !== id) {
						return task;
					}

					const newStatus = task.status === 'done' ? 'active' : 'done';
					return { ...task, status: newStatus, updatedAt: now() };
				})
			);
		},
		setStatus: (id: string, status: 'active' | 'in_progress' | 'done') => {
			update((tasks) =>
				tasks.map((task) => {
					if (task.id !== id) {
						return task;
					}

					return { ...task, status, updatedAt: now() };
				})
			);
		},
		deleteTask: (id: string) => {
			update((tasks) => tasks.filter((task) => task.id !== id));
		},
		clearCompleted: () => {
			update((tasks) => tasks.filter((task) => task.status !== 'done'));
		},
		getTasksByBoard: (boardId: string) => {
			// This will be used to filter tasks by board
			let currentTasks: Task[] = [];
			const unsubscribe = subscribe((tasks) => {
				currentTasks = tasks.filter(task => task.boardId === boardId);
			});
			unsubscribe();
			return currentTasks;
		}
	};
};

export const tasks = createTaskStore();

export type TaskStore = ReturnType<typeof createTaskStore>;
