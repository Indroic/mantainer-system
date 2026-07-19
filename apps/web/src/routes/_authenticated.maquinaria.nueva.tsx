import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/maquinaria/nueva")({
  beforeLoad: () => {
    throw redirect({ to: "/maquinaria" });
  },
  component: () => null,
});

