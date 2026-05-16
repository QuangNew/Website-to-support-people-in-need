import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase env vars missing – storage uploads will fall back to backend.');
}

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

type Bucket = 'avatars' | 'post-images';

const IMAGE_EXTENSIONS_BY_TYPE: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

function getSafeImageExtension(file: File): string | null {
  const allowedExtensions = IMAGE_EXTENSIONS_BY_TYPE[file.type];
  if (!allowedExtensions) return null;

  const suppliedExtension = file.name.split('.').pop()?.toLowerCase();
  if (suppliedExtension && allowedExtensions.includes(suppliedExtension)) {
    return suppliedExtension === 'jpeg' ? 'jpg' : suppliedExtension;
  }

  return allowedExtensions[0];
}

function createRandomObjectPath(file: File): string | null {
  const extension = getSafeImageExtension(file);
  if (!extension) return null;

  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const randomName = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');

  return `${year}/${month}/${day}/${randomName}.${extension}`;
}

/**
 * Upload a file to Supabase Storage and return its public URL.
 * Retries once on failure. Falls back to `null` when Supabase is not configured.
 */
export async function uploadToStorage(
  bucket: Bucket,
  file: File,
): Promise<string | null> {
  if (!supabase) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const path = createRandomObjectPath(file);
    if (!path) return null;

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    }

    console.error(`Supabase upload error (${bucket}), attempt ${attempt + 1}:`, error.message);
  }

  return null;
}

/**
 * Delete a file from Supabase Storage by its public URL.
 * Silently ignores errors (best-effort cleanup).
 */
export async function deleteFromStorage(
  bucket: Bucket,
  publicUrl: string,
): Promise<void> {
  if (!supabase || !publicUrl) return;
  try {
    // Extract path from public URL: .../<bucket>/<path>
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const filePath = publicUrl.slice(idx + marker.length);
    if (!filePath) return;
    await supabase.storage.from(bucket).remove([filePath]);
  } catch {
    // best-effort; don't block the upload flow
  }
}
