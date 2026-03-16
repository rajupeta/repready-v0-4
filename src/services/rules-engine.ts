import { CoachingRule, TranscriptLine } from "@/types";

export class RulesEngine {
  private rules: CoachingRule[];
  private sessionCooldowns: Map<string, Map<string, number>> = new Map();

  constructor(rules: CoachingRule[]) {
    this.rules = rules;
  }

  evaluate(window: TranscriptLine[], sessionId?: string): CoachingRule[] {
    const now = Date.now();
    const triggered: CoachingRule[] = [];
    const key = sessionId ?? '__default__';

    if (!this.sessionCooldowns.has(key)) {
      this.sessionCooldowns.set(key, new Map());
    }
    const cooldowns = this.sessionCooldowns.get(key)!;

    for (const rule of this.rules) {
      if (!rule.detect(window)) continue;

      const lastTime = cooldowns.get(rule.ruleId);
      if (lastTime !== undefined && now - lastTime < rule.cooldownMs) continue;

      cooldowns.set(rule.ruleId, now);
      triggered.push(rule);
    }

    return triggered;
  }

  resetCooldowns(sessionId?: string): void {
    if (sessionId) {
      this.sessionCooldowns.delete(sessionId);
    } else {
      this.sessionCooldowns.clear();
    }
  }
}
