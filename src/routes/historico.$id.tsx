import { adicionarLogoPdf } from "@/lib/logo-gestor";
import { useAuth } from "@/hooks/useAuth";
import { createFileRoute, useNavigate,Link } from "@tanstack/react-router";
import {pode, rotaPermitida} from "@/lib/funcoes";
import {clienteDoRomaneio} from "@/lib/fiscal-cargas";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { capturarLog } from "@/lib/registro";
import type { Romaneio, Tora } from "@/lib/data";
import { romaneiosQuery, torasQuery } from "@/lib/data";
import { useFilaOffline } from "@/hooks/useFilaOffline";
import { getEmpresaAtiva } from "@/lib/empresa";
import { projetarDados } from "@/lib/offline/projecao";
import { estoqueComFila } from "@/lib/tora-origem";
import { fmtM3 } from "@/lib/volume";
import { resumoPorEspecie } from "@/lib/romaneio";
import { Button } from "@/components/ui/button";
import { QrImage } from "@/components/QrImage";
import { qrRomaneio } from "@/lib/tora-qr";
import { FileDown, Trash2, Share2, Pencil } from "lucide-react";
import { NfeWhatsapp } from "@/components/NfeWhatsapp";
import { itensDeToras } from "@/lib/nfe-txt";
import { compartilharArquivoExato } from "@/lib/arquivo";

// Ordem alfabética por espécie, depois árvore e secção (A antes de B).
export function ordenarRomaneio(itens: Tora[]): Tora[] {
  return [...itens].sort(
    (a, b) =>
      (a.especie ?? "").localeCompare(b.especie ?? "", "pt-BR") ||
      a.arvore - b.arvore ||
      (a.secao ?? "").localeCompare(b.secao ?? "", "pt-BR") ||
      a.plaqueta - b.plaqueta,
  );
}

export function medidasFisicasRomaneio(t: Tora): (string | number)[] {
  return [t.d_topo1 ?? "—", t.d_topo2 ?? "—", t.d_pe1 ?? "—", t.d_pe2 ?? "—", t.comprimento ?? "—"];
}

export const Route = createFileRoute("/historico/$id")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Romaneio — Manejo Florestal" },
      { name: "description", content: "Detalhes e PDF do romaneio de carga." },
      { property: "og:title", content: "Romaneio — Manejo Florestal" },
      { property: "og:description", content: "Detalhes e PDF do romaneio de carga." },
    ],
  }),
  component: Detalhe,
});

const dataBR = (d: string) => new Date(d + "T12:00").toLocaleDateString("pt-BR");

async function montarPdf(r: Romaneio, itens: Tora[]) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape" });
  await adicionarLogoPdf(doc, 14, 6, 18);
  doc.setFontSize(16);
  doc.text("ROMANEIO DE CARGA", 36, 16);
  doc.setFontSize(10);
  doc.text(`Placa/Caminhão: ${r.placa ?? ""}    Reboque: ${r.julieta ?? ""}`, 36, 24);
  doc.text(`Data: ${dataBR(r.data)}    Motorista: ${r.motorista ?? ""}    CPF: ${r.cpf ?? ""}`, 14, 30);
  const QRCode = (await import("qrcode")).default;
  const qr = await QRCode.toDataURL(qrRomaneio(r, itens.map((t) => t.plaqueta)), { margin: 1, width: 400 });
  doc.addImage(qr, "PNG", 160, 6, 36, 36);
  doc.setFontSize(7);
  doc.text("QR da carga: entrada no pátio", 160, 45);
  autoTable(doc, {
    startY: 48,
    head: [["Plaqueta", "Árvore", "Espécie", "Sec.", "Topo Ø1 (cm)", "Topo Ø2 (cm)", "Pé Ø1 (cm)", "Pé Ø2 (cm)", "Comp. (m)", "m³ físico"]],
    body: itens.map((t) => [
      t.plaqueta, t.arvore, t.especie ?? "", t.secao ?? "",
      ...medidasFisicasRomaneio(t), fmtM3(Number(t.volume)),
    ]),
    foot: [["", "", "TOTAL", "", "", "", "", "", `${itens.length} toras`, fmtM3(itens.reduce((n, t) => n + Number(t.volume), 0))]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [46, 84, 56] },
    footStyles: { fillColor: [230, 225, 205], textColor: 20 },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const y = (doc as any).lastAutoTable.finalY + 8;
  autoTable(doc, {
    startY: y,
    head: [["Espécie", "Nome científico", "Qtd toras", "m³ físico"]],
    body: resumoPorEspecie(itens).map((e) => [e.especie, e.nome_cientifico ?? "", e.qtd, fmtM3(e.volume)]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [46, 84, 56] },
  });
  return doc;
}

const nomePdf = (r: Romaneio) => `romaneio_${r.placa || "carga"}_${r.data}.pdf`;

async function gerarPdf(r: Romaneio, itens: Tora[]) {
  const doc = await montarPdf(r, itens);
  doc.save(nomePdf(r));
}

// Compartilha o PDF REAL. Sem Web Share com arquivos, baixa o PDF para anexação manual.
async function compartilharPdf(r: Romaneio, itens: Tora[]) {
  const doc = await montarPdf(r, itens);
  const resultado = await compartilharArquivoExato({
    blob: doc.output("blob"),
    nome: nomePdf(r),
  });
  if (resultado === "baixado") {
    toast.info("PDF baixado. Abra o WhatsApp e anexe o arquivo na conversa.");
  }
}

function Detalhe() {
  const { papel, empresaId } = useAuth();
  const podeExcluir = papel === "superadmin" || papel === "admin_empresa";
  const podeEditar = pode(papel, "carga_criar");
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const empresa = getEmpresaAtiva() ?? empresaId;
  const roms = useQuery(romaneiosQuery);
  const toras = useQuery(torasQuery);
  const pendentes = useFilaOffline();
  const registros = projetarDados('romaneios', roms.data ?? [], pendentes.itens, empresa);
  const registro = registros.find(r => r.id === id);
  const q = { isLoading: roms.isLoading || toras.isLoading || pendentes.carregando, data: registro ? {r:registro, itens:estoqueComFila(toras.data ?? [], pendentes.itens, empresa).filter(t => t.romaneio_id === id)} : null };

  async function excluir() {
    if (!podeExcluir) return;
    if (!confirm("Excluir esta carga? As toras voltam para o pátio.")) return;
    const log = await capturarLog("Romaneio excluído", `Romaneio ${id}`);
    const { error } = await supabase.rpc("excluir_romaneio_toras", { _empresa: q.data?.r.empresa_id ?? "", _id: id, _log: log as unknown as Json });
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries();
    toast.success("Carga excluída");
    nav({ to: "/historico" });
  }

  if (q.isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (roms.isError || toras.isError || pendentes.erro) return <p>Não foi possível ler todos os dados da carga neste aparelho. Conecte e atualize a cópia offline antes de exportar.</p>;
  if (!q.data) return <p>Romaneio não encontrado na cópia deste aparelho. Conecte e atualize a cópia offline.</p>;
  const { r, itens: itensBrutos } = q.data;
  const cliente=clienteDoRomaneio(r.cliente);
  const itens = ordenarRomaneio(itensBrutos);

  return (
    <div className="space-y-4">
      <div className="bg-forest text-primary-foreground rounded-xl p-4">
        <div className="text-xs uppercase opacity-80">Romaneio · {dataBR(r.data)}</div>
        <h1 className="text-3xl font-bold uppercase">{r.placa || "Sem placa"}</h1>
        <div className="text-sm opacity-90">Reboque {r.julieta || "–"} · {r.motorista} {r.cpf && `· CPF ${r.cpf}`}</div>
        <div className="mt-2 font-display text-4xl font-bold">{fmtM3(Number(r.total_volume))} m³</div>
        <div className="text-sm opacity-80">{r.qtd_toras} toras · volume físico</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className="flex-1 h-12" onClick={() => gerarPdf(r, itens)}><FileDown /> Baixar PDF</Button>
        <Button variant="secondary" className="flex-1 h-12" onClick={() => void compartilharPdf(r, itens).catch((e) => toast.error(e instanceof Error ? e.message : "Erro ao gerar PDF"))}><Share2 /> Enviar PDF</Button>
        {podeEditar && !r.recebido_em && <Button asChild variant="outline" className="h-12"><Link to="/romaneio" search={{ editar: r.id }}><Pencil /> Editar</Link></Button>}
        {podeExcluir && <Button variant="outline" className="h-12" onClick={excluir} aria-label="Excluir"><Trash2 /></Button>}
      </div>
      <div className="rounded-xl border bg-card p-3">
        <h2 className="font-semibold">Cliente / fornecedor do manejo</h2>
        <p>{cliente?.nome || "Cliente não informado neste romaneio"}</p>
        {cliente && <p className="text-sm">{cliente.documento} · {Object.values(cliente.endereco??{}).filter(Boolean).join(", ")}</p>}
      </div>
      <NfeWhatsapp acaoFiscal={rotaPermitida(papel,"/fiscal") && r.empresa_id ? <Button asChild className="h-11" size="sm"><Link to="/fiscal" search={{romaneio:"toras/"+r.id,empresa:r.empresa_id}}>Gerar NF-e</Link></Button> : undefined} titulo="ROMANEIO DE TORAS" nomeArquivo={`nfe-romaneio-${(r.placa || "sem-placa").replace(/\W/g, "")}-${r.data}`} dados={{ numero: `${r.placa || "SEM-PLACA"}-${r.data.replace(/-/g, "")}`, data: r.data, natureza: "REMESSA DE MADEIRA EM TORA", cliente:clienteDoRomaneio(r.cliente), motorista: r.motorista ? { nome: r.motorista, cpf: r.cpf ?? "" } : null, placa: r.placa, reboque: r.julieta, itens: itensDeToras(itens) }} />
      <div className="bg-card border rounded-xl p-3 flex items-center gap-4">
        <QrImage value={qrRomaneio(r, itens.map((t) => t.plaqueta))} size={140} />
        <div className="text-sm">
          <div className="font-bold uppercase">QR da carga</div>
          <p className="text-muted-foreground">Leia na serraria em “Entrada no pátio” para receber as {itens.length} toras de uma vez.</p>
          {r.recebido_em && <p className="text-success font-semibold mt-1">Recebido em {new Date(r.recebido_em).toLocaleString("pt-BR")}</p>}
        </div>
      </div>
      <div className="bg-card border rounded-xl p-3">
        <h2 className="text-lg font-bold uppercase mb-1">Por espécie</h2>
        {resumoPorEspecie(itens).map((e) => (
          <div key={e.especie} className="flex justify-between text-sm py-0.5">
            <span>{e.especie}{e.nome_cientifico && <i className="text-muted-foreground"> · {e.nome_cientifico}</i>} <span className="text-muted-foreground">({e.qtd})</span></span>
            <span className="font-medium">{fmtM3(e.volume)}</span>
          </div>
        ))}
      </div>
      <div className="bg-card border rounded-xl divide-y">
        {itens.map((t) => (
          <div key={t.plaqueta} className="flex items-center gap-3 p-3 text-sm">
            <div className="font-display text-lg font-bold w-14">{t.plaqueta}</div>
            <div className="flex-1 min-w-0"><div>{t.especie} <span className="text-muted-foreground">· Árv. {t.arvore} · Sec. {t.secao ?? "–"}</span></div><div className="text-xs text-muted-foreground">Topo {t.d_topo1 ?? "–"}×{t.d_topo2 ?? "–"} cm · Pé {t.d_pe1 ?? "–"}×{t.d_pe2 ?? "–"} cm · Comp. {t.comprimento ?? "–"} m</div></div>
            <div className="text-right font-semibold">{fmtM3(Number(t.volume))}<div className="text-xs font-normal text-muted-foreground">físico</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
