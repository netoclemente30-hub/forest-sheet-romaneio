# Banco de dados separado por empresa (multi-empresa)

## Objetivo
Cada empresa (ex.: RJ Madeiras) tem seus próprios dados: base de árvores, toras, romaneios, AUTEX, pátios, placas e motoristas. Cada usuário pertence a uma empresa e só vê os dados dela. Se outra empresa comprar o sistema, você cria a empresa e os acessos dela, e os dados ficam totalmente separados.

## Como vai funcionar
- Nova tabela **empresas** (nome da empresa).
- Nova tabela **empresa_usuarios**: liga cada usuário a uma empresa (um usuário = uma empresa).
- Todas as tabelas de dados ganham a coluna **empresa_id**: arvores, toras, romaneios, autex, patios, veiculos, motoristas.
- Regras de acesso (RLS) passam a filtrar pela empresa do usuário: leitura e escrita só dentro da própria empresa.
- Os dados que já existem hoje passam a pertencer à empresa inicial **"RJ Madeiras"**, e você (Neto) fica como administrador dela.

## Mudanças na tela
- **Aba Usuários** passa a ter duas partes:
  - **Empresas**: criar nova empresa (ex.: quando outra empresa comprar o sistema).
  - **Usuários**: ao criar um acesso, você escolhe a qual empresa ele pertence. Trocar senha, tornar admin e remover continuam iguais.
- O admin de cada empresa só vê e gerencia os usuários da própria empresa.
- O resto do app (Base, Toras, Estoque, Romaneio, Serraria, Etiquetas, Importar) não muda de aparência — cada tela simplesmente passa a mostrar só os dados da empresa de quem está logado.

## Detalhes técnicos
- Migração: tabelas `empresas` e `empresa_usuarios` (user_id → auth.users, ON DELETE CASCADE), coluna `empresa_id` (nullable, com backfill para a empresa inicial) em todas as tabelas de dados, função `minha_empresa()` (security definer) e novas policies por empresa. GRANTs para authenticated/service_role.
- `has_role` continua existindo; admin continua global por enquanto (papel admin vale dentro da empresa do usuário, pois os dados já são filtrados por empresa).
- `usuarios.functions.ts`: `criarUsuario` passa a exigir `empresaId` e grava o vínculo; `listarUsuarios` lista só usuários da empresa do admin; novas funções `listarEmpresas` e `criarEmpresa`.
- `useAuth`: passa a expor também a empresa do usuário logado.
- Importação de planilha e lançamentos gravam `empresa_id` automaticamente a partir do usuário logado (via default/trigger ou preenchimento no cliente).

## Limitação conhecida
- Um usuário pertence a uma única empresa. Se no futuro precisar de um usuário em duas empresas, dá para evoluir depois.
