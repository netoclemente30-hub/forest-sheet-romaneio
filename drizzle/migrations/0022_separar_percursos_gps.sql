ALTER TABLE public.rastros_gps ADD COLUMN sessao_id uuid;
COMMENT ON COLUMN public.rastros_gps.sessao_id IS 'Identifica um percurso contínuo para não ligar rastreios diferentes no mapa';
CREATE INDEX rastros_gps_sessao_idx ON public.rastros_gps (empresa_id, autex, sessao_id, capturado_em);