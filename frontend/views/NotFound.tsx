import { Link, useLocation } from "react-router-dom";
import { Mascot } from "@/components/brand/Mascot";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <header className="px-6 py-5">
        <Link to="/"><BrandMark size="sm" /></Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-gradient-brand opacity-20 blur-3xl rounded-full" />
            <Mascot size="lg" className="relative" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Error 404</p>
          <h1 className="text-4xl font-display font-extrabold tracking-tight mb-3">
            We couldn't find that page
          </h1>
          <p className="text-muted-foreground mb-2">
            The page <span className="font-mono text-foreground">{location.pathname}</span> doesn't exist or has moved.
          </p>
          <div className="mt-7 flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => window.history.back()} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Go back
            </Button>
            <Link to="/">
              <Button className="bg-gradient-brand text-primary-foreground border-0 shadow-brand gap-1.5">
                <Home className="h-4 w-4" /> Home
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
