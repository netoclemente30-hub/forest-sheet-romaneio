# Fiscal em homologação

## Cancelamento e carta de correção

Abra a nota no Fiscal e use **Cancelamento e carta de correção → Consultar eventos fiscais**. As ações ficam disponíveis quando a Spedy confirma a autorização da NF-e. Escolha **Cancelar NF-e** ou **Carta de correção**, preencha o texto e marque a confirmação para enviar em homologação. O cancelamento exige justificativa de 15 a 255 caracteres. A CC-e aceita de 15 a 1.000 caracteres.

O servidor autoriza com a permissão fiscal da empresa, localiza a nota pelo vínculo salvo e confere o CNPJ cadastrado em empresas, o CNPJ retornado na nota e o ambiente de homologação na nota e nas configurações. O texto da solicitação, o usuário e os resultados ficam na tabela fiscal_eventos existente.

O recebimento HTTP inicia o acompanhamento. **Consultar eventos fiscais** mostra códigos, mensagens e protocolos da Spedy. O cancelamento se confirma por situação canceled ou pelo evento correspondente aceito. A CC-e se confirma por um novo evento correctionLetter com código 135 e protocolo. A identificação dos eventos anteriores impede confundir uma carta antiga com uma nova.

Uma reserva atômica em fiscal_documentos impede envios simultâneos. Em timeout ou resposta incerta, a nota conserva o estado evento_pendente. As consultas comuns e a emissão preservam essa trava. A confirmação de um evento libera somente a reserva consultada. Solicitações sem resultado comprovado exigem reconciliação administrativa e permanecem bloqueadas para reenvio automático.

A CC-e deve respeitar as restrições fiscais para valores e tributos, mudança do emitente ou destinatário e datas. Novas cartas devem consolidar as correções anteriores. Os prazos e as condições de cancelamento são verificados pela SEFAZ.

Implementação validada com serviços simulados. A validação integrada com credenciais e eventos de homologação exige execução autorizada no ambiente de testes.

[Cancelamento na Spedy](https://docs.spedy.com.br/api-reference/nf-e/cancelar-nf-e) · [CC-e na Spedy](https://docs.spedy.com.br/api-reference/nf-e/carta-de-corre%C3%A7%C3%A3o) · [Eventos da Spedy](https://docs.spedy.com.br/api-reference/nf-e/listar-eventos-da-nf-e)

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
5. Rascunhos, emitente, catálogo, assinatura simulada e solicitações locais de inutilização ficam no armazenamento persistente deste navegador (localStorage), separados por usuário e empresa; rascunhos antigos guardados na aba (sessionStorage) ainda são lidos uma vez. Não sincronizam entre aparelhos. A assinatura do módulo continua simulada (sem cobrança).

## Credencial por empresa

No ambiente **isolado de homologação** do servidor TanStack Start, abra o gerenciador de segredos. Copie o UUID exibido em **Fiscal → Emitente**. Substitua hifens por sublinhados e use letras maiúsculas. Para o UUID fictício `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee`, crie o nome:

```text
SPEDY_SANDBOX_KEY_AAAAAAAA_BBBB_4CCC_8DDD_EEEEEEEEEEEE
```

No campo protegido do valor, cole a X-Api-Key de sandbox emitida para a mesma empresa. A variável precisa estar disponível ao processo do backend em tempo de execução. Mantenha o A1 cadastrado na Spedy. Repita com outro segredo para cada emitente.

Com essa versão executando no ambiente isolado, **Verificar conexão Spedy** faz somente uma consulta GET ao sandbox e informa se a chave foi aceita. O diagnóstico não verifica titularidade ou validade do A1. O servidor exige permissão administrativa e confere o vínculo com a empresa antes de acessar o segredo. A interface não recebe a chave nem os documentos retornados.

[Ambiente de testes](https://docs.spedy.com.br/start/ambiente-de-testes) · [Consulta de NF-e](https://docs.spedy.com.br/api-reference/nf-e/listar-notas-fiscais)

## Emissão em homologação (servidor)

Só administrador da empresa vinculada ou administrador geral (`pode_fiscal` no banco, conferido no servidor antes de ler o segredo). Toda chamada vai fixamente a `https://sandbox-api.spedy.com.br/v1`; não há caminho no código para a API de produção.

Antes de qualquer envio (nota ou inutilização) o servidor faz o diagnóstico, que mostra separadamente:

- **Chave**: segredo `SPEDY_SANDBOX_KEY_<UUID>` presente e aceito.
- **Cadastro**: empresa da conta Spedy com o mesmo CNPJ do emitente (o ID da Spedy fica em `fiscal_config`).
- **Certificado**: A1 ativo com validade futura em `GET /companies/{id}/certificates`. Só leitura: nada é enviado ou substituído.
- **Ambiente**: `productInvoice.environmentType` em `GET /companies/{id}/settings` precisa ser `development` (Homologação). Produção ou valor desconhecido bloqueia o envio, mesmo dentro do sandbox. Se a resposta de uma nota vier com outro ambiente, grava alerta e interrompe.

**Enviar em homologação** exige confirmação, tributação informada pelo usuário (CSOSN/CST, PIS, COFINS, origem) e pagamento. O servidor valida CPF/CNPJ, endereço, UF, CEP, NCM (8 dígitos), CFOP, quantidades e preços, e calcula os totais. O `integrationId` é o ID interno estável da nota (`fiscal_documentos.id`, único por empresa e rascunho): reenvio após timeout atualiza a mesma nota na Spedy, sem duplicar. Uma trava atômica impede dois envios simultâneos; nota autorizada, denegada ou cancelada nunca é reenviada. Sem resposta, a nota fica **incerta** e **Consultar situação** a localiza pelo `integrationId`.

Consulta atualiza situação, número, série, chave e protocolo. XML e DANFE ficam disponíveis após autorização. A inutilização envia `POST /product-invoices/disablements` e recusa faixas sobrepostas a outra inutilização ou a uma nota numerada.

Tabelas: `fiscal_config`, `fiscal_documentos`, `fiscal_inutilizacoes`, `fiscal_eventos` (auditoria de cada ação). Leitura só por `pode_fiscal`; gravação só pelo servidor.

Pendente: validação real com chave de sandbox, A1 e cadastro da empresa; webhooks; cancelamento e carta de correção; assinatura do módulo real.

[Idempotência](https://docs.spedy.com.br/start/idempotencia) · [Emissão de NF-e](https://docs.spedy.com.br/guides/emissao-nfe)

## Onboarding em homologação: empresa e certificado A1

Em **Fiscal → Emitente**, bloco "Spedy (homologação): empresa e certificado A1":
- **Verificar CNPJ na Spedy**: busca paginada (`GET /companies?page=N&pageSize=100`) pelo CNPJ cadastrado da empresa no Gestor (`empresas.cnpj`). CNPJ do formulário diferente é recusado.
- **Vincular**: grava em `fiscal_config` o id achado no servidor. Nada é alterado na Spedy.
- **Cadastrar**: só se o CNPJ não existe; `POST /companies` com `id` = código da empresa no Gestor. A documentação aceita `id`, mas não promete idempotência; após timeout a tela exige nova verificação e o servidor bloqueia nova criação por 2 min. `apiCredentials` da resposta é descartado. A documentação diz que só a chave da empresa titular da conta cria empresas.
- **Certificado A1**: `.pfx` até 100 KB, checagem estrutural PKCS#12 mínima (sem abrir o arquivo); senha, titular e validade são conferidos pela Spedy. Arquivo e senha ficam só na memória da tela e da requisição; nunca vão para banco, storage, cache ou fila. Com certificado ativo, exige confirmação de substituição. Timeout não reenvia.
- Auditoria em `fiscal_eventos` (`spedy_empresa_*`, `spedy_certificado`) com resultado resumido.
