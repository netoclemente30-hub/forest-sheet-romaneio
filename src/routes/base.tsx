import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/base")({
  staticData: { sitemap: false },
  component: () => <Outlet />,
});
