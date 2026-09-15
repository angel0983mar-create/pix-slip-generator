CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  barcode TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'un',
  category TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX products_user_barcode_key ON public.products (user_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX products_user_name_idx ON public.products (user_id, name);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_own_select ON public.products FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY products_own_insert ON public.products FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY products_own_update ON public.products FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY products_own_delete ON public.products FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER products_touch_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();