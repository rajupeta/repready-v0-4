import { existsSync } from "fs";
import { join } from "path";
import { readFileSync } from "fs";

describe("TICKET-039: npm install and dependency resolution", () => {
  const rootDir = join(__dirname, "..", "..");

  describe("package.json validity", () => {
    it("has a valid package.json", () => {
      const pkgPath = join(rootDir, "package.json");
      expect(existsSync(pkgPath)).toBe(true);
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      expect(pkg.name).toBe("repready-v0-4");
    });

    it("does not reference local tgz files for dependencies", () => {
      const pkgPath = join(rootDir, "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      for (const [name, version] of Object.entries(allDeps)) {
        expect({ name, version }).not.toEqual(
          expect.objectContaining({
            version: expect.stringMatching(/^file:.*\.tgz$/),
          })
        );
      }
    });

    it("lists tailwindcss as a devDependency", () => {
      const pkgPath = join(rootDir, "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      expect(pkg.devDependencies).toHaveProperty("tailwindcss");
    });

    it("lists @tailwindcss/postcss as a devDependency", () => {
      const pkgPath = join(rootDir, "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      expect(pkg.devDependencies).toHaveProperty("@tailwindcss/postcss");
    });
  });

  describe("installed modules", () => {
    it("has tailwindcss installed in node_modules", () => {
      const modulePath = join(rootDir, "node_modules", "tailwindcss");
      expect(existsSync(modulePath)).toBe(true);
    });

    it("has @tailwindcss/postcss installed in node_modules", () => {
      const modulePath = join(
        rootDir,
        "node_modules",
        "@tailwindcss",
        "postcss"
      );
      expect(existsSync(modulePath)).toBe(true);
    });

    it("has ts-jest installed in node_modules", () => {
      const modulePath = join(rootDir, "node_modules", "ts-jest");
      expect(existsSync(modulePath)).toBe(true);
    });
  });

  describe(".npmrc configuration", () => {
    it(".npmrc exists at project root", () => {
      const npmrcPath = join(rootDir, ".npmrc");
      expect(existsSync(npmrcPath)).toBe(true);
    });

    it(".npmrc includes dev dependencies", () => {
      const npmrcPath = join(rootDir, ".npmrc");
      const content = readFileSync(npmrcPath, "utf-8");
      expect(content).toContain("include=dev");
    });
  });

  describe("CI script", () => {
    it("has a CI script", () => {
      const ciPath = join(rootDir, "scripts", "ci.sh");
      expect(existsSync(ciPath)).toBe(true);
    });

    it("CI script runs npm install before npm test", () => {
      const ciPath = join(rootDir, "scripts", "ci.sh");
      const content = readFileSync(ciPath, "utf-8");
      const installIndex = content.indexOf("npm install");
      const testIndex = content.indexOf("npm test");
      expect(installIndex).toBeGreaterThan(-1);
      expect(testIndex).toBeGreaterThan(-1);
      expect(installIndex).toBeLessThan(testIndex);
    });
  });

});
