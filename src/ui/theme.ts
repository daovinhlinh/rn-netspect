/**
 * A fixed dark palette of plain literals. Deliberately not wired to any theming
 * library — a debug overlay should look the same in every host app, and depending on
 * the host's theme is what would make this module non-portable.
 */
export const T = {
  bg: '#0B0F14',
  surface: '#141A21',
  surfaceAlt: '#1B232C',
  border: '#27323D',
  text: '#E6EDF3',
  textDim: '#8B98A5',
  accent: '#4C9AFF',
  ok: '#3FB950',
  warn: '#D29922',
  error: '#F85149',
  pending: '#8B98A5',
  bubble: '#1F6FEB',
  overlay: 'rgba(0,0,0,0.6)',

  // JSON syntax, kept in the same GitHub-dark family as the tokens above.
  jsonKey: '#79C0FF',
  jsonString: '#A5D6FF',
  jsonNumber: '#FFA657',
  jsonBool: '#D2A8FF',
  jsonNull: '#8B98A5',
  /** Selected tree row. Readable against `bg` without washing out the text on it. */
  selected: '#13283F',
} as const;

export const S = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const FONT = {
  mono: 'Menlo',
  monoAndroid: 'monospace',
} as const;

/** Status colour by HTTP class, with non-ok outcomes taking precedence. */
export function statusColor(status: number, outcome: string): string {
  if (outcome === 'pending') return T.pending;
  if (outcome !== 'ok') return T.error;
  if (status >= 500) return T.error;
  if (status >= 400) return T.warn;
  if (status >= 200 && status < 300) return T.ok;
  return T.textDim;
}
