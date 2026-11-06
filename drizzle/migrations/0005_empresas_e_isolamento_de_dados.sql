-- Empresas (cada cliente compra um acesso; dados ficam separados por empresa)
CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos leem empresas" ON public.empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin gerencia empresas" ON public.empresas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Vínculo usuário -> empresa (um usuário pertence a uma empresa)
CREATE TABLE public.empresa_usuarios (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.empresa_usuarios TO authenticated;
GRANT ALL ON public.empresa_usuarios TO service_role;
ALTER TABLE public.empresa_usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario le proprio vinculo" ON public.empresa_usuarios FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Empresa do usuário logado
CREATE OR REPLACE FUNCTION public.minha_empresa()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.empresa_usuarios WHERE user_id = auth.uid()
$$;

-- Empresa da qual o usuário logado é administrador (NULL = super-admin, vê tudo)
CREATE OR REPLACE FUNCTION public.admin_minha_empresa()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN public.has_role(auth.uid(), 'admin')
    THEN (SELECT empresa_id FROM public.empresa_usuarios WHERE user_id = auth.uid())
    ELSE NULL END
$$;

-- Empresa inicial recebe todos os dados já existentes
INSERT INTO public.empresas (id, nome) VALUES ('a0000000-0000-0000-0000-000000000001', 'RJ Madeiras');

ALTER TABLE public.arvores ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.toras ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.romaneios ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.autex ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.patios ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.veiculos ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.motoristas ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);

UPDATE public.arvores SET empresa_id = 'a0000000-0000-0000-0000-000000000001';
UPDATE public.toras SET empresa_id = 'a0000000-0000-0000-0000-000000000001';
UPDATE public.romaneios SET empresa_id = 'a0000000-0000-0000-0000-000000000001';
UPDATE public.autex SET empresa_id = 'a0000000-0000-0000-0000-000000000001';
UPDATE public.patios SET empresa_id = 'a0000000-0000-0000-0000-000000000001';
UPDATE public.veiculos SET empresa_id = 'a0000000-0000-0000-0000-000000000001';
UPDATE public.motoristas SET empresa_id = 'a0000000-0000-0000-0000-000000000001';

-- Preenche empresa_id automaticamente em todo lançamento novo
CREATE OR REPLACE FUNCTION public.definir_empresa_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := public.minha_empresa();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_empresa_arvores BEFORE INSERT ON public.arvores FOR EACH ROW EXECUTE FUNCTION public.definir_empresa_id();
CREATE TRIGGER trg_empresa_toras BEFORE INSERT ON public.toras FOR EACH ROW EXECUTE FUNCTION public.definir_empresa_id();
CREATE TRIGGER trg_empresa_romaneios BEFORE INSERT ON public.romaneios FOR EACH ROW EXECUTE FUNCTION public.definir_empresa_id();
CREATE TRIGGER trg_empresa_autex BEFORE INSERT ON public.autex FOR EACH ROW EXECUTE FUNCTION public.definir_empresa_id();
CREATE TRIGGER trg_empresa_patios BEFORE INSERT ON public.patios FOR EACH ROW EXECUTE FUNCTION public.definir_empresa_id();
CREATE TRIGGER trg_empresa_veiculos BEFORE INSERT ON public.veiculos FOR EACH ROW EXECUTE FUNCTION public.definir_empresa_id();
CREATE TRIGGER trg_empresa_motoristas BEFORE INSERT ON public.motoristas FOR EACH ROW EXECUTE FUNCTION public.definir_empresa_id();

-- Policies por empresa: cada usuário só vê e altera os dados da própria empresa
DROP POLICY "equipe le arvores" ON public.arvores;
DROP POLICY "equipe arvores" ON public.arvores;
DROP POLICY "admin escreve arvores" ON public.arvores;
CREATE POLICY "empresa arvores" ON public.arvores FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa()) WITH CHECK (empresa_id = public.minha_empresa());

DROP POLICY "equipe le toras" ON public.toras;
DROP POLICY "equipe toras" ON public.toras;
DROP POLICY "admin escreve toras" ON public.toras;
CREATE POLICY "empresa toras" ON public.toras FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa()) WITH CHECK (empresa_id = public.minha_empresa());

DROP POLICY "equipe romaneios" ON public.romaneios;
CREATE POLICY "empresa romaneios" ON public.romaneios FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa()) WITH CHECK (empresa_id = public.minha_empresa());

DROP POLICY "Equipe acessa AUTEX" ON public.autex;
CREATE POLICY "empresa autex" ON public.autex FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa()) WITH CHECK (empresa_id = public.minha_empresa());

DROP POLICY "equipe" ON public.patios;
CREATE POLICY "empresa patios" ON public.patios FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa()) WITH CHECK (empresa_id = public.minha_empresa());

DROP POLICY "equipe" ON public.veiculos;
CREATE POLICY "empresa veiculos" ON public.veiculos FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa()) WITH CHECK (empresa_id = public.minha_empresa());

DROP POLICY "equipe" ON public.motoristas;
CREATE POLICY "empresa motoristas" ON public.motoristas FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa()) WITH CHECK (empresa_id = public.minha_empresa());