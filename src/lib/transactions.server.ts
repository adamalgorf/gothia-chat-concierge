import { ensureCoreHotelSchema, postgres } from "@/lib/db/postgres.server";

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

function describeError(error: unknown) {
  if (!error || typeof error !== "object") {
    return { raw: String(error) };
  }

  const record = error as Record<string, unknown>;
  return {
    name: record.name,
    message: record.message,
    code: record.code,
    details: record.details,
    hint: record.hint,
    status: record.status,
    statusCode: record.statusCode,
    propertyNames: Object.getOwnPropertyNames(error),
    json: JSON.stringify(error),
    stringValue: String(error),
  };
}

export async function saveGuestTransaction(input: SaveGuestTransactionInput) {
  console.info("[Transactions] Saving guest transaction", {
    roomNumber: input.roomNumber,
    transactionType: input.transactionType,
    status: input.status ?? "pending",
    detailsPreview: input.details.slice(0, 160),
  });

  await ensureCoreHotelSchema();
  const sql = postgres();

  try {
    const rows = await sql<{ id: string }>`
      INSERT INTO public.guest_transactions (room_number, transaction_type, details, items, status)
      VALUES (
        ${input.roomNumber},
        ${input.transactionType},
        ${input.details},
        ${JSON.stringify(input.items ?? [])}::jsonb,
        ${input.status ?? "pending"}
      )
      RETURNING id
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("Insert returned no transaction id.");

    console.info("[Transactions] Saved guest transaction", {
      id,
      roomNumber: input.roomNumber,
      transactionType: input.transactionType,
    });

    return {
      ok: true as const,
      id,
      transaction_type: input.transactionType,
      details: input.details,
      items: input.items ?? [],
      confirmation: input.confirmation,
    };
  } catch (error) {
    console.error("[Transactions] Failed to save guest transaction", {
      roomNumber: input.roomNumber,
      transactionType: input.transactionType,
      status: input.status ?? "pending",
      error: describeError(error),
    });
    return { ok: false as const, message: "Kunde inte registrera." };
  }
}
