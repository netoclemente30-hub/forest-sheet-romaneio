import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Warehouse, Plus, Crosshair } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { pode } from "@/lib/funcoes";
import { getEmpresaAtiva } from "@/lib/empresa";
import { autexQuery } from "@/lib/data";
import { cadastrarExplanada, listarExplanadas } from "@/lib/explanadas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/explanadas")({
  staticData: { sitemap: false },
  component: ExplanadasPage,
});

function ExplanadasPage() {
  const { empresaId, papel } = useAuth();
  const empresa = getEmpresaAtiva() ?? empresaId ?? "";
  const podeCriar = pode(papel, "patios_criar");
  const [nome, setNome] = useState("");
  const [autex, setAutex] = useState("");
  const [gps, setGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const autorizacoes = useQuery(autexQuery);
  const cadastradas = useQuery({
    queryKey: ["explanadas", empresa],
    queryFn: () => listarExplanadas(empresa),
    enabled: !!empresa,
  });
  const autexes = (autorizacoes.data ?? []).filter((a) => !a.encerrado && (!empresa || a.empresa_id === empresa));

  function capturarGPS() {
    if (!navigator.geolocation) { toast.error("GPS indisponível neste dispositivo"); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      setGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      toast.success("Localização da explanada capturada");
    }, () => toast.error("Não foi possível capturar o GPS"), {
      enableHighAccuracy: true, timeout: 20000, maximumAge: 0,
    });
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!podeCriar || !empresa || !autex || busy) return;
    setBusy(true);
    try {
      await cadastrarExplanada({
        empresa, autex, nome,
        latitude: gps?.latitude ?? null,
        longitude: gps?.longitude ?? null,
      });
      setNome("");
      setGps(null);
      await qc.invalidateQueries({ queryKey: ["explanadas", empresa] });
      toast.success("Explanada cadastrada para esta AUTEX");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao cadastrar explanada");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold uppercase"><Warehouse /> Pátios / Explanadas</h1>
        <p className="text-sm text-muted-foreground">
          Pontos de entrega na floresta onde o tratorista deixa as toras arrastadas.
          Não se confundem com os pátios de recebimento da serraria.
        </p>
      </header>
      {cadastradas.isError && <p role="alert" className="rounded-md border p-3 text-sm">
        Explanadas ainda não habilitadas no banco. A tela está disponível para conferência,
        mas o cadastro depende da ativação da estrutura pela Lovable.
      </p>}
      {podeCriar && (
        <form onSubmit={(e) => void criar(e)} className="space-y-3 rounded-xl border bg-card p-3">
          <h2 className="font-semibold">Cadastrar nova explanada</h2>
          <label className="block text-sm font-medium">AUTEX
            <select aria-label="AUTEX da explanada" value={autex} onChange={(e) => setAutex(e.target.value)}
              className="mt-1 h-11 w-full rounded-md border bg-background px-3" required>
              <option value="">Selecione o manejo</option>
              {autexes.map((a) => <option key={a.numero} value={a.numero}>{a.numero}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Nome da explanada
            <Input className="mt-1" required minLength={2} maxLength={80}
              placeholder="Ex.: Explanada 01 — Picada 04" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <Button type="button" variant="outline" onClick={capturarGPS} className="w-full">
            <Crosshair /> {gps ? "Atualizar GPS da explanada" : "Registrar GPS da explanada (opcional)"}
          </Button>
          {gps && <p className="text-xs text-muted-foreground">
            <MapPin className="inline size-3" /> {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}
          </p>}
          <Button className="w-full" type="submit"
            disabled={busy || cadastradas.isError || !autex || !empresa}>
            <Plus /> {busy ? "Salvando…" : "Criar explanada"}
          </Button>
        </form>
      )}
      <section className="rounded-xl border bg-card">
        <h2 className="border-b p-3 font-semibold">Explanadas cadastradas ({cadastradas.data?.length ?? 0})</h2>
        <div className="divide-y">
          {(cadastradas.data ?? []).map((e) => (
            <div key={e.id} className="p-3 text-sm">
              <div className="font-semibold">{e.nome}</div>
              <p className="text-xs text-muted-foreground">AUTEX {e.autex} · {e.latitude == null ? "Sem localização GPS" : "GPS registrado"}</p>
            </div>
          ))}
          {cadastradas.isSuccess && !cadastradas.data.length &&
            <p className="p-3 text-sm text-muted-foreground">Nenhuma explanada cadastrada.</p>}
        </div>
      </section>
    </div>
  );
}
