import { prisma } from '../config/prisma';
import { Server as SocketServer } from 'socket.io';

let ioInstance: SocketServer | null = null;

export function setSocketInstance(io: SocketServer): void {
  ioInstance = io;
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: string,
  link?: string
): Promise<void> {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link,
      },
    });

    if (ioInstance) {
      ioInstance.to(`user:${userId}`).emit('notification:new', notification);
    }
  } catch (error) {
    console.error('[createNotification] Error:', error);
  }
}
