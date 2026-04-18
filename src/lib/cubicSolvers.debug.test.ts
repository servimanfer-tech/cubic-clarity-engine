import { describe, it, expect } from "vitest";
import { solveFernandezMolina } from "@/lib/cubicSolvers";

describe("debug", () => {
  it("inspect", () => {
    const r = solveFernandezMolina(1, -6, 11, -6);
    console.log("METHOD:", r.method);
    console.log("ROOTS:", JSON.stringify(r.roots));
    console.log("LEN:", r.roots.length);
    expect(r.roots.length).toBe(3);
  });
});
