# Fiscal em homologação

Acesse **Fiscal** com um administrador da empresa. No perfil de administrador geral, escolha a empresa no seletor do Gestor. O módulo usa a sessão do Gestor e consulta as tabelas de cargas pelo identificador da empresa, com as políticas de acesso existentes.

## Experimentar o fluxo

1. Salve razão social, CNPJ e inscrição estadual do emitente no painel Fiscal.
2. Clique em **Simular contratação**. O plano simulado habilita o rascunho sem cobrança.
3. Selecione um dos últimos 100 romaneios de toras ou 100 de madeira serrada. Cliente e transporte vêm da carga quando disponíveis. Preencha o destinatário que faltar e os preços por m³ para conferir o total.
4. Gere a prévia. O histórico preserva uma cópia por romaneio e permite reabrir a composição e simular a assinatura digital. O cálculo inclui produtos. Os tributos dependem de revisão fiscal.
5. O protótipo guarda cadastro, assinatura e rascunhos no armazenamento da aba, por usuário e empresa. Fechar a sessão da aba pode apagar esses dados. A versão compartilhada entre dispositivos exige persistência no backend e cobrança integrada.

## Credencial por empresa

No ambiente **isolado de homologação** do servidor TanStack Start, abra o gerenciador de segredos. Copie o UUID exibido em **Fiscal → Emitente**. Substitua hifens por sublinhados e use letras maiúsculas. Para o UUID fictício `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee`, crie o nome:

```text
SPEDY_SANDBOX_KEY_AAAAAAAA_BBBB_4CCC_8DDD_EEEEEEEEEEEE
```

No campo protegido do valor, cole a X-Api-Key de sandbox emitida para a mesma empresa. A variável precisa estar disponível ao processo do backend em tempo de execução. Mantenha o A1 cadastrado na Spedy. Repita com outro segredo para cada emitente.

Com essa versão executando no ambiente isolado, **Verificar conexão Spedy** faz somente uma consulta GET ao sandbox e informa se a chave foi aceita. O diagnóstico não verifica titularidade ou validade do A1. O servidor exige permissão administrativa e confere o vínculo com a empresa antes de acessar o segredo. A interface não recebe a chave nem os documentos retornados.

[Ambiente de testes](https://docs.spedy.com.br/start/ambiente-de-testes) · [Consulta de NF-e](https://docs.spedy.com.br/api-reference/nf-e/listar-notas-fiscais)
