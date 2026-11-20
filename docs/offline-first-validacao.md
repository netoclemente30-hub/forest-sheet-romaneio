# Offline-first — entrega em revisão

## Branch e escopo
Checkout verificado: `feat/emissor-nfe-spedy`, base `33376ea`. Referência local da main desatualizada; conexão do projeto e main remota não confirmadas. Esta entrega não deve ser apresentada como integrada à main. Sem publicação ou alterações de banco/dados reais.

## Mudanças
- IndexedDB confirma apenas `transaction.oncomplete`; abort e erro rejeitam.
- Lançamento, edição, medição, encaixe, romaneio de toras, recebimento, serragem, pacotes, NI, coordenadas, arrasto, transferências, AUTEX e saldo persistem intenção na fila antes do envio.
- Bases de leitura não incorporam pendências; projeção separada por empresa evita repetir toras e volumes. Respostas atrasadas conservam a chave inicial de usuário/empresa.
- Início de envio é persistido; operação que pode ter sido enviada não é reescrita. Timeout conserva a pendência. RPCs existentes continuam autorizando o replay.
- Romaneios importados entram na fila com revisão e ID de operação para a RPC otimista existente.
- Ficha de importação guarda prévia e restaura ao reabrir. Expedição, upload e exclusões especiais guardam rascunho antes da ação online. Fiscal conserva rascunhos em armazenamento persistente.

## Limitações ainda abertas
- Não há integração comprovada à main; usar a prévia da branch indicada.
- Atualizações diretas legadas de GPS/NI/cadastros ainda não têm comparação atômica de snapshots e auditoria na mesma transação. Não se garante concorrência/idempotência completa nesses caminhos.
- Rejeições explícitas de transações atômicas na primeira tentativa liberam edição no mesmo ID, mantendo o erro até nova tentativa manual. Respostas perdidas, erros genéricos e operações legadas que podem ter gravações parciais continuam protegidos contra reescrita; lançamentos antigos já marcados como enviados precisam de confirmação antes de editar.
- Rascunhos de expedição/upload/exclusões especiais persistem, mas recuperação automática e confirmação após resposta perdida não estão completas. Exclusões de árvore/manejo continuam essencialmente online.
- Impressão de etiquetas de toras mantém marcador online legado. Cadastros fiscais/administrativos não foram convertidos integralmente à fila.
- Abertura do documento totalmente sem rede depende do worker já existente no app publicado; worker não é registrado na prévia.
- Sessão real abriu, mas acesso operacional bloqueou por falta de cargo. Nenhum cargo foi alterado. Teste de interface usou respostas simuladas e bloqueio de toda escrita remota.

## Evidências
Suíte completa intermediária: 399 testes em 74 arquivos passaram. Verificação final deve constar no resumo da entrega. Teste de navegador simulou empresa, salvou NI local (50 cm nos quatro diâmetros, 6 m), relançou a tela e confirmou uma única NI com 1,1781 m³. Não houve gravação real.

## Arquivos
Alterações concentradas em `src/lib/offline/*`, salvadores de campo, formulários/listas de toras/NI/pacotes/romaneios, Base, saldo, importação e fiscal. `git show --stat` do commit fornece a relação exata; alterações anteriores de PDF/Excel foram preservadas.