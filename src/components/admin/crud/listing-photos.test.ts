import { describe, expect, it } from "vitest";
import { reorder } from "./listing-photos-order";

describe("reorder", () => {
  it("sube, baja y pasa a portada; en los bordes no cambia nada", () => {
    expect(reorder([1, 2, 3], 2, "up")).toEqual([2, 1, 3]);
    expect(reorder([1, 2, 3], 2, "down")).toEqual([1, 3, 2]);
    expect(reorder([1, 2, 3], 3, "cover")).toEqual([3, 1, 2]);
    expect(reorder([1, 2, 3], 1, "up")).toEqual([1, 2, 3]);
    expect(reorder([1, 2, 3], 3, "down")).toEqual([1, 2, 3]);
    expect(reorder([1, 2, 3], 9, "cover")).toEqual([1, 2, 3]);
  });
});
