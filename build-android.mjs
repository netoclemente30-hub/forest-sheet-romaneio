import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { loadEnv } from "vite";

const env = loadEnv("android", process.cwd(), "VITE_SUPABASE_");
const supabase = new URL(env.VITE_SUPABASE_URL ?? "");
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const legacyAnon = /^[\w-]+\.[\w-]+\.[\w-]+$/.test(key)
  && JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "anon";
if (supabase.protocol !== "https:" || supabase.username || supabase.password ||
    !(key.startsWith("sb_publishable_") || legacyAnon)) {
  throw new Error("Configure o endereço HTTPS e a chave pública do Supabase para o APK.");
}

const result = spawnSync(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--mode", "android"], {
  stdio: "inherit",
  timeout: 180_000,
});
if (result.status !== 0) process.exit(result.status ?? 1);

const publicDir = ".output/android/client";
const shell = publicDir + "/index.html";
if (!existsSync(shell) || !existsSync(publicDir + "/assets")) {
  throw new Error("O build Android não gerou o HTML e os recursos locais.");
}
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
cpSync(publicDir, "dist", { recursive: true });
const index = "dist/index.html";
const html = readFileSync(index, "utf8");
const origin = supabase.origin;
const policy = `connect-src 'self' ${origin} wss://${supabase.host}; object-src 'none'`;
writeFileSync(index, html.replace(/<head>/i,
  `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`));
