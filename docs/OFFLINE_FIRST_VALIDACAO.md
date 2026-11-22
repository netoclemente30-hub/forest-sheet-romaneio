# Robustez offline — Gestor Florestal

## Entrega
Branch: `main`. Sem publicação, migração, alterações de segredos ou gravações no banco. O commit desta entrega tem a mensagem **Preservar cargo e lançamentos com robustez offline-first**.

### Correções
- Cargo e vínculo previamente confirmados são recuperados por usuário/empresa. Falha de transporte não vira ausência de cargo; resposta válida sem cargo substitui a cópia anterior. Saída invalida permissões e troca de conta limpa consultas. Nenhuma cópia local concede autoridade no servidor.
- Sessão local usa somente a chave já mantida pelo SDK, sem duplicar credenciais. Consultas e revalidação têm prazo limitado.
- Gravação IndexedDB só conclui em `transaction.oncomplete`; quota, abort e armazenamento indisponível não informam sucesso. Formulários conservam dados diante de falha.
- Toras e romaneios são persistidos antes de tentar enviar. Estados pendente/enviando/enviado/erro, IDs estáveis e auditoria capturada são preservados. Recibo gravado impede reenvio após falha de limpeza.
- Resposta incerta conserva o payload. Rejeição transacional confirmada permite corrigir a mesma entrada, mantendo empresa, identidade e auditoria; erro só sai por tentativa explícita.
- Sincronização verifica o backend autenticado antes do envio, tem exclusão entre abas quando Web Locks está disponível, e retoma por reconexão/foco/visibilidade. Wi-Fi sozinho não é confirmação de servidor disponível.
- Consultas têm cache isolado por conta/empresa e não retornam dados fictícios em ausência de cache. Resposta de permissão negada não libera dados privados antigos.
- Medições, atualizações e reservas em cargas pendentes projetam-se nas listas locais. Histórico distingue carga local de romaneio enviado.
- PWA mantém generateSW/NetworkFirst, inclui páginas prioritárias e precache de imagens/fontes; não registra em prévia/dev. APIs, OAuth e rastreio público não recebem HTML privado antigo.
- Ações dependentes de servidor não simulam autorização; consulta fiscal mostra indisponibilidade sem conexão. Simulações fiscais preexistentes continuam identificadas como simulações.

## Validação efetivamente executada
- **423 testes passaram em 74 arquivos** (`bunx vitest run`).
- Checagem de tipos (`oj typecheck -b --noEmit`): sem erros.
- Compilação automática da prévia: **build OK**. Não foi executado build manual nem deploy.
- Navegador autenticado: empresa selecionada preservada em Toras, Romaneio, Base, Serraria, Saldo e Histórico.
- Formulário real salvou uma tora fictícia somente na IndexedDB do contexto temporário do navegador, com estado pendente. Cadastro remoto foi bloqueado durante toda a conferência.
- Cargo e registro local sobreviveram à perda de conexão, suspensão/retomada simulada e recarga com backend inacessível; mesma entrada relida sem recriação.
- Rotas prioritárias abriram com backend bloqueado; 384 px sem corte horizontal; nenhum erro JavaScript observado.

## Limitações e pendências
- A prévia não registra worker por segurança. Reabrir com **zero rede para HTML/assets**, fechar completamente a PWA instalada, bloquear/desbloquear fisicamente e trabalhar horas em modo avião ainda precisam de aparelho com uma versão publicada autorizada. A conferência de recarga usou assets locais disponíveis e backend bloqueado; não equivale a provar ciclo instalado offline completo.
- Nenhum replay real foi enviado ao banco por instrução do usuário. Reconexão, conflito, idempotência e auditoria foram exercitados por testes com executores/armazenamento controlados. O papel verificado no navegador foi administrador geral; cargos operacionais/revogação foram testados automaticamente.
- Revogação remota não pode ser descoberta sem rede. Ao reconectar, permissões são revalidadas e cada escrita continua submetida às políticas/RPCs do servidor.
- Armazenamento pode ser apagado pelo usuário/sistema; não há promessa de durabilidade se os dados do aplicativo forem removidos. Sem Web Locks, a proteção entre abas é limitada ao contexto; IDs estáveis seguem protegendo replay das operações cobertas pelas RPCs.
- Dados não previamente sincronizados ficam vazios. Mapas/arquivos privados não já preparados não podem ser baixados sem conexão.

## Arquivos modificados
AGENTS.md
bun.lock
package.json
roadmap.md
src/components/AppShell.tsx
src/components/SituacaoEmpresa.tsx
src/components/SyncStatus.tsx
src/components/ToraEditor.tsx
src/components/ToraForm.test.tsx
src/components/ToraForm.tsx
src/hooks/useAuth.test.tsx
src/hooks/useAuth.tsx
src/hooks/useFilaOffline.ts
src/lib/cadastros-empresa.ts
src/lib/empresa.ts
src/lib/madeira-serrada.ts
src/lib/offline/cache.test.ts
src/lib/offline/cache.ts
src/lib/offline/db.ts
src/lib/offline/fila.test.ts
src/lib/offline/fila.ts
src/lib/offline/sync.ts
src/lib/pacote-offline.test.ts
src/lib/pwa-policy.ts
src/lib/registro-operacao.ts
src/lib/registro.ts
src/lib/romaneio-salvar.ts
src/lib/tora-origem.test.ts
src/lib/tora-origem.ts
src/routes/base.$autex.tsx
src/routes/explanadas.tsx
src/routes/fiscal.tsx
src/routes/historico.index.tsx
src/routes/romaneio.tsx
src/routes/serraria.tsx
src/routes/toras.tsx
vite.config.ts
docs/OFFLINE_FIRST_VALIDACAO.md
src/lib/offline/conexao.test.ts
src/lib/offline/conexao.ts
src/lib/offline/db.test.ts
src/lib/offline/permissoes.test.ts
src/lib/offline/permissoes.ts
src/lib/offline/rejeicao.ts
src/lib/offline/sessao.ts
