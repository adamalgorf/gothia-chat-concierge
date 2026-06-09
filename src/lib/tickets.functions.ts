import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const STAFF = ["Anna", "Erik", "Sara", "Johan", "Maja"] as const;

export const STAFF_MEMBERS = STAFF;

export type Ticket = {
  id: string;
  room_number: string;
  transaction_type: string;
  details: string;
  items: unknown;
  status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

export const listTickets = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("guest_transactions")
    .select("id, room_number, transaction_type, details, items, status, assigned_to, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as Ticket[];
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "done", "kitchen_received", "confirmed_booking"]).optional(),
  assigned_to: z.string().min(1).max(50).nullable().optional(),
});

export const updateTicket = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => UpdateSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.assigned_to !== undefined) patch.assigned_to = data.assigned_to;
    const { error } = await supabaseAdmin
      .from("guest_transactions")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
