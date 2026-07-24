import { useUnlocked, unlockAccess } from '@/access/passkey';
import { PassKeyScreen } from './PassKeyScreen';

/**
 * PassKeyGate — a wrapper (NOT a screen-machine state) that blocks the app
 * behind the Pass Key entry until this device is unlocked.
 *
 * Mirrors the AppShell / SmallScreenGate pattern: it renders EITHER the gate
 * OR its children, so the game's screen flow, persistence, and migrations are
 * left untouched. Unlock state lives in a reactive store (access/passkey.ts),
 * so a global "Log out" control elsewhere can re-lock and bring the gate back
 * instantly — no reload.
 */
export function PassKeyGate({ children }: { children: React.ReactNode }) {
  const unlocked = useUnlocked();
  if (unlocked) return <>{children}</>;
  return <PassKeyScreen onEnter={unlockAccess} />;
}
