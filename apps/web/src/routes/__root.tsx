import type { AppRouter } from "@mantainer-system/api/routers/index";
import { Toaster } from "@mantainer-system/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

export interface RouterAppContext {
  trpc: TRPCOptionsProxy<AppRouter>;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootDocument,
});

function RootDocument() {
  return (
    <>
      <Outlet />
      <Toaster richColors />
    </>
  );
}
