-- Local PostgREST needs table privileges on the request roles to include
-- relations in its schema cache. RLS still controls row access.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Service role only" ON public.chat_messages;
CREATE POLICY "Service role only" ON public.chat_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role only" ON public.guest_transactions;
CREATE POLICY "Service role only" ON public.guest_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role only" ON public.guest_profiles;
CREATE POLICY "Service role only" ON public.guest_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role only rooms" ON public.rooms;
CREATE POLICY "Service role only rooms" ON public.rooms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role only tmpl" ON public.checklist_templates;
CREATE POLICY "Service role only tmpl" ON public.checklist_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role only chkcomp" ON public.checklist_completions;
CREATE POLICY "Service role only chkcomp" ON public.checklist_completions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

