"use server";

import { createClient } from "@/utils/supabase/server";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return supabase;
}

export interface TemplateDTO {
  id: string;
  key: string;
  bodyAr: string;
}

export async function getTemplatesServer(): Promise<{ templates: TemplateDTO[] }> {
  const supabase = await verifyAdmin();
  const { data, error } = await supabase.from("message_templates").select("*").order("key");
  
  if (error) throw new Error(error.message);

  const templates = (data || []).map((row) => ({
    id: row.id,
    key: row.key,
    bodyAr: row.body_ar,
  }));

  return { templates };
}

export async function saveTemplateServer(key: string, bodyAr: string) {
  const supabase = await verifyAdmin();
  const { error } = await supabase
    .from("message_templates")
    .update({ body_ar: bodyAr })
    .eq("key", key);
    
  if (error) throw new Error(error.message);
  return { success: true };
}
