import { Server, Socket } from "socket.io";

let io: Server;

// Track user sessions: userId -> Set of socketIds
const userSessions = new Map<string, Set<string>>();

export const initSocket = (srv: any, origin: string) => {
  io = new Server(srv, {
    cors: {
      origin,
      methods: ["GET", "POST"],
    },
  });

  io.on("connect_error", (err) => {
    console.log(`connect_error due to ${err.message}`);
  });

  io.on("connection", (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    // Listen for userLoggedIn event to track sessions
    socket.on("userLoggedIn", (data: { userId: string }) => {
      const { userId } = data;
      if (userId) {
        if (!userSessions.has(userId)) {
          userSessions.set(userId, new Set());
        }
        userSessions.get(userId)!.add(socket.id);
        console.log(`User ${userId} logged in on socket ${socket.id}`);
      }
    });

    // Clean up on disconnect
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
      // Remove this socket from all user sessions
      for (const [userId, socketIds] of userSessions.entries()) {
        socketIds.delete(socket.id);
        if (socketIds.size === 0) {
          userSessions.delete(userId);
        }
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
