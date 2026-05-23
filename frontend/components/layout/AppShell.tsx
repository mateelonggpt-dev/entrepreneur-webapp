import { useState, ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ProductTour } from "@/components/tour/ProductTour";
import { cn } from "@/lib/utils";

export const AppShell = ({ children }: { children: ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen w-full bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <Topbar sidebarCollapsed={collapsed} />
      <main
        className={cn(
          "transition-[padding] duration-300 pt-16",
          collapsed ? "pl-[76px]" : "pl-[272px]"
        )}
      >
        <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in">
          {children}
        </div>
      </main>
      <ProductTour />
    </div>
  );
};
