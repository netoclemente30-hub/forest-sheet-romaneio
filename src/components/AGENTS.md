# Regras de src/components

- AppShell shows `ApresentacaoPagina` for visitors without a session, and only `ehRotaPublica` paths in `src/lib/nav.ts` (public log page and `/apresentacao`) render without sign-in. Why: the presentation is the app's front door and panel data must never appear before authentication.
- The login form lives in `FormularioLogin` and is opened from the presentation's "Acessar sistema" dialog. Why: one login flow serves both the dialog and any full-screen sign-in surface.
