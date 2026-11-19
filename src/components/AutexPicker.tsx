import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { autexQuery } from "@/lib/data";
import { empresaIdGravacao } from "@/lib/empresa";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Plus, X } from "lucide-react";
import { fila } from '@/lib/offline/fila';
import { capturarLog } from '@/lib/registro';
import { useAuth } from '@/hooks/useAuth';

export function AutexPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { empresaId } = useAuth();
  const q = useQuery(autexQuery);
  const qc = useQueryClient();
  const [novo, setNovo] = useState(false);
  const [numero, setNumero] = useState("");
  const [descricao, setDescricao] = useState("");
  const [busy, setBusy] = useState(false);
  async function salvar() {
    if (!numero.trim()) { toast.error("Informe o número da AUTEX"); return; }
    setBusy(true);
    try {
      const empresa = empresaIdGravacao().empresa_id ?? empresaId;
      if (!empresa) throw new Error('Escolha uma empresa');
      await fila().enfileirar({ tipo: 'cadastro_upsert', tabela: 'autex', empresa_id: empresa, conflito: 'empresa_id,numero', dados: { numero: numero.trim(), descricao: descricao.trim() || null }, log: await capturarLog('AUTEX cadastrada', numero.trim()) });
      await qc.invalidateQueries({ queryKey: ['autex'] });
      onChange(numero.trim()); setNovo(false); setNumero(''); setDescricao('');
      toast.success('AUTEX guardada no aparelho — aguarda confirmação na nuvem');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível guardar a AUTEX'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2">
    <Label>AUTEX</Label>
    <div className="flex gap-2">
      <Select value={value || "sem"} onValueChange={(v) => { if (v) onChange(v === "sem" ? "" : v); }}>
        <SelectTrigger className="flex-1 min-w-0"><SelectValue placeholder="Selecionar AUTEX" /></SelectTrigger>
        <SelectContent><SelectItem value="sem">Sem AUTEX</SelectItem>{(q.data ?? []).filter((a) => !a.encerrado || a.numero === value).map((a) => <SelectItem key={a.numero} value={a.numero}>{a.numero}{a.descricao ? ` · ${a.descricao}` : ""}{a.encerrado ? " (encerrado)" : ""}</SelectItem>)}</SelectContent>
      </Select>
      <Button type="button" variant="outline" onClick={() => setNovo(!novo)} aria-label={novo ? "Cancelar cadastro AUTEX" : "Adicionar AUTEX"}>{novo ? <X /> : <Plus />}</Button>
    </div>
    {novo && <div className="space-y-2 border-l-2 pl-3">
      <Input aria-label="Número da AUTEX" placeholder="Número da AUTEX" value={numero} onChange={(e) => setNumero(e.target.value)} />
      <Input aria-label="Descrição da AUTEX" placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      <Button type="button" disabled={busy} onClick={salvar}>Cadastrar AUTEX</Button>
    </div>}
    {q.isError && <p className="text-sm text-destructive">Não foi possível carregar as AUTEX.</p>}
  </div>;
}