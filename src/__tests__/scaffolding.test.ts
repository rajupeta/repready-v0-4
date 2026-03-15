import * as fs from "fs";
import * as path from "path";

describe("Project scaffolding — extended", () => {
  const root = process.cwd();

  it("tsconfig.json exists and has strict mode enabled", () => {
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(root, "tsconfig.json"), "utf-8")
    );
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it("tsconfig.json has @/* path alias pointing to ./src/*", () => {
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(root, "tsconfig.json"), "utf-8")
    );
    expect(tsconfig.compilerOptions.paths["@/*"]).toEqual(["./src/*"]);
  });

  it("package.json has Next.js 15 dependency", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf-8")
    );
    expect(pkg.dependencies.next).toMatch(/^\^?15/);
  });

  it("package.json has dev, build, start, lint, and test scripts", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf-8")
    );
    expect(pkg.scripts.dev).toBeDefined();
    expect(pkg.scripts.build).toBeDefined();
    expect(pkg.scripts.start).toBeDefined();
    expect(pkg.scripts.lint).toBeDefined();
    expect(pkg.scripts.test).toBeDefined();
  });

  it("eslint.config.mjs exists", () => {
    expect(fs.existsSync(path.join(root, "eslint.config.mjs"))).toBe(true);
  });

  it(".env.example contains ANTHROPIC_API_KEY=your_api_key_here", () => {
    const content = fs.readFileSync(path.join(root, ".env.example"), "utf-8");
    expect(content).toContain("ANTHROPIC_API_KEY=your_api_key_here");
  });

  it("src/app/layout.tsx exists (App Router)", () => {
    expect(
      fs.existsSync(path.join(root, "src", "app", "layout.tsx"))
    ).toBe(true);
  });

  it("src/app/api/health/route.ts exists", () => {
    expect(
      fs.existsSync(path.join(root, "src", "app", "api", "health", "route.ts"))
    ).toBe(true);
  });

  it(".gitignore includes node_modules and .next", () => {
    const content = fs.readFileSync(path.join(root, ".gitignore"), "utf-8");
    expect(content).toContain("node_modules");
    expect(content).toContain(".next");
  });
});
