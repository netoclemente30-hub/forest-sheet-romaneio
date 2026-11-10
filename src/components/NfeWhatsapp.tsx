import { toast } from "sonner";
import { FileCode2, Copy, MessageCircle } from "lucide-react";
import { Button } from "./ui/button";
import { baixarArquivo } from "@/lib/arquivo";
import { gerarTxtNfe, linkWhatsapp, resumoWhatsapp, type DadosNfe } from "@/lib/nfe-txt";

export function NfeWhatsapp({ dados, titulo, nomeArquivo }: { dados: DadosNfe; titulo: string; nomeArquivo: string }) {
  const txt = () => gerarTxtNfe(dados);
  async function copiar() {
    try { await navigator.clipboard.writeText(txt()); toast.success("Texto da NF-e copiado"); }
    catch { toast.error("Não foi possível copiar. Use Baixar TXT."); }
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      <Button variant="outline" size="sm" onClick={() => baixarArquivo({ blob: new Blob([txt()], { type: "text/plain;charset=utf-8" }), nome: `${nomeArquivo}.txt` })}><FileCode2 /> TXT NF-e</Button>
      <Button variant="outline" size="sm" onClick={() => void copiar()}><Copy /> Copiar</Button>
      <Button size="sm" variant="secondary" asChild>
        <a href={linkWhatsapp(resumoWhatsapp(titulo, dados))} target="_blank" rel="noopener noreferrer"><MessageCircle /> WhatsApp</a>
      </Button>
    </div>
  );
}
