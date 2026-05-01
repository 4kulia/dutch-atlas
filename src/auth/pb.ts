import PocketBase from 'pocketbase';

const PB_URL = (import.meta.env.VITE_POCKETBASE_URL || '/pb').replace(/\/+$/, '');

export const pb = new PocketBase(PB_URL);

// Avoid auto-cancelling concurrent reads from different components.
pb.autoCancellation(false);

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export function toAuthUser(record: unknown): AuthUser | null {
  if (!record || typeof record !== 'object') return null;
  const r = record as Record<string, unknown>;
  if (typeof r.id !== 'string') return null;

  const avatarFile = typeof r.avatar === 'string' ? r.avatar : '';
  const fullAvatar = avatarFile
    ? `${PB_URL}/api/files/${r.collectionId}/${r.id}/${avatarFile}`
    : (typeof (r.meta as Record<string, unknown> | undefined)?.avatarUrl === 'string'
        ? ((r.meta as Record<string, string>).avatarUrl)
        : undefined);

  return {
    id: r.id,
    email: typeof r.email === 'string' ? r.email : '',
    name: typeof r.name === 'string' && r.name ? r.name : (typeof r.email === 'string' ? r.email.split('@')[0] : 'User'),
    avatar: fullAvatar,
  };
}
