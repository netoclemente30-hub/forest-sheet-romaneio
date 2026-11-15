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

## Segurança de verdade — dependências para homologação

A interface NÃO é barreira suficiente: alguém pode chamar a API diretamente. A implantação exige a mesma matriz no banco com RLS, validação de RPCs SECURITY DEFINER e isolamento multiempresa.

Propostas SQL (não executadas, só para aplicação futura pela Lovable):
1. docs/propostas/funcoes-funcionarios.sql — função por usuário, empresa, explanadas, verificação de permissões, vínculo do arrasto
2. docs/propostas/controle-acesso-rls.sql — políticas de leitura e escrita por cargo, bloqueio de alterações indevidas de árvores
3. docs/propostas/controle-acesso-rpcs.sql — autorização dentro das RPCs de romaneio, estoque e madeira serrada
4. docs/propostas/arrasto-de-toras.sql — transação auditável de arrasto por tora e explanada

Revisar ordem, dependências e privilégios com a Lovable em banco de homologação isolado. Cadastro de cargos e gravação do arrasto permanecem indisponíveis até ativar o backend.

A migração de dados deve: (a) identificar administradores atuais, (b) preservar suas permissões, (c) atribuir cargos a cada funcionário, (d) testar usuários sem cargo e outras empresas, (e) tentar operações diretas na API e chamadas de RPC com JWT de todos os perfis, (f) conferir fila offline após troca de cargo.

Não foi aplicada migração em produção nem foram alterados cadastros reais. Não publicar nem mesclar antes de homologar.
