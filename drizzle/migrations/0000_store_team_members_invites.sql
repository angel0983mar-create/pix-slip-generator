-- Equipe da loja: funcionários com acesso ao PDV e/ou estoque
CREATE TABLE public.store_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_email text,
  role text NOT NULL DEFAULT 'pdv' CHECK (role IN ('pdv','estoque','completo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, member_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_members TO authenticated;
GRANT ALL ON public.store_members TO service_role;
ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY store_members_owner_all ON public.store_members
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY store_members_self_select ON public.store_members
  FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY store_members_self_delete ON public.store_members
  FOR DELETE TO authenticated USING (member_id = auth.uid());

-- Links de convite gerados pelo administrador
CREATE TABLE public.store_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  role text NOT NULL DEFAULT 'pdv' CHECK (role IN ('pdv','estoque','completo')),
  label text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  revoked boolean NOT NULL DEFAULT false,
  uses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_invites TO authenticated;
GRANT ALL ON public.store_invites TO service_role;
ALTER TABLE public.store_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY store_invites_owner_all ON public.store_invites
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Helper interno (schema privado, fora da API)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_store_member(_owner uuid, _member uuid, _roles text[] DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_members m
    WHERE m.owner_id = _owner
      AND m.member_id = _member
      AND (_roles IS NULL OR m.role = 'completo' OR m.role = ANY(_roles))
  )
$$;
GRANT EXECUTE ON FUNCTION private.is_store_member(uuid, uuid, text[]) TO authenticated;

-- Loja em que o usuário opera (própria ou do patrão)
CREATE OR REPLACE FUNCTION public.my_store()
RETURNS TABLE (owner_id uuid, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.owner_id, m.role
  FROM public.store_members m
  WHERE m.member_id = auth.uid()
  ORDER BY m.created_at
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.my_store() TO authenticated;

-- Aceitar convite pelo link
CREATE OR REPLACE FUNCTION public.accept_store_invite(_token text)
RETURNS TABLE (owner_id uuid, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.store_invites;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'SESSAO_NECESSARIA';
  END IF;

  SELECT * INTO inv FROM public.store_invites
  WHERE token = _token AND revoked = false AND expires_at > now();

  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'CONVITE_INVALIDO';
  END IF;

  IF inv.owner_id = uid THEN
    RAISE EXCEPTION 'CONVITE_PROPRIO';
  END IF;

  INSERT INTO public.store_members (owner_id, member_id, member_email, role)
  VALUES (inv.owner_id, uid, (SELECT email FROM auth.users WHERE id = uid), inv.role)
  ON CONFLICT (owner_id, member_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.store_invites SET uses = uses + 1 WHERE id = inv.id;

  RETURN QUERY SELECT inv.owner_id, inv.role;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_store_invite(text) TO authenticated;

-- Dados do convite para a tela de aceite (sem exigir login)
CREATE OR REPLACE FUNCTION public.store_invite_info(_token text)
RETURNS TABLE (store_name text, role text, valid boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p.store_name, 'Loja'), i.role, (i.revoked = false AND i.expires_at > now())
  FROM public.store_invites i
  LEFT JOIN public.profiles p ON p.id = i.owner_id
  WHERE i.token = _token
$$;
GRANT EXECUTE ON FUNCTION public.store_invite_info(text) TO anon, authenticated;

-- Acesso compartilhado: pedidos
DROP POLICY IF EXISTS orders_own_select ON public.orders;
DROP POLICY IF EXISTS orders_own_insert ON public.orders;
DROP POLICY IF EXISTS orders_own_update ON public.orders;

CREATE POLICY orders_store_select ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_store_member(user_id, auth.uid()));
CREATE POLICY orders_store_insert ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR private.is_store_member(user_id, auth.uid(), ARRAY['pdv']));
CREATE POLICY orders_store_update ON public.orders
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR private.is_store_member(user_id, auth.uid(), ARRAY['pdv']))
  WITH CHECK (user_id = auth.uid() OR private.is_store_member(user_id, auth.uid(), ARRAY['pdv']));

-- Acesso compartilhado: produtos
DROP POLICY IF EXISTS products_own_select ON public.products;
DROP POLICY IF EXISTS products_own_insert ON public.products;
DROP POLICY IF EXISTS products_own_update ON public.products;
DROP POLICY IF EXISTS products_own_delete ON public.products;

CREATE POLICY products_store_select ON public.products
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_store_member(user_id, auth.uid()));
CREATE POLICY products_store_insert ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR private.is_store_member(user_id, auth.uid(), ARRAY['estoque']));
CREATE POLICY products_store_update ON public.products
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR private.is_store_member(user_id, auth.uid(), ARRAY['estoque']))
  WITH CHECK (user_id = auth.uid() OR private.is_store_member(user_id, auth.uid(), ARRAY['estoque']));
CREATE POLICY products_store_delete ON public.products
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.is_store_member(user_id, auth.uid(), ARRAY['estoque']));

-- Funcionário pode ler o perfil da loja (nome, chave Pix, layout de impressão)
DROP POLICY IF EXISTS profiles_own_select ON public.profiles;
CREATE POLICY profiles_store_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.is_store_member(id, auth.uid()));
