import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  if (import.meta.env.MODE === "android" && typeof window !== "undefined" &&
      window.location.pathname === "/index.html") {
    window.history.replaceState(window.history.state, "", "/" + window.location.search + window.location.hash);
  }
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
