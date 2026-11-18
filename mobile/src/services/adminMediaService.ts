import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '../lib/supabase';

function extensionFromUri(uri: string) {
  const clean = uri.split('?')[0]?.toLowerCase() ?? '';
  const match = clean.match(/\.([a-z0-9]+)$/);
  const ext = match?.[1] ?? 'jpg';

  if (ext === 'jpeg') return 'jpg';
  if (['jpg', 'png', 'webp', 'heic', 'heif'].includes(ext)) return ext;
  return 'jpg';
}

function mimeFromExt(ext: string) {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';
  return 'image/jpeg';
}

function safePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
}

export async function uploadAdminImage(params: {
  schoolId: string;
  entity: string;
  localUri: string;
}) {
  const { schoolId, entity, localUri } = params;

  const ext = extensionFromUri(localUri);
  const mime = mimeFromExt(ext);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const path = `${safePart(schoolId)}/${safePart(entity)}/${fileName}`;

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const atobFn = (globalThis as any).atob as (value: string) => string;
  const binary = atobFn(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const { error } = await supabase.storage
    .from('school-media')
    .upload(path, bytes.buffer, {
      contentType: mime,
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from('school-media')
    .getPublicUrl(path);

  if (!data.publicUrl) {
    throw new Error('Unable to resolve uploaded image URL.');
  }

  return {
    url: data.publicUrl,
    path,
    platform: Platform.OS,
  };
}
