CREATE OR REPLACE FUNCTION public.marcar_registro_revertido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.reversao_de IS NOT NULL THEN
    UPDATE public.registros SET revertido_em = NEW.criado_em, revertido_por = NEW.user_id
    WHERE id = NEW.reversao_de AND empresa_id = NEW.empresa_id AND revertido_em IS NULL;
  END IF;
  RETURN NEW;
END $function$;
REVOKE EXECUTE ON FUNCTION public.marcar_registro_revertido() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER marcar_registro_revertido AFTER INSERT ON public.registros FOR EACH ROW EXECUTE FUNCTION public.marcar_registro_revertido();