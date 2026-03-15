import { GET } from "@/app/api/health/route";

describe("QA: GET /api/health — acceptance criteria validation", () => {
  it("returns HTTP 200 status code", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it("returns JSON body with status field equal to 'ok'", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  it("does not include unexpected fields in the response body", async () => {
    const response = await GET();
    const body = await response.json();
    const keys = Object.keys(body);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe("status");
  });

  it("returns valid JSON content-type header", async () => {
    const response = await GET();
    const contentType = response.headers.get("content-type");
    expect(contentType).not.toBeNull();
    expect(contentType).toContain("application/json");
  });

  it("is idempotent — multiple calls return same result", async () => {
    const r1 = await GET();
    const r2 = await GET();
    const r3 = await GET();

    const b1 = await r1.json();
    const b2 = await r2.json();
    const b3 = await r3.json();

    expect(b1).toEqual({ status: "ok" });
    expect(b2).toEqual({ status: "ok" });
    expect(b3).toEqual({ status: "ok" });

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);
  });

  it("GET handler is an async function", () => {
    expect(GET).toBeDefined();
    expect(GET.constructor.name).toBe("AsyncFunction");
  });

  it("response is a standard Response instance", async () => {
    const response = await GET();
    expect(response).toBeInstanceOf(Response);
  });

  it("response body is parseable as JSON without errors", async () => {
    const response = await GET();
    await expect(response.json()).resolves.not.toThrow();
  });

  it("status value is a string, not a number or boolean", async () => {
    const response = await GET();
    const body = await response.json();
    expect(typeof body.status).toBe("string");
  });
});
