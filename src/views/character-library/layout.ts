import type { CharacterPosition, PortraitLayout } from '../sequence-player/types/sequence';

export function normalizeLayout(value: unknown): PortraitLayout | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as PortraitLayout;
  if (![v.x, v.y, v.height].every(n => typeof n === 'number' && Number.isFinite(n))) return undefined;
  return {
    x: Math.round(Math.max(-50, Math.min(150, v.x)) * 10) / 10,
    y: Math.round(Math.max(-50, Math.min(150, v.y)) * 10) / 10,
    height: Math.round(Math.max(5, Math.min(160, v.height)) * 10) / 10
  };
}
export function legacyLayout(position?: CharacterPosition, aspect = 1): PortraitLayout {
  return {
    x: position === 'left' ? 21 : position === 'center' ? 50 : 79,
    y: 96,
    height: Math.min(66, (32 * 16) / 9 / aspect)
  };
}
export function portraitStyle(layout: PortraitLayout) {
  return {
    left: `${layout.x}%`,
    top: `${layout.y}%`,
    height: `${layout.height}%`,
    transform: 'translate(-50%, -100%)'
  };
}
