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

- Data is read client-side with react-query (`src/lib/data.ts`) after sign-in in `AppShell`; reads are scoped to the user's company (empresa_id). Why: field team app, SSR has no session.
- Sawn timber uses company-scoped atomic RPCs, database-calculated totals and immutable dispatched packages; new packages queue with stable IDs/audit and project into stock offline, while dispatch requires sync/connectivity. Sawing selection suggests identity without copying log dimensions. Why: prevent duplicate replay/dispatch and preserve measured board quantities.
- Report exporters return prepared blobs; the report dialog calls the shared file delivery helper on a fresh user click. Why: asynchronous generation can lose mobile browser download/share activation.
- Tora volume uses `volumeTora` in `src/lib/volume.ts` (Smalian, same as the original spreadsheet); never duplicate the formula.
- AUTEX registry and Base management keep field sheets, offline GPS tracks and felling history linked through closure with stable IDs; QR payloads are versioned and resolve current stock before loading. Why: preserve field identity offline and after archival.
- Inventory import uses shared header/number normalization and a lazy browser PDF.js positional adapter, with a preview before company-scoped writes; legacy BASE positions and optional calculations remain supported. Trees are unique by (numero, autex). Why: PDF page continuations and varied Excel layouts must share validation without changing stock conflict behavior.
- Inventory remains in one company-scoped toras table with explicit origem; Base-backed measurements use manejo, reconciliation/fitting/bulk saldo use serraria. Sawmill lists include serraria-origin rows plus received romaneio rows until serrada; manejo lists filter origin. Why: separate workflows without copying logs or breaking QR identity.
- RelatorioToras centralizes exporters and AUTEX/species summaries; PDF measures and totals follow the active mode in manejo/sawmill, preserving Excel/SINAFLOR. Why: PDFs must match the selected view.
- Multi-tenant by company: every data table has empresa_id (DEFAULT minha_empresa(), trigger-filled); RLS scopes all reads/writes to the user's company; user→company link lives in empresa_usuarios; admins create companies and one shared access per company in /usuarios.
- Offline/PWA: vite-plugin-pwa (generateSW, /sw.js) registered only via src/lib/pwa-register.ts, which refuses dev/preview/iframes; offline writes go to an IndexedDB queue (src/lib/offline/fila.ts, injectable store for tests) and sync.ts replays them in order on reconnect, marking conflicts as errors without dropping data; read queries use comCache (src/lib/offline/cache.ts). Why: field work without signal; SW in preview serves stale chunks.
- Failed queue operations are edited in place, retaining ID, company and captured audit; saving keeps the error until explicit retry, and automatic sync skips failed rows. Why: corrections must not create duplicate operations or send while being edited.
- Activity log: every mutation captures capturarLog (src/lib/registro.ts: email + GPS + timestamp) and writes to public.registros — online directly, offline attached to the queued op so the original time/place is kept. Why: audit who inserted what, where.
- PWA precache URLs strip the SSR build's client/ prefix and exclude server output; after clientsClaim, marked same-origin document requests warm the generated NetworkFirst worker without iframes. PrecacheFallbackPlugin serves self-contained offline.html only when network and page cache fail (navigateFallback stays null to avoid overriding NetworkFirst). Private query data remains in company-scoped IndexedDB, with empty arrays on offline cache misses. Why: SSR documents are not build assets and fallback must not replace usable cached pages.
- Installation UI captures beforeinstallprompt in useInstallApp at AppShell mount, invokes it only on a user click, and offers browser-specific fallback instructions without registering another worker. Why: installation availability varies by browser and lifecycle.

- Stock reconciliation indexes normalized tree/section/AUTEX matches and renders only a page of filtered rows; selection spans the full filtered dataset. Why: large inventories must not freeze field tablets.
- Log creation and editing share normalized company/tree/section/AUTEX duplicate matching; creation checks queued inserts and current online inventory with the resolved saldo AUTEX. Why: saldo autofill and offline queues must not bypass duplicate warnings.
- Label ordering is centralized in the PDF module and reused by the preview; use creation timestamps with label-number tie-breaking. Why: all print paths must match the launch sequence regardless of selection order.
- Log fitting compares saldo volumes using shared Smalian and scientific-name filtering; identity assignment requires explicit candidate selection and confirmation, preserving measured dimensions and auditing the choice. Allocate the smallest positive unused company label across inventory and queued inserts/renumbers; queued measurements are printable. Why: similar volumes do not prove identity and unsynchronized labels must stay reserved.
- Fitting availability subscribes to the persistent offline queue, excludes company-scoped pending insert identities including failed operations, and retains the last resolved company per authenticated user for offline remounts. Why: unsynchronized measurements must not be reused on the same device.
- Fitted-log comparisons use company-scoped audit snapshots and offline inserts, excluding reversals. Why: retain original saldo/measurements, not later imports or reused labels.
- Inventory mutations use registrar_operacao (stable offline IDs, atomic snapshot logs); triggers capture other stock writes. Reversal is an admin/company-checked RPC comparing current snapshots and appending a compensating event; legacy logs are non-reversible. Why: undo must never invent old data or overwrite newer work.
- AppShell groups routes into nav sections with sub-tabs. Why: keep URLs/QR links.
