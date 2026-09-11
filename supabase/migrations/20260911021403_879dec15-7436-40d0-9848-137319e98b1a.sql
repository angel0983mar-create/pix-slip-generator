CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL DEFAULT 'Minha loja',
  merchant_name TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'SAO PAULO',
  phone TEXT,
  document TEXT,
  pix_key TEXT,
  pix_key_type TEXT NOT NULL DEFAULT 'aleatoria',
  print_layout TEXT NOT NULL DEFAULT 'a4',
  receipt_footer TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  open_order_limit INT NOT NULL DEFAULT 15,
  next_order_number INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_own_select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_own_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_own_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number INT NOT NULL DEFAULT 0,
  customer_name TEXT NOT NULL DEFAULT 'Cliente',
  customer_contact TEXT,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberto',
  payment_method TEXT NOT NULL DEFAULT 'pix',
  pix_payload TEXT,
  notes TEXT,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX orders_user_status_idx ON public.orders (user_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_own_select" ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "orders_own_insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "orders_own_update" ON public.orders FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "orders_own_delete" ON public.orders FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, store_name, merchant_name)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'Minha loja'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.orders_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT;
  v_open INT;
  v_next INT;
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.user_id) ON CONFLICT (id) DO NOTHING;

  SELECT open_order_limit INTO v_limit FROM public.profiles WHERE id = NEW.user_id;

  IF NEW.status = 'aberto' THEN
    SELECT count(*) INTO v_open FROM public.orders WHERE user_id = NEW.user_id AND status = 'aberto';
    IF v_open >= COALESCE(v_limit, 15) THEN
      RAISE EXCEPTION 'LIMITE_PEDIDOS_ABERTOS: seu plano permite % pedidos em aberto. Finalize ou cancele algum pedido para criar outro.', COALESCE(v_limit, 15);
    END IF;
  END IF;

  UPDATE public.profiles
     SET next_order_number = next_order_number + 1
   WHERE id = NEW.user_id
  RETURNING next_order_number - 1 INTO v_next;

  NEW.order_number = COALESCE(v_next, 1);

  IF NEW.status = 'pago' AND NEW.paid_at IS NULL THEN
    NEW.paid_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_before_insert_trg BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_before_insert();

CREATE OR REPLACE FUNCTION public.orders_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pago' AND NEW.paid_at IS NULL THEN
    NEW.paid_at = now();
  END IF;
  IF NEW.status <> 'pago' THEN
    NEW.paid_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_before_update_trg BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_before_update();