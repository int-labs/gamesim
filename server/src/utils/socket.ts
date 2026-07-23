import { Server, Socket } from "socket.io";
import jwt, { JwtPayload } from "jsonwebtoken";
import Team from "../models/teams";

let io: Server;

interface SocketUser {
  id: string;
  role: string;
  teamId?: string;
  simulationId?: string;
}

// Kept for the pre-existing unauthenticated `userLoggedIn` convention some
// clients may still emit — superseded by the authenticated room join below,
// which is the source of truth for round/decision/result routing.
const userSessions = new Map<string, Set<string>>();

export const initSocket = (srv: any, origin: string) => {
  io = new Server(srv, {
    cors: {
      origin,
      methods: ["GET", "POST"],
    },
  });

  // Authenticate the handshake itself — a socket that can't present a valid
  // access token never reaches `connection`, so a client can never pick its
  // own user/team/simulation room by supplying it in event payloads.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        next(new Error("Unauthorized"));
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload & {
        id: string;
        role: string;
        teamId?: string;
      };

      let simulationId: string | undefined;
      if (decoded.teamId) {
        const team = await Team.findById(decoded.teamId);
        simulationId = team ? String(team.simulationId) : undefined;
      }

      (socket.data as { user?: SocketUser }).user = {
        id: decoded.id,
        role: decoded.role,
        teamId: decoded.teamId,
        simulationId,
      };
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connect_error", (err) => {
    console.log(`connect_error due to ${err.message}`);
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket.data as { user?: SocketUser }).user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    socket.join(`user:${user.id}`);
    socket.join(`role:${user.role}`);
    if (user.teamId) socket.join(`team:${user.teamId}`);
    if (user.simulationId) socket.join(`simulation:${user.simulationId}`);

    console.log(`User connected: ${socket.id} (user:${user.id}, role:${user.role})`);

    socket.on("userLoggedIn", (data: { userId: string }) => {
      const { userId } = data;
      if (userId) {
        if (!userSessions.has(userId)) userSessions.set(userId, new Set());
        userSessions.get(userId)!.add(socket.id);
      }
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
      for (const [userId, socketIds] of userSessions.entries()) {
        socketIds.delete(socket.id);
        if (socketIds.size === 0) userSessions.delete(userId);
      }
    });
  });

  return io;
};

export const getSocket = () => {
  if (!io) {
    throw new Error("Socket.io is not initialized!");
  }
  return io;
};

export const getUserSessions = (userId: string): Set<string> => {
  return userSessions.get(userId) || new Set();
};

// Room-scoped emit helpers — round/decision/result controllers use these,
// never a raw io.emit(...), so a lifecycle event only ever reaches the
// simulation/team it's actually about.
export const emitToSimulation = (simulationId: string, event: string, data: unknown) => {
  getSocket().to(`simulation:${simulationId}`).emit(event, data);
};

export const emitToTeam = (teamId: string, event: string, data: unknown) => {
  getSocket().to(`team:${teamId}`).emit(event, data);
};

export const emitToUser = (userId: string, event: string, data: unknown) => {
  getSocket().to(`user:${userId}`).emit(event, data);
};
