import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { GenerateSuggestionDto, SuggestionContextType } from './dto/generate-suggestion.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private groq: Groq;

  constructor(private readonly configService: ConfigService) {
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
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 500,
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
}