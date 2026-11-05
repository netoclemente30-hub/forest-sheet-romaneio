import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { autexQuery } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Plus, X } from "lucide-react";

export function AutexPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const q = useQuery(autexQuery);
  const qc = useQueryClient();
  const [novo, setNovo] = useState(false);
  const [numero, setNumero] = useState("");
  const [descricao, setDescricao] = useState("");
  const [busy, setBusy] = useState(false);
  async function salvar() {
    if (!numero.trim()) { toast.error("Informe o número da AUTEX"); return; }
    setBusy(true);
    const { error } = await supabase.from("autex").insert({ numero: numero.trim(), descricao: descricao.trim() || null });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["autex"] });
    onChange(numero.trim()); setNovo(false); setNumero(""); setDescricao("");
    toast.success("AUTEX cadastrada");
  }
  return <div className="space-y-2">
    <Label>AUTEX</Label>
    <div className="flex gap-2">
      <Select value={value || "sem"} onValueChange={(v) => onChange(v === "sem" ? "" : v)}>
        <SelectTrigger className="flex-1 min-w-0"><SelectValue placeholder="Selecionar AUTEX" /></SelectTrigger>
        <SelectContent><SelectItem value="sem">Sem AUTEX</SelectItem>{(q.data ?? []).map((a) => <SelectItem key={a.numero} value={a.numero}>{a.numero}{a.descricao ? ` · ${a.descricao}` : ""}</SelectItem>)}</SelectContent>
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