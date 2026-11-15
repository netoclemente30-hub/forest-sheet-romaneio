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
- O botão de gravação fica disponível só para o cargo tratorista (e admin); os demais apenas consultam.

## Banco de dados — APLICADO

- Campos e explanadas: `drizzle/migrations/0036_cargos_estrutura_seguranca.sql`; transação `registrar_arrasto_toras` (cargo tratorista, GPS ≤100 m, idempotente por operação, auditoria com snapshot completo): `0037_cargos_rls_rpcs_arrasto.sql`.
- Reversão (só admin/superadmin): `0038_reverter_arrasto_completo.sql` restaura `arrastada_em`, `arrastada_por`, `arrasto_operacao_id`, `arrasto_lat`, `arrasto_lng` e `arrasto_explanada_id`. É recusada se o snapshot não tiver todos esses campos, se a explanada original não existir mais ou se a tora mudou depois.
- `docs/propostas/arrasto-de-toras.sql` fica apenas como histórico da proposta.
