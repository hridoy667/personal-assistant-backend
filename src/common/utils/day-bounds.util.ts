import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay, addDays, subDays } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const prisma = new PrismaClient();

export async function getUserDayBounds(
  userId: string,
  requestDate: Date = new Date(),
  userTimeZone?: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultWakeTime: true, defaultSleepTime: true, timezone: true },
  });

  if (!user) throw new Error('User not found');

  const timeZone = userTimeZone || user.timezone || 'UTC';

  const [wakeH, wakeM] = (user.defaultWakeTime || '06:00').split(':').map(Number);
  const [sleepH, sleepM] = (user.defaultSleepTime || '04:00').split(':').map(Number);

  // 1. CONVERT UTC REQUEST TO USER'S ZONED WALL-CLOCK DATE
  const zonedNow = toZonedTime(requestDate, timeZone);

  // 2. DETERMINE LOGICAL DATE IN LOCAL TIME
  let logicalZonedDate = new Date(zonedNow);

  // Set wake time on the zoned date
  const zonedWake = new Date(zonedNow);
  zonedWake.setHours(wakeH, wakeM, 0, 0);

  // If current local time is before wake time, shift back 1 logical day
  if (zonedNow < zonedWake) {
    logicalZonedDate = subDays(logicalZonedDate, 1);
  }

  // 3. CONSTRUCT LOCAL START & END TIMES
  const localStart = new Date(logicalZonedDate);
  localStart.setHours(wakeH, wakeM, 0, 0);

  let localEnd = new Date(logicalZonedDate);
  localEnd.setHours(sleepH, sleepM, 0, 0);

  // If sleep time (e.g. 04:00) is earlier than wake time (e.g. 06:00), it ends tomorrow
  if (sleepH < wakeH || (sleepH === wakeH && sleepM <= wakeM)) {
    localEnd = addDays(localEnd, 1);
  }

  // 4. CONVERT ZONED WALL-CLOCK TIMES BACK TO TRUE UTC FOR PRISMA
  const defaultStart = fromZonedTime(localStart, timeZone);
  const defaultEnd = fromZonedTime(localEnd, timeZone);

  const localStartOfDay = fromZonedTime(startOfDay(logicalZonedDate), timeZone);
  const localEndOfDay = fromZonedTime(endOfDay(logicalZonedDate), timeZone);

  // 5. OVERRIDE WITH SLEEP LOGS IF PRESENT
  const actualStartLog = await prisma.sleepLog.findFirst({
    where: {
      userId,
      wokeUpAt: {
        gte: localStartOfDay,
        lte: localEndOfDay,
      },
    },
    orderBy: { wokeUpAt: 'desc' },
  });

  const dayStart = actualStartLog?.wokeUpAt || defaultStart;

  const actualEndLog = await prisma.sleepLog.findFirst({
    where: {
      userId,
      sleptAt: {
        gte: dayStart,
        lte: addDays(dayStart, 1),
      },
    },
    orderBy: { sleptAt: 'asc' },
  });

  const dayEnd = actualEndLog?.sleptAt || defaultEnd;

  return {
    logicalDate: localStartOfDay,
    dayStart,
    dayEnd,
    isCurrentlyAwake: !actualEndLog?.sleptAt,
  };
}