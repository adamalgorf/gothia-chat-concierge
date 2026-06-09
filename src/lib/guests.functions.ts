import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ProfileSchema = z.object({
  room_number: z.string().trim().regex(/^[0-9]{2,6}$/, "Ogiltigt rumsnummer"),
  full_name: z.string().trim().min(2, "Ange för- och efternamn").max(120),
  email: z.string().trim().email("Ogiltig e-postadress").max(255),
  phone: z
    .string()
    .trim()
    .min(6, "Ogiltigt telefonnummer")
    .max(32)
    .regex(/^[0-9+()\-\s]+$/, "Endast siffror och + - ( )"),
  booking_reference: z.string().trim().min(1).max(64).optional().nullable(),
});

export type GuestProfileInput = z.infer<typeof ProfileSchema>;

export type GuestProfile = {
  id: string;
  room_number: string;
  full_name: string;
  email: string;
  phone: string;
  booking_reference: string | null;
  checked_in_at: string;
  checked_out_at: string | null;
};

export const saveGuestProfile = createServerFn({ method: "POST" })
  .validator((data: unknown) => ProfileSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true; id: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Close any previous active stay for the same room (defensive)
    await supabaseAdmin
      .from("guest_profiles")
      .update({ checked_out_at: new Date().toISOString() })
      .eq("room_number", data.room_number)
      .is("checked_out_at", null);

    // Fresh stay = fresh chat. Clear any leftover chat history for this room
    // so a new guest never sees the previous guest's conversation.
    await supabaseAdmin
      .from("chat_messages")
      .delete()
      .eq("room_number", data.room_number);

    const { data: inserted, error } = await supabaseAdmin
      .from("guest_profiles")
      .insert({
        room_number: data.room_number,
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        booking_reference: data.booking_reference ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted.id };
  });

const CheckOutSchema = z.object({
  room_number: z.string().trim().regex(/^[0-9]{2,6}$/),
});

export const checkOutGuest = createServerFn({ method: "POST" })
  .validator((data: unknown) => CheckOutSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("guest_profiles")
      .update({ checked_out_at: new Date().toISOString() })
      .eq("room_number", data.room_number)
      .is("checked_out_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listActiveGuests = createServerFn({ method: "GET" }).handler(
  async (): Promise<GuestProfile[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("guest_profiles")
      .select("id, room_number, full_name, email, phone, booking_reference, checked_in_at, checked_out_at")
      .is("checked_out_at", null)
      .order("checked_in_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as GuestProfile[];
  },
);
