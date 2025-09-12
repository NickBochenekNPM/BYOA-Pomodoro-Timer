(function () {
	'use strict';

	/**
	 * Application State
	 */
	const defaultSettings = {
		pomodoroMinutes: 25,
		shortBreakMinutes: 5,
		longBreakMinutes: 15,
		longBreakEvery: 4
	};

	let settings = loadSettings();

	/**
	 * Timer State
	 */
	let currentMode = 'pomodoro'; // 'pomodoro' | 'short' | 'long'
	let cycleCount = 1; // increments after each pomodoro
	let isRunning = false;
	let remainingMs = minutesToMs(getModeMinutes(currentMode));
	let intervalId = null;

	/**
	 * DOM Elements
	 */
	const timeEl = document.getElementById('time');
	const startPauseBtn = document.getElementById('start-pause');
	const resetBtn = document.getElementById('reset');
	const modeButtons = Array.from(document.querySelectorAll('.mode-btn'));
	const sessionLabelEl = document.getElementById('session-label');
	const cycleLabelEl = document.getElementById('cycle-label');
	const settingsDialog = document.getElementById('settings-dialog');
	const openSettingsBtn = document.getElementById('open-settings');
	const settingsForm = document.getElementById('settings-form');
	const pomodoroInput = document.getElementById('pomodoro-min');
	const shortInput = document.getElementById('short-min');
	const longInput = document.getElementById('long-min');
	const saveSettingsBtn = document.getElementById('save-settings');

	/**
	 * Initialization
	 */
	updateInputsFromSettings();
	updateTimerDisplay();
	updateLabels();
	updateModeButtons();
	attachEventListeners();

	/**
	 * Event Listeners
	 */
	function attachEventListeners() {
		startPauseBtn.addEventListener('click', onToggleStartPause);
		resetBtn.addEventListener('click', onReset);
		modeButtons.forEach(btn => btn.addEventListener('click', onModeClick));
		openSettingsBtn.addEventListener('click', () => settingsDialog.showModal());
		saveSettingsBtn.addEventListener('click', onSaveSettings);
		settingsDialog.addEventListener('close', () => {
			// Reset inputs on cancel
			if (settingsDialog.returnValue === 'cancel') {
				updateInputsFromSettings();
			}
		});
	}

	function onToggleStartPause() {
		if (isRunning) {
			pause();
		} else {
			start();
		}
	}

	function onReset() {
		pause();
		remainingMs = minutesToMs(getModeMinutes(currentMode));
		updateTimerDisplay();
	}

	function onModeClick(event) {
		const button = event.currentTarget;
		const mode = button.getAttribute('data-mode');
		if (!mode || mode === currentMode) return;
		setMode(mode);
	}

	function onSaveSettings(event) {
		// form method="dialog" will close; prevent default so we can validate first
		event.preventDefault();
		const newSettings = {
			pomodoroMinutes: clampInt(pomodoroInput.valueAsNumber, 1, 120, defaultSettings.pomodoroMinutes),
			shortBreakMinutes: clampInt(shortInput.valueAsNumber, 1, 60, defaultSettings.shortBreakMinutes),
			longBreakMinutes: clampInt(longInput.valueAsNumber, 1, 60, defaultSettings.longBreakMinutes),
			longBreakEvery: settings.longBreakEvery
		};
		saveSettings(newSettings);
		settings = newSettings;
		if (currentMode === 'pomodoro' || currentMode === 'short' || currentMode === 'long') {
			remainingMs = minutesToMs(getModeMinutes(currentMode));
			updateTimerDisplay();
		}
		settingsDialog.close();
	}

	/**
	 * Timer Controls
	 */
	function start() {
		if (isRunning) return;
		isRunning = true;
		startPauseBtn.textContent = 'Pause';
		const startTimestamp = Date.now();
		let expected = startTimestamp + 1000;
		intervalId = setInterval(() => {
			const drift = Date.now() - expected;
			expected += 1000;
			remainingMs -= 1000;
			if (remainingMs <= 0) {
				remainingMs = 0;
				updateTimerDisplay();
				completeSession();
				return;
			}
			updateTimerDisplay();
			// compensate drift if large
			if (drift > 100) {
				// do nothing special, next tick corrects via expected
			}
		}, 1000);
	}

	function pause() {
		if (!isRunning) return;
		isRunning = false;
		startPauseBtn.textContent = 'Start';
		clearInterval(intervalId);
		intervalId = null;
	}

	function setMode(mode) {
		pause();
		currentMode = mode;
		remainingMs = minutesToMs(getModeMinutes(currentMode));
		updateTimerDisplay();
		updateLabels();
		updateModeButtons();
	}

	function completeSession() {
		pause();
		if (currentMode === 'pomodoro') {
			cycleCount += 1;
			const shouldLongBreak = (cycleCount - 1) % settings.longBreakEvery === 0;
			currentMode = shouldLongBreak ? 'long' : 'short';
		} else {
			currentMode = 'pomodoro';
		}
		remainingMs = minutesToMs(getModeMinutes(currentMode));
		updateLabels();
		updateModeButtons();
		updateTimerDisplay();
		// Optionally auto-start next session? Keeping manual start for control.
	}

	/**
	 * UI Updates
	 */
	function updateTimerDisplay() {
		timeEl.textContent = formatMs(remainingMs);
		updateTabTitle();
	}

	function updateTabTitle() {
		const timeStr = formatMs(remainingMs);
		const modeStr = currentMode === 'pomodoro' ? '🍅' : (currentMode === 'short' ? '☕' : '🌿');
		const statusStr = isRunning ? '▶️' : '⏸️';
		document.title = `${timeStr} ${modeStr} ${statusStr} - Pomodoro`;
	}

	function updateLabels() {
		sessionLabelEl.textContent = currentMode === 'pomodoro' ? 'Focus' : (currentMode === 'short' ? 'Short Break' : 'Long Break');
		cycleLabelEl.textContent = `Cycle ${cycleCount}`;
		updateTabTitle();
	}

	function updateModeButtons() {
		modeButtons.forEach(btn => {
			const mode = btn.getAttribute('data-mode');
			btn.setAttribute('aria-selected', String(mode === currentMode));
		});
	}

	/**
	 * Helpers
	 */
	function minutesToMs(min) { return Math.round(min * 60 * 1000); }
	function formatMs(ms) {
		const totalSeconds = Math.max(0, Math.floor(ms / 1000));
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}
	function getModeMinutes(mode) {
		if (mode === 'pomodoro') return settings.pomodoroMinutes;
		if (mode === 'short') return settings.shortBreakMinutes;
		return settings.longBreakMinutes;
	}
	function clampInt(value, min, max, fallback) {
		if (Number.isFinite(value)) {
			return Math.max(min, Math.min(max, Math.round(value)));
		}
		return fallback;
	}

	/**
	 * Settings persistence
	 */
	function loadSettings() {
		try {
			const raw = localStorage.getItem('pomodoroSettings');
			if (!raw) return { ...defaultSettings };
			const parsed = JSON.parse(raw);
			return { ...defaultSettings, ...parsed };
		} catch (e) {
			return { ...defaultSettings };
		}
	}
	function saveSettings(next) {
		try {
			localStorage.setItem('pomodoroSettings', JSON.stringify(next));
		} catch (e) {
			// ignore
		}
	}
	function updateInputsFromSettings() {
		pomodoroInput.value = String(settings.pomodoroMinutes);
		shortInput.value = String(settings.shortBreakMinutes);
		longInput.value = String(settings.longBreakMinutes);
	}
})();
