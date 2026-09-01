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
  durationInSeconds: number;
  playlistOrder?: number;
  timestamps: ExtractedTimestamp[];
}

export interface ResourceLink {
  title: string;
  url: string;
}

export interface GeneratedModule {
  order: number;
  title: string;
  theoryText: string;
  videoId: string | null;
  videoUrl: string | null;
  embedUrl: string | null;
  startSeconds: number;
  endSeconds: number;
  docLinks: ResourceLink[];
  practiceTask: string;
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
  async generateRoadmap(
    title: string,
    level?: string,
    resources?: string,
  ): Promise<GeneratedModule[]> {
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
      this.logger.log(
        `No user-supplied video resources found. Searching YouTube for top quality resources...`,
      );
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

  private async searchTopYoutubeVideos(title: string, level = 'Beginner'): Promise<VideoMetadata[]> {
    try {
      const normalizedLevel = level.toLowerCase();
      let searchQuery = `${title} full course tutorial`;
      let durationFilter: 'medium' | 'long' | 'any' = 'long';

      if (normalizedLevel.includes('advanced')) {
        searchQuery = `${title} advanced masterclass architecture deep dive production`;
      } else if (normalizedLevel.includes('intermediate')) {
        searchQuery = `${title} intermediate full project tutorial`;
      } else {
        searchQuery = `${title} beginner crash course tutorial`;
      }

      this.logger.debug(`Searching YouTube with query: "${searchQuery}" | Duration: ${durationFilter}`);

      const searchResponse = await this.youtube.search.list({
        part: ['snippet'],
        q: searchQuery,
        type: ['video'],
        videoDuration: durationFilter,
        order: 'relevance',
        maxResults: 3,
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

  private async fetchMultipleYoutubeMetadata(
    videoIds: string[],
    isPlaylist = false,
  ): Promise<VideoMetadata[]> {
    try {
      const response = await this.youtube.videos.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        id: videoIds,
      });

      const items = response.data.items || [];
      const result: VideoMetadata[] = [];

      for (const [index, item] of items.entries()) {
        const videoId = item.id!;
        const title = item.snippet?.title || `Video (${videoId})`;
        const description = item.snippet?.description || '';
        const isoDuration = item.contentDetails?.duration || 'PT0S';
        const durationInSeconds = this.parseIso8601Duration(isoDuration);

        const timestamps = this.parseTimestampsFromText(videoId, description);

        result.push({
          videoId,
          title,
          description,
          durationInSeconds,
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

  private parseIso8601Duration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

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

  private async generateModulesWithGroq(
    title: string,
    level?: string,
    resources?: string,
    videos: VideoMetadata[] = [],
    webTheoryContext = '',
    tavilyDocLinks: ResourceLink[] = [],
  ): Promise<GeneratedModule[]> {
    let videoContext = '';

    if (videos.length > 0) {
      videoContext = videos
        .map((v, idx) => {
          const orderPrefix = v.playlistOrder ? `[Playlist Item #${v.playlistOrder}] ` : '';
          const tsText =
            v.timestamps.length > 0
              ? JSON.stringify(v.timestamps, null, 2)
              : 'No manual timestamps found in description.';

          return `--- VIDEO ${idx + 1}: ${orderPrefix}${v.title} ---
ID: ${v.videoId}
Duration (seconds): ${v.durationInSeconds} (${Math.floor(v.durationInSeconds / 60)} minutes)
Description Summary: ${v.description.slice(0, 300)}...
Parsed Timestamps:
${tsText}`;
        })
        .join('\n\n');
    } else {
      videoContext = 'No YouTube resources provided.';
    }

    const prompt = `
You are a world-class technical curriculum designer creating a hyper-effective learning roadmap for: "${title}".
Target Student Level: ${level || 'Beginner'}.
User Preferences: "${resources || 'None provided'}".

==================================================
AVAILABLE VIDEO RESOURCES (${videos.length} Total Videos):
${videoContext}

AUTHORITATIVE WEB & THEORY CONTEXT (TAVILY):
${webTheoryContext || 'No additional web theory gathered.'}

AVAILABLE DOCUMENTATION / RESOURCE LINKS:
${JSON.stringify(tavilyDocLinks, null, 2)}
==================================================

STRICT TIMECODE MANDATE:
1. Break down the topic into 4 to 6 non-overlapping sequential modules.
2. For EVERY module, you MUST return valid numeric values for "startSeconds" and "endSeconds".
3. IF A VIDEO HAS NO DESCRIPTION TIMESTAMPS:
   - Divide its total "Duration (seconds)" evenly across the modules using math.
   - Example (Full video = 3000 seconds across 4 modules):
     - Module 1: startSeconds = 0, endSeconds = 750
     - Module 2: startSeconds = 750, endSeconds = 1500
     - Module 3: startSeconds = 1500, endSeconds = 2250
     - Module 4: startSeconds = 2250, endSeconds = 3000

INSTRUCTIONS FOR MODULE CREATION:
- "title": Actionable module title.
- "theoryText": Overview with TWO sections:
  🔥 Warm-Up Overview: 2-3 conceptual sentences introducing the core mental model before watching.
  💡 Key Concepts: 3-4 concise bullet points summarizing the highest-yield takeaways.
- "videoId": The selected video ID string.
- "startSeconds": Start timestamp in seconds (integer).
- "endSeconds": End timestamp in seconds (integer, strictly greater than startSeconds).
- "docLinks": Array of 1 to 3 relevant documentation objects with "title" and "url".
- "practiceTask": A specific hands-on exercise.

REQUIRED JSON OUTPUT FORMAT:
{
  "modules": [
    {
      "title": "Module Title",
      "theoryText": "🔥 Warm-Up Overview:\\nIntroductory sentences...\\n\\n💡 Key Concepts:\\n• Concept 1\\n• Concept 2\\n• Concept 3",
      "videoId": "VIDEO_ID_HERE",
      "startSeconds": 0,
      "endSeconds": 750,
      "docLinks": [
        { "title": "Documentation Title", "url": "https://example.com/docs" }
      ],
      "practiceTask": "Hands-on exercise description"
    }
  ]
}
`;

    this.logger.debug(`Sending prompt to Groq model: openai/gpt-oss-120b`);

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

      return rawModules.map((mod: any, index: number) => {
        const vId = mod.videoId ? String(mod.videoId) : null;
        const startSec = Math.max(0, parseInt(mod.startSeconds, 10) || 0);
        const fallbackEndSec = (videos[0]?.durationInSeconds || 1800);
        const endSec = Math.max(startSec + 60, parseInt(mod.endSeconds, 10) || fallbackEndSec);

        const videoUrl = vId
          ? `https://www.youtube.com/watch?v=${vId}&t=${startSec}s`
          : null;

        const embedUrl = vId
          ? `https://www.youtube.com/embed/${vId}?start=${startSec}&end=${endSec}&autoplay=0`
          : null;

        return {
          order: index + 1,
          title: String(mod.title || `Module ${index + 1}`),
          theoryText: Array.isArray(mod.theoryText)
            ? mod.theoryText.join('\n• ')
            : String(mod.theoryText || ''),
          videoId: vId,
          videoUrl,
          embedUrl,
          startSeconds: startSec,
          endSeconds: endSec,
          docLinks: Array.isArray(mod.docLinks)
            ? mod.docLinks.map((link: any) => ({
                title: String(link.title || 'Official Documentation'),
                url: String(link.url || '#'),
              }))
            : [],
          practiceTask: String(
            mod.practiceTask || 'Review concepts and complete exercise.',
          ),
        };
      });
    } catch (error: any) {
      this.logger.error(
        'Groq API call or JSON parsing failed',
        error.stack || error.message || error,
      );
      return [];
    }
  }
}