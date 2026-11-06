<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Data is read client-side with react-query (`src/lib/data.ts`) after sign-in in `AppShell`; all signed-in users share one team dataset (RLS `authenticated` = full access). Why: field team app, SSR has no session.
- Tora volume uses `volumeTora` in `src/lib/volume.ts` (Smalian, same as the original spreadsheet); never duplicate the formula.
- AUTEX uses a team-shared registry referenced by logs; QR payloads are versioned and resolve to current inventory rows before loading, so printed data never overrides stock status.
- BASE imports accept the original seven columns plus optional picada, scientific name and AUTEX (col J); trees are unique by (numero, autex) so repeated tree numbers across AUTEX stay separate; the calculations sheet is optional.
- Sawmill flow: romaneio QR receipt records the destination pátio on the romaneio; logs at a received pátio are sawmill stock until marked serrada.
- Toras and Estoque share the same log list and selection behavior; saved unladen logs are stock rather than duplicated records.
- Multi-tenant by company: every data table has empresa_id (DEFAULT minha_empresa(), trigger-filled); RLS scopes all reads/writes to the user's company; user→company link lives in empresa_usuarios; admins create companies and one shared access per company in /usuarios.
- Offline/PWA: vite-plugin-pwa (generateSW, /sw.js) registered only via src/lib/pwa-register.ts, which refuses dev/preview/iframes; offline writes go to an IndexedDB queue (src/lib/offline/fila.ts, injectable store for tests) and sync.ts replays them in order on reconnect, marking conflicts as errors without dropping data; read queries use comCache (src/lib/offline/cache.ts). Why: field work without signal; SW in preview serves stale chunks.
- Activity log: every mutation captures capturarLog (src/lib/registro.ts: email + GPS + timestamp) and writes to public.registros — online directly, offline attached to the queued op so the original time/place is kept. Why: audit who inserted what, where.
- PWA precache URLs strip the SSR build's client/ prefix, exclude server output, and warm navigation documents through the generated NetworkFirst worker after activation. Why: hosting serves client assets at root and the first visit is initially uncontrolled.
- Installation UI captures beforeinstallprompt in useInstallApp at AppShell mount, invokes it only on a user click, and offers browser-specific fallback instructions without registering another worker. Why: installation availability varies by browser and lifecycle.
