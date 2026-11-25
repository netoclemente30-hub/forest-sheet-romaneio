import * as XLSX from "xlsx";
import { especieSchema, censoSchema, type Censo } from "./inventario";
import { deUTM } from "./gis";
import { avaliarCenso } from "./camadas";
import type { Estado, Projeto } from "./projeto";

export function lerTabela(texto: string): Record<string, unknown>[] {
  if (texto.trim().startsWith("[")) {
    const a: unknown = JSON.parse(texto);
    if (!Array.isArray(a) || a.some((v) => !v || typeof v !== "object" || Array.isArray(v)))
      throw new Error("JSON deve ser uma lista de registros.");
    return a;
  }
  const wb = XLSX.read(texto, { type: "string", raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}
const numero = (v: unknown) => {
  if (typeof v === "number") return v;
  if (typeof v !== "string" || !v.trim()) return NaN;
  return Number(v.trim().replace(",", "."));
};
const bool = (v: unknown) => {
  if (v === true || v === "true" || v === "1" || v === "sim") return true;
  if (v === false || v === "false" || v === "0" || v === "não" || v === "nao") return false;
  throw new Error("Booleano deve ser true/false ou sim/não.");
};
export function previaTabela(texto: string, tipo: "especies" | "censo", p: Projeto) {
  const erros: string[] = [];
  const dados: Record<string, unknown>[] = [];
  lerTabela(texto).forEach((r, i) => {
    try {
      if (tipo === "especies") {
        const eq = r["equacaoVolume"];
        const entrada: Record<string, unknown> = {
          ...r,
          dmcCm: numero(r["dmcCm"]),
          fatorForma: numero(r["fatorForma"]),
        };
        if (eq === "" || eq === undefined) delete entrada["equacaoVolume"];
        else entrada["equacaoVolume"] = typeof eq === "string" ? JSON.parse(eq) : eq;
        dados.push(especieSchema.parse(entrada));
      } else {
        const entrada: Record<string, unknown> = { ...r };
        for (const k of ["dapCm", "capCm"]) {
          if (r[k] === "" || r[k] === undefined) delete entrada[k];
          else entrada[k] = numero(r[k]);
        }
        for (const k of ["alturaComercialM", "qualidadeFuste"]) entrada[k] = numero(r[k]);
        for (const k of ["cipos", "ocoAparente"]) entrada[k] = bool(r[k]);
        if (r["x"] !== undefined || r["y"] !== undefined) {
          if (
            (r["latitude"] !== undefined && r["latitude"] !== "") ||
            (r["longitude"] !== undefined && r["longitude"] !== "")
          )
            throw new Error("Escolha UTM ou Lat/Lon, não ambos.");
          Object.assign(
            entrada,
            deUTM(
              numero(r["x"]),
              numero(r["y"]),
              r["zona"] === undefined ? p.zona : numero(r["zona"]),
              p.hemisferio,
            ),
          );
          for (const k of ["x", "y", "zona"]) delete entrada[k];
        } else {
          entrada["latitude"] = numero(r["latitude"]);
          entrada["longitude"] = numero(r["longitude"]);
        }
        dados.push(censoSchema.parse(entrada));
      }
    } catch (e) {
      erros.push(`Linha ${i + 2}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  if (!dados.length && !erros.length) erros.push("Arquivo sem registros.");
  return { dados, erros };
}
export const CABECALHO_IF100 = [
  "Número da Árvore",
  "Nome UPA",
  "UT",
  "Produto",
  "Nome Científico",
  "Nome Popular",
  "CAP (m)",
  "DAP (m)",
  "Altura Comercial (m)",
  "Categoria",
  "Qualidade do Fuste",
  "Volume (m³)",
  "Área Basal (m²)",
  "Latitude",
  "Longitude",
];
export function linhasIF100(
  s: Estado,
  p: Projeto,
  upa: string,
  produto: string,
  categorias: Record<Censo["destinacao"], string>,
) {
  if (!upa.trim() || !produto.trim() || Object.values(categorias).some((v) => !v.trim()))
    throw new Error("Informe UPA, produto e categorias conforme o manual do órgão.");
  const identificador = (v: string) => {
    if (!/^[A-Za-z0-9]{1,10}$/.test(v))
      throw new Error(
        "Árvore, UPA e UT devem conter até 10 caracteres alfanuméricos para o IF100.",
      );
    return v;
  };
  identificador(upa);
  const arredondar = (v: number) => Number(v.toFixed(4));
  return [
    CABECALHO_IF100,
    ...avaliarCenso(s, p.id).map((a) => {
      const e = s.especies.find((e) => e.projetoId === p.id && e.codigo === a.especieId)!;
      return [
        identificador(a.numeroArvore),
        upa,
        identificador(s.uts.find((u) => u.id === a.ut)!.nome),
        produto,
        e.nomeCientifico,
        e.nomePopular,
        arredondar((a.dapCm * Math.PI) / 100),
        arredondar(a.dapCm / 100),
        arredondar(a.alturaComercialM),
        categorias[a.destinacao],
        a.qualidadeFuste,
        arredondar(a.volume),
        arredondar(a.areaBasal),
        a.latitude,
        a.longitude,
      ];
    }),
  ];
}
// The official IF100 manual specifies ISO-8859-1; reject lossy substitutions.
export function csvIF100(linhas: (string | number)[][]): Uint8Array<ArrayBuffer> {
  const texto = csvSeguro(linhas);
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) {
    const n = texto.charCodeAt(i);
    if (n > 255)
      throw new Error(
        "CSV IF100 exige ISO-8859-1: remova caracteres não representáveis, como emojis.",
      );
    bytes[i] = n;
  }
  return bytes;
}
export function csvSeguro(linhas: (string | number)[][]) {
  return linhas
    .map((l) =>
      l
        .map((v) => {
          const t = typeof v === "number" ? String(v).replace(".", ",") : String(v);
          const seguro = typeof v === "string" && /^[\s]*[=+@-]/.test(t) ? "'" + t : t;
          return '"' + seguro.replaceAll('"', '""') + '"';
        })
        .join(";"),
    )
    .join("\r\n");
}
export function excel(linhas: (string | number)[][]) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  ws["!cols"] = CABECALHO_IF100.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, "Inventario 100%");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
export function exportarGeo(s: Estado, pid: string) {
  return {
    type: "FeatureCollection",
    features: [
      ...s.camadas
        .filter((c) => c.projetoId === pid)
        .flatMap((c) =>
          c.geojson.features.map((f) => ({
            ...f,
            properties: { ...f.properties, camada: c.tipo, ut: c.ut },
          })),
        ),
      ...avaliarCenso(s, pid).map((a) => ({
        type: "Feature",
        properties: { ...a },
        geometry: { type: "Point", coordinates: [a.longitude, a.latitude] },
      })),
    ],
  };
}
