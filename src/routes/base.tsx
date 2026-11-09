import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/base")({
  component: () => <Outlet />,
});
