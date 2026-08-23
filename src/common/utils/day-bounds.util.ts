import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay, addDays, subDays } from 'date-fns';

const prisma = new PrismaClient();

// Helper: Get target timezone offset in minutes for a given Date
function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value]),
  );

  const localAsUtc = new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second),
    ),
  );

  return (localAsUtc.getTime() - date.getTime()) / 60000;
}

// Helper: Convert UTC Date to local wall-clock representations and back
function toLocalTime(date: Date, timeZone: string): Date {
  const offset = getTimeZoneOffsetMinutes(date, timeZone);
  return new Date(date.getTime() + offset * 60000);
}

function fromLocalTime(localDate: Date, timeZone: string): Date {
  const offset = getTimeZoneOffsetMinutes(localDate, timeZone);
  return new Date(localDate.getTime() - offset * 60000);
}

export async function getUserDayBounds(
  userId: string,
  requestDate: Date = new Date(),
  userTimeZone?: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultWakeTime: true, defaultSleepTime: true, timezone: true }, // Fixed: timezone
  });

  if (!user) throw new Error('User not found');

  // Priority: parameter -> user setting -> default UTC fallback
  const timeZone = userTimeZone || user.timezone || 'UTC'; // Fixed: user.timezone

  const [wakeH, wakeM] = (user.defaultWakeTime || '06:00').split(':').map(Number);
  const [sleepH, sleepM] = (user.defaultSleepTime || '23:00').split(':').map(Number);

  // 1. CONVERT REQUEST TO USER'S LOCAL TIME WALL-CLOCK
  const localDate = toLocalTime(requestDate, timeZone);

  // 2. DETERMINE LOGICAL DATE IN LOCAL CONTEXT
  let logicalLocalDate = new Date(localDate);
  const localWake = new Date(localDate);
  localWake.setHours(wakeH, wakeM, 0, 0);

  if (localDate < localWake) {
    logicalLocalDate = subDays(logicalLocalDate, 1);
  }

  // 3. SET BASE DEFAULTS FOR THE LOGICAL DAY
  const localStart = new Date(logicalLocalDate);
  localStart.setHours(wakeH, wakeM, 0, 0);

  let localEnd = new Date(logicalLocalDate);
  localEnd.setHours(sleepH, sleepM, 0, 0);

  if (sleepH < wakeH) {
    localEnd = addDays(localEnd, 1); // Handles cross-midnight
  }

  // 4. MAP LOCAL WALL-CLOCK TIMES BACK TO TRUE UTC STAMPS
  const defaultStart = fromLocalTime(localStart, timeZone);
  const defaultEnd = fromLocalTime(localEnd, timeZone);
  
  const localStartOfDay = fromLocalTime(startOfDay(logicalLocalDate), timeZone);
  const localEndOfDay = fromLocalTime(endOfDay(logicalLocalDate), timeZone);

  // 5. OVERRIDE WITH ACTUAL LOGS
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
    logicalDate: localStartOfDay, // Correct UTC start of the logical date for queries
    dayStart,
    dayEnd,
    isCurrentlyAwake: !actualEndLog?.sleptAt,
  };
}