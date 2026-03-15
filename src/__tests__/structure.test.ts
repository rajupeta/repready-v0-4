import * as fs from "fs";
import * as path from "path";

describe("Project directory structure", () => {
  const srcDir = path.join(process.cwd(), "src");

  const requiredDirs = [
    "services",
    "types",
    "fixtures",
    "rules",
    "components",
    "hooks",
    "lib",
  ];

  it.each(requiredDirs)("src/%s directory exists", (dir) => {
    const dirPath = path.join(srcDir, dir);
    expect(fs.existsSync(dirPath)).toBe(true);
    expect(fs.statSync(dirPath).isDirectory()).toBe(true);
  });

  it(".env.example exists and contains ANTHROPIC_API_KEY", () => {
    const envPath = path.join(process.cwd(), ".env.example");
    expect(fs.existsSync(envPath)).toBe(true);
    const content = fs.readFileSync(envPath, "utf-8");
    expect(content).toContain("ANTHROPIC_API_KEY");
  });
});
