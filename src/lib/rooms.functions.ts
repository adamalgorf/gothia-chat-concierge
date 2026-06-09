import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const ROOM_STATUSES = [
  "vacant_clean",
  "vacant_dirty",
  "cleaning",
  "inspected",
  "occupied",
  "out_of_order",
] as const;

export type RoomStatus = (typeof ROOM_STATUSES)[number];

export type Room = {
  room_number: string;
  floor: number | null;
  status: RoomStatus;
  assigned_cleaner: string | null;
  notes: string | null;
  last_cleaned_at: string | null;
  updated_at: string;
};

export const listRooms = createServerFn({ method: "GET" }).handler(async (): Promise<Room[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("rooms")
    .select("room_number, floor, status, assigned_cleaner, notes, last_cleaned_at, updated_at")
    .order("room_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Room[];
});

const UpdateRoomSchema = z.object({
  room_number: z.string().min(1).max(10),
  status: z.enum(ROOM_STATUSES).optional(),
  assigned_cleaner: z.string().min(1).max(50).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const updateRoom = createServerFn({ method: "POST" })
  .validator((d: unknown) => UpdateRoomSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      status?: string;
      assigned_cleaner?: string | null;
      notes?: string | null;
      last_cleaned_at?: string;
    } = {};
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.status === "vacant_clean" || data.status === "inspected") {
        patch.last_cleaned_at = new Date().toISOString();
      }
    }
    if (data.assigned_cleaner !== undefined) patch.assigned_cleaner = data.assigned_cleaner;
    if (data.notes !== undefined) patch.notes = data.notes;
    const { error } = await supabaseAdmin.from("rooms").update(patch).eq("room_number", data.room_number);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
