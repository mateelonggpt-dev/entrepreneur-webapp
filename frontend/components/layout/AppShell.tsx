import { useState, ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ProductTour } from "@/components/tour/ProductTour";
import { cn } from "@/lib/utils";

export const AppShell = ({ children }: { children: ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <Topbar sidebarCollapsed={collapsed} />
      <main
        className={cn(
          "min-w-0 overflow-x-hidden pt-16 transition-[padding] duration-300",
          collapsed ? "pl-[76px]" : "pl-[272px]"
        )}
      >
        <div className="mx-auto max-w-[1600px] min-w-0 p-6 animate-fade-in lg:p-8">
          {children}
        </div>
      </main>
      <ProductTour />
    </div>
  );
};
