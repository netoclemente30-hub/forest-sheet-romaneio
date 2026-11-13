ALTER TABLE public.empresas DROP CONSTRAINT empresas_status_valido;
ALTER TABLE public.empresas ADD CONSTRAINT empresas_status_valido CHECK (status IN ('pendente','demonstracao','ativa','inativa'));
CREATE OR REPLACE FUNCTION public.limitar_toras_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status text; _qtd int;
BEGIN
  SELECT status INTO _status FROM public.empresas WHERE id = NEW.empresa_id;
  IF _status IN ('inativa','pendente') THEN
    RAISE EXCEPTION 'Acesso da empresa ainda não liberado. Fale pelo WhatsApp (69) 99900-4121.';
  END IF;
  IF _status = 'demonstracao' THEN
    SELECT count(*) INTO _qtd FROM public.toras WHERE empresa_id = NEW.empresa_id;
    IF _qtd >= 50 THEN
      RAISE EXCEPTION 'Limite da demonstração atingido (50 toras). Peça a liberação pelo WhatsApp (69) 99900-4121.';
    END IF;
  END IF;
  RETURN NEW;
END $$;