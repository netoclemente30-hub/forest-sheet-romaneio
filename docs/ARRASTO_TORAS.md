# Arrasto de toras — funcionalidade em revisão

## Operação de campo

1. **Cortador / Mapa:** o tratorista vê as árvores abatidas próximas ao GPS que possuem toras de manejo sem arrasto registrado.
2. Ao abrir a árvore, encontra o número de toras traçadas, arrastadas e a arrastar, e a lista de secções/plaquetas.
3. Seleciona só as toras que realmente arrastou (por padrão, as pendentes estão selecionadas), toca **Registrar arrasto concluído** e confirma o GPS próximo à árvore.
4. A ação armazena empresa, AUTEX, árvore, plaquetas, momento, usuário e GPS, e não repete operações já concluídas. Sem internet, permanece na fila do aparelho; itens na fila aparecem separados para não duplicar o registro.
5. **Início → Exploração diária:** quarto contador **Toras arrastadas** com quantidade e volume por data, fuso de Rondônia. O contador usa somente registros confirmados e sincronizados.

## Regras de integridade

- A árvore deve estar **abatida** e **localizada no mapa**. Apenas toras de **manejo** daquela empresa/AUTEX/árvore podem ser selecionadas.
- Não registra uma tora já arrastada nem uma carga já enviada para serraria.
- GPS capturado recentemente, precisão máxima 100 m e distância da árvore até 100 m.
- A operação no banco deve ser atômica e idempotente (um ID por operação). O registro de auditoria é inseparável da mudança de estoque.
- Antigos romaneios não são retroativamente classificados como arrasto. Ausência de histórico não equivale a arrasto confirmado.
- O mapa continua disponível para consulta antes da instalação SQL, mas **o botão de gravação fica desabilitado**. O contador aparece como indisponível para não exibir zero enganoso.

## Banco de dados — APENAS PROPOSTA

O projeto especifica em AGENTS.md que mudanças em drizzle/ e no banco sejam realizadas **pela Lovable**, não pelo GitHub. Por esse motivo, o SQL **não** foi colocado em drizzle/migrations/ nem executado:

- docs/propostas/arrasto-de-toras.sql — definição técnica para revisão e adaptação no editor Lovable, depois de autorizados os custos de Cloud
- Todos os novos campos são opcionais; não há exclusão de dados ou migração destrutiva
- Requer validação em banco de homologação: vínculo empresa e AUTEX, RLS, autorização de operadores, triggers de auditoria, GPS, concorrência, retry offline e confirmação do dashboard

Não executar no banco de produção nem publicar esta branch enquanto faltarem migrações e testes de homologação. O GitHub Actions verifica sintaxe SQL, testes, TypeScript, lint e build sem enviar prompts à IA da Lovable.
