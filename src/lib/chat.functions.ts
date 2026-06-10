import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureCoreHotelSchema, postgres } from "@/lib/db/postgres.server";

const RoomSchema = z.object({
  roomNumber: z.string().min(1).max(10).regex(/^[0-9]{2,6}$/),
});

export const getMessagesForRoom = createServerFn({ method: "POST" })
  .validator((data: unknown) => RoomSchema.parse(data))
  .handler(async ({ data }) => {
    await ensureCoreHotelSchema();
    const sql = postgres();
    return sql`
      SELECT id, role, content, created_at
      FROM public.chat_messages
      WHERE room_number = ${data.roomNumber}
      ORDER BY created_at ASC
      LIMIT 200
    `;
  });
