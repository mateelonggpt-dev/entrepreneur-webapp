import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

/** Auto-detect entry: logged-in users -> /app, else -> /landing */
const RootRedirect = () => {
  const { isAuthed, loading } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="text-sm text-muted-foreground">Loading workspace...</p>
      </main>
    );
  }

  return <Navigate to={isAuthed ? "/app" : "/landing"} replace />;
};

export default RootRedirect;
