"use server";

import { createClient } from "@/utils/supabase/server";

// Verify admin access
async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return supabase;
}

export async function getBotSettingsServer() {
  const supabase = await verifyAdmin();
  const { data, error } = await supabase
    .from("bot_settings")
    .select("*")
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message);
  }

  return { settings: data || null };
}

export async function saveBotSettingsServer(isActive: boolean, systemPrompt: string) {
  const supabase = await verifyAdmin();
  
  // Try to get existing settings
  const { data: existing } = await supabase
    .from("bot_settings")
    .select("id")
    .limit(1)
    .single();

  let error;
  
  if (existing) {
    // Update
    const res = await supabase
      .from("bot_settings")
      .update({ is_active: isActive, system_prompt: systemPrompt, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    error = res.error;
  } else {
    // Insert
    const res = await supabase
      .from("bot_settings")
      .insert({ is_active: isActive, system_prompt: systemPrompt });
    error = res.error;
  }

  if (error) throw new Error(error.message);
  return { success: true };
}
