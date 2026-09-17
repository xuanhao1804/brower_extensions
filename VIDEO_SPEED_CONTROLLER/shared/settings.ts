import { storage } from '#imports';

export const MIN_SPEED = 0.25;
export const MAX_SPEED = 16;

export type ShortcutAction = 'decrease' | 'increase' | 'reset';
export type WheelModifier = 'Alt' | 'Control' | 'Shift' | 'Meta' | 'None';

export interface ShortcutBinding {
  code: string;
  alt: boolean;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
}

export interface SpeedSettings {
  defaultSpeed: number;
  speedStep: number;
  presets: number[];
  shortcuts: Record<ShortcutAction, ShortcutBinding>;
  wheelEnabled: boolean;
  wheelModifier: WheelModifier;
  showBadge: boolean;
  badgeOpacity: number;
}

export const DEFAULT_SETTINGS: SpeedSettings = {
  defaultSpeed: 1,
  speedStep: 0.25,
  presets: [0.5, 1, 1.5, 2, 3],
  shortcuts: {
    decrease: {
      code: 'ArrowDown',
      alt: true,
      ctrl: false,
      shift: false,
      meta: false,
    },
    increase: {
      code: 'ArrowUp',
      alt: true,
      ctrl: false,
      shift: false,
      meta: false,
    },
    reset: {
      code: 'Digit0',
      alt: true,
      ctrl: false,
      shift: false,
      meta: false,
    },
  },
  wheelEnabled: true,
  wheelModifier: 'Alt',
  showBadge: true,
  badgeOpacity: 0.58,
};

export const settingsStorage = storage.defineItem<SpeedSettings>(
  'sync:videoSpeedSettings',
  { fallback: DEFAULT_SETTINGS },
);

export function clampSpeed(value: number): number {
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, value));
}

export function normalizeSpeed(value: number): number {
  return Math.round(clampSpeed(value) * 100) / 100;
}

export function sanitizeSettings(value: SpeedSettings): SpeedSettings {
  const defaultSpeed = Number.isFinite(value.defaultSpeed)
    ? normalizeSpeed(value.defaultSpeed)
    : DEFAULT_SETTINGS.defaultSpeed;
  const speedStep = Number.isFinite(value.speedStep)
    ? Math.min(4, Math.max(0.05, value.speedStep))
    : DEFAULT_SETTINGS.speedStep;
  const badgeOpacity = Number.isFinite(value.badgeOpacity)
    ? Math.min(1, Math.max(0.2, value.badgeOpacity))
    : DEFAULT_SETTINGS.badgeOpacity;
  const presets = [...new Set((value.presets ?? []).filter(Number.isFinite).map(normalizeSpeed))]
    .sort((a, b) => a - b)
    .slice(0, 10);

  return {
    ...DEFAULT_SETTINGS,
    ...value,
    defaultSpeed,
    speedStep,
    presets: presets.length > 0 ? presets : DEFAULT_SETTINGS.presets,
    shortcuts: {
      ...DEFAULT_SETTINGS.shortcuts,
      ...value.shortcuts,
    },
    badgeOpacity,
  };
}

export function shortcutFromKeyboardEvent(
  event: Pick<KeyboardEvent, 'code' | 'altKey' | 'ctrlKey' | 'shiftKey' | 'metaKey'>,
): ShortcutBinding {
  return {
    code: event.code,
    alt: event.altKey,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };
}

export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: ShortcutBinding,
): boolean {
  return (
    event.code === shortcut.code &&
    event.altKey === shortcut.alt &&
    event.ctrlKey === shortcut.ctrl &&
    event.shiftKey === shortcut.shift &&
    event.metaKey === shortcut.meta
  );
}

export function formatShortcut(shortcut: ShortcutBinding): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.meta) parts.push('Meta');

  const readableCode = shortcut.code
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace('Arrow', '');
  parts.push(readableCode || 'Chưa đặt');
  return parts.join(' + ');
}
