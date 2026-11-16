/** Datas operacionais sempre no fuso de Rondônia, inclusive ao ler o QR em outro estado. */
export const FUSO_SERRARIA = "America/Porto_Velho";

export function dataHoraSerragem(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  return data.toLocaleString("pt-BR", {
    timeZone: FUSO_SERRARIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A baixa registrada no banco é a fonte de verdade, não a data impressa no QR. */
export function situacaoSerragem(serradaEm: string | null | undefined) {
  const horario = dataHoraSerragem(serradaEm);
  return horario
    ? { status: "Serrada", detalhe: "Serrada em " + horario, serrada: true }
    : { status: "Ainda não serrada", detalhe: "Sem data de serragem registrada", serrada: false };
}
