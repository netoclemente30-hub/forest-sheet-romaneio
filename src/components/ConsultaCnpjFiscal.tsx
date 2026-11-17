import { useEffect, useRef, useState } from "react";
import { consultarCnpj, documentoId, type ClienteFiscal } from "@/lib/catalogo-fiscal";
export function ConsultaCnpjFiscal({
  documento,
  aplicar,
}: {
  documento: string;
  aplicar: (c: ClienteFiscal) => void;
}) {
  const aplicarRef = useRef(aplicar);
  useEffect(() => {
    aplicarRef.current = aplicar;
  }, [aplicar]);
  const [aviso, setAviso] = useState("");
  const id = documentoId(documento);
  useEffect(() => {
    setAviso("");
    if (!/^[A-Z0-9]{12}\d{2}$/.test(id)) return;
    const controle = new AbortController();
    let vigente = true;
    const timer = setTimeout(async () => {
      setAviso("Consultando CNPJ…");
      try {
        const c = await consultarCnpj(
          id,
          AbortSignal.any([controle.signal, AbortSignal.timeout(8000)]),
        );
        if (vigente) {
          aplicarRef.current(c);
          setAviso("Dados públicos carregados. Confira antes de salvar.");
        }
      } catch (e) {
        if (vigente)
          setAviso(
            e instanceof Error && e.message.includes("Preencha")
              ? e.message
              : "Consulta indisponível. Preencha manualmente.",
          );
      }
    }, 500);
    return () => {
      vigente = false;
      clearTimeout(timer);
      controle.abort();
    };
  }, [id]);
  return <small role="status">{aviso}</small>;
}
