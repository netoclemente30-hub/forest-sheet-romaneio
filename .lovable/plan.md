# Auditoria Spedy (somente leitura) – diagnóstico e log proposto

## Diagnóstico verificado
- Branch atual: `edit/edt-fb46…`, último commit `2c69e5b` (Fiscal Spedy homologação). Não é a main.
- Não existem Edge Functions (`supabase/functions` ausente). A integração roda em funções do servidor do app: `src/lib/spedy.functions.ts` -> `src/lib/spedy.server.ts`.
- Mensagem exata vem de `src/lib/spedy.server.ts` linhas 4-5: o servidor procura o segredo `SPEDY_SANDBOX_KEY_<código da empresa em maiúsculas, hífens trocados por _>`; se não existe, retorna "Chave de homologação pendente no servidor." antes de qualquer contato com a Spedy.
- Segredos configurados no projeto hoje: apenas `LOVABLE_API_KEY` e `LOVABLE_CRON_SECRET`. Nenhum `SPEDY_SANDBOX_KEY_*`.
- **Causa exata:** falta o segredo da chave de homologação da empresa. Não é erro de código, de permissão nem da Spedy.

## O que existe
- Verificação da chave (GET sandbox `product-invoices`), diagnóstico (chave/cadastro CNPJ/A1/ambiente), emissão, consulta, XML/DANFE e inutilização em homologação, com bloqueio de produção, trava anti-duplicidade e auditoria (migração 0041).
- Endereço fixo `sandbox-api.spedy.com.br/v1`, cabeçalho `X-Api-Key`, conforme docs.spedy.com.br.

## O que falta
1. Segredo `SPEDY_SANDBOX_KEY_<EMPRESA>` (o usuário adiciona em Configurações do projeto -> Secrets; valor nunca pelo chat).
2. Na conta de testes Spedy: empresa com mesmo CNPJ, A1 válido, modelo NF-e em Homologação.
3. Integração na main (hoje só na branch) e publicação, se quiser testar no site oficial — o servidor publicado só enxerga o segredo após existir.
4. Ainda não feitos: aviso automático (webhook), cancelamento, carta de correção.

## Log proposto de alterações (opcional, após aprovação)
- `src/components/HomologacaoSpedy.tsx`: mostrar o nome exato do segredo esperado (só o nome, sem valor) quando a chave estiver ausente.
- `src/lib/spedy.server.ts`: reutilizar `nomeSegredo` em `verificarSandbox` (hoje duplicado na linha 4), sem mudar comportamento.
- `src/test/fiscal-spedy.test.tsx`: teste de que a mensagem de chave ausente traz o nome correto.
- `docs/fiscal-spedy.md`: passo a passo de configuração do segredo.
- Nenhuma alteração de banco, segredos, emissão ou publicação.
