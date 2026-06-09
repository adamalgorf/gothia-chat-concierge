
-- Housekeeping rooms registry
CREATE TABLE public.rooms (
  room_number text PRIMARY KEY,
  floor integer,
  status text NOT NULL DEFAULT 'vacant_clean',
  assigned_cleaner text,
  notes text,
  last_cleaned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only rooms" ON public.rooms FOR ALL USING (false) WITH CHECK (false);
CREATE TRIGGER trg_rooms_updated BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed a handful of rooms across 3 floors (101-110, 201-210, 301-310)
INSERT INTO public.rooms (room_number, floor, status) VALUES
('101',1,'vacant_dirty'),('102',1,'occupied'),('103',1,'vacant_clean'),('104',1,'cleaning'),('105',1,'vacant_dirty'),
('106',1,'occupied'),('107',1,'inspected'),('108',1,'vacant_clean'),('109',1,'out_of_order'),('110',1,'occupied'),
('201',2,'occupied'),('202',2,'vacant_dirty'),('203',2,'cleaning'),('204',2,'vacant_clean'),('205',2,'occupied'),
('206',2,'occupied'),('207',2,'vacant_dirty'),('208',2,'inspected'),('209',2,'vacant_clean'),('210',2,'occupied'),
('301',3,'vacant_clean'),('302',3,'occupied'),('303',3,'vacant_dirty'),('304',3,'occupied'),('305',3,'cleaning'),
('306',3,'vacant_clean'),('307',3,'occupied'),('308',3,'vacant_dirty'),('309',3,'occupied'),('310',3,'inspected');

-- Staff checklist templates
CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  role text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_templates TO authenticated;
GRANT ALL ON public.checklist_templates TO service_role;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only tmpl" ON public.checklist_templates FOR ALL USING (false) WITH CHECK (false);

-- Daily completions
CREATE TABLE public.checklist_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT CURRENT_DATE,
  item_index integer NOT NULL,
  checked_by text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, day, item_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_completions TO authenticated;
GRANT ALL ON public.checklist_completions TO service_role;
ALTER TABLE public.checklist_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only chkcomp" ON public.checklist_completions FOR ALL USING (false) WITH CHECK (false);

INSERT INTO public.checklist_templates (title, role, items) VALUES
('Morgonrutin Housekeeping','housekeeping','["Hämta vagn och linne","Kontrollera dagens utcheckningar","Synka med Floor Manager","Kontrollera städkemikalier","Rapportera skador omedelbart"]'::jsonb),
('Kvällsrutin Reception','reception','["Stäm av kassa","Kontrollera ankommande sena gäster","Lås in värdesaker","Skicka skiftrapport","Avstämning av minibar-debiteringar"]'::jsonb),
('Säkerhetsrond','security','["Kontrollera nödutgångar","Testa brandlarm-panel","Inspektera lobby & garage","Logga incidenter","Lämna över till nästa skift"]'::jsonb);
