-- Chaves passam a ser por empresa: cada empresa tem suas placas, AUTEX, plaquetas etc.
ALTER TABLE public.toras DROP CONSTRAINT toras_autex_fkey;

ALTER TABLE public.autex DROP CONSTRAINT autex_pkey;
ALTER TABLE public.autex ADD PRIMARY KEY (empresa_id, numero);

ALTER TABLE public.toras ADD CONSTRAINT toras_autex_fkey FOREIGN KEY (empresa_id, autex) REFERENCES public.autex (empresa_id, numero);

ALTER TABLE public.patios DROP CONSTRAINT patios_pkey;
ALTER TABLE public.patios ADD PRIMARY KEY (empresa_id, nome);

ALTER TABLE public.veiculos DROP CONSTRAINT veiculos_pkey;
ALTER TABLE public.veiculos ADD PRIMARY KEY (empresa_id, placa, tipo);

ALTER TABLE public.motoristas DROP CONSTRAINT motoristas_pkey;
ALTER TABLE public.motoristas ADD PRIMARY KEY (empresa_id, nome);

ALTER TABLE public.toras DROP CONSTRAINT toras_pkey;
ALTER TABLE public.toras ADD PRIMARY KEY (empresa_id, plaqueta);

ALTER TABLE public.arvores DROP CONSTRAINT arvores_numero_autex_key;
ALTER TABLE public.arvores ADD CONSTRAINT arvores_empresa_numero_autex_key UNIQUE (empresa_id, numero, autex);