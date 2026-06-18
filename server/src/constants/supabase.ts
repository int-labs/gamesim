import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL      = process.env.SUPABASE_URL      as string;
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_KEY as string;
const SUPABASE_BUCKET   = "imageAsset";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase environment variables.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const uploadImage = async (
  file: Buffer,
  filename: string
): Promise<string> => {
  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(filename, file, { contentType: "image/*", upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(filename);

  return data.publicUrl;
};

export const deleteImage = async (image_id: string): Promise<void> => {
  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .remove([image_id]);

  if (error) throw new Error(`Delete failed: ${error.message}`);
};