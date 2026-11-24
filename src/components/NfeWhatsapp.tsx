import { toast } from "sonner";
import type {ReactNode} from "react";
import { FileCode2, Share2 } from "lucide-react";
import { Button } from "./ui/button";
import { baixarArquivo, compartilharArquivoExato } from "@/lib/arquivo";
import { gerarTxtNfe, type DadosNfe } from "@/lib/nfe-txt";

/** O TXT NF-e é um arquivo; compartilhar nunca cola seu conteúdo no WhatsApp. */
export function NfeWhatsapp({ dados, nomeArquivo,acaoFiscal }: { dados: DadosNfe; titulo: string; nomeArquivo: string;acaoFiscal?:ReactNode }) {
  const arquivo = () => ({
    blob: new Blob([gerarTxtNfe(dados)], { type: "text/plain;charset=utf-8" }),
    nome: `${nomeArquivo}.txt`,
  });

  async function compartilhar() {
    try {
      const modo = await compartilharArquivoExato(arquivo());
      if (modo === "baixado")
        toast.info("TXT baixado. Abra o WhatsApp e anexe o arquivo .txt na conversa.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o TXT.");
    }
  }

  return (
    <div className={acaoFiscal?"grid grid-cols-2 gap-2 sm:grid-cols-3":"grid grid-cols-2 gap-2"}>
      <Button variant="outline" size="sm" className="h-11" onClick={() => baixarArquivo(arquivo())}>
        <FileCode2 /> Baixar TXT
      </Button>
      {acaoFiscal}
      <Button variant="secondary" size="sm" className="h-11" onClick={() => void compartilhar()}>
        <Share2 /> Enviar TXT
      </Button>
    </div>
  );
}
