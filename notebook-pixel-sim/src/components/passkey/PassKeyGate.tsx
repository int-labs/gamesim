import { useUnlocked, unlockAccess } from '@/access/passkey';
import { useGamesimSession } from '@/gamesim/GamesimProvider';
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
 *
 * In the gamesim build this is the INNER gate: GamesimProvider already shows the
 * same screen when there is no session, so by the time children mount the app is
 * normally unlocked. It still matters after an in-app logout — hence the
 * bootstrap refetch on re-entry, so the reloaded team's context replaces the
 * previous one instead of lingering.
 */
export function PassKeyGate({ children }: { children: React.ReactNode }) {
  const unlocked = useUnlocked();
  const { refetchBootstrap } = useGamesimSession();
  if (unlocked) return <>{children}</>;
  return (
    <PassKeyScreen
      onEnter={() => {
        unlockAccess();
        refetchBootstrap();
      }}
    />
  );
}
