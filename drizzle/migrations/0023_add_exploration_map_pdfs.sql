CREATE TABLE public.mapas_exploracao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL DEFAULT public.minha_empresa() REFERENCES public.empresas(id) ON DELETE CASCADE,
  autex TEXT NOT NULL,
  arquivo_path TEXT NOT NULL UNIQUE,
  nome_arquivo TEXT NOT NULL,
  tamanho_bytes BIGINT NOT NULL,
  enviado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mapas_exploracao_empresa_autex_key UNIQUE (empresa_id, autex),
  CONSTRAINT mapas_exploracao_empresa_autex_fkey FOREIGN KEY (empresa_id, autex) REFERENCES public.autex(empresa_id, numero) ON DELETE CASCADE,
  CONSTRAINT mapas_exploracao_tamanho_valido CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 26214400),
  CONSTRAINT mapas_exploracao_pdf CHECK (lower(nome_arquivo) LIKE '%.pdf')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapas_exploracao TO authenticated;
GRANT ALL ON public.mapas_exploracao TO service_role;

ALTER TABLE public.mapas_exploracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa pode ler mapas PDF"
ON public.mapas_exploracao FOR SELECT TO authenticated
USING (empresa_id = public.minha_empresa());

CREATE POLICY "Empresa pode enviar mapas PDF"
ON public.mapas_exploracao FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.minha_empresa());

CREATE POLICY "Empresa pode atualizar mapas PDF"
ON public.mapas_exploracao FOR UPDATE TO authenticated
USING (empresa_id = public.minha_empresa())
WITH CHECK (empresa_id = public.minha_empresa());

CREATE POLICY "Empresa pode excluir mapas PDF"
ON public.mapas_exploracao FOR DELETE TO authenticated
USING (empresa_id = public.minha_empresa());

CREATE POLICY "Empresa pode ler arquivos de mapas"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'mapas-exploracao'
  AND (storage.foldername(name))[1] = public.minha_empresa()::text
);

CREATE POLICY "Empresa pode enviar arquivos de mapas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'mapas-exploracao'
  AND (storage.foldername(name))[1] = public.minha_empresa()::text
  AND storage.extension(name) = 'pdf'
);

CREATE POLICY "Empresa pode substituir arquivos de mapas"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'mapas-exploracao'
  AND (storage.foldername(name))[1] = public.minha_empresa()::text
)
WITH CHECK (
  bucket_id = 'mapas-exploracao'
  AND (storage.foldername(name))[1] = public.minha_empresa()::text
  AND storage.extension(name) = 'pdf'
);

CREATE POLICY "Empresa pode excluir arquivos de mapas"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'mapas-exploracao'
  AND (storage.foldername(name))[1] = public.minha_empresa()::text
);