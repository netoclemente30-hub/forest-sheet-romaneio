import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Romaneio, Tora } from "@/lib/data";
import { fmtM3 } from "@/lib/volume";
import { resumoPorEspecie } from "@/lib/romaneio";
import { Button } from "@/components/ui/button";
import { FileDown, Trash2 } from "lucide-react";

export const Route = createFileRoute("/historico/$id")({
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

async function gerarPdf(r: Romaneio, itens: Tora[]) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("ROMANEIO DE CARGA", 14, 16);
  doc.setFontSize(10);
  doc.text(`Placa/Caminhão: ${r.placa ?? ""}    Julieta: ${r.julieta ?? ""}`, 14, 24);
  doc.text(`Data: ${dataBR(r.data)}    Motorista: ${r.motorista ?? ""}    CPF: ${r.cpf ?? ""}`, 14, 30);
  autoTable(doc, {
    startY: 36,
    head: [["Plaqueta", "Árvore", "Espécie", "Sec.", "D1 (m)", "D2 (m)", "C (m)", "m³"]],
    body: itens.map((t) => [
      t.plaqueta, t.arvore, t.especie ?? "", t.secao ?? "",
      (((Number(t.d_topo1) + Number(t.d_topo2)) / 2) / 100).toFixed(3),
      (((Number(t.d_pe1) + Number(t.d_pe2)) / 2) / 100).toFixed(3),
      t.comprimento, fmtM3(Number(t.volume)),
    ]),
    foot: [["", "", "TOTAL", "", "", "", `${itens.length} toras`, fmtM3(Number(r.total_volume))]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [46, 84, 56] },
    footStyles: { fillColor: [230, 225, 205], textColor: 20 },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const y = (doc as any).lastAutoTable.finalY + 8;
  autoTable(doc, {
    startY: y,
    head: [["Espécie", "Qtd toras", "Volume m³"]],
    body: resumoPorEspecie(itens).map((e) => [e.especie, e.qtd, fmtM3(e.volume)]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [46, 84, 56] },
  });
  doc.save(`romaneio_${r.placa || "carga"}_${r.data}.pdf`);
}

function Detalhe() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ["romaneio", id],
    queryFn: async () => {
      const [{ data: r, error }, { data: itens }] = await Promise.all([
        supabase.from("romaneios").select("*").eq("id", id).single(),
        supabase.from("toras").select("*").eq("romaneio_id", id).order("plaqueta"),
      ]);
      if (error) throw error;
      return { r: r as Romaneio, itens: (itens ?? []) as Tora[] };
    },
  });

  async function excluir() {
    if (!confirm("Excluir esta carga? As toras voltam para o pátio.")) return;
    await supabase.from("toras").update({ carregada: false, romaneio_id: null }).eq("romaneio_id", id);
    const { error } = await supabase.from("romaneios").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries();
    toast.success("Carga excluída");
    nav({ to: "/historico" });
  }

  if (q.isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!q.data) return <p>Romaneio não encontrado.</p>;
  const { r, itens } = q.data;

  return (
    <div className="space-y-4">
      <div className="bg-forest text-primary-foreground rounded-xl p-4">
        <div className="text-xs uppercase opacity-80">Romaneio · {dataBR(r.data)}</div>
        <h1 className="text-3xl font-bold uppercase">{r.placa || "Sem placa"}</h1>
        <div className="text-sm opacity-90">Julieta {r.julieta || "–"} · {r.motorista} {r.cpf && `· CPF ${r.cpf}`}</div>
        <div className="mt-2 font-display text-4xl font-bold">{fmtM3(Number(r.total_volume))} m³</div>
        <div className="text-sm opacity-80">{r.qtd_toras} toras</div>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1 h-12" onClick={() => gerarPdf(r, itens)}><FileDown /> Baixar PDF</Button>
        <Button variant="outline" className="h-12" onClick={excluir} aria-label="Excluir"><Trash2 /></Button>
      </div>
      <div className="bg-card border rounded-xl p-3">
        <h2 className="text-lg font-bold uppercase mb-1">Por espécie</h2>
        {resumoPorEspecie(itens).map((e) => (
          <div key={e.especie} className="flex justify-between text-sm py-0.5">
            <span>{e.especie} <span className="text-muted-foreground">({e.qtd})</span></span>
            <span className="font-medium">{fmtM3(e.volume)}</span>
          </div>
        ))}
      </div>
      <div className="bg-card border rounded-xl divide-y">
        {itens.map((t) => (
          <div key={t.plaqueta} className="flex items-center gap-3 p-3 text-sm">
            <div className="font-display text-lg font-bold w-14">{t.plaqueta}</div>
            <div className="flex-1">{t.especie} <span className="text-muted-foreground">· Árv. {t.arvore}</span></div>
            <div className="font-semibold">{fmtM3(Number(t.volume))}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
