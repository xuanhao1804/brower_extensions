import './style.css';
import type { ContentMessage, VideoSpeedResponse } from '../../shared/messages';
import {
  DEFAULT_SETTINGS,
  type ShortcutAction,
  type ShortcutBinding,
  type SpeedSettings,
  type WheelModifier,
  formatShortcut,
  sanitizeSettings,
  settingsStorage,
  shortcutFromKeyboardEvent,
} from '../../shared/settings';

const form = requireElement<HTMLFormElement>('settings-form');
const defaultSpeedInput = requireElement<HTMLInputElement>('default-speed');
const speedStepInput = requireElement<HTMLInputElement>('speed-step');
const presetsInput = requireElement<HTMLInputElement>('presets');
const wheelEnabledInput = requireElement<HTMLInputElement>('wheel-enabled');
const wheelModifierInput = requireElement<HTMLSelectElement>('wheel-modifier');
const showBadgeInput = requireElement<HTMLInputElement>('show-badge');
const badgeOpacityInput = requireElement<HTMLInputElement>('badge-opacity');
const opacityValue = requireElement<HTMLOutputElement>('opacity-value');
const presetButtons = requireElement<HTMLDivElement>('preset-buttons');
const status = requireElement<HTMLParagraphElement>('status');
const resetButton = requireElement<HTMLButtonElement>('reset-settings');

let settings = sanitizeSettings(await settingsStorage.getValue());
let captureAction: ShortcutAction | null = null;
let activeSpeed: number | null = null;

renderSettings();
void refreshCurrentSpeed();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  settings = readSettings();
  await settingsStorage.setValue(settings);
  renderSettings();
  showStatus('Changes saved.');
});

resetButton.addEventListener('click', async () => {
  settings = structuredClone(DEFAULT_SETTINGS);
  await settingsStorage.setValue(settings);
  renderSettings();
  showStatus('Defaults restored.');
});

badgeOpacityInput.addEventListener('input', updateOpacityLabel);

document.querySelectorAll<HTMLButtonElement>('.shortcut').forEach((button) => {
  button.addEventListener('click', () => {
    captureAction = button.dataset.action as ShortcutAction;
    button.classList.add('capturing');
    button.textContent = 'Press keys…';
    button.focus();
  });

  button.addEventListener('keydown', (event) => {
    if (!captureAction || event.key === 'Tab') return;
    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Escape') {
      captureAction = null;
      renderShortcuts();
      return;
    }
    if (['Alt', 'Control', 'Shift', 'Meta'].includes(event.key)) return;

    const binding = shortcutFromKeyboardEvent(event);
    settings = {
      ...settings,
      shortcuts: { ...settings.shortcuts, [captureAction]: binding },
    };
    captureAction = null;
    renderShortcuts();
  });
});

function renderSettings(): void {
  defaultSpeedInput.value = String(settings.defaultSpeed);
  speedStepInput.value = String(settings.speedStep);
  presetsInput.value = settings.presets.join(', ');
  wheelEnabledInput.checked = settings.wheelEnabled;
  wheelModifierInput.value = settings.wheelModifier;
  showBadgeInput.checked = settings.showBadge;
  badgeOpacityInput.value = String(settings.badgeOpacity);
  updateOpacityLabel();
  renderShortcuts();
  renderPresets();
}

function renderShortcuts(): void {
  document.querySelectorAll<HTMLButtonElement>('.shortcut').forEach((button) => {
    const action = button.dataset.action as ShortcutAction;
    button.classList.remove('capturing');
    button.textContent = formatShortcut(settings.shortcuts[action]);
  });
}

function renderPresets(): void {
  presetButtons.replaceChildren();
  for (const speed of settings.presets) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.speed = String(speed);
    button.textContent = `x${formatSpeed(speed)}`;
    button.classList.toggle('active', isSameSpeed(speed, activeSpeed));
    button.addEventListener('click', () => void applySpeed(speed));
    presetButtons.append(button);
  }
}

function readSettings(): SpeedSettings {
  const parsedPresets = presetsInput.value
    .split(',')
    .map((value) => Number.parseFloat(value.trim()))
    .filter(Number.isFinite);

  return sanitizeSettings({
    ...settings,
    defaultSpeed: Number.parseFloat(defaultSpeedInput.value),
    speedStep: Number.parseFloat(speedStepInput.value),
    presets: parsedPresets,
    wheelEnabled: wheelEnabledInput.checked,
    wheelModifier: wheelModifierInput.value as WheelModifier,
    showBadge: showBadgeInput.checked,
    badgeOpacity: Number.parseFloat(badgeOpacityInput.value),
  });
}

async function applySpeed(speed: number): Promise<void> {
  const response = await sendToActiveTab({ type: 'SET_VIDEO_SPEED', speed });
  if (!response?.ok || response.speed === undefined) {
    showStatus(response?.error ?? 'Open a page with an active video.', true);
    return;
  }
  setCurrentSpeed(response.speed);
  showStatus(`Speed set to x${formatSpeed(response.speed)}.`);
}

async function refreshCurrentSpeed(): Promise<void> {
  const response = await sendToActiveTab({ type: 'GET_VIDEO_SPEED' });
  setCurrentSpeed(response?.ok && response.speed !== undefined ? response.speed : null);
}

function setCurrentSpeed(speed: number | null): void {
  activeSpeed = speed;
  presetButtons.querySelectorAll<HTMLButtonElement>('button[data-speed]').forEach((button) => {
    const presetSpeed = Number.parseFloat(button.dataset.speed ?? '');
    button.classList.toggle('active', isSameSpeed(presetSpeed, speed));
  });
}

function isSameSpeed(left: number, right: number | null): boolean {
  return right !== null && Math.abs(left - right) < 0.001;
}

async function sendToActiveTab(
  message: ContentMessage,
): Promise<VideoSpeedResponse | null> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    return await browser.tabs.sendMessage(tab.id, message);
  } catch {
    return null;
  }
}

function updateOpacityLabel(): void {
  opacityValue.value = `${Math.round(Number(badgeOpacityInput.value) * 100)}%`;
}

function showStatus(message: string, isError = false): void {
  status.textContent = message;
  status.classList.toggle('error', isError);
  window.setTimeout(() => {
    if (status.textContent === message) status.textContent = '';
  }, 2600);
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

function formatSpeed(speed: number): string {
  return speed.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
