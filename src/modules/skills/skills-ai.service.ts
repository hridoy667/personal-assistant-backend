import { Injectable, Logger } from '@nestjs/common';
import { google, youtube_v3 } from 'googleapis';
import Groq from 'groq-sdk';
import { tavily, TavilyClient } from '@tavily/core';

export interface ExtractedTimestamp {
  videoId: string;
  seconds: number;
  label: string;
}

export interface VideoMetadata {
  videoId: string;
  title: string;
  description: string;
  playlistOrder?: number;
  timestamps: ExtractedTimestamp[];
}

export interface ResourceLink {
  title: string;
  url: string;
}

@Injectable()
export class SkillsAiService {
  private readonly logger = new Logger(SkillsAiService.name);
  private youtube: youtube_v3.Youtube;
  private groq: Groq;
  private tavilyClient: TavilyClient;

  constructor() {
    this.youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY,
    });
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
    this.tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY || '' });
  }

  /**
   * Main Pipeline
   */
  async generateRoadmap(title: string, level?: string, resources?: string) {
    const input = resources || '';

    const playlistIds = this.extractPlaylistIds(input);
    const standaloneVideoIds = this.extractStandaloneVideoIds(input);

    this.logger.debug(
      `Extracted - Playlists: [${playlistIds.join(', ')}] | Single Videos: [${standaloneVideoIds.join(', ')}]`,
    );

    let allVideoMetadata: VideoMetadata[] = [];

    // Stage 1A: Process Playlists if provided
    if (playlistIds.length > 0) {
      for (const playlistId of playlistIds) {
        const playlistVideos = await this.fetchPlaylistMetadata(playlistId);
        allVideoMetadata.push(...playlistVideos);
      }
    }

    // Stage 1B: Process Standalone Videos if provided
    const existingVideoIds = new Set(allVideoMetadata.map((v) => v.videoId));
    const uniqueSingleIds = standaloneVideoIds.filter((id) => !existingVideoIds.has(id));

    if (uniqueSingleIds.length > 0) {
      const singleVideos = await this.fetchMultipleYoutubeMetadata(uniqueSingleIds);
      allVideoMetadata.push(...singleVideos);
    }

    // Stage 1C: Automated YouTube Search Fallback if no videos found
    if (allVideoMetadata.length === 0) {
      this.logger.log(`No user-supplied video resources found. Searching YouTube for top quality resources...`);
      allVideoMetadata = await this.searchTopYoutubeVideos(title, level);
    }

    this.logger.log(`Total video resources gathered for AI context: ${allVideoMetadata.length}`);

    // Stage 2: Tavily Search for Documentation & Theory Insights
    const { webTheoryContext, tavilyDocLinks } = await this.fetchTheoryInsightsWithTavily(title, level);

    // Stage 3: Generate Roadmap via Groq
    return this.generateModulesWithGroq(
      title,
      level,
      resources,
      allVideoMetadata,
      webTheoryContext,
      tavilyDocLinks,
    );
  }

  /**
   * Automatic Search for Top-Performing & Level-Appropriate YouTube Videos
   */
  private async searchTopYoutubeVideos(title: string, level = 'Beginner'): Promise<VideoMetadata[]> {
    try {
      const normalizedLevel = level.toLowerCase();
      let searchQuery = `${title} full course tutorial`;
      let durationFilter: 'medium' | 'long' | 'any' = 'medium';

      // Tailor duration & search terms to level
      if (normalizedLevel.includes('advanced')) {
        searchQuery = `${title} advanced masterclass architecture deep dive production`;
        durationFilter = 'long'; // > 20 minutes for advanced topics
      } else if (normalizedLevel.includes('intermediate')) {
        searchQuery = `${title} intermediate full project tutorial`;
        durationFilter = 'long'; // > 20 minutes
      } else {
        searchQuery = `${title} beginner crash course tutorial`;
        durationFilter = 'medium'; // 4 - 20 minutes
      }

      this.logger.debug(`Searching YouTube with query: "${searchQuery}" | Duration: ${durationFilter}`);

      const searchResponse = await this.youtube.search.list({
        part: ['snippet'],
        q: searchQuery,
        type: ['video'],
        videoDuration: durationFilter,
        order: 'relevance',
        maxResults: 5,
      });

      const items = searchResponse.data.items || [];
      const videoIds = items
        .map((item) => item.id?.videoId)
        .filter((id): id is string => Boolean(id));

      if (videoIds.length === 0) return [];

      return await this.fetchMultipleYoutubeMetadata(videoIds);
    } catch (error: any) {
      this.logger.error(`Failed to execute fallback YouTube search`, error.stack || error.message || error);
      return [];
    }
  }

  /**
   * Search Web Documentation and Articles via Tavily
   */
  private async fetchTheoryInsightsWithTavily(
    title: string,
    level = 'Beginner',
  ): Promise<{ webTheoryContext: string; tavilyDocLinks: ResourceLink[] }> {
    try {
      if (!process.env.TAVILY_API_KEY) {
        this.logger.warn('TAVILY_API_KEY is missing. Skipping Tavily web search.');
        return { webTheoryContext: '', tavilyDocLinks: [] };
      }

      this.logger.debug(`Fetching documentation & theory resources via Tavily for: "${title}" (${level})`);
      const searchResult = await this.tavilyClient.search(
        `${title} ${level} official documentation architecture guide tutorial`,
        {
          searchDepth: 'basic',
          maxResults: 5,
        },
      );

      const tavilyDocLinks: ResourceLink[] = searchResult.results.map((res) => ({
        title: res.title,
        url: res.url,
      }));

      const webTheoryContext = searchResult.results
        .map((res) => `Title: ${res.title}\nContent: ${res.content.slice(0, 400)}...\nURL: ${res.url}`)
        .join('\n\n');

      return { webTheoryContext, tavilyDocLinks };
    } catch (error: any) {
      this.logger.error('Failed to fetch theory search from Tavily', error.stack || error.message || error);
      return { webTheoryContext: '', tavilyDocLinks: [] };
    }
  }

  /**
   * Helper: Extract Playlist IDs (list=PL...)
   */
  private extractPlaylistIds(input: string): string[] {
    const regExp = /[?&]list=([a-zA-Z0-9_-]+)/g;
    const matches = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = regExp.exec(input)) !== null) {
      if (match[1]) {
        matches.add(match[1]);
      }
    }
    return Array.from(matches);
  }

  /**
   * Helper: Extract Standalone YouTube Video IDs
   */
  private extractStandaloneVideoIds(input: string): string[] {
    const regExp =
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;

    const matches = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = regExp.exec(input)) !== null) {
      if (match[1]) {
        matches.add(match[1]);
      }
    }
    return Array.from(matches);
  }

  /**
   * Fetch all videos inside a YouTube Playlist
   */
  private async fetchPlaylistMetadata(playlistId: string): Promise<VideoMetadata[]> {
    try {
      this.logger.debug(`Fetching playlist items for playlistId: ${playlistId}`);

      const playlistItemsResponse = await this.youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: playlistId,
        maxResults: 50,
      });

      const items = playlistItemsResponse.data.items || [];
      const videoIds: string[] = [];

      items.forEach((item) => {
        const vId = item.snippet?.resourceId?.videoId;
        if (vId) videoIds.push(vId);
      });

      if (videoIds.length === 0) return [];

      return await this.fetchMultipleYoutubeMetadata(videoIds, true);
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch playlist items for ${playlistId}`,
        error.stack || error.message || error,
      );
      return [];
    }
  }

  /**
   * Batch fetch video details & timestamps
   */
  private async fetchMultipleYoutubeMetadata(
    videoIds: string[],
    isPlaylist = false,
  ): Promise<VideoMetadata[]> {
    try {
      const response = await this.youtube.videos.list({
        part: ['snippet', 'statistics'],
        id: videoIds,
      });

      const items = response.data.items || [];
      const result: VideoMetadata[] = [];

      for (const [index, item] of items.entries()) {
        const videoId = item.id!;
        const title = item.snippet?.title || `Video (${videoId})`;
        const description = item.snippet?.description || '';
        const timestamps = this.parseTimestampsFromText(videoId, description);

        result.push({
          videoId,
          title,
          description,
          playlistOrder: isPlaylist ? index + 1 : undefined,
          timestamps,
        });
      }

      return result;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch YouTube metadata batch`,
        error.stack || error.message || error,
      );
      return [];
    }
  }

  /**
   * Timestamp Parser
   */
  private parseTimestampsFromText(videoId: string, text: string): ExtractedTimestamp[] {
    const timestamps: ExtractedTimestamp[] = [];
    const lines = text.split('\n');

    const timestampRegex =
      /(?:^|\s|\()(?<hours>\d{1,2}:)?(?<minutes>\d{1,2}):(?<seconds>\d{2})\)?(?:\s*[-–—:]\s*|\s+)(?<label>.+)?$/;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const match = line.match(timestampRegex);
      if (match && match.groups) {
        const hours = match.groups.hours
          ? parseInt(match.groups.hours.replace(':', ''), 10)
          : 0;
        const minutes = parseInt(match.groups.minutes, 10);
        const seconds = parseInt(match.groups.seconds, 10);
        let label = (match.groups.label || 'Module Step').trim();

        label = label.replace(/^[-–—:]\s*/, '').trim();
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;

        timestamps.push({ videoId, seconds: totalSeconds, label });
      }
    }

    return timestamps;
  }

  /**
   * Stage 3: Multi-Video & Web Search Context Aware Groq Generator
   */
  private async generateModulesWithGroq(
    title: string,
    level?: string,
    resources?: string,
    videos: VideoMetadata[] = [],
    webTheoryContext = '',
    tavilyDocLinks: ResourceLink[] = [],
  ) {
    let videoContext = '';

    if (videos.length > 0) {
      videoContext = videos
        .map((v, idx) => {
          const orderPrefix = v.playlistOrder ? `[Playlist Item #${v.playlistOrder}] ` : '';
          const tsText =
            v.timestamps.length > 0
              ? JSON.stringify(v.timestamps, null, 2)
              : 'No timestamps in description.';

          return `--- VIDEO ${idx + 1}: ${orderPrefix}${v.title} ---
ID: ${v.videoId}
Description Summary: ${v.description.slice(0, 300)}...
Timestamps:
${tsText}`;
        })
        .join('\n\n');
    } else {
      videoContext = 'No YouTube resources provided.';
    }

    const prompt = `
You are a world-class technical curriculum designer creating a hyper-effective, high-yield learning roadmap for: "${title}".
Target Student Level: ${level || 'Beginner'}.
User Context / Preferences: "${resources || 'None provided'}".

==================================================
AVAILABLE VIDEO RESOURCES (${videos.length} Total Videos):
${videoContext}

AUTHORITATIVE WEB & THEORY CONTEXT (TAVILY):
${webTheoryContext || 'No additional web theory gathered.'}

AVAILABLE DOCUMENTATION / HELPFUL RESOURCE LINKS:
${JSON.stringify(tavilyDocLinks, null, 2)}
==================================================

CORE PEDAGOGICAL PHILOSOPHY (THE 70/30 RULE):
Design the roadmap around the Pareto Principle of Learning: Focus heavily on the core 70% foundational building blocks, critical paradigms, and practical primitives. Mastering this core unlocks the remaining 30% advanced edge-cases naturally. Do NOT waste modules on obscure tools or ultra-niche concepts early on.

CHAIN-OF-THOUGHT INSTRUCTIONS:
Before constructing the final output, reason through these steps internally:
1. Identify the Core 70%: What are the essential foundational topics in "${title}" that the student MUST master at the ${level || 'Beginner'} level?
2. Resource Mapping: Map the provided video timestamps, documentation links, and Tavily theory notes to these core topics in logical sequence.
3. High-Yield Progression: Group into 4 to 8 non-redundant modules that build linearly from basic primitives to practical application.

INSTRUCTIONS FOR MODULE CREATION:
1. Group the available resources into 4 to 8 logical, progressive learning modules.
2. For EACH module, generate:
   - "title": Clear, actionable module title focused on core mastery.
   - "theoryText": Synthesize video timestamps and web documentation into a clear overview with TWO sections:
     🔥 Warm-Up Overview: 2-3 conceptual sentences introducing the core mental model before watching.
     💡 Key Concepts: 3-4 concise bullet points summarizing the highest-yield takeaways.
   - "videoUrl": Direct link to the primary starting video/timestamp for this module. Format: "https://www.youtube.com/watch?v={videoId}&t={seconds}s".
   - "docLinks": An array of 1 to 3 relevant documentation or helpful resource objects with "title" and "url" properties (drawn from Tavily results or official documentation).
   - "practiceTask": A specific, hands-on project or task targeted at the ${level || 'Beginner'} level to solidify the core 70% rule.

FEW-SHOT EXAMPLES:

Example Input: Title = "NestJS", Level = "Advanced"
Example Output Module:
{
  "title": "Module 1: Advanced Microservices Architecture & Custom Transporters",
  "theoryText": "🔥 Warm-Up Overview:\\nNestJS microservices abstract underlying transport mechanisms like gRPC, NATS, and Kafka behind a unified message-driven pattern. Master custom transporters and hybrid applications to build scalable, distributed systems.\\n\\n💡 Key Concepts:\\n• Implementing ClientProxy and Custom Server Transporters\\n• Event pattern vs Request-Response pattern communication\\n• Exception Filters and Interceptors in RPC microservice context",
  "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s",
  "docLinks": [
    { "title": "NestJS Microservices Overview", "url": "https://docs.nestjs.com/microservices/basics" },
    { "title": "NestJS Custom Transporters Guide", "url": "https://docs.nestjs.com/microservices/custom-transport" }
  ],
  "practiceTask": "Build a hybrid HTTP + gRPC NestJS service that handles order processing asynchronously using a custom Redis message transporter with dead-letter queue handling."
}

CRITICAL REQUIREMENT:
Return ONLY a valid JSON object matching this schema:
{
  "modules": [
    {
      "title": "Module Title",
      "theoryText": "🔥 Warm-Up Overview:\\nIntroductory sentences...\\n\\n💡 Key Concepts:\\n• Concept 1\\n• Concept 2\\n• Concept 3",
      "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID&t=0s",
      "docLinks": [
        { "title": "Documentation Title", "url": "https://example.com/docs" }
      ],
      "practiceTask": "Hands-on exercise description"
    }
  ]
}
`;

    this.logger.debug(`Sending multi-video & web context prompt to Groq model: openai/gpt-oss-120b`);

    try {
      const chatCompletion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'openai/gpt-oss-120b',
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const rawContent = chatCompletion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(rawContent);

      const rawModules =
        parsed.modules || parsed.data || (Array.isArray(parsed) ? parsed : []);

      return rawModules.map((mod: any, index: number) => ({
        order: index + 1,
        title: String(mod.title || `Module ${index + 1}`),
        theoryText: Array.isArray(mod.theoryText)
          ? mod.theoryText.join('\n• ')
          : String(mod.theoryText || ''),
        videoUrl: mod.videoUrl ? String(mod.videoUrl) : null,
        docLinks: Array.isArray(mod.docLinks)
          ? mod.docLinks.map((link: any) => ({
              title: String(link.title || 'Official Documentation'),
              url: String(link.url || '#'),
            }))
          : [],
        practiceTask: String(
          mod.practiceTask || 'Review concepts and complete exercise.',
        ),
      }));
    } catch (error: any) {
      this.logger.error(
        'Groq API call or JSON parsing failed',
        error.stack || error.message || error,
      );
      return [];
    }
  }
}