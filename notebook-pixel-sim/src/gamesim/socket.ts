// Authenticated realtime notifications from gamesim. Socket carries no
// canonical data — every event just tells the app to refetch over HTTP
// (round.*, decision.submitted, result.published). See gamesim's
// server/src/utils/socket.ts for the room/auth contract this mirrors.
import { io, type Socket } from 'socket.io-client';
import { getGamesimBaseUrl, getGamesimToken } from './client';
import type { GamesimSocketEvent } from '@gamesim/api-contract';

export type { GamesimSocketEvent };

let socket: Socket | null = null;

function socketOrigin(): string {
  // gamesim mounts REST at /api and Socket.IO at the server root.
  return getGamesimBaseUrl().replace(/\/api\/?$/, '');
}

export function connectGamesimSocket(): Socket | null {
  const token = getGamesimToken();
  if (!token) return null;
  if (socket) return socket;

  socket = io(socketOrigin(), {
    transports: ['websocket'],
    auth: { token },
  });
  return socket;
}

export function disconnectGamesimSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function onGamesimEvent(event: GamesimSocketEvent, handler: (data: unknown) => void): () => void {
  const s = connectGamesimSocket();
  if (!s) return () => {};
  s.on(event, handler);
  return () => s.off(event, handler);
}
