import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET() {
  const fixturesDir = path.join(process.cwd(), "src", "fixtures");
  const files = fs.readdirSync(fixturesDir);
  const fixtureNames = files
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""));

  return NextResponse.json(fixtureNames, { status: 200 });
}
