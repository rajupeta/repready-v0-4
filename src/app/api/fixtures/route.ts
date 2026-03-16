import { NextResponse } from 'next/server';
import { getAllCallTypes } from '@/lib/call-type-routing';

export async function GET() {
  const callTypes = getAllCallTypes();
  return NextResponse.json(callTypes);
}
