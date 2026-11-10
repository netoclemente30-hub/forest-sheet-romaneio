ALTER TABLE public.registros ADD COLUMN IF NOT EXISTS aparelho_nome text, ADD COLUMN IF NOT EXISTS aparelho_modelo text, ADD COLUMN IF NOT EXISTS aparelho_ua text;

CREATE TABLE public.aparelhos (
  empresa_id uuid NOT NULL DEFAULT public.minha_empresa() REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_agent text NOT NULL,
  nome text NOT NULL,
  modelo text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, user_agent)
);
GRANT SELECT, INSERT, UPDATE ON public.aparelhos TO authenticated;
GRANT ALL ON public.aparelhos TO service_role;
ALTER TABLE public.aparelhos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Aparelhos da empresa" ON public.aparelhos FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa()) WITH CHECK (empresa_id = public.minha_empresa());

CREATE OR REPLACE FUNCTION public.preencher_aparelho_registro() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ua text; a record;
BEGIN
  ua := coalesce(NEW.aparelho_ua, nullif(current_setting('request.headers', true), '')::json->>'user-agent');
  NEW.aparelho_ua := ua;
  IF ua IS NOT NULL AND (NEW.aparelho_nome IS NULL OR NEW.aparelho_modelo IS NULL) THEN
    SELECT nome, modelo INTO a FROM public.aparelhos WHERE empresa_id = NEW.empresa_id AND user_agent = ua;
    IF FOUND THEN
      NEW.aparelho_nome := coalesce(NEW.aparelho_nome, a.nome);
      NEW.aparelho_modelo := coalesce(NEW.aparelho_modelo, a.modelo);
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END $$;

CREATE TRIGGER zz_preencher_aparelho BEFORE INSERT ON public.registros
FOR EACH ROW EXECUTE FUNCTION public.preencher_aparelho_registro();