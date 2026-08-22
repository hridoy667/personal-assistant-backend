import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay, setHours, setMinutes } from 'date-fns';

const prisma = new PrismaClient();

/**
 * Calculates a user's exact start and end of day boundaries based on 
 * their latest SleepLog entries or default wake/sleep string fallbacks.
 * 
 * @param userId - ID of the target user
 * @param targetDate - Optional date to check bounds for (defaults to today)
 */
export async function getUserDayBounds(userId: string, targetDate: Date = new Date()) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultWakeTime: true, defaultSleepTime: true, createdAt: true },
  });

  if (!user) throw new Error('User not found');

  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);

  // Check for active or completed sleep logs today
  const todaysWakeLog = await prisma.sleepLog.findFirst({
    where: {
      userId,
      wokeUpAt: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { wokeUpAt: 'desc' },
  });

  if (todaysWakeLog && todaysWakeLog.wokeUpAt) {
    return {
      dayStart: todaysWakeLog.wokeUpAt,
      dayEnd: dayEnd,
    };
  }

  // FALLBACK FOR NEW USERS WITH NO LOGS:
  // Use default user settings (e.g., 06:00 to 23:00) applied to targetDate
  const [wakeH, wakeM] = (user.defaultWakeTime || '06:00').split(':').map(Number);
  const [sleepH, sleepM] = (user.defaultSleepTime || '23:00').split(':').map(Number);

  return {
    dayStart: setMinutes(setHours(targetDate, wakeH), wakeM),
    dayEnd: setMinutes(setHours(targetDate, sleepH), sleepM),
  };
}