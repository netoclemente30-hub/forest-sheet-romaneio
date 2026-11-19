import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cadastrarEmpresaSpedy, enviarCertificadoSpedy, verificarCadastroSpedy } from "@/lib/spedy.functions";
import { REGIMES } from "@/lib/spedy-onboarding.core";
import type { Cadastro } from "@/lib/fiscal";

type Res = { ok: boolean; mensagem: string; situacao?: string; existe?: boolean; vinculada?: boolean; nome?: string | null; atual?: { expirationAt: string | null; subject: string | null } };
const data = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "sem data");

export function OnboardingSpedy({ empresa, cadastro }: { empresa: string; cadastro: Cadastro }) {
  const verificar = useServerFn(verificarCadastroSpedy);
  const cadastrar = useServerFn(cadastrarEmpresaSpedy);
  const enviar = useServerFn(enviarCertificadoSpedy);
  const vazio = () => ({
    nome: "", razao: cadastro.nome, cnpj: cadastro.cnpj, ie: cadastro.ie, regime: "",
    logradouro: cadastro.endereco?.logradouro ?? "", numero: cadastro.endereco?.numero ?? "", complemento: cadastro.endereco?.complemento ?? "",
    bairro: cadastro.endereco?.bairro ?? "", municipio: cadastro.endereco?.municipio ?? "", ibge: "", uf: cadastro.endereco?.uf ?? "", cep: cadastro.endereco?.cep ?? "",
  });
  const [f, setF] = useState<Record<string, string>>(vazio);
  const [busca, setBusca] = useState<Res | null>(null);
  const [confirmaCriar, setConfirmaCriar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState("");
  // Certificado: somente em memória do componente, nunca persistido.
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [confirmaEnvio, setConfirmaEnvio] = useState(false);
  const [substituir, setSubstituir] = useState<Res["atual"] | null>(null);
  const [confirmaSubst, setConfirmaSubst] = useState(false);
  const [chaveInput, setChaveInput] = useState(0);
  const enviando = useRef(false);

  const limparCertificado = () => { setArquivo(null); setSenha(""); setConfirmaEnvio(false); setSubstituir(null); setConfirmaSubst(false); setChaveInput((k) => k + 1); };
  useEffect(() => {
    setF(vazio()); setBusca(null); setMsg(""); setConfirmaCriar(false); limparCertificado();
    return () => { setArquivo(null); setSenha(""); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa]);

  async function travar<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (enviando.current) return undefined;
    enviando.current = true; setOcupado(true);
    try { return await fn(); }
    catch { toast.error("Falha na comunicação com o servidor."); return undefined; }
    finally { enviando.current = false; setOcupado(false); }
  }
  const campo = (k: string, rot: string, extra: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <label className="grid text-sm">{rot}<Input value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} /></label>
  );
  const dados = () => ({
    nome: f["nome"], razao: f["razao"], cnpj: f["cnpj"], ie: f["ie"], regime: f["regime"],
    endereco: { logradouro: f["logradouro"], numero: f["numero"], complemento: f["complemento"], bairro: f["bairro"], municipio: f["municipio"], ibge: f["ibge"], uf: f["uf"], cep: f["cep"] },
  });

  return (
    <div className="space-y-4 rounded-md border p-3">
      <h3 className="font-semibold">Spedy (homologação): empresa e certificado A1</h3>
      <p className="text-sm text-muted-foreground">O CNPJ precisa ser o mesmo do cadastro desta empresa no Gestor. Nada é enviado sem a sua confirmação.</p>

      <div className="grid gap-2 sm:grid-cols-2">
        {campo("cnpj", "CNPJ (Spedy)", { maxLength: 18 })}
        {campo("razao", "Razão social (Spedy)", { maxLength: 80 })}
        {campo("nome", "Nome fantasia (Spedy)", { maxLength: 80 })}
        {campo("ie", "Inscrição estadual (Spedy)", { maxLength: 20 })}
        <label className="grid text-sm">Regime tributário (Spedy)
          <select className="h-10 rounded-md border bg-background px-2" value={f["regime"]} onChange={(e) => setF({ ...f, regime: e.target.value })}>
            <option value="">Selecione</option>
            {Object.entries(REGIMES).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </label>
        {campo("logradouro", "Logradouro (Spedy)", { maxLength: 100 })}
        {campo("numero", "Número (Spedy)", { maxLength: 10 })}
        {campo("complemento", "Complemento (Spedy)", { maxLength: 150 })}
        {campo("bairro", "Bairro (Spedy)", { maxLength: 100 })}
        {campo("municipio", "Município (Spedy)", { maxLength: 100 })}
        {campo("ibge", "Código IBGE do município (Spedy)", { maxLength: 7, inputMode: "numeric" })}
        {campo("uf", "UF (Spedy)", { maxLength: 2 })}
        {campo("cep", "CEP (Spedy)", { maxLength: 9 })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={ocupado} onClick={() => travar(async () => {
          const r = (await verificar({ data: { empresa, cnpj: f["cnpj"] ?? "" } })) as Res;
          setBusca(r); setMsg(r.ok ? (r.existe ? (r.vinculada ? "Empresa já cadastrada e vinculada." : `Empresa encontrada na Spedy${r.nome ? `: ${r.nome}` : ""}. Você pode vinculá-la.`) : "CNPJ ainda não cadastrado na Spedy.") : r.mensagem);
        })}>Verificar CNPJ na Spedy</Button>
        {busca?.ok && busca.existe && !busca.vinculada && (
          <Button disabled={ocupado} onClick={() => travar(async () => {
            if (!window.confirm("Vincular a empresa encontrada na Spedy? O cadastro e o certificado dela não serão alterados.")) return;
            const r = await cadastrar({ data: { empresa, modo: "vincular", confirmacao: "HOMOLOGACAO", dados: { cnpj: f["cnpj"] } } });
            setMsg(r.mensagem); if (r.ok) setBusca({ ...busca, vinculada: true });
          })}>Vincular esta empresa</Button>
        )}
      </div>
      {busca?.ok && !busca.existe && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmaCriar} onChange={(e) => setConfirmaCriar(e.target.checked)} />Confirmo o cadastro desta empresa na Spedy (homologação).</label>
          <Button disabled={!confirmaCriar || ocupado} onClick={() => travar(async () => {
            const r = (await cadastrar({ data: { empresa, modo: "criar", confirmacao: "HOMOLOGACAO", dados: dados() } })) as Res;
            setMsg(r.mensagem); setConfirmaCriar(false);
            if (r.situacao === "criada") setBusca({ ok: true, mensagem: "", existe: true, vinculada: true });
            else setBusca(null); // incerto/erro: obriga nova verificação antes de repetir
          })}>Cadastrar empresa na Spedy</Button>
        </div>
      )}
      {msg && <p className="text-sm" role="status">{msg}</p>}

      <div className="space-y-2 border-t pt-3">
        <h4 className="font-medium">Certificado A1</h4>
        <p className="text-sm text-muted-foreground">O arquivo e a senha vão direto para a Spedy e não ficam guardados no Gestor nem neste aparelho. A senha e a validade são conferidas pela Spedy.</p>
        <Input key={chaveInput} type="file" accept=".pfx" aria-label="Arquivo do certificado A1 (.pfx)" onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setSubstituir(null); setConfirmaSubst(false); }} />
        <Input type="password" autoComplete="off" placeholder="Senha do certificado" aria-label="Senha do certificado" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmaEnvio} onChange={(e) => setConfirmaEnvio(e.target.checked)} />Confirmo o envio deste certificado à Spedy (homologação).</label>
        {substituir && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmaSubst} onChange={(e) => setConfirmaSubst(e.target.checked)} />
            Substituir o certificado ativo ({substituir.subject ?? "sem titular"} · validade {data(substituir.expirationAt)}).</label>
        )}
        <div className="flex gap-2">
          <Button disabled={!arquivo || !senha || !confirmaEnvio || (!!substituir && !confirmaSubst) || ocupado} onClick={() => travar(async () => {
            if (!arquivo) return;
            const fd = new FormData();
            fd.append("empresa", empresa); fd.append("confirmacao", "HOMOLOGACAO");
            fd.append("arquivo", arquivo); fd.append("senha", senha);
            if (substituir && confirmaSubst) fd.append("substituir", "1");
            const r = (await enviar({ data: fd })) as Res & { certificado?: { expirationAt: string | null; subject: string | null } };
            if (r.situacao === "confirmar_substituicao") { setSubstituir(r.atual ?? { expirationAt: null, subject: null }); setMsg(r.mensagem); return; }
            setMsg(r.situacao === "enviado" ? `${r.mensagem} Titular: ${r.certificado?.subject ?? "—"} · validade ${data(r.certificado?.expirationAt)}.` : r.mensagem);
            limparCertificado(); // nunca reenvia sozinho
          })}>{ocupado ? "Enviando…" : "Enviar certificado"}</Button>
          <Button variant="outline" disabled={ocupado} onClick={limparCertificado}>Limpar</Button>
        </div>
      </div>
    </div>
  );
}
