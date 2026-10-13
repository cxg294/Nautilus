import catalog from '../../shared/voice-catalog.json' with { type: 'json' };

const byId = new Map(catalog.voices.map(voice => [voice.voice, voice]));
export function getCatalogVoice(id) { return byId.get(id); }
export function listCatalogVoices() {
  return catalog.voices.map(voice => ({ ...voice, id: voice.voice, status: 'OK',
    createdAt: '', updatedAt: '', isSystemDefault: true, readOnly: true,
    voicePrompt: [voice.gender, voice.description, voice.scene, voice.language].filter(Boolean).join(' · ') }));
}

export function requireCustomVoice(id) {
  if (getCatalogVoice(id)) throw new Error('现成音色不支持改名或删除');
}
