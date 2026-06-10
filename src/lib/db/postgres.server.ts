type SqlClient = {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
};

type BunSqlRuntime = {
  Bun?: {
    SQL: new (url: string) => SqlClient;
  };
};

let sqlClient: SqlClient | undefined;
let schemaReady: Promise<void> | undefined;

function databaseUrl(): string {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "postgres://postgres:postgres@supabase-db:5432/postgres";
}

export function postgres(): SqlClient {
  if (sqlClient) return sqlClient;

  const SQL = (globalThis as BunSqlRuntime).Bun?.SQL;
  if (!SQL) {
    throw new Error("Direct Postgres access requires the Bun runtime.");
  }

  sqlClient = new SQL(databaseUrl());
  return sqlClient;
}

export async function ensureCoreHotelSchema(): Promise<void> {
  if (schemaReady) return schemaReady;

  schemaReady = (async () => {
    const sql = postgres();

    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

    await sql`
      CREATE TABLE IF NOT EXISTS public.chat_messages (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        room_number text NOT NULL,
        role text NOT NULL CHECK (role IN ('user','assistant')),
        content text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS chat_messages_room_idx
        ON public.chat_messages(room_number, created_at)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS public.guest_transactions (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        room_number text NOT NULL,
        transaction_type text NOT NULL CHECK (transaction_type IN ('WORK_REQUEST','DEBITERA_MINIBAR','HOTEL_SERVICE')),
        details text NOT NULL,
        items jsonb NOT NULL DEFAULT '[]'::jsonb,
        status text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now(),
        assigned_to text,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    await sql`ALTER TABLE public.guest_transactions ADD COLUMN IF NOT EXISTS assigned_to text`;
    await sql`ALTER TABLE public.guest_transactions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;

    await sql`
      CREATE OR REPLACE FUNCTION public.update_updated_at_column()
      RETURNS trigger AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SET search_path = public
    `;

    await sql`DROP TRIGGER IF EXISTS update_guest_transactions_updated_at ON public.guest_transactions`;
    await sql`
      CREATE TRIGGER update_guest_transactions_updated_at
        BEFORE UPDATE ON public.guest_transactions
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()
    `;

    console.info("[Postgres] Core hotel schema is ready");
  })();

  return schemaReady;
}

