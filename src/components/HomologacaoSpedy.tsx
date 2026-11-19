import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  diagnosticarSpedy, emitirNfeHomologacao, consultarNfeHomologacao, baixarNfeHomologacao, inutilizarHomologacao,
} from "@/lib/spedy.functions";
import { idRascunho, type Cadastro, type InutilizacaoRascunho, type Rascunho } from "@/lib/fiscal";
import type { NotaFiscalEntrada } from "@/lib/fiscal-spedy.core";

const rotulos: Record<string, Record<string, string>> = {
  chave: { ok: "aceita", ausente: "não configurada no servidor", recusada: "recusada pela Spedy", indisponivel: "Spedy indisponível" },
  cadastro: { ok: "empresa encontrada pelo CNPJ", nao_encontrado: "CNPJ não cadastrado na conta de homologação", pendente: "não verificado" },
  certificado: { ok: "A1 ativo e válido", ausente: "nenhum A1 ativo", vencido: "A1 vencido", pendente: "não verificado" },
  ambiente: { homologacao: "NF-e em Homologação", producao_bloqueada: "NF-e em PRODUÇÃO — emissão bloqueada", desconhecido: "não confirmado — emissão bloqueada", pendente: "não verificado" },
};

export function DiagnosticoSpedy({ empresa, cnpj }: { empresa: string; cnpj: string }) {
  const diag = useServerFn(diagnosticarSpedy);
  const [r, setR] = useState<Record<string, string> | null>(null);
  const [carregando, setCarregando] = useState(false);
  return (
    <div className="space-y-2">
      <Button variant="outline" disabled={carregando} onClick={async () => {
        setCarregando(true);
        try { setR((await diag({ data: { empresa, cnpj } })) as Record<string, string>); }
        catch { toast.error("Não foi possível diagnosticar."); }
        finally { setCarregando(false); }
      }}>
        {carregando ? "Verificando…" : "Diagnóstico Spedy (homologação)"}
      </Button>
      {r && (
        <ul className="text-sm">
          {(["chave", "cadastro", "certificado", "ambiente"] as const).map((k) => (
            <li key={k}><b className="capitalize">{k}:</b> {rotulos[k]?.[r[k] ?? ""] ?? r[k]}{k === "certificado" && r["validadeCertificado"] ? ` · validade ${new Date(r["validadeCertificado"]).toLocaleDateString("pt-BR")}` : ""}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function entrada(r: Rascunho, t: Record<string, string>): NotaFiscalEntrada {
  const d = r.detalhes!;
  const icms = t["regime"] === "simples" ? { csosn: Number(t["icms"]) } : { cst: Number(t["icms"]) };
  return {
    emitenteCnpj: r.cadastro.cnpj,
    natureza: d.cabecalho?.natureza || r.carga.natureza || "",
    serie: d.cabecalho?.serie || undefined,
    consumidorFinal: t["final"] === "1",
    destinatario: { nome: d.nome, documento: d.documento, endereco: d.endereco },
    itens: r.itens.map((i, n) => ({
      codigo: (i as { codigo?: string }).codigo || String(n + 1), descricao: i.descricao, ncm: i.ncm ?? "",
      cfop: (i as { cfop?: string }).cfop ?? "", unidade: i.unidade || "M3", quantidade: i.quantidade, preco: i.preco,
    })),
    tributacao: { origem: Number(t["origem"]), icms, pisCst: Number(t["pis"]), cofinsCst: Number(t["cofins"]) },
    pagamento: t["pagamento"] as NotaFiscalEntrada["pagamento"],
    frete: (d.modFrete || "9") as NotaFiscalEntrada["frete"],
    informacoes: d.infAdFisco || undefined,
  };
}

function baixar(base64: string, nome: string, tipo: string) {
  const bin = atob(base64);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([b], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function EmissaoHomologacao({ empresa, r }: { empresa: string; r: Rascunho }) {
  const emitir = useServerFn(emitirNfeHomologacao);
  const consultar = useServerFn(consultarNfeHomologacao);
  const arquivo = useServerFn(baixarNfeHomologacao);
  const [t, setT] = useState<Record<string, string>>({ regime: "simples", origem: "0", icms: "", pis: "", cofins: "", pagamento: "", final: "0" });
  const [confirmado, setConfirmado] = useState(false);
  const [estado, setEstado] = useState<{ situacao: string; mensagem: string; protocolo?: string | null; numero?: string | null; chave?: string | null } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const id = idRascunho(r);
  async function executar(f: () => Promise<{ ok: boolean; mensagem: string; situacao?: string; documento?: { protocolo: string | null; numero: string | null; chave_acesso: string | null } | null }>) {
    setOcupado(true);
    try {
      const res = await f();
      setEstado({ situacao: res.situacao ?? "erro", mensagem: res.mensagem, protocolo: res.documento?.protocolo ?? null, numero: res.documento?.numero ?? null, chave: res.documento?.chave_acesso ?? null });
      if (!res.ok) toast.error(res.mensagem);
    } catch { toast.error("Falha na comunicação com o servidor."); }
    finally { setOcupado(false); }
  }
  const campo = (k: string, rot: string, ph = "") => (
    <label className="grid text-sm">{rot}<Input value={t[k]} placeholder={ph} onChange={(e) => setT({ ...t, [k]: e.target.value })} /></label>
  );
  const pronto = confirmado && !!r.detalhes && t["icms"] && t["pis"] && t["cofins"] && t["pagamento"];
  return (
    <div className="space-y-3 rounded-md border p-3">
      <h3 className="font-semibold">Emissão real em HOMOLOGAÇÃO (Spedy, sem validade fiscal)</h3>
      <p className="text-sm text-muted-foreground">Informe a tributação conforme orientação do contador. Nada é preenchido automaticamente. O servidor recusa o envio se o modelo NF-e da empresa na Spedy não estiver em Homologação.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="grid text-sm">Regime<select className="h-10 rounded-md border bg-background px-2" value={t["regime"]} onChange={(e) => setT({ ...t, regime: e.target.value })}><option value="simples">Simples Nacional (CSOSN)</option><option value="normal">Regime Normal (CST)</option></select></label>
        {campo("icms", t["regime"] === "simples" ? "CSOSN do ICMS" : "CST do ICMS", "ex.: 102")}
        {campo("origem", "Origem da mercadoria", "0")}
        {campo("pis", "CST do PIS", "ex.: 49")}
        {campo("cofins", "CST da COFINS", "ex.: 49")}
        <label className="grid text-sm">Pagamento<select className="h-10 rounded-md border bg-background px-2" value={t["pagamento"]} onChange={(e) => setT({ ...t, pagamento: e.target.value })}><option value="">Selecione</option><option value="pix">Pix</option><option value="bankDeposit">Depósito</option><option value="money">Dinheiro</option><option value="noPayment">Sem pagamento</option></select></label>
        <label className="grid text-sm">Consumidor final<select className="h-10 rounded-md border bg-background px-2" value={t["final"]} onChange={(e) => setT({ ...t, final: e.target.value })}><option value="0">Não</option><option value="1">Sim</option></select></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />Confirmo o envio desta nota à SEFAZ em homologação.</label>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!pronto || ocupado} onClick={() => executar(async () => {
          let nota: NotaFiscalEntrada;
          try { nota = entrada(r, t); } catch { return { ok: false, mensagem: "Complete os dados da nota." }; }
          return emitir({ data: { empresa, rascunhoId: id, origem: r.origem, confirmacao: "HOMOLOGACAO", nota } });
        })}>Enviar em homologação</Button>
        <Button variant="outline" disabled={ocupado} onClick={() => executar(() => consultar({ data: { empresa, rascunhoId: id } }))}>Consultar situação</Button>
        {(["xml", "pdf"] as const).map((tipo) => (
          <Button key={tipo} variant="outline" disabled={ocupado || estado?.situacao !== "authorized"} onClick={async () => {
            const res = await arquivo({ data: { empresa, rascunhoId: id, tipo } });
            if (res.ok) baixar(res.base64, `nfe-homologacao-${r.carga.numero}.${tipo}`, tipo === "xml" ? "application/xml" : "application/pdf");
            else toast.error(res.mensagem);
          }}>{tipo === "xml" ? "Baixar XML" : "Baixar DANFE"}</Button>
        ))}
      </div>
      {estado && (
        <p className="text-sm" role="status">Situação: <b>{estado.situacao}</b> · {estado.mensagem}{estado.numero ? ` · Nº ${estado.numero}` : ""}{estado.protocolo ? ` · Protocolo ${estado.protocolo}` : ""}{estado.chave ? ` · Chave ${estado.chave}` : ""}</p>
      )}
    </div>
  );
}

export function InutilizacaoHomologacao({ empresa, cadastro, itens }: { empresa: string; cadastro: Cadastro; itens: InutilizacaoRascunho[] }) {
  const enviar = useServerFn(inutilizarHomologacao);
  const [msg, setMsg] = useState<Record<string, string>>({});
  if (!itens.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Enviar inutilização à Spedy (homologação)</h3>
      {itens.map((i) => (
        <div key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span>Série {i.serie} · {i.inicio}–{i.fim}</span>
          <Button size="sm" variant="outline" onClick={async () => {
            if (!window.confirm(`Inutilizar em homologação a faixa ${i.inicio}–${i.fim} da série ${i.serie}?`)) return;
            try {
              const r = await enviar({ data: { empresa, confirmacao: "HOMOLOGACAO", cnpj: cadastro.cnpj, serie: i.serie, inicio: i.inicio, fim: i.fim, justificativa: i.justificativa } });
              setMsg({ ...msg, [i.id]: r.mensagem });
            } catch { setMsg({ ...msg, [i.id]: "Falha na comunicação." }); }
          }}>Enviar</Button>
          {msg[i.id] && <span role="status">{msg[i.id]}</span>}
        </div>
      ))}
    </div>
  );
}
