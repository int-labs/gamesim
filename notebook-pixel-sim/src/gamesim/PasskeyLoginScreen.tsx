import { useState } from 'react';
import * as gamesim from './client';

/** Minimal passkey login against gamesim's POST /users/login-passkey — the
 *  team-role login path (no email/password). The response carries the team and
 *  simulation ids as well as the token; all three are stored, because every
 *  later call on main passes them explicitly as query params.
 *  Deliberately plain, unstyled markup: this is the integration seam, not the
 *  pixel-art visual layer. */
export function PasskeyLoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [passkey, setPasskey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passkey.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { token, teamId, simulationId } = await gamesim.loginWithPasskey(passkey.trim());
      gamesim.setGamesimSession({ token, teamId, simulationId });
      onSuccess();
    } catch (err) {
      setError(err instanceof gamesim.GamesimApiError ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', background: '#fdf6ec', color: '#241c12' }}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 280 }}>
        <h2 style={{ marginBottom: 8 }}>Enter your team passkey</h2>
        <input
          autoFocus
          type="text"
          value={passkey}
          onChange={(e) => setPasskey(e.target.value)}
          placeholder="Passkey"
          style={{ padding: 10, fontSize: 16 }}
        />
        {error && <p style={{ color: '#c0392b', margin: 0 }}>{error}</p>}
        <button type="submit" disabled={submitting || !passkey.trim()} style={{ padding: 10, fontSize: 16, cursor: 'pointer' }}>
          {submitting ? 'Signing in...' : 'Start'}
        </button>
      </form>
    </div>
  );
}
