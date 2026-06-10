type JsonRecord = Record<string, unknown>;

export type TransactionType = "WORK_REQUEST" | "DEBITERA_MINIBAR" | "HOTEL_SERVICE";

export interface SaveGuestTransactionInput {
  roomNumber: string;
  transactionType: TransactionType;
  details: string;
  items?: JsonRecord[];
  status?: string;
  confirmation: string;
}

export async function saveGuestTransaction(input: SaveGuestTransactionInput) {
  console.info("[Transactions] Saving guest transaction", {
    roomNumber: input.roomNumber,
    transactionType: input.transactionType,
    status: input.status ?? "pending",
    detailsPreview: input.details.slice(0, 160),
  });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("guest_transactions")
    .insert({
      room_number: input.roomNumber,
      transaction_type: input.transactionType,
      details: input.details,
      items: (input.items ?? []) as unknown as never,
      status: input.status ?? "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[Transactions] Failed to save guest transaction", {
      roomNumber: input.roomNumber,
      transactionType: input.transactionType,
      status: input.status ?? "pending",
      errorMessage: error.message,
      errorCode: error.code,
      errorDetails: error.details,
      errorHint: error.hint,
    });
    return { ok: false as const, message: "Kunde inte registrera." };
  }

  console.info("[Transactions] Saved guest transaction", {
    id: data.id,
    roomNumber: input.roomNumber,
    transactionType: input.transactionType,
  });

  return {
    ok: true as const,
    id: data.id,
    transaction_type: input.transactionType,
    details: input.details,
    items: input.items ?? [],
    confirmation: input.confirmation,
  };
}
