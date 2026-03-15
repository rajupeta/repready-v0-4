import { CoachingRule, TranscriptLine } from "@/types";

export class RulesEngine {
  private rules: CoachingRule[];
  private lastTriggered: Map<string, number> = new Map();

  constructor(rules: CoachingRule[]) {
    this.rules = rules;
  }

  evaluate(window: TranscriptLine[]): CoachingRule[] {
    const now = Date.now();
    const triggered: CoachingRule[] = [];

    for (const rule of this.rules) {
      if (!rule.detect(window)) continue;

      const lastTime = this.lastTriggered.get(rule.ruleId);
      if (lastTime !== undefined && now - lastTime < rule.cooldownMs) continue;

      this.lastTriggered.set(rule.ruleId, now);
      triggered.push(rule);
    }

    return triggered;
  }

  resetCooldowns(): void {
    this.lastTriggered.clear();
  }
}
