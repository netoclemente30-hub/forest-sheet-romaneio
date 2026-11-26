import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QrCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { urlRastreioSerrado, UUID_RASTREIO } from "@/lib/rastreabilidade-serrada";
import { salvarArquivo } from "@/lib/arquivo";
import { Button } from "./ui/button";

type Props = { empresa: string; id: string; tipo: "pacote" | "carga"; publicoId?: string | null | undefined; podePublicar: boolean };

export function QrRastreioSerrado({ empresa, id, tipo, publicoId, podePublicar }: Props) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState<{ id: string; imagem: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!publicoId && !podePublicar) return null;

  async function abrir() {
    if (busy) return;
    if (aberto) { setAberto(null); return; }
    if (!publicoId && !window.confirm("Publicar esta ficha para consulta por quem tiver o QR? Ela pode incluir CNPJ, dados de origem e coordenadas.")) return;
    setBusy(true);
    try {
      let codigo = publicoId;
      if (!codigo) {
        const { data, error } = await supabase.rpc("publicar_rastreabilidade_serrada", { _empresa: empresa, _tipo: tipo, _id: id });
        if (error) throw new Error(error.message);
        if (typeof data !== "string" || !UUID_RASTREIO.test(data)) throw new Error("Código público inválido.");
        codigo = data;
        void qc.invalidateQueries({ queryKey: [tipo === "carga" ? "cargas-serradas" : "madeira-serrada", empresa] });
      }
      const qr = (await import("qrcode")).default;
      const imagem = await qr.toDataURL(urlRastreioSerrado(codigo), { width: 300, margin: 2, errorCorrectionLevel: "M" });
      setAberto({ id: codigo, imagem });
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível abrir o QR público.");
    } finally { setBusy(false); }
  }

  async function exportarQr() {
    if (!aberto) return;
    try {
      const blob = await fetch(aberto.imagem).then(r => r.blob());
      await salvarArquivo({ blob, nome: `qr-${tipo}-${aberto.id}.png` });
    } catch { toast.error("Não foi possível salvar o QR."); }
  }

  return <div>
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void abrir()}>
      <QrCode />{aberto ? "Fechar QR" : publicoId ? "Ver QR público" : "Publicar ficha e gerar QR"}
    </Button>
    {aberto && <div className="mt-2 space-y-2">
      <img src={aberto.imagem} width={156} height={156} alt="QR da ficha pública de rastreabilidade" />
      <a className="text-sm underline" href={urlRastreioSerrado(aberto.id)} target="_blank" rel="noopener noreferrer">Abrir ficha pública</a>
      <p className="break-all font-mono text-xs">{aberto.id}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => void exportarQr()}>Salvar QR (PNG)</Button>
    </div>}
  </div>;
}
