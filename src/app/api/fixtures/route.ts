import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const fixturesDir = path.join(process.cwd(), 'src', 'fixtures');
  const files = fs.readdirSync(fixturesDir);
  const names = files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));

  return NextResponse.json(names);
}
