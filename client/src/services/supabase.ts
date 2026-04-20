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

/**
 * Upload a file to Supabase Storage and return its public URL.
 * Retries once on failure. Falls back to `null` when Supabase is not configured.
 */
export async function uploadToStorage(
  bucket: Bucket,
  file: File,
): Promise<string | null> {
  if (!supabase) return null;

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';

  for (let attempt = 0; attempt < 2; attempt++) {
    const path = `${crypto.randomUUID()}.${ext}`;

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
