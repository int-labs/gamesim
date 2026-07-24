// CORS / Socket.IO allowed-origin helper. Kept free of Express/socket.io
// imports so HTTP and Socket.IO can share one consistent allowlist.
export function parseAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = [
    env.CLIENT_ORIGIN,
    env.PLAYER_ORIGIN,
    env.ADMIN_ORIGIN,
    env.ALLOWED_ORIGINS,
    env.RENDER_EXTERNAL_URL,
  ]
    .filter(Boolean)
    .join(',');

  const fromEnv = raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const defaults = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3005',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3001',
  ];

  return Array.from(new Set([...fromEnv, ...defaults]));
}

export function isOriginAllowed(origin: string | undefined, allowed: string[], isProdLike: boolean): boolean {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, '');
  if (allowed.includes(normalized)) return true;
  return !isProdLike;
}
