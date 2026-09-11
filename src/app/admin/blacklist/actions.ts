"use server";

import { createClient } from "@/utils/supabase/server";
import { normalizeMaPhone } from "@/lib/phone";
import type { BlacklistEntryDTO } from "@/lib/types";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return supabase;
}

export async function getBlacklistEntriesServer(): Promise<{ entries: BlacklistEntryDTO[] }> {
  const supabase = await verifyAdmin();
  const { data, error } = await supabase
    .from("blacklist")
    .select("*")
    .order("strikes", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const entries = (data || []).map(row => ({
    id: row.id,
    phone: row.phone,
    strikes: row.strikes,
    reasons: row.reasons || [],
    createdAt: row.created_at,
  })) as BlacklistEntryDTO[];

  return { entries };
}

export async function addBlacklistServer(rawPhone: string, reason: string = "يدوي") {
  const supabase = await verifyAdmin();
  const phone = normalizeMaPhone(rawPhone);
  if (!phone) throw new Error("رقم الهاتف غير صالح");

  const { data: existing, error: err } = await supabase
    .from("blacklist")
    .select("*")
    .eq("phone", phone)
    .single();

  let newReasons = [reason];
  let newStrikes = 1;

  if (existing) {
    newReasons = [...(existing.reasons || []), reason];
    newStrikes = existing.strikes + 1;
    const { error } = await supabase
      .from("blacklist")
      .update({ strikes: newStrikes, reasons: newReasons })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("blacklist")
      .insert({ phone, strikes: 1, reasons: newReasons });
    if (error) throw new Error(error.message);
  }

  return { success: true };
}

export async function deleteBlacklistServer(id: string) {
  const supabase = await verifyAdmin();
  const { error } = await supabase.from("blacklist").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}
