# Local Docker Setup

This project runs locally as:

- `app`: the built TanStack Start app and server routes.
- `supabase-db`: local Postgres with the existing `supabase/migrations` applied on first startup.
- `rest`: PostgREST, providing the Supabase-style `/rest/v1` API used by `@supabase/supabase-js`.
- `supabase-gateway`: local HTTP gateway exposed on `http://localhost:54321`.

## Start

1. Keep the existing `.env` if you need it. Docker uses `LOCAL_*` variables so it does not accidentally point at a remote Supabase project.
2. Add `OPENAI_API_KEY` to `.env` if you want `/api/chat` to call OpenAI.
3. Set `OPENAI_MODEL` if you want to use a model other than the default `gpt-5.2`.
4. Run:

```bash
docker compose up --build
```

Open:

- App: `http://localhost:3000`
- Internal portal: `http://localhost:3000/internal`
- Local Supabase REST gateway: `http://localhost:54321/rest/v1`
- Postgres: `localhost:54322`

## Database Resets

Migrations only run when the Postgres volume is created. To reset local data and re-run migrations:

```bash
docker compose down -v
docker compose up --build
```

## Notes

This is a minimal local Supabase-compatible stack. It includes Postgres and PostgREST, which is enough for the current app because server functions use the service-role Supabase client for table operations.

Supabase Auth is intentionally not included yet. The current app does not require sign-in, but `/internal` should be protected before any non-local deployment.
