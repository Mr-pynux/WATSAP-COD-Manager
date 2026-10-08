"use server";

import { createClient } from "@/utils/supabase/server";
import { normalizeMaPhone } from "@/lib/phone";
import type { ReclamationDTO, ReclamationsResponse, ReclamationStatus } from "@/lib/types";

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return supabase;
}

export async function getReclamationsServer(params?: {
  status?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}): Promise<ReclamationsResponse> {
  const supabase = await verifyAdmin();

  const status = params?.status || "all";
  const query = params?.query?.trim() || "";
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;

  try {
    // 1. Fetch all for counts
    const { data: allData, error: countErr } = await supabase
      .from("reclamations")
      .select("id, status");

    if (countErr) {
      console.warn("reclamations table might not exist yet:", countErr.message);
      return {
        reclamations: [],
        total: 0,
        counts: { total: 0, pending: 0, contacted: 0, resolved: 0 },
      };
    }

    const counts = {
      total: allData?.length || 0,
      pending: allData?.filter((r) => r.status === "pending").length || 0,
      contacted: allData?.filter((r) => r.status === "contacted").length || 0,
      resolved: allData?.filter((r) => r.status === "resolved").length || 0,
    };

    // 2. Build filtered query
    let req = supabase.from("reclamations").select("*", { count: "exact" });

    if (status !== "all") {
      req = req.eq("status", status);
    }

    if (query) {
      req = req.or(`customer_name.ilike.%${query}%,phone.ilike.%${query}%,issue.ilike.%${query}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await req
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error fetching reclamations:", error);
      throw new Error(error.message);
    }

    const reclamations: ReclamationDTO[] = (data || []).map((row) => ({
      id: row.id,
      customerName: row.customer_name || "زبون",
      phone: row.phone || "",
      orderId: row.order_id || null,
      type: row.type || "other",
      issue: row.issue || "",
      status: (row.status || "pending") as ReclamationStatus,
      adminNotes: row.admin_notes || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return {
      reclamations,
      total: count || 0,
      counts,
    };
  } catch (err: any) {
    console.warn("Exception in getReclamationsServer:", err.message);
    return {
      reclamations: [],
      total: 0,
      counts: { total: 0, pending: 0, contacted: 0, resolved: 0 },
    };
  }
}

export async function updateReclamationStatusServer(
  id: string,
  status: ReclamationStatus,
  adminNotes?: string
) {
  const supabase = await verifyAdmin();

  const updatePayload: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (adminNotes !== undefined) {
    updatePayload.admin_notes = adminNotes;
  }

  const { error } = await supabase
    .from("reclamations")
    .update(updatePayload)
    .eq("id", id);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function deleteReclamationServer(id: string) {
  const supabase = await verifyAdmin();
  const { error } = await supabase.from("reclamations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function createManualReclamationServer({
  customerName,
  phone,
  type,
  issue,
  adminNotes,
}: {
  customerName: string;
  phone: string;
  type: string;
  issue: string;
  adminNotes?: string;
}) {
  const supabase = await verifyAdmin();
  const cleanPhone = normalizeMaPhone(phone) || phone.trim();

  const { data, error } = await supabase
    .from("reclamations")
    .insert({
      customer_name: customerName.trim(),
      phone: cleanPhone,
      type,
      issue: issue.trim(),
      status: "pending",
      admin_notes: adminNotes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id };
}
