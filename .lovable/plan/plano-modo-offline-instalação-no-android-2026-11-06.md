# Plano: modo offline + instalação no Android

## O que será entregue

### 1. Instalável no Android (PWA)
- Manifest do app (`public/manifest.webmanifest`) com nome "Manejo Florestal", cor do tema, `display: standalone` e ícones (192/512 px, gerados).
- Tags no head da rota raiz: manifest, theme-color, apple-touch-icon.
- Resultado: no celular Android, abrir o link no Chrome → "Adicionar à tela inicial" → o app abre em tela cheia com ícone próprio, como um aplicativo.
- Observação: publicar na Play Store (arquivo .aab/.apk nativo) é um caminho separado (Capacitor), não incluído aqui.

### 2. App abre sem internet (app shell offline)
- `vite-plugin-pwa` com `generateSW`, `registerType: "autoUpdate"`, `injectRegister: null`, `devOptions.enabled: false`, arquivo `/sw.js`.
- Cache: navegação/HTML com `NetworkFirst`; assets com hash same-origin com `CacheFirst`; `/~oauth` excluído do fallback.
- Wrapper único de registro (`src/lib/pwa-register.ts`) que NUNCA registra em dev/preview Lovable: recusa quando `!import.meta.env.PROD`, dentro de iframe, hostnames `*.lovable.app` / `*.gpt-eng.com` / `*.gptengineer.run` com label de preview, hostname exato do `delegated_preview_url`, `*.lovableproject.com`, `*.lovableproject-dev.com`, `*.beta.lovable.dev`, ou URL com `?sw=off`. Em contexto recusado, desregistra SWs antigos de `/sw.js`.
- Offline só funciona no app publicado; no preview do editor sempre online.

### 3. Lançar dados sem internet e sincronizar depois
- Fila local (IndexedDB, `src/lib/offline/fila.ts`) de operações pendentes: lançar tora, salvar romaneio, entrada no pátio, marcar serrada, cadastros (veículo, motorista, pátio, AUTEX).
- Cache local da base de árvores e das toras da empresa (IndexedDB) para consulta e medição offline; atualizado sempre que o app está online.
- `src/lib/offline/sync.ts`: ao recuperar conexão (evento `online` + retry), envia a fila na ordem; conflitos (ex.: plaqueta já existe) marcam o item como "com erro" e mostram aviso, sem perder o dado.
- Indicador no topo (AppShell): "Offline — N lançamentos pendentes" / "Sincronizando…" / "Tudo sincronizado".
- ToraForm e Romaneio passam a gravar na fila quando offline e na nuvem quando online, de forma transparente.
- Importação de planilha e aba Usuários continuam exigindo internet (avisos claros).

## Arquivos principais
- Novos: `public/manifest.webmanifest`, ícones em `public/`, `src/lib/pwa-register.ts`, `src/lib/offline/{fila,sync,cache}.ts`, componente de status de sincronização.
- Alterados: `vite.config.ts` (plugin PWA), `src/routes/__root.tsx` (head tags + wrapper), `src/components/AppShell.tsx` (indicador), `src/components/ToraForm.tsx`, `src/routes/romaneio.tsx`, `src/routes/entrada.tsx`, `src/routes/serraria.tsx`, `src/lib/data.ts` (cache offline das consultas).

## Verificação
- Build de produção local + teste com Playwright: app carrega, service worker não registra no preview (guard correto), fila grava offline e sincroniza ao voltar a rede (simulado).
- Testes unitários novos para a fila/sync (vitest).
