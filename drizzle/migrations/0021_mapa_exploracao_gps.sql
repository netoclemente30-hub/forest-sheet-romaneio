ALTER TABLE public.arvores
  ADD COLUMN latitude double precision,
  ADD COLUMN longitude double precision,
  ADD COLUMN gps_precisao double precision,
  ADD COLUMN localizado_em timestamptz,
  ADD COLUMN abatida_em timestamptz;

COMMENT ON COLUMN public.arvores.latitude IS 'Latitude WGS84 registrada pela ficha ou pelo GPS do manejo';
COMMENT ON COLUMN public.arvores.longitude IS 'Longitude WGS84 registrada pela ficha ou pelo GPS do manejo';
COMMENT ON COLUMN public.arvores.gps_precisao IS 'Precisão informada pelo GPS em metros';
COMMENT ON COLUMN public.arvores.abatida_em IS 'Data e hora do registro de abatimento; nula enquanto a árvore não foi abatida';

CREATE TABLE public.rastros_gps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.minha_empresa() REFERENCES public.empresas(id),
  autex text NOT NULL,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  precisao double precision,
  capturado_em timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rastros_gps_empresa_autex_fkey FOREIGN KEY (empresa_id, autex) REFERENCES public.autex(empresa_id, numero)
);

GRANT SELECT, INSERT ON public.rastros_gps TO authenticated;
GRANT ALL ON public.rastros_gps TO service_role;
ALTER TABLE public.rastros_gps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresa le rastros" ON public.rastros_gps FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa() OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "empresa insere rastros" ON public.rastros_gps FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.minha_empresa() OR public.has_role(auth.uid(), 'superadmin'));
CREATE INDEX rastros_gps_empresa_autex_data_idx ON public.rastros_gps (empresa_id, autex, capturado_em);