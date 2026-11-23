# Envio de notas ao contador

## Problema confirmado
O cadastro do contador salva a opção de envio automático, mas nenhuma emissão ou consulta de nota envia e-mail. O domínio de envio do projeto ainda não está configurado. O download manual de XMLs continua funcionando e não substitui o envio automático.

## Entrega
- Configurar o domínio de e-mail do Gestor Florestal pelo assistente da plataforma. A verificação depende do domínio e, quando necessário, da ação do proprietário no provedor.
- Fazer a opção aparecer como indisponível até que o envio esteja pronto; preservar o cadastro existente, sem anunciar um envio que não ocorreu.
- Enviar uma mensagem ao contador cadastrado na empresa quando uma emissão **ou consulta** confirmar a autorização da nota.
- Incluir número, série, chave de acesso e links privados temporários para o XML e o DANFE. O serviço não aceita anexos; os arquivos serão acessíveis pelos links.
- Não enviar para notas rejeitadas, pendentes ou de outra empresa. Identificar claramente notas de homologação como documentos de teste.
- Manter a autorização da nota independente de uma falha de e-mail, mostrando separadamente se a notificação foi enviada, bloqueada ou falhou.
- Permitir uma nova tentativa para a mesma nota, sem duplicar a mensagem e sem reenviar a nota à Spedy.

## Detalhes técnicos
- Usar os modelos e o remetente gerados pelo serviço gerenciado de e-mail, sem fila, tabelas de e-mail ou agendamentos próprios.
- Integrar um modelo fixo aos handlers autenticados de emissão/consulta, após confirmar `authorized`, lendo o contador da empresa no servidor. Não aceitar destinatário ou modelo arbitrários do navegador.
- Usar a identidade estável do documento e do evento para idempotência; manter registro de resultado no histórico fiscal existente sem gravar links assinados ou segredos.
- Disponibilizar arquivos por links assinados de curta validade e escopo empresa/documento/tipo, verificando assinatura, validade e estado autorizado antes de buscar na Spedy. Nunca enviar links que exijam a conta do operador nem expor a chave Spedy.
- Respeitar supressões e limites de envio do serviço; não contornar recusas ou retentar indiscriminadamente.

## Validação
- Testar autorização em emissão e consulta, isolamento por empresa, opção desligada, contador ausente, repetição, falha de e-mail e validade dos links.
- Verificar o fluxo autenticado com nota de homologação autorizada e destinatário de teste autorizado pelo usuário, conferindo o resultado nos registros de envio.
- Não emitir nota real nem publicar sem a revisão do Neto.

## Fora deste reparo
Relatórios mensais, envio de lotes e demais funcionalidades combinadas anteriormente continuam fora do escopo destes dois avisos.

## Outro aviso desta revisão
A edição de lançamentos rejeitados já foi corrigida para rejeições explícitas de transações atômicas na primeira tentativa, com 30 testes e conferência na tela. Respostas perdidas e pendências antigas com resultado incerto continuam protegidas contra reescrita para evitar duplicidade.