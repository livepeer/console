import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("registry UI primitive policy", () => {
  it("does not introduce Radix packages or imports", async () => {
    const files = [
      "package.json",
      "components/ui/dialog.tsx",
      "components/ui/tooltip.tsx",
      "components/ui/badge.tsx",
      "components/ui/button.tsx",
    ];
    const contents = await Promise.all(
      files.map((file) => readFile(new URL(`../../${file}`, import.meta.url), "utf8"))
    );
    expect(contents.join("\n")).not.toMatch(/(?:@radix-ui\/|["']radix-ui["'])/);
  });
});
