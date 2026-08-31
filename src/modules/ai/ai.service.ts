import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { GenerateSuggestionDto, SuggestionContextType } from './dto/generate-suggestion.dto';
import { PrismaService } from '../prisma/prisma.service';
import { calculateAge, calculateBmi } from 'src/common/utils/health-science.util';
import { getUserDayBounds } from 'src/common/utils/day-bounds.util';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private groq: Groq;

  constructor(private readonly prisma: PrismaService,
    private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      this.logger.warn('GROQ_API_KEY is missing from environment variables.');
    }
    this.groq = new Groq({ apiKey });
  }

  async generateSuggestion(dto: GenerateSuggestionDto): Promise<{ suggestion: string }> {
    try {
      const systemPrompt = this.buildSystemPrompt(dto.contextType);
      const userPrompt = dto.userContext
        ? `Here is the current user context:\n${dto.userContext}`
        : 'Provide a helpful, actionable suggestion for my day.';

      const completion = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: 'openai/gpt-oss-120b',
        temperature: 2,
        max_tokens: 900,
      });

      const suggestion = completion.choices[0]?.message?.content?.trim();

      if (!suggestion) {
        throw new Error('Received empty response from Groq API');
      }

      return { suggestion };
    } catch (error: any) {
      this.logger.error(`Failed to generate AI suggestion: ${error.message}`, error.stack);
      throw new InternalServerErrorException('AI Suggestion generation failed.');
    }
  }

  private buildSystemPrompt(contextType: SuggestionContextType): string {
    const basePrompt = `You are Nexus AI, a personal executive assistant built into a Personal OS. Your job is to analyze user habits, tasks, screen time, mood, and finance metrics to provide sharp, empathetic, concise, and highly actionable advice. Keep responses under 3-4 sentences or 3 bullet points maximum. Never use generic corporate jargon.`;

    switch (contextType) {
      case SuggestionContextType.DAILY_BRIEFING:
        return `${basePrompt} Focus on summarizing the morning briefing, highlighting top priorities, weather adjustments, and energy management.`;
      case SuggestionContextType.TASK_OPTIMIZATION:
        return `${basePrompt} Focus on productivity, energy management, breaking down complex tasks, and time-blocking recommendations.`;
      case SuggestionContextType.WELLBEING_TIP:
        return `${basePrompt} Focus on sleep recovery, mindfulness, reducing screen time, and emotional balance.`;
      case SuggestionContextType.FINANCE_ADVICE:
        return `${basePrompt} Focus on budget awareness, saving goals progression, and mindful spending habits.`;
      default:
        return basePrompt;
    }
  }

  async generateUserContext(userId: string) {
    // 1. Fetch baseline user profile & timezone first
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        personalityType:true,
        gender: true,
        height: true,
        weight: true,
        timezone: true,
        dateOfBirth: true,
        defaultWakeTime: true,
        defaultSleepTime: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    // 2. Compute day bounds using user's explicit timezone
    const dayBounds = await getUserDayBounds(
      userId,
      new Date(),
      user.timezone || 'UTC',
    );
    const { dayStart, dayEnd, logicalDate, isCurrentlyAwake } = dayBounds;
    console.log(dayBounds)
    // 3. Concurrently retrieve logs
    const [allActivities, todayActivities, latestMood, todayScreenTime, rawTopApps, recentSleep] =
      await Promise.all([
        this.prisma.activityLog.findMany({
          where: { userId },
          select: { type: true, durationMin: true, note: true, loggedAt: true },
          orderBy: { loggedAt: 'desc' },
        }),
        this.prisma.activityLog.findMany({
          where: {
            userId,
            loggedAt: { gte: dayStart, lte: dayEnd },
          },
          select: { type: true, durationMin: true, note: true, loggedAt: true },
          orderBy: { loggedAt: 'asc' },
        }),
        this.prisma.moodLog.findFirst({
          where: {
            userId,
            loggedAt: { gte: dayStart, lte: dayEnd },
          },
          select: { mood: true, energyScore: true, symptoms: true },
          orderBy: { loggedAt: 'desc' },
        }),
        this.prisma.screenTimeLog.findFirst({
          where: {
            userId,
            date: logicalDate,
          },
          select: { totalScreenTimeMins: true, productivityScore: true },
        }),
        this.prisma.appUsage.findMany({
          where: {
            userId,
            date: logicalDate,
          },
          select: { appName: true, category: true, timeSpentMins: true },
          orderBy: { timeSpentMins: 'desc' },
        }),
        this.prisma.sleepLog.findFirst({
          where: {
            userId,
            sleptAt: { gte: dayStart, lte: dayEnd },
          },
          select: { sleptAt: true, wokeUpAt: true, qualityRating: true },
          orderBy: { sleptAt: 'desc' },
        }),
      ]);

    // 4. Deduplicate top apps by appName
    const topAppsMap = new Map<string, { appName: string; category: any; timeSpentMins: number }>();
    for (const app of rawTopApps) {
      const name = app.appName || 'Unknown';
      if (!topAppsMap.has(name)) {
        topAppsMap.set(name, {
          appName: name,
          category: app.category,
          timeSpentMins: app.timeSpentMins,
        });
      }
    }
    const topApps = Array.from(topAppsMap.values()).slice(0, 5);

    // 5. Calculate derived metrics
    const bmi = calculateBmi(user.height, user.weight);
    const age = calculateAge(user.dateOfBirth);

    let sleepDurationHours: number | null = null;
    if (recentSleep?.sleptAt && recentSleep?.wokeUpAt) {
      const diffMs = recentSleep.wokeUpAt.getTime() - recentSleep.sleptAt.getTime();
      sleepDurationHours = Number((diffMs / (1000 * 60 * 60)).toFixed(1));
    }

    // Determine target activity list (fallback to recent activities if today's bounds return empty)
    const activitiesToDescribe = todayActivities.length > 0 ? todayActivities : allActivities.slice(0, 5);
    const totalActivityMins = activitiesToDescribe.reduce(
      (sum, act) => sum + (act.durationMin || 0),
      0,
    );

    // const structuredData = {
    //   user: {
    //     age,
    //     gender: user.gender || null,
    //     bmi,
    //     activityLevel: allActivities,
    //     isCurrentlyAwake,
    //   },
    //   timeContext: {
    //     defaultWakeTime: user.defaultWakeTime,
    //     defaultSleepTime: user.defaultSleepTime,
    //   },
    //   currentState: {
    //     mood: latestMood?.mood || null,
    //     energyScore: latestMood?.energyScore || null,
    //     symptoms: latestMood?.symptoms || [],
    //     recentSleep: {
    //       durationHours: sleepDurationHours,
    //       qualityRating: recentSleep?.qualityRating || null,
    //     },
    //   },
    //   todaySummary: {
    //     totalActivityMins,
    //     loggedActivitiesCount: activitiesToDescribe.length,
    //     activities: activitiesToDescribe,
    //     screenTimeMins: todayScreenTime?.totalScreenTimeMins || 0,
    //     productivityScore: todayScreenTime?.productivityScore || null,
    //     topApps,
    //   },
    // };

    // 6. Build text timeline with exact user time format
    const activityTimeline = activitiesToDescribe.length > 0
      ? activitiesToDescribe
        .map((act) => {
          const timeStr = new Date(act.loggedAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: user.timezone || 'UTC',
          });
          const durationStr = act.durationMin ? `for ${act.durationMin} mins` : '';
          const noteStr = act.note ? ` (Note: "${act.note}")` : '';
          return `- At ${timeStr}, user logged ${act.type} ${durationStr}${noteStr}`.trim();
        })
        .join('\n')
      : '- No activities logged.';

    const appUsageText = topApps.length > 0
      ? topApps.map(a => `${a.appName} (${a.timeSpentMins}m)`).join(', ')
      : 'No app usage recorded';

    const symptomsText = latestMood?.symptoms?.length
      ? latestMood.symptoms.join(', ')
      : 'None reported';

    // 7. Render dynamic text context prompt
    const userContextText = `USER CONTEXT SNAPSHOT:
- Profile: ${age ? `${age} yrs old` : 'Age unknown'}, Gender: ${user.gender || 'Unspecified'}, BMI: ${bmi ?? 'N/A'}.
- Awake Status: User is currently ${isCurrentlyAwake ? 'AWAKE' : 'ASLEEP'} (Schedule: ${user.defaultWakeTime} - ${user.defaultSleepTime}).
- Current State: Mood is ${latestMood?.mood || 'unrecorded'}, Energy Score: ${latestMood?.energyScore ?? 'N/A'}/5, Symptoms: ${symptomsText}.
- Sleep: ${sleepDurationHours ? `${sleepDurationHours} hrs logged` : 'No sleep logged today'} (Quality: ${recentSleep?.qualityRating ?? 'N/A'}/5).

LOGGED ACTIVITIES (${totalActivityMins} mins total across ${activitiesToDescribe.length} logs):
${activityTimeline}

DIGITAL USAGE:
- Total Screen Time: ${todayScreenTime?.totalScreenTimeMins || 0} mins. Top apps: ${appUsageText}.`;

    return {
      userContextText,
    };
  }
}