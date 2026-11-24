# Teste da cópia offline

Branch: `fix/offline-primeiro-login-toras-romaneios`. Não integrar na main antes do teste do usuário.

## Preparar o aparelho

Use uma versão de teste desta branch em endereço próprio, com HTTPS, ou um build local servido em localhost. A prévia dentro do editor Lovable e o servidor de desenvolvimento não registram o service worker e não validam a reabertura offline. Não é necessário publicar a main para testar.

1. Abra o app com internet e entre na conta. Se for administrador geral, selecione uma empresa.
2. Aguarde a preparação automática. Confira a data da cópia e a confirmação **Telas preparadas para reabrir sem internet**. Se houver pendências, veja os detalhes e use **Atualizar cópia offline** com conexão.
3. No mesmo aparelho e navegador, desconecte a internet. Não saia da conta nem apague os dados do aplicativo.

## Conferência

- Entre em Toras, lance uma plaqueta livre, feche o formulário e localize a tora na lista. Corrija espécie e medidas pelo lápis. Confira o volume corrigido imediatamente.
- Feche e reabra o app pela página inicial ainda sem conexão. Confira novamente a tora e sua correção.
- Abra Histórico de cargas e escolha um romaneio anterior que você não abriu durante o preparo. Confira toras, cliente e totais; teste PDF e TXT.
- Salve um romaneio local, abra-o no histórico e confira as toras da carga antes de sincronizar.
- Volte à internet. Confira a fila e eventuais conflitos. Não descartar conflitos para tentar resolver.
- Repita em outra empresa e confirme que os dados de uma não aparecem na outra.

O romaneador pode corrigir seus próprios lançamentos locais ainda não enviados. Correção conserva a identidade e auditoria do lançamento; envio incerto exige confirmação antes de reescrever. Administradores continuam com a edição das toras existentes, agora com persistência local antes de enviar.

## Limites

A cópia pertence à conta, empresa, navegador e aparelho usados no preparo. Mudanças feitas em outros aparelhos só chegam com internet. O preparo baixa as bases de manejo, estoque, cadastros de transporte, saldo, romaneios de toras e serrados, encaixes e mapas PDF acessíveis à conta, com paginação e confirmação de gravação. Cada etapa indisponível ou sem espaço fica identificada; não há promessa de cópia completa nesses casos. Imagens externas de mapas não são baixadas para uso offline.

Emissão, cancelamento e carta de correção fiscal, consulta de CNPJ e demais operações que dependem de servidor continuam exigindo internet. A primeira autenticação e a preparação das telas também exigem conexão. Se um link direto de detalhe ainda não tiver seu documento HTML guardado, abra a página inicial ou o histórico preparado e navegue até a carga.

## Verificação de código

Regressões cobrem lançamento, correção e reabertura por projeção local, proteção de empresa/autor, resposta incerta, detalhes de carga local, paginação acima de mil registros e falha de armazenamento sem confirmação falsa. O teste real de instalação, fechamento/reabertura e permissões do navegador deve ser feito no endereço de teste; os testes automatizados não substituem essa conferência no aparelho.
