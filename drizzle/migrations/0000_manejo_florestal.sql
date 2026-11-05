CREATE TABLE public.arvores (
  numero integer PRIMARY KEY,
  nome_vulgar text NOT NULL DEFAULT '',
  cap numeric, dap numeric, altura numeric, volume numeric,
  categoria text, picada text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arvores TO authenticated;
GRANT ALL ON public.arvores TO service_role;
ALTER TABLE public.arvores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe arvores" ON public.arvores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.romaneios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placa text, julieta text, motorista text, cpf text,
  data date NOT NULL DEFAULT current_date,
  total_volume numeric NOT NULL DEFAULT 0,
  qtd_toras integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.romaneios TO authenticated;
GRANT ALL ON public.romaneios TO service_role;
ALTER TABLE public.romaneios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe romaneios" ON public.romaneios FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.toras (
  plaqueta integer PRIMARY KEY,
  arvore integer NOT NULL,
  especie text,
  secao text,
  d_topo1 numeric, d_topo2 numeric, d_pe1 numeric, d_pe2 numeric,
  comprimento numeric,
  volume numeric NOT NULL DEFAULT 0,
  carregada boolean NOT NULL DEFAULT false,
  romaneio_id uuid REFERENCES public.romaneios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX toras_arvore_idx ON public.toras(arvore);
CREATE INDEX toras_romaneio_idx ON public.toras(romaneio_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toras TO authenticated;
GRANT ALL ON public.toras TO service_role;
ALTER TABLE public.toras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe toras" ON public.toras FOR ALL TO authenticated USING (true) WITH CHECK (true);