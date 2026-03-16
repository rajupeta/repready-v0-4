import Anthropic from "@anthropic-ai/sdk";
import {
  TranscriptLine,
  CoachingPrompt,
  Scorecard,
  RuleDefinition,
} from "@/types";

const COACHING_SYSTEM_PROMPT = `You are an AI sales coaching assistant for SDRs (Sales Development Representatives). You analyze live sales call transcripts and provide real-time coaching prompts to help reps improve their performance.

When given a transcript window and triggered coaching rules, generate a brief, actionable coaching prompt for each rule. Each prompt should be 1-2 sentences, specific to what's happening in the conversation, and immediately actionable.

Respond with a JSON array of objects, each with "ruleId" (string), "ruleName" (string), and "message" (string). Return ONLY the JSON array, no other text.`;

const SCORECARD_SYSTEM_PROMPT = `You are an AI sales coaching assistant that evaluates SDR (Sales Development Representative) call performance. You review complete call transcripts and assess performance against specific coaching rules.

For each rule, provide:
- "ruleId": the rule's ID
- "ruleName": the rule's name
- "assessment": one of "good", "needs-work", or "missed"
- "comment": a brief explanation (1-2 sentences) of the assessment

Also provide an "overallScore" from 0-100 representing the overall call quality, and a "summary" string with a brief overall assessment of the call.

Respond with a JSON object containing "entries" (array of assessments), "overallScore" (number), and "summary" (string). Return ONLY the JSON object, no other text.`;

/**
 * Strip markdown code fences from Claude responses.
 * Handles ```json ... ```, ``` ... ```, and raw JSON.
 */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:\w*)\s*\n?([\s\S]*?)\n?\s*```$/);
  if (match) {
    return match[1].trim();
  }
  return trimmed;
}

export class ClaudeService {
  private client: Anthropic;
  private model: string;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.model = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";
  }

  async getCoachingPrompts(
    triggeredRules: RuleDefinition[],
    context: TranscriptLine[]
  ): Promise<CoachingPrompt[]> {
    try {
      const transcriptText = context
        .map((line) => `${line.speaker}: ${line.text}`)
        .join("\n");

      const rulesText = triggeredRules
        .map(
          (r) => `- ${r.ruleId} (${r.ruleName}): ${r.description}`
        )
        .join("\n");

      const userMessage = `Here is the recent transcript window:\n\n${transcriptText}\n\nThe following coaching rules have been triggered:\n\n${rulesText}\n\nGenerate a coaching prompt for each triggered rule.`;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: COACHING_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        return [];
      }

      const parsed = JSON.parse(stripCodeFences(content.text)) as Array<{
        ruleId: string;
        ruleName: string;
        message: string;
      }>;

      return parsed.map((item) => ({
        ruleId: item.ruleId,
        ruleName: item.ruleName,
        message: item.message,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.warn("ClaudeService.getCoachingPrompts failed:", error);
      return [];
    }
  }

  async generateScorecard(
    transcript: TranscriptLine[],
    rules: RuleDefinition[]
  ): Promise<Scorecard> {
    try {
      const transcriptText = transcript
        .map((line) => `${line.speaker}: ${line.text}`)
        .join("\n");

      const rulesText = rules
        .map(
          (r) => `- ${r.ruleId} (${r.ruleName}): ${r.description}`
        )
        .join("\n");

      const userMessage = `Here is the complete call transcript:\n\n${transcriptText}\n\nEvaluate the SDR's performance against these coaching rules:\n\n${rulesText}\n\nProvide a per-rule assessment and overall score.`;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: SCORECARD_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        return this.defaultScorecard(rules);
      }

      const parsed = JSON.parse(stripCodeFences(content.text)) as Scorecard;
      return parsed;
    } catch (error) {
      console.warn("ClaudeService.generateScorecard failed:", error);
      return this.defaultScorecard(rules);
    }
  }

  private defaultScorecard(rules: RuleDefinition[]): Scorecard {
    return {
      entries: rules.map((r) => ({
        ruleId: r.ruleId,
        ruleName: r.ruleName,
        assessment: "missed" as const,
        comment: "Unable to evaluate — scoring unavailable.",
      })),
      overallScore: 0,
      summary: "Unable to generate scorecard — scoring unavailable.",
    };
  }
}
