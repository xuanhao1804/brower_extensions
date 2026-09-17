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
const currentSpeed = requireElement<HTMLOutputElement>('current-speed');
const presetButtons = requireElement<HTMLDivElement>('preset-buttons');
const status = requireElement<HTMLParagraphElement>('status');
const resetButton = requireElement<HTMLButtonElement>('reset-settings');

let settings = sanitizeSettings(await settingsStorage.getValue());
let captureAction: ShortcutAction | null = null;

renderSettings();
void refreshCurrentSpeed();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  settings = readSettings();
  await settingsStorage.setValue(settings);
  renderSettings();
  showStatus('Đã lưu cài đặt.');
});

resetButton.addEventListener('click', async () => {
  settings = structuredClone(DEFAULT_SETTINGS);
  await settingsStorage.setValue(settings);
  renderSettings();
  showStatus('Đã khôi phục cài đặt mặc định.');
});

badgeOpacityInput.addEventListener('input', updateOpacityLabel);

document.querySelectorAll<HTMLButtonElement>('.shortcut').forEach((button) => {
  button.addEventListener('click', () => {
    captureAction = button.dataset.action as ShortcutAction;
    button.classList.add('capturing');
    button.textContent = 'Nhấn phím…';
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
    button.textContent = `${formatSpeed(speed)}×`;
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
    showStatus(response?.error ?? 'Hãy mở một trang có video rồi thử lại.', true);
    return;
  }
  currentSpeed.value = `${formatSpeed(response.speed)}×`;
  showStatus(`Đã đặt tốc độ ${formatSpeed(response.speed)}×.`);
}

async function refreshCurrentSpeed(): Promise<void> {
  const response = await sendToActiveTab({ type: 'GET_VIDEO_SPEED' });
  currentSpeed.value = response?.ok && response.speed !== undefined
    ? `${formatSpeed(response.speed)}×`
    : '—';
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
  if (!element) throw new Error(`Thiếu element #${id}`);
  return element as T;
}

function formatSpeed(speed: number): string {
  return speed.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
