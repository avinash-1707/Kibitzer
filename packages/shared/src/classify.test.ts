import { expect, test, describe } from "bun:test";
import { isDestructive } from "./classify.ts";

describe("isDestructive", () => {
  test("rm -rf flagged", () => {
    expect(isDestructive({ command: "rm -rf dist" })).toBe(true);
  });

  test("git force-push flagged (both forms)", () => {
    expect(isDestructive({ command: "git push origin main --force" })).toBe(true);
    expect(isDestructive({ command: "git push -f" })).toBe(true);
  });

  test("git reset --hard flagged", () => {
    expect(isDestructive({ command: "git reset --hard HEAD~1" })).toBe(true);
  });

  test("DROP TABLE inside a db invocation flagged", () => {
    expect(isDestructive({ command: 'psql -c "DROP TABLE users"' })).toBe(true);
  });

  test("'truncate' in a commit message does NOT false-positive", () => {
    expect(isDestructive({ command: "git commit -m 'truncate log'" })).toBe(false);
  });

  test("writing .env via redirect flagged", () => {
    expect(isDestructive({ command: "echo SECRET=1 >> .env" })).toBe(true);
  });

  test(".env file path flagged", () => {
    expect(isDestructive({ filePath: "config/.env" })).toBe(true);
    expect(isDestructive({ filePath: ".env.local" })).toBe(true);
  });

  test("ordinary command not flagged", () => {
    expect(isDestructive({ command: "npm test" })).toBe(false);
    expect(isDestructive({ filePath: "src/index.ts" })).toBe(false);
  });
});
