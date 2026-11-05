CREATE TABLE public.autex (numero text PRIMARY KEY CHECK (length(btrim(numero)) > 0), descricao text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autex TO authenticated;
GRANT ALL ON public.autex TO service_role;
ALTER TABLE public.autex ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe acessa AUTEX" ON public.autex FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.toras ADD COLUMN autex text REFERENCES public.autex(numero);
ALTER TABLE public.arvores ADD COLUMN nome_cientifico text;
ALTER TABLE public.toras ADD COLUMN nome_cientifico text;