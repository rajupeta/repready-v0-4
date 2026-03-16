import Anthropic from "@anthropic-ai/sdk";
import type { CallType } from "@/types";
import type { FixtureLine } from "@/types/transcript";
import { stripCodeFences } from "@/services/claude-service";

const TRANSCRIPT_SYSTEM_PROMPT = `You are a sales conversation generator for SDR (Sales Development Representative) training simulations. Generate realistic, unique sales conversations between a rep and a prospect.

Rules:
- Each line must have "speaker" ("rep" or "prospect") and "text" (the dialogue)
- Generate 20-30 exchanges total
- Make conversations feel natural with filler words, interruptions, and realistic speech patterns
- Include common sales mistakes for coaching purposes (e.g., feature dumping, not asking questions, filler words)
- Vary the conversation flow — don't follow a rigid template
- Return ONLY a JSON array of objects with "speaker" and "text" fields, no other text`;

const CALL_TYPE_PROMPTS: Record<CallType, string> = {
  discovery: `Generate a discovery call conversation. The rep is calling a prospect for the first time to understand their pain points and qualify them. The prospect works at a mid-size B2B company. Include moments where the rep could improve — maybe they talk too much, miss a chance to ask a follow-up question, or dump too many features at once.`,
  demo: `Generate a product demo call conversation. The rep is showing the product to a prospect who attended a discovery call previously. The prospect has specific questions and concerns. Include moments where the rep gets too technical, misses buying signals, or fails to connect features to the prospect's specific needs.`,
  "objection-handling": `Generate a sales call where the prospect raises multiple objections — price, competitor comparisons, timing, and internal buy-in. The rep should handle some objections well and fumble others. Include moments where the rep deflects instead of addressing concerns directly, uses vague language, or misses opportunities to provide concrete evidence.`,
  "follow-up": `Generate a follow-up call where the rep is checking in after sending a proposal. The prospect has been evaluating multiple vendors. Include moments where the rep could be more proactive about next steps, fails to create urgency, or misses signals that the deal is at risk.`,
  pricing: `Generate a pricing negotiation call where the rep is discussing pricing and packaging with a prospect who has already seen a demo. The prospect pushes back on cost, asks for discounts, and compares to cheaper alternatives. Include moments where the rep caves too quickly on price, fails to anchor value before discussing numbers, or doesn't explore the prospect's budget constraints properly.`,
  "cold-call": `Generate a cold call conversation where the rep is reaching out to a prospect who has never heard of the product. The prospect is initially resistant and busy. Include moments where the rep's opening is weak, they fail to earn the right to continue the conversation, talk too much about themselves instead of the prospect's problems, or miss the chance to book a follow-up meeting.`,
};

export class TranscriptGeneratorService {
  private client: Anthropic;
  private model: string;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.model = process.env.CLAUDE_MODEL || "claude-3-5-haiku-20241022";
  }

  async generateTranscript(callType: CallType): Promise<FixtureLine[]> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: TRANSCRIPT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: CALL_TYPE_PROMPTS[callType] }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response format from Claude");
    }

    const parsed = JSON.parse(stripCodeFences(content.text));

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Invalid transcript format: expected non-empty array");
    }

    // Validate each line has the required fields
    const lines: FixtureLine[] = parsed.map((line: Record<string, unknown>) => {
      if (
        typeof line.speaker !== "string" ||
        typeof line.text !== "string" ||
        !["rep", "prospect"].includes(line.speaker)
      ) {
        throw new Error(
          `Invalid transcript line: speaker must be "rep" or "prospect" and text must be a string`
        );
      }
      return { speaker: line.speaker, text: line.text };
    });

    return lines;
  }
}
