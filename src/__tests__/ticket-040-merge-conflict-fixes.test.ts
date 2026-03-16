/**
 * TICKET-040: Verify merge conflict resolutions
 *
 * Validates that the rebased branches' changes are correctly applied on main:
 * - TICKET-038: Claude model updated to claude-haiku-4-5-20251001
 * - TICKET-045: Session page uses SSE-first flow with pendingStartIdRef
 */

import * as fs from "fs";
import * as path from "path";

describe("TICKET-040: Merge conflict resolutions", () => {
  describe("TICKET-038 — Claude model update", () => {
    it("claude-service.ts uses claude-haiku-4-5-20251001 as default model", () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/services/claude-service.ts"),
        "utf-8"
      );
      expect(source).toContain('"claude-haiku-4-5-20251001"');
      expect(source).not.toContain('"claude-3-5-haiku-20241022"');
    });

    it(".env.example references new model name", () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), ".env.example"),
        "utf-8"
      );
      expect(source).toContain("claude-haiku-4-5-20251001");
    });

    it("README.md references new model name", () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), "README.md"),
        "utf-8"
      );
      expect(source).toContain("claude-haiku-4-5-20251001");
    });
  });

  describe("TICKET-045 — SSE-first session start flow", () => {
    it("session page uses pendingStartIdRef for SSE-first flow", () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/app/session/page.tsx"),
        "utf-8"
      );
      expect(source).toContain("pendingStartIdRef");
    });

    it("session page imports useRef", () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/app/session/page.tsx"),
        "utf-8"
      );
      expect(source).toContain("useRef");
    });

    it("session page waits for isConnected before calling /start", () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/app/session/page.tsx"),
        "utf-8"
      );
      // The effect that starts playback should check isConnected
      expect(source).toContain("isConnected && pendingStartIdRef.current");
    });

    it("session page retains scorecardData and scorecardLoading state", () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/app/session/page.tsx"),
        "utf-8"
      );
      expect(source).toContain("scorecardData");
      expect(source).toContain("scorecardLoading");
    });
  });
});
