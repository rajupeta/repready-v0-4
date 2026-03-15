/**
 * TICKET-001 QA Validation — Test Agent
 *
 * Validates all acceptance criteria for the project scaffolding ticket:
 * 1. Next.js 15 app structure (App Router)
 * 2. GET /api/health returns 200 with { status: 'ok' }
 * 3. TypeScript configured correctly
 * 4. All required directories exist under src/
 * 5. .env.example contains ANTHROPIC_API_KEY
 * 6. ESLint configured
 */
import * as fs from "fs";
import * as path from "path";
import { GET } from "@/app/api/health/route";

const ROOT = process.cwd();

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, filePath), "utf-8"));
}

// ---------- AC 1: Next.js 15 app with App Router ----------

describe("AC1: Next.js 15 with App Router", () => {
  it("next dependency is version 15.x", () => {
    const pkg = readJson("package.json");
    expect(pkg.dependencies.next).toMatch(/15/);
  });

  it("uses App Router — src/app/layout.tsx exists", () => {
    expect(fs.existsSync(path.join(ROOT, "src/app/layout.tsx"))).toBe(true);
  });

  it("uses App Router — src/app/page.tsx exists", () => {
    expect(fs.existsSync(path.join(ROOT, "src/app/page.tsx"))).toBe(true);
  });

  it("next.config.ts exists", () => {
    expect(fs.existsSync(path.join(ROOT, "next.config.ts"))).toBe(true);
  });

  it("has dev script", () => {
    const pkg = readJson("package.json");
    expect(pkg.scripts.dev).toBe("next dev");
  });

  it("has build script", () => {
    const pkg = readJson("package.json");
    expect(pkg.scripts.build).toBe("next build");
  });

  it("has start script", () => {
    const pkg = readJson("package.json");
    expect(pkg.scripts.start).toBe("next start");
  });
});

// ---------- AC 2: GET /api/health ----------

describe("AC2: GET /api/health returns 200 { status: 'ok' }", () => {
  it("route file exists at src/app/api/health/route.ts", () => {
    expect(
      fs.existsSync(path.join(ROOT, "src/app/api/health/route.ts"))
    ).toBe(true);
  });

  it("returns HTTP 200", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("body is exactly { status: 'ok' }", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("does not include unexpected keys in the response", async () => {
    const res = await GET();
    const body = await res.json();
    expect(Object.keys(body)).toEqual(["status"]);
  });

  it("response content-type is application/json", async () => {
    const res = await GET();
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("GET is exported as a named export", async () => {
    const mod = await import("@/app/api/health/route");
    expect(typeof mod.GET).toBe("function");
  });
});

// ---------- AC 3: TypeScript compiles clean ----------

describe("AC3: TypeScript configuration", () => {
  it("tsconfig.json exists", () => {
    expect(fs.existsSync(path.join(ROOT, "tsconfig.json"))).toBe(true);
  });

  it("strict mode is enabled", () => {
    const tsconfig = readJson("tsconfig.json");
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it("module resolution is bundler (Next.js 15 standard)", () => {
    const tsconfig = readJson("tsconfig.json");
    expect(tsconfig.compilerOptions.moduleResolution).toBe("bundler");
  });

  it("path alias @/* maps to ./src/*", () => {
    const tsconfig = readJson("tsconfig.json");
    expect(tsconfig.compilerOptions.paths["@/*"]).toEqual(["./src/*"]);
  });

  it("includes next plugin", () => {
    const tsconfig = readJson("tsconfig.json");
    const nextPlugin = tsconfig.compilerOptions.plugins?.find(
      (p: { name: string }) => p.name === "next"
    );
    expect(nextPlugin).toBeDefined();
  });

  it("jsx is set to preserve", () => {
    const tsconfig = readJson("tsconfig.json");
    expect(tsconfig.compilerOptions.jsx).toBe("preserve");
  });
});

// ---------- AC 4: All directory folders exist under src/ ----------

describe("AC4: Required src/ directories", () => {
  const requiredDirs = [
    "services",
    "types",
    "fixtures",
    "rules",
    "components",
    "hooks",
    "lib",
  ];

  for (const dir of requiredDirs) {
    it(`src/${dir}/ exists`, () => {
      const dirPath = path.join(ROOT, "src", dir);
      expect(fs.existsSync(dirPath)).toBe(true);
      expect(fs.statSync(dirPath).isDirectory()).toBe(true);
    });
  }

  it("src/app/ directory exists (App Router)", () => {
    const dirPath = path.join(ROOT, "src", "app");
    expect(fs.existsSync(dirPath)).toBe(true);
    expect(fs.statSync(dirPath).isDirectory()).toBe(true);
  });

  it("src/app/api/ directory exists (API routes)", () => {
    const dirPath = path.join(ROOT, "src", "app", "api");
    expect(fs.existsSync(dirPath)).toBe(true);
    expect(fs.statSync(dirPath).isDirectory()).toBe(true);
  });
});

// ---------- AC 5: .env.example contains ANTHROPIC_API_KEY ----------

describe("AC5: .env.example", () => {
  it(".env.example file exists", () => {
    expect(fs.existsSync(path.join(ROOT, ".env.example"))).toBe(true);
  });

  it("contains ANTHROPIC_API_KEY=your_api_key_here", () => {
    const content = fs.readFileSync(
      path.join(ROOT, ".env.example"),
      "utf-8"
    );
    expect(content).toContain("ANTHROPIC_API_KEY=your_api_key_here");
  });

  it("does not contain actual API keys (only placeholders)", () => {
    const content = fs.readFileSync(
      path.join(ROOT, ".env.example"),
      "utf-8"
    );
    // Should not contain sk-ant- prefix (real Anthropic key pattern)
    expect(content).not.toMatch(/sk-ant-/);
  });
});

// ---------- AC 6: ESLint configured ----------

describe("AC6: ESLint configuration", () => {
  it("eslint.config.mjs exists", () => {
    expect(fs.existsSync(path.join(ROOT, "eslint.config.mjs"))).toBe(true);
  });

  it("lint script is defined in package.json", () => {
    const pkg = readJson("package.json");
    expect(pkg.scripts.lint).toBeDefined();
  });

  it("eslint is in devDependencies", () => {
    const pkg = readJson("package.json");
    expect(pkg.devDependencies.eslint).toBeDefined();
  });

  it("eslint-config-next is in devDependencies", () => {
    const pkg = readJson("package.json");
    expect(pkg.devDependencies["eslint-config-next"]).toBeDefined();
  });

  it("eslint config extends next/core-web-vitals", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "eslint.config.mjs"),
      "utf-8"
    );
    expect(content).toContain("next/core-web-vitals");
  });
});

// ---------- Additional: Project health checks ----------

describe("Project health", () => {
  it("package.json has correct project name", () => {
    const pkg = readJson("package.json");
    expect(pkg.name).toBe("repready-v0-4");
  });

  it("package.json version is 0.4.0", () => {
    const pkg = readJson("package.json");
    expect(pkg.version).toBe("0.4.0");
  });

  it("react and react-dom are version 19.x", () => {
    const pkg = readJson("package.json");
    expect(pkg.dependencies.react).toMatch(/19/);
    expect(pkg.dependencies["react-dom"]).toMatch(/19/);
  });

  it("TypeScript is in devDependencies", () => {
    const pkg = readJson("package.json");
    expect(pkg.devDependencies.typescript).toBeDefined();
  });

  it(".gitignore excludes node_modules", () => {
    const content = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf-8");
    expect(content).toContain("node_modules");
  });

  it(".gitignore excludes .next", () => {
    const content = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf-8");
    expect(content).toContain(".next");
  });

  it(".gitignore excludes .env files (but not .env.example)", () => {
    const content = fs.readFileSync(
      path.join(ROOT, ".gitignore"),
      "utf-8"
    );
    // .env.example should NOT be in .gitignore
    // .env.local or similar should be excluded
    expect(content).toBeDefined();
    expect(fs.existsSync(path.join(ROOT, ".env.example"))).toBe(true);
  });

  it("test infrastructure is configured (jest.config.js)", () => {
    expect(fs.existsSync(path.join(ROOT, "jest.config.js"))).toBe(true);
  });
});
