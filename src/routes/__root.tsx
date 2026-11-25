import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { AparenciaProvider } from "@/components/Aparencia";

const buildAndroid = import.meta.env.MODE === "android";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

// Missing JS chunk (stale cache/update) or no server: explain in the field's
// language and offer the self-contained offline page instead of a dead end.
function erroDeCarregamento(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /dynamically imported module|Importing a module script failed|module script|ChunkLoadError|Failed to fetch|NetworkError|Load failed/i.test(msg);
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  const carregamento = erroDeCarregamento(error);
  const detalhe = error instanceof Error ? error.message : String(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {carregamento ? "Esta tela não abriu sem conexão" : "Esta tela não abriu"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {carregamento
            ? (buildAndroid
              ? "A tela não carregou. Volte ao início ou tente novamente."
              : "Parte do aplicativo não estava salva neste aparelho. Seus lançamentos continuam guardados. Abra a página offline ou tente novamente quando houver sinal.")
            : "Ocorreu um erro inesperado. Seus lançamentos guardados neste aparelho não foram apagados."}
        </p>
        <p className="mt-2 break-words text-xs text-muted-foreground">Detalhe: {detalhe}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              if (carregamento) { window.location.reload(); return; }
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href={carregamento && !buildAndroid ? "/offline.html" : "/"}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {carregamento && !buildAndroid ? "Abrir página offline" : "Ir para o início"}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#1a3c2e" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { title: "Manejo Florestal" },
      { name: "description", content: "Inventário florestal, toras e romaneios de carga." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      ...(!buildAndroid ? [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600&display=swap",
      },
      ] : []),
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (buildAndroid) {
      void import("@/lib/otaUpdater").then((m) => m.verificarAtualizacaoOTA());
      return;
    }
    // Service worker de offline: só registra no app publicado (nunca no preview).
    void import("@/lib/pwa-register").then((m) => m.registrarServiceWorker());
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AparenciaProvider>
      {/* AppShell renders <Outlet /> once signed in. */}
      <AppShell />
      <Toaster richColors position="top-center" />
      </AparenciaProvider>
    </QueryClientProvider>
  );
}
