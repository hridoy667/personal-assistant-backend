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
  const [sleepH, sleepM] = (user.defaultSleepTime || '23:00').split(':').map(Number);

  // Convert UTC request to local wall clock
  const zonedNow = toZonedTime(requestDate, timeZone);
  let logicalZonedDate = new Date(zonedNow);

  const zonedWake = new Date(zonedNow);
  zonedWake.setHours(wakeH, wakeM, 0, 0);

  // If current time is before wake time (e.g., 02:00 AM), we are still in yesterday's logical day
  if (zonedNow < zonedWake) {
    logicalZonedDate = subDays(logicalZonedDate, 1);
  }

  // Define default local bounds for the logical date
  const localStart = new Date(logicalZonedDate);
  localStart.setHours(wakeH, wakeM, 0, 0);

  let localEnd = new Date(logicalZonedDate);
  localEnd.setHours(sleepH, sleepM, 0, 0);

  if (sleepH < wakeH || (sleepH === wakeH && sleepM <= wakeM)) {
    localEnd = addDays(localEnd, 1);
  }

  const defaultStart = fromZonedTime(localStart, timeZone);
  const defaultEnd = fromZonedTime(localEnd, timeZone);

  // 1. Search wider range (previous day startOfDay to current day endOfDay) to catch night sessions
  const searchStartWindow = subDays(fromZonedTime(startOfDay(logicalZonedDate), timeZone), 1);
  const searchEndWindow = addDays(fromZonedTime(endOfDay(logicalZonedDate), timeZone), 1);

  // 2. Fetch active or latest session matching this logical window
  const actualStartLog = await prisma.sleepLog.findFirst({
    where: {
      userId,
      sleptAt: {
        gte: searchStartWindow,
        lte: searchEndWindow,
      },
    },
    orderBy: { sleptAt: 'desc' },
  });

  const dayStart = actualStartLog?.wokeUpAt || defaultStart;
  const dayEnd = actualStartLog?.sleptAt || defaultEnd;

  return {
    logicalDate: fromZonedTime(startOfDay(logicalZonedDate), timeZone),
    dayStart,
    dayEnd,
    isCurrentlyAwake: !actualStartLog || actualStartLog.wokeUpAt !== null,
  };
}