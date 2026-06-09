import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RoomSchema = z.object({
  roomNumber: z.string().min(1).max(10).regex(/^[0-9]{2,6}$/),
});

export const getMessagesForRoom = createServerFn({ method: "POST" })
  .validator((data: unknown) => RoomSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("room_number", data.roomNumber)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
