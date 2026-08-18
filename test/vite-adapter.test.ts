import { describe, expect, test } from "vitest";
import { createViteEventBus, type HotContextLike } from "../src/vite";

type Events = {
  change: (value: number) => void;
};

describe("Vite HMR adapter", () => {
  test("reuses a bus so listeners survive module replacement", async () => {
    const hot: HotContextLike = { data: {} };
    const first = createViteEventBus<Events>(hot, "app", { sync: true });
    const values: number[] = [];
    first.on("change", (value) => values.push(value));

    const replacement = createViteEventBus<Events>(hot, "app");
    await replacement.emit("change", 1);

    expect(replacement).toBe(first);
    expect(replacement.sync).toBe(true);
    expect(values).toEqual([1]);
  });

  test("uses separate identities for different keys", () => {
    const hot: HotContextLike = { data: {} };

    expect(createViteEventBus(hot, "first")).not.toBe(
      createViteEventBus(hot, "second")
    );
  });

  test("falls back to a fresh bus without a hot context", () => {
    expect(createViteEventBus(undefined, "app")).not.toBe(
      createViteEventBus(undefined, "app")
    );
  });
});
