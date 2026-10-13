import { request } from '../request';
import type { WorkshopCharacter } from '@/views/sequence-player/workshop/model';
import type { MediaAsset } from '@/views/sequence-player/types/sequence';
async function libraryRequest<T>(options: Parameters<typeof request>[0]) {
  const result = await request<T>({ ...options, responseType: 'json', silentError: true });
  if (result.error) {
    const error = result.error as { response?: { data?: { msg?: string } }; message?: string };
    window.$message?.error(error.response?.data?.msg || error.message || '人物配置操作失败');
  }
  return result;
}
export interface CharacterRecord {
  id: string;
  revision: number;
  character: WorkshopCharacter;
  archived: boolean;
  updatedAt: string;
}
export const fetchCharacterLibrary = () => libraryRequest<CharacterRecord[]>({ url: '/character-library' });
export const saveLibraryCharacter = (character: WorkshopCharacter, record?: Pick<CharacterRecord, 'id' | 'revision'>) =>
  libraryRequest<CharacterRecord>({
    url: record ? `/character-library/${record.id}` : '/character-library',
    method: record ? 'put' : 'post',
    data: { character, revision: record?.revision }
  });
export const archiveLibraryCharacter = (record: CharacterRecord, archived: boolean) =>
  libraryRequest<CharacterRecord>({
    url: `/character-library/${record.id}`,
    method: 'patch',
    data: { archived, revision: record.revision }
  });
export function uploadLibraryPortrait(file: File) {
  const data = new FormData();
  data.append('image', file);
  return libraryRequest<MediaAsset>({ url: '/character-library/assets', method: 'post', data, timeout: 60000 });
}
