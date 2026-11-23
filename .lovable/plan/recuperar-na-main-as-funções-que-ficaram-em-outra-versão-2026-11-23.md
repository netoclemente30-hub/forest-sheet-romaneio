# Recuperar na main as funções que ficaram em outra versão

## O que foi confirmado
Os três problemas são reais, mas nenhum foi apagado por uma alteração recente. A main atual nasceu de uma versão do GitHub que **nunca recebeu 19 alterações** feitas depois, em outra linha do projeto (a versão `535f925`). Por isso faltam na main:
- Fiscal liberado para o Gerente de escritório (menu, tela e permissão).
- Emitente salvo na nuvem e recolhível, rascunhos guardados no aparelho e NF-e sem romaneio, com catálogo de itens.
- Lançamentos offline de cinco tipos: operação de estoque, romaneio serrado importado, edição de árvore/AUTEX/tora, cadastro e exclusão de tora aguardando. Se um aparelho ainda guardar algum deles, a main atual o descarta como "enviado" sem enviar.
- Outras partes da mesma linha também sumiram: Ajuda com o manual, cadastro da empresa na Spedy, Relatório Geral, aba Contador e cliente no romaneio.

## O que será feito
1. **Proteção imediata dos lançamentos:** antes de tudo, qualquer lançamento offline de tipo desconhecido fica marcado como erro e continua guardado. Nunca será apagado nem registrado como feito.
2. **Juntar as duas linhas na main**, mantendo dos dois lados:
   - toda a robustez offline recente (cargo sem sinal, salvamento confirmado, abertura do app instalado sem internet);
   - todas as 19 alterações da outra linha, incluindo os cinco tipos de lançamento, que voltam a ser enviados de verdade.
3. Nos arquivos alterados pelos dois lados (fila, sincronização, Fiscal, menu, permissões, telas de toras, romaneio e saldo), combinar à mão as duas versões, sem descartar nenhuma.
4. Rodar todos os testes e a montagem. Conferir com sua conta: Fiscal como Gerente de escritório, emitente salvo após recarregar, NF-e sem romaneio e envio de um lançamento antigo de cada tipo, sem apagar nada.

## Fora do escopo
Nada será publicado e não haverá migração destrutiva. Migrações da outra linha (por exemplo a do emitente e a do contador) que ainda não estiverem no banco serão revisadas antes. Só serão aplicadas se acrescentarem algo sem apagar dados.

## Detalhes técnicos
- Fazer `git merge` de `origin/feat/emissor-nfe-spedy` (`535f925`) na `main`. A base comum é `e6dfebb`: 19 commits de um lado e 6 do outro.
- Em `executarOpSemLog`, uma ação padrão lança um erro de "tipo não suportado". Em `sincronizar`, esse erro marca o item como falha e o mantém na fila. Teste de regressão incluído.
- Manter `paginaOfflinePlugin`, `prepararPaginas`, as permissões offline por usuário/empresa e o `__root` em português.
