import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureCoreHotelSchema, postgres } from "@/lib/db/postgres.server";

const STAFF = ["Anna", "Erik", "Sara", "Johan", "Maja"] as const;

export const STAFF_MEMBERS = STAFF;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export type Ticket = {
  id: string;
  room_number: string;
  transaction_type: string;
  details: string;
  items: JsonValue;
  status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

export const listTickets = createServerFn({ method: "GET" }).handler(async (): Promise<Ticket[]> => {
  await ensureCoreHotelSchema();
  const sql = postgres();
  const rows = await sql<Ticket>`
    SELECT id, room_number, transaction_type, details, items, status, assigned_to, created_at, updated_at
    FROM public.guest_transactions
    ORDER BY created_at DESC
    LIMIT 200
  `;
  return rows.map((r) => ({
    id: r.id,
    room_number: r.room_number,
    transaction_type: r.transaction_type,
    details: r.details,
    items: (r.items ?? null) as JsonValue,
    status: r.status,
    assigned_to: r.assigned_to,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
});


const UpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "done", "kitchen_received", "confirmed_booking"]).optional(),
  assigned_to: z.string().min(1).max(50).nullable().optional(),
});

export const updateTicket = createServerFn({ method: "POST" })
  .validator((data: unknown) => UpdateSchema.parse(data))
  .handler(async ({ data }) => {
    await ensureCoreHotelSchema();
    const sql = postgres();
    await sql`
      UPDATE public.guest_transactions
      SET
        status = COALESCE(${data.status ?? null}, status),
        assigned_to = COALESCE(${data.assigned_to ?? null}, assigned_to)
      WHERE id = ${data.id}
    `;
    return { ok: true };
  });
