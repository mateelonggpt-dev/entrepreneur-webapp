"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { AppDataProvider } from "@/lib/app-data";
import { RouterCompatProvider } from "@/lib/router";
import { resolveAppRoute } from "@/lib/routes";
import type { AppData } from "@/lib/types";
import "@/lib/i18n";

interface AppProps {
  initialData: AppData;
}

const App = ({ initialData }: AppProps) => {
  const pathname = usePathname() || "/";
  const [queryClient] = useState(() => new QueryClient());
  const match = resolveAppRoute(pathname);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppDataProvider initialData={initialData}>
          <RouterCompatProvider pathname={pathname} params={match.params}>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              {match.element}
            </TooltipProvider>
          </RouterCompatProvider>
        </AppDataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
