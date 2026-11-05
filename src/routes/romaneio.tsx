import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { torasQuery, type Tora } from "@/lib/data";
import { fmtM3 } from "@/lib/volume";
import { resumoPorEspecie } from "@/lib/romaneio";
import { plaquetaDoQr } from "@/lib/tora-qr";
import { QrScanner } from "@/components/QrScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, X, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/romaneio")({
  head: () => ({
    meta: [
      { title: "Novo romaneio — Manejo Florestal" },
      { name: "description", content: "Monte a carga do caminhão pelas plaquetas e some os volumes." },
      { property: "og:title", content: "Novo romaneio — Manejo Florestal" },
      { property: "og:description", content: "Monte a carga do caminhão pelas plaquetas e some os volumes." },
    ],
  }),
  component: RomaneioPage,
});

function RomaneioPage() {
  const toras = useQuery(torasQuery);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [cab, setCab] = useState({ placa: "", julieta: "", motorista: "", cpf: "", data: new Date().toISOString().slice(0, 10) });
  const [itens, setItens] = useState<Tora[]>([]);
  const [plq, setPlq] = useState("");
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const mapa = useMemo(() => new Map((toras.data ?? []).map((t) => [t.plaqueta, t])), [toras.data]);

  const adicionar = useCallback(
    (raw: string) => {
      const n = plaquetaDoQr(raw);
      if (!n) { toast.error("QR code inválido ou plaqueta inválida"); return; }
      const t = mapa.get(n);
      if (!t) { toast.error(`Plaqueta ${n} não encontrada no inventário`); return; }
      if (t.carregada) { toast.warning(`Plaqueta ${n} JÁ FOI CARREGADA em outra carga!`, { duration: 6000 }); return; }
      setItens((cur) => {
        if (cur.some((x) => x.plaqueta === n)) {
          toast.warning(`Plaqueta ${n} já está nesta carga`);
          return cur;
        }
        toast.success(`${n} · ${t.especie} · ${fmtM3(Number(t.volume))} m³`);
        return [t, ...cur];
      });
    },
    [mapa],
  );

  const total = itens.reduce((n, t) => n + Number(t.volume), 0);
  const resumo = resumoPorEspecie(itens);

  async function salvar() {
    if (!itens.length) { toast.error("Adicione plaquetas"); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("romaneios")
      .insert({ ...cab, total_volume: Math.round(total * 10000) / 10000, qtd_toras: itens.length, created_by: u.user?.id ?? null })
      .select()
      .single();
    if (error || !data) { setBusy(false); { toast.error(error?.message ?? "Erro"); return; } }
    const { error: e2 } = await supabase
      .from("toras")
      .update({ carregada: true, romaneio_id: data.id })
      .in("plaqueta", itens.map((t) => t.plaqueta));
    setBusy(false);
    if (e2) { toast.error(e2.message); return; }
    await qc.invalidateQueries();
    toast.success("Romaneio salvo");
    nav({ to: "/historico/$id", params: { id: data.id } });
  }

  const f = (k: keyof typeof cab, label: string, type = "text") => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={cab[k]} onChange={(e) => setCab({ ...cab, [k]: e.target.value })} className="h-11" />
    </div>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold uppercase">Romaneio de carga</h1>
      <div className="bg-card border rounded-xl p-3 grid grid-cols-2 gap-2">
        {f("placa", "Placa / caminhão")}
        {f("julieta", "Julieta")}
        {f("motorista", "Motorista")}
        {f("cpf", "CPF")}
        <div className="col-span-2">{f("data", "Data", "date")}</div>
      </div>

      <div className="sticky top-14 z-10 bg-background py-2 space-y-2">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); adicionar(plq); setPlq(""); inputRef.current?.focus(); }}>
          <Input ref={inputRef} aria-label="Plaqueta ou conteúdo QR" placeholder="Digite a plaqueta ou cole o QR" value={plq} onChange={(e) => setPlq(e.target.value)} className="h-12 text-lg" />
          <Button type="submit" className="h-12">Adicionar</Button>
          <Button type="button" variant="secondary" className="h-12" aria-label="Ler QR code" onClick={() => setScan(!scan)}><Camera /></Button>
        </form>
        {scan && <QrScanner onScan={adicionar} onClose={() => { setScan(false); toast.error("Não foi possível abrir a câmera"); }} />}
        <div className="flex items-center justify-between rounded-lg bg-forest text-primary-foreground px-4 py-3">
          <span className="text-sm opacity-80">{itens.length} toras</span>
          <span className="font-display text-3xl font-bold">{fmtM3(total)} m³</span>
        </div>
      </div>

      {resumo.length > 0 && (
        <div className="bg-card border rounded-xl p-3">
          <h2 className="text-lg font-bold uppercase mb-1">Por espécie</h2>
          {resumo.map((r) => (
            <div key={r.especie} className="flex justify-between text-sm py-0.5">
              <span>{r.especie} <span className="text-muted-foreground">({r.qtd})</span></span>
              <span className="font-medium">{fmtM3(r.volume)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card border rounded-xl divide-y">
        {itens.map((t) => (
          <div key={t.plaqueta} className="flex items-center gap-3 p-3">
            <div className="font-display text-xl font-bold w-14">{t.plaqueta}</div>
            <div className="flex-1 min-w-0">
              <div className="truncate">{t.especie}</div>
              <div className="text-xs text-muted-foreground">Árv. {t.arvore} · Sec. {t.secao ?? "–"}</div>
            </div>
            <div className="text-sm font-semibold">{fmtM3(Number(t.volume))}</div>
            <Button size="icon" variant="ghost" aria-label="Remover" onClick={() => setItens(itens.filter((x) => x.plaqueta !== t.plaqueta))}><X /></Button>
          </div>
        ))}
        {!itens.length && (
          <div className="p-4 text-sm text-muted-foreground flex gap-2"><AlertTriangle className="size-4 shrink-0" />Plaquetas já carregadas são bloqueadas automaticamente.</div>
        )}
      </div>
      <Button size="lg" className="w-full h-12" disabled={busy || !itens.length} onClick={salvar}>Salvar romaneio</Button>
    </div>
  );
}
