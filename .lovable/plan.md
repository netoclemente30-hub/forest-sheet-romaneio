# Auditoria pré-teste NF-e homologação — MADENORTE (somente leitura)

## Resultado da verificação
| Item | Situação |
|---|---|
| Empresa no Gestor | Ativa |
| Segredo sandbox `SPEDY_SANDBOX_KEY_6D4582F7_...` | Presente (valor não lido) |
| CNPJ no cadastro da empresa | Ausente ou inválido (não tem 14 dígitos) |
| IE, razão social, endereço do emitente | Não verificável daqui: ficam salvos só no navegador de quem preencheu a aba Fiscal |
| Vínculo com a Spedy (diagnóstico já rodado) | Nunca rodado — nenhuma configuração fiscal gravada |
| Assinatura do módulo | Só existe em simulação, salva no navegador; não há assinatura real |
| Notas fiscais já enviadas | Nenhuma |
| Romaneios de toras | 1 |
| Cargas de madeira serrada | 0 |
| Romaneios serrados importados | 0 |

## Impedimentos exatos
1. CNPJ da Madenorte não está válido no cadastro da empresa (Usuários → empresa). O diagnóstico procura a empresa na Spedy pelo CNPJ.
2. Cadastro do emitente (razão social, IE, endereço, CEP, município) precisa ser conferido na aba Fiscal no aparelho que vai testar.
3. Diagnóstico Spedy ainda não foi executado: chave, cadastro na Spedy, certificado A1 e modelo NF-e em Homologação não confirmados.
4. Tributação (CSOSN/CST, PIS, COFINS, origem), NCM e CFOP precisam vir do contador — o sistema não preenche.
5. Há apenas 1 romaneio de toras; nenhuma carga serrada. O romaneio de toras não traz cliente, que precisa ser informado no rascunho.

## Opção segura sem emissão
- **Diagnóstico Spedy**: apenas consultas, sem emitir nada. Primeiro passo recomendado.
- Rascunho e prévia ficam locais; o envio exige confirmação marcada. Tudo vai só ao ambiente de testes da Spedy e é bloqueado se o modelo estiver em Produção.

## Passos para o teste (feitos pelo usuário, nada pelo agente)
1. Corrigir o CNPJ da Madenorte no cadastro da empresa.
2. Na Spedy (testes): empresa com o mesmo CNPJ, A1 válido, modelo NF-e em Homologação.
3. Aba Fiscal: completar emitente, rodar Diagnóstico Spedy (deve mostrar tudo verde).
4. Ativar assinatura simulada, criar rascunho a partir do romaneio, informar cliente e tributação do contador.
5. Só então marcar confirmação e enviar em homologação; depois Consultar situação.

Nenhum arquivo, banco, segredo ou publicação foi alterado nesta auditoria.
