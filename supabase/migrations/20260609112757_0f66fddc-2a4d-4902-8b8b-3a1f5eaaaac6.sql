
CREATE TABLE public.guest_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_number text NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('WORK_REQUEST','DEBITERA_MINIBAR','HOTEL_SERVICE')),
  details text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.guest_transactions TO service_role;

ALTER TABLE public.guest_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.guest_transactions
  FOR ALL TO public USING (false) WITH CHECK (false);
