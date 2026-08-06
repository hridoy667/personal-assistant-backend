import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging, Message, FidMulticastMessage } from 'firebase-admin/messaging';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from 'src/common/dtos/pagination.dto';

@Injectable()
export class NotificationService implements OnModuleInit {

    constructor(private readonly prisma: PrismaService) { }

    onModuleInit() {
        if (getApps().length === 0) {
            initializeApp({
                // 🛠️ Fixed: Use modular cert() instead of admin.credential.cert
                credential: cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                }),
            });
            console.log('Firebase Admin SDK initialized successfully.');
        }
    }

    async sendNotificationToUsers(userIds: string | string[], title: string, body: string) {
        // 1. Normalize input into an array so the logic handles 1 or multiple users identically
        const targetUserIds = Array.isArray(userIds) ? userIds : [userIds];

        if (targetUserIds.length === 0) {
            return { pushDispatched: false, reason: 'No user IDs provided.' };
        }

        // 2. Save notifications in the database history for all target users concurrently
        const notificationData = targetUserIds.map(id => ({
            userId: id,
            title,
            body,
        }));

        await this.prisma.notification.createMany({
            data: notificationData,
        });

        // 3. Fetch active Firebase tokens ONLY for users who have isNotificationOn enabled
        const users = await this.prisma.user.findMany({
            where: {
                id: { in: targetUserIds },
                isNotificationOn: true, // 👈 Filters out users who muted notifications
            },
            select: {
                firebaseToken: true,
            },
        });

        // 4. Flatten all multi-device arrays into one single array of target tokens
        const allTokens = users
            .flatMap(user => user.firebaseToken)
            .filter((token): token is string => !!token && token.trim() !== '');

        // 5. Fallback: If zero devices are registered or everyone turned off notifications
        if (allTokens.length === 0) {
            return {
                pushDispatched: false,
                reason: 'No active push tokens found (Users may have disabled notifications or have no active devices).',
            };
        }

        // 6. Map your flat list of tokens into an array of individual message payloads
        const messages: Message[] = allTokens.map(token => ({
            token,
            notification: { title, body },
            android: { priority: 'high' },
        }));

        try {
            // 7. Blast messages concurrently using sendEach()
            const response = await getMessaging().sendEach(messages);

            return {
                pushDispatched: true,
                successCount: response.successCount,
                failureCount: response.failureCount,
            };
        } catch (error) {
            console.error(`FCM failed to blast messages to target users:`, error);
            return {
                pushDispatched: false,
                error: 'Database saved, but push dispatch channel experienced downstream network error.',
            };
        }
    }

    async getAll(userId: string, paginationDto: PaginationDto) {
        const { cursor, limit = 10 } = paginationDto;
        const take = limit + 1;

        const notifications = await this.prisma.notification.findMany({
            where: {
                userId: userId,
            },
            take: take,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: {
                createdAt: 'desc', // Show newest notifications first
            },
        });

        const hasNextPage = notifications.length > limit;

        if (hasNextPage) {
            notifications.pop();
        }

        const nextCursor = notifications.length > 0 ? notifications[notifications.length - 1].id : null;

        return {
            success: true,
            data: notifications,
            meta: {
                hasNextPage,
                nextCursor: hasNextPage ? nextCursor : null,
            },
        };
    }

    async deleteOne(id: string, userId: string) {
        // 1. Verify the notification exists and belongs to this user first
        const notification = await this.prisma.notification.findFirst({
            where: {
                id: id,
                userId: userId,
            },
        });

        if (!notification) {
            throw new NotFoundException('Notification not found or access denied.');
        }

        // 2. Perform the secure deletion
        await this.prisma.notification.delete({
            where: {
                id: id,
            },
        });

        return {
            success: true,
            message: 'Notification deleted successfully.',
        };
    }

}