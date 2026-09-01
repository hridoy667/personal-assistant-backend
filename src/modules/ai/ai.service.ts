import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import {
  GenerateSuggestionDto,
  SuggestionContextType,
} from './dto/generate-suggestion.dto';
import { PrismaService } from '../prisma/prisma.service';
import { calculateAge, calculateBmi } from 'src/common/utils/health-science.util';
import { getUserDayBounds } from 'src/common/utils/day-bounds.util';
import { DashboardService } from '../dashbord/dashboard.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private groq: Groq;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly dashbordService: DashboardService,
    private readonly httpService: HttpService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      this.logger.warn('GROQ_API_KEY is missing from environment variables.');
    }
    this.groq = new Groq({ apiKey });
  }

  private buildCacheKey(userId: string, contextType: SuggestionContextType, providedContext?: string): string {
    const cacheContextPart = providedContext
      ? `:custom:${Buffer.from(providedContext).toString('base64').slice(0, 16)}`
      : '';
    return `ai:suggestion:${userId}:${contextType}${cacheContextPart}`;
  }

  /**
   * Explicitly delete a cached suggestion for a user and context type
   */
  async clearSuggestionCache(userId: string, contextType: SuggestionContextType, providedContext?: string): Promise<boolean> {
    const redisKey = this.buildCacheKey(userId, contextType, providedContext);
    try {
      const deletedCount = await this.redis.del(redisKey);
      return deletedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to delete Redis cache key ${redisKey}:`, error);
      return false;
    }
  }

  /**
   * Generates suggestion with optional cache bypass
   */
  async generateSuggestion(
    dto: GenerateSuggestionDto,
    userId: string,
    forceRefresh = false,
  ) {
    const providedContext = dto.userContext?.trim();
    const redisKey = this.buildCacheKey(userId, dto.contextType, providedContext);
    const CACHE_TTL = 5400; // 1.5 hours in seconds

    // 1. Check Redis Cache (Skip if forceRefresh is true)
    if (!forceRefresh) {
      try {
        const cachedSuggestion = await this.redis.get(redisKey);
        if (cachedSuggestion) {
          return JSON.parse(cachedSuggestion);
        }
      } catch (redisError) {
        this.logger.error('Redis read error in generateSuggestion:', redisError);
      }
    }

    // 2. Build Unified User Context
    let finalUserContext = '';
    const autoDbContext = await this.generateUserContext(userId);
    console.log('Auto-generated DB context:', autoDbContext);
    if (providedContext) {
      finalUserContext = `[DIRECT INPUT CONTEXT]:\n${providedContext}\n\n[BACKGROUND USER SNAPSHOT]:\n${autoDbContext}`;
    } else {
      finalUserContext = autoDbContext;
    }

    // 3. Optional live Tavily web search context
    const webContext = await this.fetchTavilyContext(dto.contextType);
    if (webContext) {
      finalUserContext += `\n\n[REAL-TIME RESEARCH CONTEXT]:\n${webContext}`;
    }

    // 4. Build system prompt & execute AI request
    const systemPrompt = this.buildSystemPrompt(dto.contextType);
    const result = await this.executeAiPipeline(systemPrompt, finalUserContext, dto.contextType);

    // 5. Cache ONLY valid responses (Do not cache fallbacks)
    const isFallback = result.suggestion === 'Unable to generate suggestion at this time.';
    if (!isFallback) {
      try {
        await this.redis.set(redisKey, JSON.stringify(result), 'EX', CACHE_TTL);
      } catch (redisSetError) {
        this.logger.error('Redis set error in generateSuggestion:', redisSetError);
      }
    }

    return result;
  }

  /**
   * Combined step: Clear existing cache and re-fetch fresh suggestion
   */
  async refreshSuggestion(dto: GenerateSuggestionDto, userId: string) {
    await this.clearSuggestionCache(userId, dto.contextType, dto.userContext);
    return this.generateSuggestion(dto, userId, true);
  }

  private async executeAiPipeline(
    systemPrompt: string,
    userContext: string,
    contextType: SuggestionContextType,
  ): Promise<{ suggestion: string; contextType: SuggestionContextType }> {
    try {
      const model = this.configService.get<string>('GROQ_MODEL') || 'openai/gpt-oss-120b';

      // Example using Groq SDK execution
      const response = await this.groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Analyze the following context snapshot and return your tactical plan according to format rules:\n\n${userContext}`,
          },
        ],
        temperature: 0.4,
        max_tokens: 1200,
      });

      const suggestion =
        response.choices[0]?.message?.content?.trim() ||
        'Unable to generate suggestion at this time.';

      return {
        suggestion,
        contextType,
      };
    } catch (error: any) {
      this.logger.error(`Groq AI pipeline execution failed: ${error.message}`, error.stack);
      return {
        suggestion: 'Unable to generate suggestion at this time.',
        contextType,
      };
    }
  }

  private buildSystemPrompt(contextType: SuggestionContextType): string {
    const corePersona = `You are Evo AI, an empathetic, intuitive, high-performance personal OS companion.

VOICE & TONE GUIDELINES:
- Speak like an insightful, grounded human peer or elite personal performance manager who truly understands the user's day.
- Express natural situational awareness based on time, fatigue, and real-life context (e.g., recognize when it's 1 AM, acknowledge heavy workloads, or note high heat outside).
- Deliver practical, hyper-personalized advice in a conversational, relatable format.
- Write using standard conversational Markdown (either 1 warm, concise paragraph OR 2-3 short, impactful bullet points).

REASONING & DATA HIERARCHY EVALUATION:
1. SENSE THE MOMENT: Read the current local time, wake/sleep status, and environmental conditions first to establish real-world constraints.
2. SYNTHESIZE KEY DATA: Prioritize core domain parameters first, then layer secondary context to uncover real root causes (e.g., connect poor sleep or long screen time to lower mood).
3. FORMULATE HUMAN ADVICE: Offer real-world guidance, guidence for betterment, practical resets, or sensible cautions tailored to their exact situation.`;

    switch (contextType) {
      case SuggestionContextType.PHYSICAL_ACTIVITY:
        return `${corePersona}

[ROLE & SPECIALTY]: Practical Movement & Recovery Coach.
[OBJECTIVE]: Synthesize today's logged activities with pending task demands to prescribe specific workout timings, active breaks, or recovery strategies.

[DATA EVALUATION HIERARCHY]:
• PRIMARY ANCHORS (MUST DRIVE THE RESPONSE): Logged Activities (types, durations) + Pending Tasks (priority, energy demands) + Current Local Time.
• SECONDARY Context: User Profile (BMI, Age, Gender, Personality).
• TERTIARY Context (Use ONLY as background constraints): Weather & Environment.

[INSTRUCTIONAL GUIDELINES]:
- Rule 1 (Activity & Task Alignment): Directly mention their completed activities and relate them to their pending tasks. Example: "You've spent 2 hours doing [X Activity], but still have [Y Task] pending..."
- Rule 2 (Time-of-Day Overrides): If local time is past 10 PM / late night, DO NOT suggest workouts. Tell them to rest so they can hit their remaining tasks tomorrow.
- Rule 3 (Weather as a Constraint, NOT the Topic): Never make weather or hydration the main point. Treat weather strictly as a background variable (e.g., if it's raining, keep the movement recommendation indoors).

[STRICT ANTI-PATTERNS - DO NOT DO THE FOLLOWING]:
- DO NOT default to generic wellness advice like "drink water", "stay hydrated", or "take deep breaths" unless heat stroke/dehydration symptoms are explicitly logged.
- DO NOT spend more than 5-10 words mentioning weather conditions.

[FEW-SHOT EXAMPLES]:

User Context: Time: 1:15 AM, Logged Activities: 120m (Coding), Tasks: 3 pending (High priority), BMI: 27.2.
Response:
You've already put in 2 hours of heavy focus time tonight, and it's past 1 AM. Trying to grind through your remaining 3 high-priority tasks now will ruin tomorrow's energy. Shut down the screen and get to sleep so you can tackle them fresh.

User Context: Time: 5:30 PM, Logged Activities: 0 mins (Sitting all day), Tasks: 2 pending (High energy required), BMI: 24.1, Weather: 32°C High Humidity.
Response:
• **Pre-Task Activation:** You haven't logged any physical movement today and have 2 high-energy tasks left to complete. Do a quick 10-minute indoor mobility routine right now to break up the static sitting and get blood flowing to your brain.
• **Task Execution Window:** Once refreshed, dive straight into your highest priority task while that post-movement energy spike lasts, keeping workout intensity light until your work queue is clear.`;
      case SuggestionContextType.MENTAL_HEALTH:
        return `${corePersona}

[ROLE & SPECIALTY]: Intuitive Mindset & Stress Regulation Specialist.
[OBJECTIVE]: Decode emotional patterns, relate physical activities and daily workload to mood fluctuations, and deliver comforting, actionable psychological support.

[DATA EVALUATION HIERARCHY]:
• PRIMARY CONTEXT: Latest Mood Logs (mood, energy score, symptoms) + Personality Type + Age + Gender + Local Time + Weather.
• SECONDARY CONTEXT: Logged Activities + Daily Tasks + Screen Time (used to identify root causes of emotional friction).

[INSTRUCTIONAL GUIDELINES]:
- Priority 1: Focus deeply on current emotional state, energy score, and reported symptoms.
- Priority 2: Cross-reference physical activity logs and daily tasks with mood logs. Look for clear correlations (e.g., long screen time + 0 physical movement leading to brain fog; high task load + poor sleep driving overwhelm).
- Priority 3: Tailor communication style to personality type (e.g., practical structure for Analytical/INTJ, gentle encouraging flow for Empathetic/INFJ).
- Priority 4: Deliver a grounded human reset tactic tailored to the time of day and environment.

[FEW-SHOT EXAMPLES]:

User Context: Mood: Stressed & Overwhelmed, Energy: 2/5, Personality: INFP, Age: 24, Female, Time: 3:00 PM, Screen Time: 380m, Logged Activities: 0 mins, Tasks: 5 pending.
Response:
Sitting in front of a screen for over 6 hours with 5 pending tasks is directly driving your overwhelm right now. Step away from your desk for just 10 minutes, grab a cold drink, and let's pick just ONE small task to complete when you get back.

User Context: Mood: Anxious, Energy: 1/5, Symptoms: Brain fog, Personality: ISTJ, Age: 31, Male, Time: 10:30 PM, Sleep: 4.5 hrs previous night.
Response:
• **Root Cause Check:** Your anxiety and brain fog tonight stem directly from running on 4.5 hours of sleep while managing a heavy workload today.
• **Immediate Reset:** Close your task manager for the night. Spend 5 minutes practicing slow breathing, then head to bed early to reset your cognitive baseline.`;

      case SuggestionContextType.DAILY_BRIEFING:
        return `${corePersona}

[ROLE & SPECIALTY]: Chief of Staff & Performance Systems Partner.
[OBJECTIVE]: Synthesize morning readiness, environmental conditions, and day schedules into a clear human operational briefing.

[INSTRUCTIONAL GUIDELINES]:
- Connect environmental factors (weather, AQI, pressure) directly to personal cognitive capacity for the day.
- Organize daily tasks into clear energy-based execution windows.
- Provide practical pacing advice tailored to personality type and baseline sleep quality.

[FEW-SHOT EXAMPLE]:
User Context: Sleep 5.5 hrs (Quality 2/5), AQI High, Barometric Pressure dropping, 4 tasks pending.
Response:
• **Pacing Strategy:** With 5.5 hours of sleep and dropping air pressure today, tackle your hardest task right away while your morning energy holds, then switch to lightweight admin work this afternoon.
• **Environment Check:** Keep windows closed and air filtration running indoor air quality is rough today and will compound your fatigue if you're exposed.`;

      case SuggestionContextType.TASK_OPTIMIZATION:
        return `${corePersona}

[ROLE & SPECIALTY]: Ergonomics,Task organizer,Productivity coach & Focus Architect.
[OBJECTIVE]: Analyze task queues, screen time metrics, and current time to recommend optimal focus blocks and distraction-control strategies.

[INSTRUCTIONAL GUIDELINES]:
- Match task complexity directly to the user's available time window and energy levels.
- Offer direct friction mechanisms for high screen time or app usage.

[FEW-SHOT EXAMPLE]:
User Context: Tasks pending: 5, Screen Time: 340m, Time: 2:00 PM.
Response:
You've logged over 5 hours of screen time today and context-switching is draining your energy. Put your phone in another room and run a focused 45-minute sprint on your single highest-priority task right now.`;

      case SuggestionContextType.FINANCE_ADVICE:
        return `${corePersona}

[ROLE & SPECIALTY]: Behavioral Finance Coach.
[OBJECTIVE]: Analyze spending patterns in context with mood, time of day, and stress levels to offer practical financial mindfulness tips.

[INSTRUCTIONAL GUIDELINES]:
- Connect emotional or stress states to recent impulse expense logs.
- Offer actionable behavioral boundaries around spending triggers.

[FEW-SHOT EXAMPLE]:
User Context: Expense logged: Dining out (High), Mood: Stressed, Time: 9:00 PM.
Response:
Stressful days often trigger impulse food delivery spend. Pause auto-fills on ordering apps tonight and setup a 24-hour cooling-off window before making any non-essential purchases.`;

case SuggestionContextType.GENERAL:
      default:
        return `${corePersona}

[PERSONA]: Trusted Best Friend & Personal OS System Auditor. Warm, deeply analytical, empathetic, yet direct.
[OBJECTIVE]: Conduct a comprehensive end-of-day reflection based on the user's complete 24-hour telemetry (wake/sleep cycles, biometric baseline, completed vs. pending tasks, mood entries, financial spending, and local environment).

[INPUT TELEMETRY AUDIT]:
Analyze all provided user data fields:
1. Biometrics & Environment: Age, Gender, BMI, Sleep Quality, Weather, AQI.
2. Daily Performance: Tasks completed vs. pending, Screen time, Work focus windows.
3. Behavior & Finances: Mood logs, stress triggers, physical activity mins, non-essential spending.

[OUTPUT STRUCTURE & FORMAT]:
Structure the response cleanly into 4 distinct, actionable sections:

1. 🌟 **The Wins (What Went Right):** Acknowledge positive execution, healthy spending habits, or biometric endurance.
2. ⚠️ **The Friction Points (What Went Wrong & Traits to Reconsider):** Highlight stress triggers, excessive screen time, missed tasks, or impulse buys without sugarcoating.
3. 🎯 **Tactical Adjustments (How to Fix & Improve):** Provide 2 specific, actionable tweaks for tomorrow to solve today's friction points.
4. 🤝 **Friend's Evening Briefing:** End with an empathetic, encouraging 2-sentence closing as a supportive companion helping them wind down and prepare for sleep.

[FEW-SHOT EXAMPLE]:
User Context: Age: 26 (Male), BMI: 23.1, Sleep: 5.5 hrs, Mood: Stressed (Evening), Tasks: 6 Completed / 3 Pending, Activity: 20 mins, Finance: Spent 1,200 BDT (Impulse Dining), Weather: 32°C (High Humidity), Time: 10:30 PM.

Response:
🌟 **The Wins:**
You pushed through a heavy workload despite starting today on a 5.5-hour sleep deficit. Finishing 6 key tasks under high heat and humidity showed serious discipline.

⚠️ **Friction Points & Habits to Watch:**
• **Stress-Induced Spending:** The 1,200 BDT impulse meal coincided directly with your evening mood drop. Fatigue weakens financial impulse control.
• **Compounding Sleep Debt:** Carrying pending tasks into the late evening is keeping your sympathetic nervous system active when your body desperately needs recovery.

🎯 **Tactical Adjustments for Tomorrow:**
• **Financial Friction:** Block food delivery apps after 8:00 PM on high-stress days to prevent fatigue-driven spending.
• **Cognitive Shutdown:** Move your 3 pending tasks straight to tomorrow morning's focus block right now—clear your mental desktop so your brain can disengage.

🤝 **Friend's Closing:**
You carried a heavy load today, so don't beat yourself up over the evening slip-ups. Put the phone down, get some proper rest tonight, and let's reset fresh tomorrow morning. You've got this.`;  }
  }

  /**
   * Fetches real-time web context via Tavily API
   */
  private async fetchTavilyContext(contextType: SuggestionContextType): Promise<string> {
    const apiKey = this.configService.get<string>('TAVILY_API_KEY');
    if (!apiKey) return '';

    if (
      contextType !== SuggestionContextType.DAILY_BRIEFING &&
      contextType !== SuggestionContextType.FINANCE_ADVICE
    ) {
      return '';
    }

    try {
      const query =
        contextType === SuggestionContextType.FINANCE_ADVICE
          ? 'latest financial productivity habits behavioral finance tips'
          : 'today peak performance circadian energy management research';

      const response = await firstValueFrom(
        this.httpService.post(
          'https://api.tavily.com/search',
          {
            api_key: apiKey,
            query,
            search_depth: 'basic',
            max_results: 2,
          },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const results = response.data?.results || [];
      return results.map((r: any) => `- ${r.title}: ${r.content}`).join('\n');
    } catch (error: any) {
      this.logger.warn(`Tavily search execution skipped: ${error.message}`);
      return '';
    }
  }

  /**
   * Internal Context Generator (Assembles DB data + Weather Redis Cache)
   */
  private async generateUserContext(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        personalityType: true,
        gender: true,
        height: true,
        weight: true,
        timezone: true,
        dateOfBirth: true,
        defaultWakeTime: true,
        defaultSleepTime: true,
        latitude: true,
        longitude: true,
        location: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const dayBounds = await getUserDayBounds(
      userId,
      new Date(),
      user.timezone || 'UTC',
    );
    const { dayStart, dayEnd, logicalDate, isCurrentlyAwake } = dayBounds;

    // Resolved array positions strictly match the destructuring array below
    const [
      todayActivities,
      todayMoods,
      todaysTask,
      todaysFinance,
      rawTopApps,
      todayScreenTime,
      recentSleep,
      weatherContext,
    ] = await Promise.all([
      this.prisma.activityLog.findMany({
        where: {
          userId,
          loggedAt: { gte: dayStart, lte: dayEnd },
        },
        select: { type: true, durationMin: true, note: true, loggedAt: true },
        orderBy: { loggedAt: 'asc' },
      }),
      this.prisma.moodLog.findMany({
        where: {
          userId,
          loggedAt: { gte: dayStart, lte: dayEnd },
        },
        select: { mood: true, energyScore: true, symptoms: true, note: true, loggedAt: true },
        orderBy: { loggedAt: 'desc' },
      }),
      this.prisma.task.findMany({
        where: {
          userId,
          OR: [
            { dueDate: { gte: dayStart, lte: dayEnd } },
            { createdAt: { gte: dayStart, lte: dayEnd } },
            { completedAt: { gte: dayStart, lte: dayEnd } },
          ],
        },
        select: {
          title: true,
          isCompleted: true,
          priority: true,
          energyRequired: true,
          category: true,
        },
      }),
      this.prisma.transaction.findMany({
        where: {
          userId,
          transactedAt: { gte: dayStart, lte: dayEnd },
        },
        select: {
          description: true,
          amount: true,
          category: true,
          isExpense: true,
        },
      }),
      this.prisma.appUsage.findMany({
        where: {
          userId,
          date: logicalDate,
        },
        select: { appName: true, category: true, timeSpentMins: true },
        orderBy: { timeSpentMins: 'desc' },
      }),
      this.prisma.screenTimeLog.findFirst({
        where: {
          userId,
          date: logicalDate,
        },
        select: { totalScreenTimeMins: true, productivityScore: true },
      }),
      this.prisma.sleepLog.findFirst({
        where: {
          userId,
          sleptAt: { gte: dayStart, lte: dayEnd },
        },
        select: { sleptAt: true, wokeUpAt: true, qualityRating: true },
        orderBy: { sleptAt: 'desc' },
      }),
      this.dashbordService
        .getWeatherByPlace(
          userId,
          user.latitude ?? undefined,
          user.longitude ?? undefined,
        )
        .catch(() => null),
    ]);

    // Derive latest mood entry for summary header
    const latestMood = todayMoods[0] || null;

    const topAppsMap = new Map<
      string,
      { appName: string; category: any; timeSpentMins: number }
    >();
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

    const bmi = calculateBmi(user.height, user.weight);
    const age = calculateAge(user.dateOfBirth);

    let sleepDurationHours: number | null = null;
    if (recentSleep?.sleptAt && recentSleep?.wokeUpAt) {
      const diffMs =
        recentSleep.wokeUpAt.getTime() - recentSleep.sleptAt.getTime();
      sleepDurationHours = Number((diffMs / (1000 * 60 * 60)).toFixed(1));
    }

    const totalActivityMins = todayActivities.reduce(
      (sum, act) => sum + (act.durationMin || 0),
      0,
    );

    const moodTimeline =
      todayMoods.length > 0
        ? todayMoods
          .map((m) => {
            const timeStr = new Date(m.loggedAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
              timeZone: user.timezone || 'UTC',
            });
            const energyStr =
              m.energyScore !== null ? `, Energy Score: ${m.energyScore}/5` : '';
            const symptomsStr = m.symptoms?.length
              ? `, Symptoms: ${m.symptoms.join(', ')}`
              : '';
              const noteStr = m.note ? ` (Note: "${m.note}")` : '';
            return `- At ${timeStr}: Mood is ${m.mood}${energyStr}${symptomsStr}${noteStr}`;
            
          })
          .join('\n')
        : '- No mood entries logged today.';

    const activityTimeline =
      todayActivities.length > 0
        ? todayActivities
          .map((act) => {
            const timeStr = new Date(act.loggedAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
              timeZone: user.timezone || 'UTC',
            });
            const durationStr = act.durationMin
              ? `for ${act.durationMin} mins`
              : '';
            const noteStr = act.note ? ` (Note: "${act.note}")` : '';
            return `- At ${timeStr}, user logged ${act.type} ${durationStr}${noteStr}`.trim();
          })
          .join('\n')
        : '- No activities logged today.';

    const taskSummary =
      todaysTask.length > 0
        ? todaysTask
          .map(
            (t) =>
              `- [${t.isCompleted ? 'COMPLETED' : 'PENDING'}] ${t.title} (Priority: ${t.priority}, Energy: ${t.energyRequired})`,
          )
          .join('\n')
        : '- No tasks recorded for today.';

    const financeSummary =
      todaysFinance.length > 0
        ? todaysFinance
          .map(
            (tx) =>
              `- ${tx.isExpense ? 'EXPENSE' : 'INCOME'}: ${tx.description || tx.category} (${tx.amount} | ${tx.category})`,
          )
          .join('\n')
        : '- No transactions logged today.';

    const appUsageText =
      topApps.length > 0
        ? topApps.map((a) => `${a.appName} (${a.timeSpentMins}m)`).join(', ')
        : 'No app usage recorded';

    const symptomsText = latestMood?.symptoms?.length
      ? latestMood.symptoms.join(', ')
      : 'None reported';

    let weatherText = '- Environmental Data: Unavailable';
    if (weatherContext?.success) {
      const { condition, thermalComfort, mentalAndHealthMetrics, location } =
        weatherContext;
      const temp =
        thermalComfort?.temperature != null
          ? `${thermalComfort.temperature}°C`
          : 'N/A';
      const feelsLike =
        thermalComfort?.feelsLike != null
          ? `${thermalComfort.feelsLike}°C`
          : 'N/A';
      const humidity =
        thermalComfort?.humidity != null
          ? `${thermalComfort.humidity}%`
          : 'N/A';
      const pressure =
        mentalAndHealthMetrics?.pressure != null
          ? `${mentalAndHealthMetrics.pressure} hPa`
          : 'N/A';
      const uvi = mentalAndHealthMetrics?.uvIndex ?? 'N/A';
      const aqi = mentalAndHealthMetrics?.airQualityIndex ?? 'N/A';
      const cloudCover =
        mentalAndHealthMetrics?.cloudCover != null
          ? `${mentalAndHealthMetrics.cloudCover}%`
          : 'N/A';

      weatherText = `ENVIRONMENTAL & BIOMETRIC CONTEXT (${location}):
- Weather: ${condition?.summary || 'N/A'} (Temp: ${temp}, Feels like: ${feelsLike}), Humidity: ${humidity}.
- Barometric Pressure: ${pressure}, Cloud Cover: ${cloudCover}.
- Air Quality Index (AQI): ${aqi}/5, UV Index: ${uvi}.`;
    }

    return `USER CONTEXT SNAPSHOT:
- Profile: ${age ? `${age} yrs old` : 'Age unknown'}, Gender: ${user.gender || 'Unspecified'}, Personality: ${user.personalityType || 'Unspecified'}, BMI: ${bmi ?? 'N/A'}.
- Awake Status: User is currently ${isCurrentlyAwake ? 'AWAKE' : 'ASLEEP'} (Schedule: ${user.defaultWakeTime} - ${user.defaultSleepTime}).
- Current State: Mood is ${latestMood?.mood || 'unrecorded'}, Energy Score: ${latestMood?.energyScore ?? 'N/A'}/5, Symptoms: ${symptomsText}.
- Sleep: ${sleepDurationHours ? `${sleepDurationHours} hrs logged` : 'No sleep logged today'} (Quality: ${recentSleep?.qualityRating ?? 'N/A'}/5).

${weatherText}

MOOD LOGS TODAY (${todayMoods.length} total):
${moodTimeline}

TASKS FOR TODAY (${todaysTask.length} total):
${taskSummary}

FINANCIAL TRANSACTIONS TODAY (${todaysFinance.length} total):
${financeSummary}

LOGGED ACTIVITIES (${totalActivityMins} mins total across ${todayActivities.length} logs):
${activityTimeline}

DIGITAL USAGE:
- Total Screen Time: ${todayScreenTime?.totalScreenTimeMins || 0} mins. Top apps: ${appUsageText}.`;
  }
}