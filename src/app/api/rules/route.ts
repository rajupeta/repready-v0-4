import { NextResponse } from 'next/server';
import { coachingRules } from '@/rules/coaching-rules';

export async function GET() {
  const rules = coachingRules.map((rule) => ({
    ruleId: rule.ruleId,
    name: rule.name,
    description: rule.description,
    cooldownMs: rule.cooldownMs,
  }));

  return NextResponse.json(rules);
}
