import * as fs from "fs";
import * as path from "path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

describe("QA: Project directory structure — acceptance criteria", () => {
  const requiredSrcDirs = [
    "services",
    "types",
    "fixtures",
    "rules",
    "components",
    "hooks",
    "lib",
  ];

  describe.each(requiredSrcDirs)("src/%s", (dir) => {
    const dirPath = path.join(SRC, dir);

    it("exists", () => {
      expect(fs.existsSync(dirPath)).toBe(true);
    });

    it("is a directory (not a file)", () => {
      expect(fs.statSync(dirPath).isDirectory()).toBe(true);
    });

    it("contains a .gitkeep so it is tracked by git", () => {
      const gitkeep = path.join(dirPath, ".gitkeep");
      expect(fs.existsSync(gitkeep)).toBe(true);
    });
  });

  it("src/app directory exists (App Router)", () => {
    expect(fs.existsSync(path.join(SRC, "app"))).toBe(true);
    expect(fs.statSync(path.join(SRC, "app")).isDirectory()).toBe(true);
  });

  it("src/app/layout.tsx exists", () => {
    expect(fs.existsSync(path.join(SRC, "app", "layout.tsx"))).toBe(true);
  });

  it("src/app/page.tsx exists", () => {
    expect(fs.existsSync(path.join(SRC, "app", "page.tsx"))).toBe(true);
  });

  it("src/app/api/health/route.ts exists", () => {
    expect(
      fs.existsSync(path.join(SRC, "app", "api", "health", "route.ts"))
    ).toBe(true);
  });
});

describe("QA: .env.example — acceptance criteria", () => {
  const envPath = path.join(ROOT, ".env.example");

  it("file exists", () => {
    expect(fs.existsSync(envPath)).toBe(true);
  });

  it("contains ANTHROPIC_API_KEY=your_api_key_here", () => {
    const content = fs.readFileSync(envPath, "utf-8");
    expect(content).toContain("ANTHROPIC_API_KEY=your_api_key_here");
  });

  it("is not empty", () => {
    const content = fs.readFileSync(envPath, "utf-8").trim();
    expect(content.length).toBeGreaterThan(0);
  });
});

describe("QA: TypeScript configuration", () => {
  const tsconfigPath = path.join(ROOT, "tsconfig.json");

  it("tsconfig.json exists", () => {
    expect(fs.existsSync(tsconfigPath)).toBe(true);
  });

  it("strict mode is enabled", () => {
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it("module resolution is set to bundler", () => {
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
    expect(tsconfig.compilerOptions.moduleResolution).toBe("bundler");
  });

  it("has @/* path alias to ./src/*", () => {
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
    expect(tsconfig.compilerOptions.paths).toBeDefined();
    expect(tsconfig.compilerOptions.paths["@/*"]).toEqual(["./src/*"]);
  });

  it("jsx is set to preserve (for Next.js)", () => {
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
    expect(tsconfig.compilerOptions.jsx).toBe("preserve");
  });

  it("includes next-env.d.ts in include array", () => {
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
    expect(tsconfig.include).toContain("next-env.d.ts");
  });

  it("excludes node_modules", () => {
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
    expect(tsconfig.exclude).toContain("node_modules");
  });
});

describe("QA: ESLint configuration", () => {
  it("eslint.config.mjs exists", () => {
    expect(fs.existsSync(path.join(ROOT, "eslint.config.mjs"))).toBe(true);
  });

  it("eslint config extends next/core-web-vitals", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "eslint.config.mjs"),
      "utf-8"
    );
    expect(content).toContain("next/core-web-vitals");
  });

  it("eslint config extends next/typescript", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "eslint.config.mjs"),
      "utf-8"
    );
    expect(content).toContain("next/typescript");
  });
});

describe("QA: package.json — Next.js 15 scaffolding", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf-8")
  );

  it("has Next.js 15 as a dependency", () => {
    expect(pkg.dependencies.next).toMatch(/^\^?15/);
  });

  it("has React 19 as a dependency", () => {
    expect(pkg.dependencies.react).toMatch(/^\^?19/);
  });

  it("has react-dom 19 as a dependency", () => {
    expect(pkg.dependencies["react-dom"]).toMatch(/^\^?19/);
  });

  it("has TypeScript as a devDependency", () => {
    expect(pkg.devDependencies.typescript).toBeDefined();
  });

  it("has ESLint as a devDependency", () => {
    expect(pkg.devDependencies.eslint).toBeDefined();
  });

  it("has eslint-config-next as a devDependency", () => {
    expect(pkg.devDependencies["eslint-config-next"]).toBeDefined();
  });

  it("has dev script", () => {
    expect(pkg.scripts.dev).toBe("next dev");
  });

  it("has build script", () => {
    expect(pkg.scripts.build).toBe("next build");
  });

  it("has start script", () => {
    expect(pkg.scripts.start).toBe("next start");
  });

  it("has lint script", () => {
    expect(pkg.scripts.lint).toBe("next lint");
  });

  it("has test script", () => {
    expect(pkg.scripts.test).toBeDefined();
  });
});

describe("QA: .gitignore", () => {
  const content = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf-8");

  it("ignores node_modules", () => {
    expect(content).toContain("node_modules");
  });

  it("ignores .next build output", () => {
    expect(content).toContain(".next");
  });

  it("ignores .env files (secrets protection)", () => {
    expect(content).toMatch(/\.env/);
  });
});
