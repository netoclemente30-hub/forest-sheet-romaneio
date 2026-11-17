# Fiscal em homologação

## Gerenciamento de notas

A listagem reúne destinatário, romaneio, valor e situação, com busca e filtro. **Nova NF-e do romaneio** leva à seleção de cargas de toras ou madeira serrada. A edição tem Cabeçalho, Cliente, Produtos, Totais, Transporte e Fisco.

**Copiar** cria outro rascunho com identidade independente, vinculado ao mesmo romaneio. A cópia preserva cliente, itens, quantidades e preços, limpa o número fiscal e reinicia a assinatura simulada. Alterações posteriores na cópia ficam somente nela.

**Inutilizar numeração** prepara uma solicitação local com série, número inicial, final e justificativa. O painel verifica o intervalo e sobreposições com outras solicitações locais. O envio à Spedy depende de aprovação e implementação da operação no servidor. A verificação da disponibilidade fiscal da faixa depende da integração.

## Cadastros e preenchimento

Em **Fiscal → Cadastros de clientes e produtos**, salve clientes com documento e endereço, e produtos com código, descrição, NCM, CFOP padrão e preço por m³. O catálogo e o emitente ficam neste navegador, separados por usuário e empresa. A sincronização entre computadores exige persistência no banco.

A preparação e a edição da nota têm as seções Cliente, Produtos, Transporte e Fisco. Selecionar um cliente copia seus dados. Selecionar um produto copia descrição, NCM, CFOP e preço, mantendo o volume da carga. O CFOP permanece editável para conferir a operação. Os dados de motorista e veículo vêm do romaneio.

Ao digitar um CNPJ completo no emitente ou no cliente, a BrasilAPI consulta razão social e endereço. A consulta usa dados públicos e permite preenchimento manual se estiver indisponível. A inscrição estadual é preenchida e conferida pelo usuário. Cadastros já salvos podem ser selecionados sem nova consulta.

[Consulta pública por CNPJ](https://brasilapi.com.br/docs)

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
