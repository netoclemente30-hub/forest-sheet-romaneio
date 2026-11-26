export const LOGO_GESTOR_FLORESTAL = "/icon-512.png";

let carregamento: Promise<Uint8Array<ArrayBuffer> | undefined> | undefined;

/** O mesmo ícone do PWA, servido localmente pelo Capacitor no Android. */
export function carregarLogoRelatorio() {
  carregamento ??= fetch(LOGO_GESTOR_FLORESTAL)
    .then(async (resposta) => {
      if (!resposta.ok) throw new Error("Ícone indisponível");
      return new Uint8Array(await resposta.arrayBuffer());
    })
    .catch(() => {
      carregamento = undefined;
      return undefined;
    });
  return carregamento;
}

export async function adicionarLogoPdf(pdf: import("jspdf").jsPDF, x: number, y: number, lado: number) {
  const logo = await carregarLogoRelatorio();
  if (!logo) return;
  pdf.addImage(logo, "PNG", x, y, lado, lado, "gestor-florestal", "FAST");
}
