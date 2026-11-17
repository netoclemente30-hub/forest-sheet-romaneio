export async function verificarSandbox(empresa: string) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(empresa))
    throw new Error("Empresa inválida.");
  const chave = process.env["SPEDY_SANDBOX_KEY_" + empresa.replaceAll("-", "_").toUpperCase()];
  if (!chave) return "Chave de homologação pendente no servidor.";
  try {
    const resposta = await fetch(
      "https://sandbox-api.spedy.com.br/v1/product-invoices?pageSize=1",
      {
        method: "GET",
        headers: { "X-Api-Key": chave },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
    await resposta.body?.cancel();
    if (resposta.ok) return "A Spedy aceitou a chave no sandbox.";
    if ([401, 403].includes(resposta.status))
      return "A Spedy recusou o acesso. Confira a chave da empresa.";
  } catch {
    /* A interface recebe somente um diagnóstico sem dados fiscais. */
  }
  return "Consulta indisponível. Tente novamente.";
}
