import { supabase } from "@/integrations/supabase/client";

const BUCKET = "brand-assets";

export async function uploadBrandFile(
  userId: string,
  brandId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const safe = file.name.replace(/[^a-z0-9.\-_]/gi, "_");
  const path = `${userId}/${brandId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || `application/${ext}`,
  });
  if (error) throw error;
  return path;
}

export async function getSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function getSignedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const row of data) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  }
  return out;
}

export async function removeBrandFiles(paths: string[]) {
  if (paths.length === 0) return;
  await supabase.storage.from(BUCKET).remove(paths);
}

export function fileNameFromPath(path: string): string {
  const parts = path.split("/");
  const last = parts[parts.length - 1] ?? path;
  return last.replace(/^\d+-/, "");
}