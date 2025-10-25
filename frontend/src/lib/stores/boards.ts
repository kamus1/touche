import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'touche:boards';
const DEFAULT_BOARD_ID = 'default';
const DEFAULT_BOARD_NAME = 'Board';

export type Board = {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
};

type BoardDraft = {
	name: string;
};

type BoardChanges = Partial<Omit<Board, 'id' | 'createdAt'>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const toBoardArray = (value: unknown): Board[] => {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((item): Board | null => {
			if (!isRecord(item)) {
				return null;
			}

			const id = typeof item.id === 'string' && item.id.trim().length > 0 ? item.id : null;
			const name =
				typeof item.name === 'string' && item.name.trim().length > 0
					? item.name.trim()
					: null;

			if (!id || !name) {
				return null;
			}

			const createdAt =
				typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString();
			const updatedAt =
				typeof item.updatedAt === 'string' ? item.updatedAt : createdAt ?? new Date().toISOString();

			return { id, name, createdAt, updatedAt };
		})
		.filter((board): board is Board => board !== null);
};

const now = () => new Date().toISOString();

const createDefaultBoard = (): Board => {
	const timestamp = now();
	return {
		id: DEFAULT_BOARD_ID,
		name: DEFAULT_BOARD_NAME,
		createdAt: timestamp,
		updatedAt: timestamp
	};
};

const ensureMinimumBoards = (boards: Board[]): Board[] => {
	return boards.length === 0 ? [createDefaultBoard()] : boards;
};

const readFromStorage = (): Board[] => {
	if (!browser) {
		return ensureMinimumBoards([]);
	}

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return ensureMinimumBoards([]);
		}
		const parsed = JSON.parse(raw) as unknown;
		return ensureMinimumBoards(toBoardArray(parsed));
	} catch {
		return ensureMinimumBoards([]);
	}
};

const persist = (boards: Board[]) => {
	if (!browser) {
		return;
	}

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
	} catch {
		// Ignore write errors (e.g. quota full)
	}
};

const createId = () => {
	if (browser && typeof crypto?.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	return `board-${Math.random().toString(36).slice(2, 10)}`;
};

const createBoardStore = () => {
	const initialValue = readFromStorage();
	const { subscribe, update, set } = writable<Board[]>(initialValue);

	if (browser) {
		subscribe((boards) => persist(boards));

		const handleStorage = (event: StorageEvent) => {
			if (event.key === STORAGE_KEY) {
				set(readFromStorage());
			}
		};

		window.addEventListener('storage', handleStorage);
	}

	return {
		subscribe,
		addBoard: ({ name }: BoardDraft) => {
			const trimmedName = name.trim();
			if (!trimmedName) {
				return;
			}

			const timestamp = now();
			const board: Board = {
				id: createId(),
				name: trimmedName,
				createdAt: timestamp,
				updatedAt: timestamp
			};

			update((boards) => [...boards, board]);
		},
		updateBoard: (id: string, changes: BoardChanges) => {
			update((boards) =>
				boards.map((board) => {
					if (board.id !== id) {
						return board;
					}

					const trimmedName = typeof changes.name === 'string' ? changes.name.trim() : board.name;
					if (!trimmedName) {
						return board;
					}

					return {
						...board,
						name: trimmedName,
						updatedAt: now()
					};
				})
			);
		},
		deleteBoard: (id: string) => {
			update((boards) => {
				if (boards.length <= 1) {
					return boards;
				}

				const filtered = boards.filter((board) => board.id !== id);
				if (filtered.length === boards.length) {
					return boards;
				}

				return filtered.length > 0 ? filtered : ensureMinimumBoards(filtered);
			});
		}
	};
};

export const boards = createBoardStore();

export type BoardStore = ReturnType<typeof createBoardStore>;
