# Permissões dos funcionários — Gestor Florestal

## Cargos e experiência no aplicativo

| Cargo | Pode fazer | Não pode fazer |
|---|---|---|
| Cortador | Ver Mapa, posição e coordenadas, registrar abate e motivo de não abate, rastrear GPS | Arrastar, lançar toras, gerar cargas, editar estoques |
| Tratorista | Ver Mapa, toras das árvores abatidas, registrar arrasto e indicar explanada, rastrear GPS | Abater, lançar toras, criar explanada, gerar romaneios |
| Romaneador | Ver toras, lançar medições, etiquetas QR, cadastrar explanadas por AUTEX, consultar mapa | Abater, arrastar, gerar cargas, alterar lançamentos de terceiros |
| Motorista | Carregar toras e criar romaneio de carga, consultar histórico, gerar TXT NF-e | Abater, arrastar, cadastrar explanada, operar serraria |
| Gerente de pátio | Toda operação da Serraria (estoque, recebimento, serragem, pacotes e cargas serradas) e relatórios | Abate, arrasto, administração de usuários ou reversão geral |
| Gerente de escritório | Consultar informações de todas as áreas da própria empresa, baixar relatórios, ler registros de atividade | Inserir, editar, excluir, carregar, reverter ou administrar usuários |
| Administrador da empresa | Todas as áreas, alterações, funcionários e reversões | Acessar empresas de terceiros, promover outro admin (reservado ao superadmin) |
| Administrador geral | Todas as empresas e funções, aprovação/gestão global | Sujeito às regras de integridade e auditoria |

**Cada funcionário deve possuir login individual.** O modelo anterior de conta compartilhada não distingue quem fez os lançamentos. Nenhum cadastro real foi convertido ou criado.

## Navegação

- A aba Cortador / Mapa chama-se Mapa. A URL antiga /cortador continua funcionando para preservar favoritos e QR.
- Após login, a área inicial é Mapa para cortador/tratorista, Toras para romaneador, Carregamento para motorista, Serraria para gerente de pátio e Visão geral para administradores/gerente de escritório.
- As abas e comandos são filtrados pelo cargo. O escritório utiliza modo consulta; não há botão de reversão nos registros.
- Administradores escolhem a função ao cadastrar e podem mudar a função de funcionário da própria empresa. Somente o superadmin promove outro administrador.
- Explanadas são pontos de entrega na floresta, não os pátios de recebimento da serraria. O romaneador cria pontos por AUTEX; o tratorista escolhe o destino ao arrastar.
- Funções e autorizações são consultadas do banco, nunca de metadados editáveis do usuário. Sem função atribuída, o aplicativo nega acesso operacional.

## Segurança no banco — APLICADA

A interface não é barreira: a mesma matriz está no banco (RLS, guardas nas RPCs SECURITY DEFINER e isolamento por empresa). Migrações aplicadas no banco da Lovable Cloud (compartilhado pela prévia e pelo app publicado):

1. `drizzle/migrations/0036_cargos_estrutura_seguranca.sql` — tabela `funcoes_funcionarios`, `minha_funcao()`, `pode_funcao(empresa, ação)`, `explanadas`, campos de arrasto em `toras`, ID estável de operação em `romaneios`.
2. `drizzle/migrations/0037_cargos_rls_rpcs_arrasto.sql` — políticas por cargo em 16 tabelas, Storage dos mapas, guardas em `registrar_operacao`, `salvar_romaneio_toras`, `excluir_romaneio_toras`, `importar_ficha_manejo`, `registrar_arrasto_toras` e RPCs de madeira serrada.
3. `drizzle/migrations/0038_reverter_arrasto_completo.sql` — a reversão restaura os seis campos de arrasto/explanada a partir do snapshot; recusa snapshots incompletos e explanada inexistente.

Os arquivos em `docs/propostas/*.sql` são o histórico das propostas revisadas; não executar. `docs/propostas/legado/` guarda duas migrações nunca aplicadas, cujo conteúdo seguro foi incorporado em 0036/0037.

Limites reais:
- Usuários sem cargo nem papel admin ficam sem acesso operacional até um administrador atribuir o cargo em /usuarios (hoje 5 usuários; nenhum cargo foi atribuído automaticamente).
- Reversão: somente admin da empresa ou superadmin. Gerente de escritório e de pátio não revertem.
- Motorista cria carga mas não recebe; recebimento exige `serraria_operar` (gerente de pátio/admin).
- Funções SECURITY DEFINER antigas (`has_role`, `minha_empresa` etc.) seguem executáveis por anônimos, mas retornam vazio sem sessão; `tora_publica` é pública por desenho.
- `aparelhos` continua editável por qualquer usuário da mesma empresa.
- A reversão não marca `revertido_em` no registro original; uma segunda reversão é recusada porque o estado atual não confere com o snapshot.
- O app publicado antes destas migrações grava algumas tabelas diretamente e falhará nessas ações até publicar a versão nova.

Testes feitos em transação com rollback (sem dados reais): 8 cargos + sem cargo + admin de outra empresa, duas empresas; reversão de arrasto com restauração, snapshot incompleto e explanada removida.

## Revisão de 15/11/2026
A branch de revisão parte de 0389d7a07225fda69899f6e3bf968209ed2d4f93.
A implementação inicial de cargos já estava nessa base; esta revisão corrige
falhas de isolamento administrativo, descarte de permissões após erro de
revalidação, envio de mapas por cargos de consulta e abertura de lançamento
via parâmetro de URL. Etiquetas podem ser baixadas pelo escritório sem
marcar impressão no estoque. Histórico permite baixar arquivos sem excluir.

As propostas SQL agora separam lançamentos de manejo e serraria, autorizam
medições de estoque recebido, impedem escrita direta nas tabelas de cargas
serradas e protegem os PDFs no Storage. Os registros de encaixe necessários
à serraria têm leitura específica. Escritório não grava auditoria avulsa de
alterações; o evento de login continua permitido.

### Validação e limites
- 281 testes passaram localmente em 53 arquivos, incluindo matriz de cargos,
  rotas, cache por conta, fila offline e isolamento da listagem no servidor.
- Compilação e TypeScript passaram após geração automática das rotas.
- Análise estática dos arquivos alterados: zero erros; um aviso preexistente
  sobre exportação auxiliar em historico.$id.tsx.
- As dependências locais foram instaladas com pnpm sem alterar o bun.lock.
  A integração do PR usa Bun com o lockfile original.
- O esquema revisado foi o versionado no repositório. Não houve consulta ao
  catálogo de produção, execução SQL, migração, alteração de cadastros,
  publicação ou solicitação à Lovable.
- A validação sintática SQL não substitui testes de RLS/RPC com sessões reais
  em homologação. Conferir também políticas adicionais existentes no ambiente.
- O modo consulta legado ainda bloqueia formulários completos em Base,
  recebimento, carregamento, saldo e serraria. Os relatórios gerais continuam
  acessíveis em /relatorios; Mapa, Toras, Explanadas, Etiquetas e Histórico
  têm consulta interativa sem liberar gravação. Revisar a experiência dessas
  telas na homologação antes de liberar o perfil de escritório.

Atualização: as propostas foram consolidadas e aplicadas nas migrações 0036–0038 (ver "Segurança no banco — APLICADA"). Os números de testes acima são históricos; a contagem atual está no roadmap.md.
