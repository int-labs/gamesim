import * as React from "react";
import { Skeleton } from "@/components/ui/primitives";
import { applyToken, fetchMe, getToken, logout, type StaffUser } from "@/lib/auth";
import { LoginPage } from "@/features/auth/login-page";

interface SessionValue {
  user: StaffUser;
  signOut: () => void;
}

const SessionContext = React.createContext<SessionValue | null>(null);

/** The signed-in staff user. Only callable beneath <AuthGate>. */
export function useSession(): SessionValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <AuthGate>");
  return ctx;
}

/**
 * Blocks the console until a real session exists.
 *
 * The check is a `/users/me` round-trip rather than a token decode, because the
 * server's `authenticate` never reads the database — a validly signed token for
 * a deleted account would otherwise sail through and only fail later, mid-page.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<StaffUser | null>(null);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    applyToken(getToken());
    fetchMe().then((me) => {
      if (cancelled) return;
      if (!me) logout(); // clear a token the server no longer honours
      setUser(me);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = React.useCallback(() => {
    logout();
    setUser(null);
  }, []);

  if (checking) {
    // Deliberately spare — a spinner here would flash on every reload.
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted">
        <Skeleton className="h-10 w-40 rounded-md" />
      </div>
    );
  }

  if (!user) return <LoginPage onSignedIn={setUser} />;

  return (
    <SessionContext.Provider value={{ user, signOut }}>{children}</SessionContext.Provider>
  );
}
