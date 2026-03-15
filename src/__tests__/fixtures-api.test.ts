import { GET } from "@/app/api/fixtures/route";

describe("GET /api/fixtures", () => {
  it("returns 200 with array of fixture names", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toContain("discovery-call");
    expect(body).toContain("demo-call");
  });

  it("returns fixture names without .json extension", async () => {
    const response = await GET();
    const body = await response.json();

    body.forEach((name: string) => {
      expect(name).not.toMatch(/\.json$/);
    });
  });
});
