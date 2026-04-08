import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { setSocketInstance } from '../utils/notifications';

let io: SocketServer;

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: no token'));
    }
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string };
      (socket as Socket & { user: { id: string; role: string } }).user = decoded;
      next();
    } catch {
      next(new Error('Authentication error: invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as Socket & { user: { id: string; role: string } }).user;
    if (!user) {
      socket.disconnect();
      return;
    }

    // Join personal room and role room
    socket.join(`user:${user.id}`);
    socket.join(`role:${user.role}`);

    console.log(`[Socket] User ${user.id} (${user.role}) connected`);

    socket.on('qr:subscribe', (data: { entryPointId: string }) => {
      if (data?.entryPointId) {
        socket.join(`entryPoint:${data.entryPointId}`);
        console.log(`[Socket] User ${user.id} subscribed to entryPoint:${data.entryPointId}`);
      }
    });

    socket.on('qr:unsubscribe', (data: { entryPointId: string }) => {
      if (data?.entryPointId) {
        socket.leave(`entryPoint:${data.entryPointId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] User ${user.id} disconnected`);
    });
  });

  setSocketInstance(io);

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
