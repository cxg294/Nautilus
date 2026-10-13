import type { CharacterRecord } from '@/service/api/character-library';
import type { WorkshopState } from '../sequence-player/workshop/model';

/** Copy a library version into a project. No shared mutable objects or live links. */
export function adoptCharacter(state: WorkshopState, record: CharacterRecord, targetId?: string) {
  const snapshot = JSON.parse(JSON.stringify(record.character));
  const target = state.characters.find(c => c.id === targetId);
  snapshot.id = target?.id || `role-${crypto.randomUUID()}`;
  snapshot.libraryRef = { id: record.id, revision: record.revision };
  if (target) {
    for (const line of state.segments.filter(s => s.characterId === target.id)) {
      if (line.portraitId === 'auto') continue;
      const oldPose = target.poses.find(p => p.id === line.portraitId);
      line.portraitId =
        snapshot.poses.find((p: { id: string; name: string }) => p.id === line.portraitId)?.id ||
        snapshot.poses.find((p: { name: string }) => p.name === oldPose?.name)?.id ||
        'auto';
    }
    Object.assign(target, snapshot);
    return target;
  }
  state.characters.push(snapshot);
  return snapshot;
}
