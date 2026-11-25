export type Mbtiles = {
  nome: string;
  mime: string;
  minzoom: number;
  maxzoom: number;
  bounds: [number, number, number, number] | null;
  tile: (z: number, x: number, y: number) => Uint8Array | null;
  fechar: () => void;
};

/** Opens a local .mbtiles (SQLite) entirely in the browser via sql.js — no network. */
export async function abrirMbtiles(bytes: Uint8Array, nomeArquivo: string): Promise<Mbtiles> {
  const initSqlJs = (await import("sql.js")).default;
  const wasm = (await import("sql.js/dist/sql-wasm.wasm?url")).default;
  const SQL = await initSqlJs({ locateFile: () => wasm } as unknown as Parameters<typeof initSqlJs>[0]);
  const db = new SQL.Database(bytes);
  const meta: Record<string, string> = {};
  try {
    const r = db.exec("SELECT name, value FROM metadata");
    for (const [k, v] of r[0]?.values ?? []) meta[String(k)] = String(v);
  } catch {
    db.close();
    throw new Error("Arquivo .mbtiles inválido (sem tabela metadata).");
  }
  const formato = (meta["format"] ?? "png").toLowerCase();
  if (formato === "pbf") {
    db.close();
    throw new Error("MBTiles vetorial (pbf) não suportado; use MBTiles raster (png/jpg/webp).");
  }
  const b = (meta["bounds"] ?? "").split(",").map(Number);
  const stmt = db.prepare(
    "SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?",
  );
  return {
    nome: meta["name"] ?? nomeArquivo,
    mime: formato === "jpg" || formato === "jpeg" ? "image/jpeg" : `image/${formato}`,
    minzoom: Number(meta["minzoom"] ?? 0),
    maxzoom: Number(meta["maxzoom"] ?? 22),
    bounds: b.length === 4 && b.every(Number.isFinite) ? (b as [number, number, number, number]) : null,
    tile(z, x, y) {
      stmt.bind([z, x, 2 ** z - 1 - y]); // MBTiles uses TMS rows
      const dado = stmt.step() ? (stmt.get()[0] as Uint8Array) : null;
      stmt.reset();
      return dado;
    },
    fechar() {
      stmt.free();
      db.close();
    },
  };
}
