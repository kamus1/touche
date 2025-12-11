import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'touche:settings';

export type Settings = {
	showCompleted: boolean;
	skipDeleteConfirmation: boolean;
	hidePageTitle: boolean;
};

const DEFAULT_SETTINGS: Settings = {
	showCompleted: true,
	skipDeleteConfirmation: false,
	hidePageTitle: false
};

const readFromStorage = (): Settings => {
	if (!browser) {
		return DEFAULT_SETTINGS;
	}

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return DEFAULT_SETTINGS;
		}
		const parsed = JSON.parse(raw);
		return {
			showCompleted: typeof parsed.showCompleted === 'boolean' ? parsed.showCompleted : DEFAULT_SETTINGS.showCompleted,
			skipDeleteConfirmation: typeof parsed.skipDeleteConfirmation === 'boolean' ? parsed.skipDeleteConfirmation : DEFAULT_SETTINGS.skipDeleteConfirmation,
			hidePageTitle: typeof parsed.hidePageTitle === 'boolean' ? parsed.hidePageTitle : DEFAULT_SETTINGS.hidePageTitle
		};
	} catch {
		return DEFAULT_SETTINGS;
	}
};

const persist = (settings: Settings) => {
	if (!browser) {
		return;
	}

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// Ignore write errors
	}
};

const createSettingsStore = () => {
	const initialValue = readFromStorage();
	const { subscribe, set, update } = writable<Settings>(initialValue);

	if (browser) {
		subscribe((settings) => persist(settings));

		const handleStorage = (event: StorageEvent) => {
			if (event.key === STORAGE_KEY) {
				set(readFromStorage());
			}
		};

		window.addEventListener('storage', handleStorage);
	}

	return {
		subscribe,
		set,
		update,
		toggleShowCompleted: () => update(s => ({ ...s, showCompleted: !s.showCompleted })),
		toggleSkipDeleteConfirmation: () => update(s => ({ ...s, skipDeleteConfirmation: !s.skipDeleteConfirmation })),
		toggleHidePageTitle: () => update(s => ({ ...s, hidePageTitle: !s.hidePageTitle }))
	};
};

export const settings = createSettingsStore();
