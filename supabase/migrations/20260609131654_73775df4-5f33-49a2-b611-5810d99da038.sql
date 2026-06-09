ALTER TABLE public.guest_transactions
  ADD COLUMN IF NOT EXISTS assigned_to TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_guest_transactions_updated_at ON public.guest_transactions;
CREATE TRIGGER update_guest_transactions_updated_at
  BEFORE UPDATE ON public.guest_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();