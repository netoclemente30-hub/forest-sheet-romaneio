import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { guardarCopiaOffline } from "./cache";
import { comPrazo, erroDeRede } from "./conexao";
import { getEmpresaAtiva, lerEmpresaSalva } from "@/lib/empresa";
import { sessaoDoAparelho } from "./sessao";

type Linha = Record<string, unknown>;
type Tabela = keyof Database["public"]["Tables"];
export type ProgressoOffline = {
  etapa: string;
  concluidas: number;
  total: number;
  falhas: string[];
  atualizadoEm?: number;
};

/** Páginas pequenas e ordem única: o limite do servidor não trunca a cópia. */
export async function baixarPaginas(
  buscar: (inicio: number, fim: number) => Promise<Linha[]>,
): Promise<Linha[]> {
  const linhas: Linha[] = [];
  for (let inicio = 0; ; inicio += 500) {
    const pagina = await buscar(inicio, inicio + 499);
    linhas.push(...pagina);
    if (pagina.length < 500) return linhas;
  }
}

export async function prepararDadosOffline(
  usuario: string,
  empresa: string,
  avisar: (p: ProgressoOffline) => void,
  signal?: AbortSignal,
) {
  const contexto = async () => {
    if (
      signal?.aborted ||
      (await sessaoDoAparelho())?.user.id !== usuario ||
      (getEmpresaAtiva() ?? lerEmpresaSalva(usuario)) !== empresa
    )
      throw new Error("Preparação interrompida pela troca de conta ou empresa.");
  };
  const guardar = async (nome: string, dados: unknown) => {
    await contexto();
    await guardarCopiaOffline(nome, dados, empresa, usuario);
  };
  const ler = (tabela: Tabela, ordem = "id", select = "*", filtro?: [string, string]) =>
    baixarPaginas(async (inicio, fim) => {
      await contexto();
      // A projeção variável é validada pelos consumidores; o nome permanece restrito ao schema.
      let consulta = supabase
        .from(tabela as "toras")
        .select(select as "*")
        .eq("empresa_id", empresa)
        .order(ordem);
      if (filtro) consulta = consulta.filter(filtro[0], "eq", filtro[1]);
      if (
        ordem !== "id" &&
        !["toras", "saldos", "autex", "motoristas", "veiculos", "patios"].includes(tabela)
      )
        consulta = consulta.order("id");
      const { data, error } = await comPrazo(
        consulta.range(inicio, fim).abortSignal(AbortSignal.timeout(15000)),
        16000,
      );
      if (error) throw error;
      return (data ?? []) as unknown as Linha[];
    });
  const tarefas: [string, () => Promise<void>][] = [
    ...(
      [
        ["Toras", "toras", "plaqueta"],
        ["Árvores", "arvores", "id"],
        ["AUTEX", "autex", "numero"],
        ["Romaneios de toras", "romaneios", "created_at"],
        ["Toras aguardando", "toras_aguardando", "id"],
      ] as const
    ).map(([label, table, order]): [string, () => Promise<void>] => [
      label,
      async () => {
        await guardar(table, await ler(table, order));
      },
    ]),
    [
      "Cadastros de transporte",
      async () => {
        for (const [tabela, chave, ordem] of [
          ["motoristas", "motoristas", "nome"],
          ["veiculos", "veiculos", "placa"],
          ["patios", "patios-serraria", "nome"],
        ] as const)
          await guardar(`${chave}:${empresa}`, await ler(tabela, ordem));
        const romaneios = await ler("romaneios");
        await guardar(`clientes:${empresa}`, romaneios.map((r) => r["cliente"]).filter(Boolean));
      },
    ],
    [
      "Saldo",
      async () => {
        const rows = await ler("saldos", "empresa_id");
        await guardar(`saldo-linhas:${empresa}`, rows[0]?.["linhas"] ?? []);
      },
    ],
    [
      "Madeira serrada",
      async () => {
        const rows = await ler(
          "pacotes_serrados",
          "id",
          "*, itens_pacote_serrado(*), romaneio_carga_pacotes(romaneio_id)",
        );
        await guardar(
          `madeira-serrada:${empresa}`,
          rows.map((p) => ({
            ...p,
            itens: p["itens_pacote_serrado"],
            carga_id:
              (p["romaneio_carga_pacotes"] as { romaneio_id: string }[])?.[0]?.romaneio_id ?? null,
          })),
        );
        await guardar(`autex-serradas:${empresa}`, await ler("autex", "numero"));
      },
    ],
    [
      "Cargas de madeira serrada",
      async () => {
        await guardar(`cargas-serradas:${empresa}`, await ler("romaneios_madeira_serrada"));
      },
    ],
    [
      "Romaneios importados",
      async () => {
        await guardar(
          `romaneios-serrados-importados:${empresa}`,
          await ler("romaneios_serrados_importados"),
        );
      },
    ],
    [
      "Encaixes de estoque",
      async () => {
        await guardar(
          `toras-encaixadas:${empresa}`,
          await ler(
            "registros",
            "id",
            "id,empresa_id,acao,detalhe,criado_em,revertido_em,mudancas",
            ["acao", "Encaixe confirmado"],
          ),
        );
      },
    ],
    [
      "Manejo e mapas",
      async () => {
        const autex = await ler("autex", "numero");
        const explanadas = await ler("explanadas");
        const rastros = await ler("rastros_gps");
        const arrastos = await ler("arrastos_arvores");
        const mapas = await ler("mapas_exploracao");
        await guardar("explanadas:", explanadas);
        await guardar(`arrastos-arvores:${empresa}:todas`, arrastos);
        for (const a of autex) {
          const numero = String(a["numero"]);
          const filtrar = (rows: Linha[]) => rows.filter((r) => r["autex"] === numero);
          await guardar(`explanadas:${numero}`, filtrar(explanadas));
          await guardar(`rastros:${numero}`, filtrar(rastros));
          await guardar(`arrastos-arvores:${empresa}:${numero}`, filtrar(arrastos));
          await guardar(`mapa-pdf:${numero}`, filtrar(mapas));
        }
        const { baixarMapaPdf } = await import("@/lib/mapa-pdf");
        for (const mapa of mapas) {
          await contexto();
          await comPrazo(
            baixarMapaPdf(mapa as unknown as import("@/lib/mapa-pdf").MapaPdf, true, usuario),
            120000,
          );
        }
      },
    ],
  ];
  const progresso: ProgressoOffline = {
    etapa: "Iniciando",
    concluidas: 0,
    total: tarefas.length,
    falhas: [],
  };
  for (const [etapa, tarefa] of tarefas) {
    await contexto();
    avisar({ ...progresso, etapa, falhas: [...progresso.falhas] });
    try {
      await tarefa();
      progresso.concluidas++;
    } catch (e) {
      progresso.falhas.push(
        `${etapa}: ${e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)}`,
      );
      if (erroDeRede(e) || !navigator.onLine) {
        progresso.falhas.push(
          "Conexão interrompida. Reconecte e atualize a cópia para completar as etapas restantes.",
        );
        break;
      }
    }
  }
  await contexto();
  if (!progresso.falhas.length) {
    progresso.atualizadoEm = Date.now();
    await guardar("preparacao-offline", [progresso.atualizadoEm]);
  }
  progresso.etapa = "Concluído";
  avisar({ ...progresso });
  return progresso;
}
