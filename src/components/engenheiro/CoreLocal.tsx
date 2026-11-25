import { useEffect, useState, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { lerEstado, salvarEstado } from "@/lib/engenheiro/banco";
import {
  vazio,
  validarEstado,
  type Estado,
  type Projeto,
  type Camada,
} from "@/lib/engenheiro/projeto";
import {
  especieSchema,
  censoSchema,
  chaveArvore,
  medidas,
  type Censo,
} from "@/lib/engenheiro/inventario";
import { importarCamada, avaliarCenso } from "@/lib/engenheiro/camadas";
import { paraUTM, deUTM } from "@/lib/engenheiro/gis";
import { resumo, sugerirSementes } from "@/lib/engenheiro/triagem";
import {
  previaTabela,
  linhasIF100,
  csvIF100,
  excel,
  exportarGeo,
} from "@/lib/engenheiro/intercambio";
import { salvarArquivo } from "@/lib/arquivo";

const Mapa = lazy(() => import("./MapaLocal").then((m) => ({ default: m.MapaLocal })));
type Campo = { id: string; nome: string; tipo?: string; opcoes?: { id: string; nome: string }[] };
function Formulario({
  campos,
  onSalvar,
  botao = "Salvar",
}: {
  campos: Campo[];
  onSalvar: (v: Record<string, string>) => Promise<void>;
  botao?: string;
}) {
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="my-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = e.currentTarget;
        const v = Object.fromEntries(new FormData(f)) as Record<string, string>;
        setBusy(true);
        setErro("");
        void onSalvar(v)
          .then(() => f.reset())
          .catch((e) => setErro(String(e.message ?? e)))
          .finally(() => setBusy(false));
      }}
    >
      {campos.map((c) => (
        <label key={c.id} className="grid gap-1 text-sm">
          {c.nome}
          {c.opcoes ? (
            <select required name={c.id} className="min-h-11 rounded border bg-background px-3">
              <option value="">Selecione</option>
              {c.opcoes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          ) : (
            <input
              required
              name={c.id}
              type={c.tipo ?? "text"}
              step="any"
              className="min-h-11 rounded border bg-background px-3"
            />
          )}
        </label>
      ))}
      <Button disabled={busy} className="self-end">
        {busy ? "Salvando…" : botao}
      </Button>
      {erro && (
        <p role="alert" className="col-span-full text-destructive break-words">
          {erro}
        </p>
      )}
    </form>
  );
}
const input = (id: string, nome: string, tipo?: string): Campo => ({
  id,
  nome,
  ...(tipo ? { tipo } : {}),
});
const opcoes = (id: string, nome: string, valores: { id: string; nome: string }[]): Campo => ({
  id,
  nome,
  opcoes: valores,
});
const enumOpts = (valores: string[]) => valores.map((id) => ({ id, nome: id }));
const categoria = {
  CORTE: "A explorar",
  PORTA_SEMENTE: "Porta semente",
  REMANESCENTE: "Remanescente",
  PROIBIDA_APP: "Outras",
};

export function CoreLocal({ aba }: { aba: string }) {
  const [s, setS] = useState<Estado>(vazio),
    [pronto, setPronto] = useState(false),
    [erro, setErro] = useState(""),
    [pid, setPid] = useState(""),
    [ut, setUt] = useState("");
  const [previa, setPrevia] = useState<{ s: Estado; texto: string; erros: string[] } | null>(null);
  const [sugestao, setSugestao] = useState<ReturnType<typeof sugerirSementes> | null>(null);
  useEffect(() => {
    void lerEstado()
      .then((s) => {
        setS(s);
        setPronto(true);
      })
      .catch((e) => setErro(e.message));
  }, []);
  const p = s.projetos.find((p) => p.id === pid);
  async function salvar(novo: Estado) {
    const resultado = await salvarEstado(novo);
    setS(resultado);
    setPrevia(null);
    setSugestao(null);
    setErro("");
  }
  const tentar = (fn: () => Promise<void>) => void fn().catch((e) => setErro(e.message));
  const exportar = (nome: string, blob: Blob) => salvarArquivo({ nome, blob });
  const linhas = p ? avaliarCenso(s, p.id) : [];
  async function importar(file: File, tipo: "censo" | "especies" | Camada["tipo"]) {
    if (!p) throw new Error("Selecione o projeto.");
    if (file.size > 20 * 1024 * 1024) throw new Error("Limite por arquivo: 20 MB.");
    const texto = await file.text();
    let novo: Estado;
    let erros: string[] = [];
    if (tipo === "censo" || tipo === "especies") {
      const pre = previaTabela(texto, tipo, p);
      erros = pre.erros;
      novo =
        tipo === "censo"
          ? {
              ...s,
              censo: [
                ...s.censo,
                ...pre.dados.map((d) => ({ ...d, projetoId: p.id }) as Estado["censo"][number]),
              ],
            }
          : {
              ...s,
              especies: [
                ...s.especies,
                ...pre.dados.map((d) => ({ ...d, projetoId: p.id }) as Estado["especies"][number]),
              ],
            };
    } else {
      const geojson = importarCamada(texto, file.name);
      if (
        ["APP", "UTs", "Limite_UPA"].includes(tipo) &&
        geojson.features.some((f) => !["Polygon", "MultiPolygon"].includes(f.geometry.type))
      )
        throw new Error("Esta camada exige Polygon/MultiPolygon.");
      novo = {
        ...s,
        camadas: [...s.camadas, { id: crypto.randomUUID(), projetoId: p.id, tipo, ut, geojson }],
      };
    }
    try {
      validarEstado(novo);
      avaliarCenso(novo, p.id);
    } catch (e) {
      erros.push(e instanceof Error ? e.message : String(e));
    }
    setPrevia({
      s: novo,
      texto: JSON.stringify(
        tipo === "censo"
          ? novo.censo.slice(-10)
          : tipo === "especies"
            ? novo.especies.slice(-10)
            : novo.camadas.at(-1),
        null,
        2,
      ),
      erros,
    });
  }
  const upload = (tipo: "censo" | "especies" | Camada["tipo"]) => (
    <label className="block my-3 text-sm">
      Importar {tipo}{" "}
      <input
        aria-label={`Importar ${tipo}`}
        type="file"
        accept={tipo === "censo" || tipo === "especies" ? ".csv,.json" : ".geojson,.json,.kml"}
        onChange={(e) => {
          const f = e.target.files?.[0];
          setPrevia(null);
          if (f) tentar(() => importar(f, tipo));
          e.target.value = "";
        }}
      />
    </label>
  );
  if (!pronto) return <p role="status">{erro || "Abrindo dados locais…"}</p>;
  return (
    <div className="space-y-4">
      <p className="rounded border bg-muted p-3 text-sm">
        Workspace local deste navegador. Os dados não são enviados ao servidor e ficam acessíveis a
        quem utiliza este perfil. Faça cópias de segurança antes de limpar os dados do navegador.
      </p>
      {erro && (
        <p role="alert" className="text-destructive break-words">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <label>
          Projeto{" "}
          <select
            className="border rounded p-2 max-w-full"
            value={pid}
            onChange={(e) => {
              setPid(e.target.value);
              setUt("");
              setPrevia(null);
              setSugestao(null);
            }}
          >
            <option value="">Selecione</option>
            {s.projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          UT{" "}
          <select
            className="border rounded p-2"
            value={ut}
            onChange={(e) => {
              setUt(e.target.value);
              setPrevia(null);
            }}
          >
            <option value="">Todas / selecione</option>
            {s.uts
              .filter((u) => u.projetoId === pid)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
          </select>
        </label>
      </div>
      {aba === "painel" && (
        <>
          <p>
            {s.clientes.length} clientes · {s.propriedades.length} propriedades ·{" "}
            {s.projetos.length} projetos · {s.censo.length} árvores.
          </p>
          <p>
            Comece por Clientes, Propriedades e Projetos. Cadastre UTs e espécies antes do censo.
            Importe os limites das UTs e APP antes da seleção de corte.
          </p>
        </>
      )}
      {aba === "clientes" && (
        <>
          <Formulario
            campos={[input("nome", "Nome do cliente")]}
            onSalvar={async (v) =>
              salvar({
                ...s,
                clientes: [...s.clientes, { id: crypto.randomUUID(), nome: v["nome"]! }],
              })
            }
          />
          {s.clientes.map((c) => (
            <p key={c.id}>{c.nome}</p>
          ))}
        </>
      )}
      {aba === "propriedades" && (
        <>
          <Formulario
            campos={[
              input("nome", "Nome da propriedade"),
              opcoes("clienteId", "Cliente", s.clientes),
            ]}
            onSalvar={async (v) =>
              salvar({
                ...s,
                propriedades: [
                  ...s.propriedades,
                  { id: crypto.randomUUID(), nome: v["nome"]!, clienteId: v["clienteId"]! },
                ],
              })
            }
          />
          {s.propriedades.map((c) => (
            <p key={c.id}>{c.nome}</p>
          ))}
        </>
      )}
      {aba === "projetos" && (
        <>
          <Formulario
            campos={[
              input("nome", "Nome do projeto"),
              opcoes("propriedadeId", "Propriedade", s.propriedades),
              opcoes("tipo", "Tipo", enumOpts(["PMFS", "POA"])),
              input("zona", "Zona UTM SIRGAS 2000", "number"),
              opcoes("hemisferio", "Hemisfério", enumOpts(["S", "N"])),
              input("intensidadeMax", "Intensidade alvo máxima (m³/ha)", "number"),
              input("percentualSementes", "Mínimo de porta-sementes (%)", "number"),
            ]}
            onSalvar={async (v) =>
              salvar({
                ...s,
                projetos: [
                  ...s.projetos,
                  {
                    id: crypto.randomUUID(),
                    ...v,
                    zona: Number(v["zona"]),
                    intensidadeMax: Number(v["intensidadeMax"]),
                    percentualSementes: Number(v["percentualSementes"]),
                  } as Projeto,
                ],
              })
            }
          />
          {p && (
            <>
              <h3 className="font-bold">Parâmetros de {p.nome}</h3>
              <Formulario
                botao="Atualizar parâmetros"
                campos={[
                  input("zona", `Zona atual: ${p.zona}`, "number"),
                  opcoes("hemisferio", "Hemisfério", enumOpts(["S", "N"])),
                  input("intensidadeMax", `Intensidade atual: ${p.intensidadeMax} m³/ha`, "number"),
                  input("percentualSementes", `Mínimo atual: ${p.percentualSementes}%`, "number"),
                ]}
                onSalvar={async (v) =>
                  salvar({
                    ...s,
                    projetos: s.projetos.map((x) =>
                      x.id === p.id
                        ? {
                            ...x,
                            zona: Number(v["zona"]),
                            hemisferio: v["hemisferio"] as "S" | "N",
                            intensidadeMax: Number(v["intensidadeMax"]),
                            percentualSementes: Number(v["percentualSementes"]),
                          }
                        : x,
                    ),
                  })
                }
              />
              <h3 className="font-bold">Unidades de trabalho</h3>
              <Formulario
                campos={[
                  input("nome", "Nome / número UT"),
                  input("areaHa", "Área efetiva da UT (ha)", "number"),
                ]}
                onSalvar={async (v) =>
                  salvar({
                    ...s,
                    uts: [
                      ...s.uts,
                      {
                        id: crypto.randomUUID(),
                        projetoId: p.id,
                        nome: v["nome"]!,
                        areaHa: Number(v["areaHa"]),
                      },
                    ],
                  })
                }
              />
              {s.uts
                .filter((u) => u.projetoId === p.id)
                .map((u) => (
                  <p key={u.id}>
                    {u.nome} · {u.areaHa} ha · ID para importação: <code>{u.id}</code>
                  </p>
                ))}
              <h3 className="font-bold">Espécies (novo código ou atualização)</h3>
              <Formulario
                campos={[
                  input("codigo", "Código"),
                  input("nomePopular", "Nome popular"),
                  input("nomeCientifico", "Nome científico"),
                  input("dmcCm", "DMC configurado (cm)", "number"),
                  input("fatorForma", "Fator de forma", "number"),
                  opcoes(
                    "statusLegal",
                    "Situação",
                    enumOpts(["COMERCIAL", "PROIBIDA_IMUNE", "RARA"]),
                  ),
                ]}
                onSalvar={async (v) => {
                  const anterior = s.especies.find(
                    (x) => x.projetoId === p.id && x.codigo === v["codigo"],
                  );
                  const e = especieSchema.parse({
                    ...v,
                    ...(anterior?.equacaoVolume ? { equacaoVolume: anterior.equacaoVolume } : {}),
                    dmcCm: Number(v["dmcCm"]),
                    fatorForma: Number(v["fatorForma"]),
                  });
                  await salvar({
                    ...s,
                    especies: [
                      ...s.especies.filter((x) => !(x.projetoId === p.id && x.codigo === e.codigo)),
                      { ...e, projetoId: p.id },
                    ],
                  });
                }}
              />
              {upload("especies")}
              <p className="text-xs">
                CSV/JSON: codigo, nomePopular, nomeCientifico, dmcCm, fatorForma, statusLegal.
                Equação opcional em JSON: equacaoVolume com a, b, c para V = a × DAP(cm)^b × H(m)^c.
                Sem equação, V = G × H × fatorForma.
              </p>
              {s.especies
                .filter((e) => e.projetoId === p.id)
                .map((e) => (
                  <p key={e.codigo}>
                    {e.codigo} · {e.nomePopular} · DMC {e.dmcCm} cm · fator {e.fatorForma} ·{" "}
                    {e.statusLegal}
                  </p>
                ))}
            </>
          )}
        </>
      )}
      {p && aba === "inventario" && (
        <>
          <Coletor
            s={s}
            p={p}
            ut={ut}
            onSalvar={async (a) => salvar({ ...s, censo: [...s.censo, { ...a, projetoId: p.id }] })}
          />
          {upload("censo")}
          <p className="text-xs">
            Importação: ut (ID), faixaPicada, numeroArvore, especieId (código), capCm ou dapCm,
            alturaComercialM, qualidadeFuste, cipos, ocoAparente, destinacao, latitude/longitude ou
            x/y/zona. Booleanos explícitos true/false. Prévia das últimas 10 linhas.
          </p>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>UT / Árvore</th>
                  <th>DAP cm</th>
                  <th>Volume m³</th>
                  <th>Destinação / alertas</th>
                </tr>
              </thead>
              <tbody>
                {linhas
                  .filter((a) => !ut || a.ut === ut)
                  .map((a) => (
                    <tr key={chaveArvore(a)} className="border-b">
                      <td>
                        {s.uts.find((u) => u.id === a.ut)?.nome} / {a.numeroArvore}
                      </td>
                      <td>{a.dapCm.toFixed(2)}</td>
                      <td>{a.volume.toFixed(4)}</td>
                      <td>
                        {a.destinacao} {a.alertas.join("; ")}
                        <select
                          aria-label={`Alterar destinação da árvore ${a.numeroArvore}`}
                          className="block border rounded p-2"
                          value={
                            s.censo.find(
                              (x) => x.projetoId === p.id && chaveArvore(x) === chaveArvore(a),
                            )?.destinacao
                          }
                          onChange={(e) => {
                            const destinacao = e.target.value as Censo["destinacao"];
                            tentar(() =>
                              salvar({
                                ...s,
                                censo: s.censo.map((x) =>
                                  x.projetoId === p.id && chaveArvore(x) === chaveArvore(a)
                                    ? { ...x, destinacao }
                                    : x,
                                ),
                              }),
                            );
                          }}
                        >
                          {Object.keys(categoria).map((d) => (
                            <option
                              key={d}
                              value={d}
                              disabled={d === "CORTE" && a.alertas.length > 0}
                            >
                              {d}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {p && aba === "mapas" && (
        <>
          {(["Limite_UPA", "UTs", "Hidrografia", "APP", "Patios_Estradas"] as const).map((t) => (
            <div key={t}>{upload(t)}</div>
          ))}
          <p>
            GeoJSON/KML em longitude/latitude WGS84. Para camada UTs, selecione a UT acima. APP deve
            ser uma poligonal já delimitada pelo responsável técnico.
          </p>
          <Suspense fallback={<p>Carregando mapa…</p>}>
            <Mapa
              s={s}
              p={p}
              ut={ut}
              onSalvar={async (c) => {
                try {
                  await salvar({ ...s, camadas: [...s.camadas, c] });
                } catch (e) {
                  setErro(String(e));
                  throw e;
                }
              }}
            />
          </Suspense>
        </>
      )}
      {p && ["volumetria", "estatisticas", "pmfs-poa"].includes(aba) && (
        <>
          <p>
            Denominador de sementes: todos os indivíduos da espécie na UT. Área usada: área efetiva
            informada no cadastro. Sugestão espacial é heurística; exige revisão técnica.
          </p>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["UT", "Espécie", "N", "G m²", "V m³", "Corte m³/ha", "Sementes %"].map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumo(s, p.id).map((r) => (
                  <tr key={r.utId + r.codigo} className="border-b">
                    <td>{r.ut}</td>
                    <td>{r.especie}</td>
                    <td>{r.total}</td>
                    <td>{r.areaBasal.toFixed(4)}</td>
                    <td>{r.volume.toFixed(4)}</td>
                    <td>{r.corteHa.toFixed(3)}</td>
                    <td>{r.percentual.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {s.uts
            .filter((u) => u.projetoId === p.id)
            .map((u) => {
              const intensidade =
                linhas
                  .filter((a) => a.ut === u.id && a.destinacao === "CORTE")
                  .reduce((n, a) => n + a.volume, 0) / u.areaHa;
              return (
                <p key={u.id} className={intensidade > p.intensidadeMax ? "text-destructive" : ""}>
                  {u.nome}: {intensidade.toFixed(3)} m³/ha / alvo {p.intensidadeMax}
                  {intensidade > p.intensidadeMax ? " — excede a intensidade configurada" : ""}
                </p>
              );
            })}
          <Button onClick={() => setSugestao(sugerirSementes(s, p.id))}>
            Sugerir porta-sementes
          </Button>
          {sugestao && (
            <div className="border p-3">
              <p>
                {sugestao.selecionadas.size} árvores sugeridas:{" "}
                {[...sugestao.selecionadas].join(", ")}
              </p>
              {sugestao.avisos.map((v) => (
                <p key={v}>{v}</p>
              ))}
              <Button
                onClick={() =>
                  tentar(() =>
                    salvar({
                      ...s,
                      censo: s.censo.map((a) =>
                        a.projetoId === p.id && sugestao.selecionadas.has(chaveArvore(a))
                          ? { ...a, destinacao: "PORTA_SEMENTE" }
                          : a,
                      ),
                    }),
                  )
                }
              >
                Confirmar sugestão
              </Button>
            </div>
          )}
        </>
      )}
      {p && ["pmfs-poa", "relatorios"].includes(aba) && (
        <>
          <p>
            Exportação para revisão no formato de colunas do inventário 100% do Ibama. CSV
            ISO-8859-1 e Excel de conferência. Confira espécies no SISTAXON, produto, limites,
            intensidade e sementes antes de importar. Não constitui aprovação nem envio ao
            Sinaflor+.
          </p>
          <Formulario
            botao="Exportar arquivo"
            campos={[
              input("upa", "Nome UPA"),
              input("produto", "Produto conforme catálogo Ibama (ex.: Tora (m³))"),
              opcoes("formato", "Formato", enumOpts(["CSV", "Excel"])),
            ]}
            onSalvar={async (v) => {
              const l = linhasIF100(s, p, v["upa"]!, v["produto"]!, categoria);
              if (v["formato"] === "CSV")
                await exportar(
                  "inventario-if100-revisao.csv",
                  new Blob([csvIF100(l)], { type: "text/csv;charset=iso-8859-1" }),
                );
              else
                await exportar(
                  "inventario-conferencia.xlsx",
                  new Blob([excel(l)], {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  }),
                );
            }}
          />
          <Button
            variant="outline"
            onClick={() =>
              tentar(() =>
                exportar(
                  "projeto.geojson",
                  new Blob([JSON.stringify(exportarGeo(s, p.id))], {
                    type: "application/geo+json",
                  }),
                ),
              )
            }
          >
            Exportar GeoJSON
          </Button>
        </>
      )}
      {aba === "sincronizacao" && (
        <>
          <p>Armazenamento exclusivamente local. Não há sincronização com servidor.</p>
          <Button
            onClick={() =>
              tentar(() =>
                exportar(
                  "engenheiro-backup.json",
                  new Blob([JSON.stringify(s, null, 2)], { type: "application/json" }),
                ),
              )
            }
          >
            Baixar cópia de segurança
          </Button>
        </>
      )}
      {!p && !["clientes", "propriedades", "projetos", "painel", "sincronizacao"].includes(aba) && (
        <p>Cadastre e selecione um projeto para trabalhar nesta aba.</p>
      )}
      {previa && (
        <section className="rounded border p-4 space-y-2">
          <h3 className="font-bold">Pré-visualização — nada foi salvo</h3>
          {previa.erros.map((e, i) => (
            <p key={i} role="alert" className="text-destructive whitespace-pre-wrap">
              {e}
            </p>
          ))}
          <pre className="max-h-64 overflow-auto text-xs">{previa.texto}</pre>
          <Button disabled={!!previa.erros.length} onClick={() => tentar(() => salvar(previa.s))}>
            Confirmar importação
          </Button>
          <Button variant="outline" onClick={() => setPrevia(null)}>
            Cancelar
          </Button>
        </section>
      )}
    </div>
  );
}

function Coletor({
  s,
  p,
  ut,
  onSalvar,
}: {
  s: Estado;
  p: Projeto;
  ut: string;
  onSalvar: (a: Censo) => Promise<void>;
}) {
  const [v, setV] = useState<Record<string, string>>({
      destinacao: "CORTE",
      qualidadeFuste: "1",
      cipos: "false",
      ocoAparente: "false",
    }),
    [erro, setErro] = useState(""),
    [modo, setModo] = useState("latlon"),
    [busy, setBusy] = useState(false);
  const e = s.especies.find((e) => e.projetoId === p.id && e.codigo === v["especieId"]);
  let preview = "";
  let arvore: Censo | undefined;
  let destino = "";
  let bloqueioCorte = false;
  try {
    const { projetoId: _, ...esp } = e!;
    const dap = Number(v["dapCm"]);
    const m = medidas(dap, Number(v["alturaComercialM"]), esp);
    preview = `DAP ${dap.toFixed(2)} cm · G ${m.areaBasal.toFixed(4)} m² · V ${m.volume.toFixed(4)} m³`;
    if (
      (modo === "utm" ? [v["x"], v["y"]] : [v["latitude"], v["longitude"]]).some((x) => !x?.trim())
    )
      throw new Error("Coordenadas obrigatórias");
    const coord =
      modo === "utm"
        ? deUTM(Number(v["x"]), Number(v["y"]), p.zona, p.hemisferio)
        : { latitude: Number(v["latitude"]), longitude: Number(v["longitude"]) };
    const u = paraUTM(coord, p.zona, p.hemisferio);
    preview = `DAP ${dap.toFixed(2)} cm · G ${m.areaBasal.toFixed(4)} m² · V ${m.volume.toFixed(4)} m³ · Lat/Lon ${coord.latitude.toFixed(6)}, ${coord.longitude.toFixed(6)} · UTM ${u.x.toFixed(2)} / ${u.y.toFixed(2)}`;
    arvore = censoSchema.parse({
      ut,
      faixaPicada: v["faixaPicada"],
      numeroArvore: v["numeroArvore"],
      especieId: v["especieId"],
      dapCm: dap,
      alturaComercialM: Number(v["alturaComercialM"]),
      qualidadeFuste: Number(v["qualidadeFuste"]),
      cipos: v["cipos"] === "true",
      ocoAparente: v["ocoAparente"] === "true",
      destinacao: v["destinacao"],
      ...coord,
    });
    const aval = avaliarCenso({ ...s, censo: [{ ...arvore, projetoId: p.id }] }, p.id)[0]!;
    bloqueioCorte = aval.alertas.length > 0;
    destino = `${aval.destinacao} ${aval.alertas.join("; ")}`;
    arvore = { ...arvore, destinacao: aval.destinacao };
  } catch {
    arvore = undefined;
    /* incomplete form */
  }
  const campo = (id: string, nome: string, tipo = "text") => (
    <label key={id} className="grid gap-1 text-sm">
      {nome}
      <input
        required
        type={tipo}
        step="any"
        className="min-h-11 border rounded px-3 bg-background"
        value={v[id] ?? ""}
        onChange={(ev) => {
          const val = ev.target.value;
          setV({
            ...v,
            [id]: val,
            ...(id === "capCm"
              ? { dapCm: val ? String(Number(val) / Math.PI) : "" }
              : id === "dapCm"
                ? { capCm: val ? String(Number(val) * Math.PI) : "" }
                : {}),
          });
        }}
      />
    </label>
  );
  const select = (id: string, nome: string, opts: { id: string; nome: string }[]) => (
    <label className="grid gap-1 text-sm">
      {nome}
      <select
        required
        className="min-h-11 border rounded px-3 bg-background"
        value={v[id] ?? ""}
        onChange={(e) => setV({ ...v, [id]: e.target.value })}
      >
        <option value="">Selecione</option>
        {opts.map((o) => (
          <option
            key={o.id}
            value={o.id}
            disabled={
              id === "destinacao" &&
              o.id === "CORTE" &&
              (e?.statusLegal !== "COMERCIAL" ||
                Number(v["dapCm"]) < (e?.dmcCm ?? Infinity) ||
                bloqueioCorte)
            }
          >
            {o.nome}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!arvore) {
          setErro("Revise UT, espécie, medidas e coordenadas.");
          return;
        }
        setBusy(true);
        void onSalvar(arvore)
          .then(() => {
            setV({ ...v, numeroArvore: "" });
            setErro("");
          })
          .catch((e) => setErro(e.message))
          .finally(() => setBusy(false));
      }}
    >
      {campo("numeroArvore", "Placa / número da árvore")}
      {campo("faixaPicada", "Faixa / picada")}
      {select(
        "especieId",
        "Espécie",
        s.especies
          .filter((e) => e.projetoId === p.id)
          .map((e) => ({ id: e.codigo, nome: e.nomePopular })),
      )}
      {campo("capCm", "CAP (cm)", "number")}
      {campo("dapCm", "DAP (cm)", "number")}
      {campo("alturaComercialM", "Altura comercial (m)", "number")}
      {select("qualidadeFuste", "Qualidade do fuste", enumOpts(["1", "2", "3"]))}
      {select("cipos", "Cipós", [
        { id: "true", nome: "Sim" },
        { id: "false", nome: "Não" },
      ])}
      {select("ocoAparente", "Oco aparente", [
        { id: "true", nome: "Sim" },
        { id: "false", nome: "Não" },
      ])}
      {select(
        "destinacao",
        "Destinação solicitada",
        enumOpts(["CORTE", "PORTA_SEMENTE", "REMANESCENTE", "PROIBIDA_APP"]),
      )}
      <label>
        Coordenadas
        <select
          className="border p-2 rounded"
          value={modo}
          onChange={(e) => {
            setModo(e.target.value);
            setV({ ...v, x: "", y: "", latitude: "", longitude: "" });
          }}
        >
          <option value="latlon">Lat/Lon WGS84</option>
          <option value="utm">UTM SIRGAS 2000 — zona do projeto</option>
        </select>
      </label>
      <div className="flex flex-col justify-end gap-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (typeof navigator === "undefined" || !navigator.geolocation) {
              setErro("GPS não suportado neste aparelho.");
              return;
            }
            setErro("");
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const lat = Number(pos.coords.latitude.toFixed(6));
                const lon = Number(pos.coords.longitude.toFixed(6));
                const acc = Math.round(pos.coords.accuracy || 0);
                try {
                  const zona = Number((projeto as any)?.zonaUtm ?? (projeto as any)?.zona ?? 20);
                  const hem = ((projeto as any)?.hemisferio ?? "S") as "S" | "N";
                  const utm = paraUTM({ latitude: lat, longitude: lon }, zona, hem);
                  setV((prev: Record<string, string>) => ({
                    ...prev,
                    latitude: String(lat),
                    longitude: String(lon),
                    x: String(Number(utm.x.toFixed(2))),
                    y: String(Number(utm.y.toFixed(2))),
                  }));
                  setErro(`GPS capturado (± ${acc} m).`);
                } catch {
                  setModo("latlon");
                  setV((prev: Record<string, string>) => ({
                    ...prev,
                    latitude: String(lat),
                    longitude: String(lon),
                  }));
                  setErro(`GPS capturado em Lat/Lon (± ${acc} m).`);
                }
              },
              (err) => {
                setErro(
                  err.code === 1
                    ? "Permissão de localização negada no navegador."
                    : "Não foi possível obter sinal de GPS agora."
                );
              },
              { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
          }}
        >
          Capturar GPS
        </Button>
      </div>
      {modo === "utm" ? (
        <>
          {campo("x", "Este X (m)", "number")}
          {campo("y", "Norte Y (m)", "number")}
        </>
      ) : (
        <>
          {campo("latitude", "Latitude", "number")}
          {campo("longitude", "Longitude", "number")}
        </>
      )}
      <p className="col-span-full text-sm">{preview}</p>
      <p className="col-span-full text-sm" role="status">
        Destinação efetiva: {destino || "Preencha a ficha"}
      </p>
      <Button disabled={busy || !arvore}>Salvar árvore localmente</Button>
      {erro && (
        <p role="alert" className="col-span-full text-destructive">
          {erro}
        </p>
      )}
    </form>
  );
}
