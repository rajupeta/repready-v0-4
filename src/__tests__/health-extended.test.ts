import { GET } from "@/app/api/health/route";

describe("GET /api/health — extended", () => {
  it("returns Content-Type application/json", async () => {
    const response = await GET();
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("returns exactly { status: 'ok' } with no extra fields", async () => {
    const response = await GET();
    const body = await response.json();
    expect(Object.keys(body)).toEqual(["status"]);
    expect(body.status).toBe("ok");
  });

  it("returns a NextResponse instance", async () => {
    const response = await GET();
    expect(response).toBeInstanceOf(Response);
  });
});
