export type SpeechControl = { kind: 'pause'; after: string; occurrence: number; timeMs: number } | { kind: 'reading'; text: string; alias: string };
export function normalizeSpeechControls(value: unknown): SpeechControl[];
export function compileSpeech(text: string, controls?: unknown): { text: string; displayText: string; spokenText: string; characterMap: { begin: number; end: number }[]; controls: SpeechControl[]; enabled: boolean };
