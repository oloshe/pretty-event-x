import { describe, expect, test } from "vitest";
import {
  EventBus,
  type EventController,
  type LogData,
} from "../src";

describe("event-bus reliability", () => {
  test("dispatch uses a snapshot when a listener cancels itself", async () => {
    const bus = new EventBus<{ change: () => void }>({ sync: true });
    const calls: string[] = [];
    let first: EventController;

    first = bus.on("change", () => {
      calls.push("first");
      first.cancel();
    });
    bus.on("change", () => calls.push("second"));

    await bus.emit("change");
    await bus.emit("change");

    expect(calls).toEqual(["first", "second", "second"]);
  });

  test("once cancels before a re-entrant or throwing handler runs", async () => {
    const errors: unknown[] = [];
    const bus = new EventBus<{
      nested: () => void;
      throwing: () => void;
    }>({
      sync: true,
      onError: (error) => errors.push(error),
    });
    let calls = 0;

    bus.once("nested", () => {
      calls += 1;
      void bus.emit("nested");
    });
    await bus.emit("nested");

    bus.once("throwing", () => {
      throw new Error("once failure");
    });
    await bus.emit("throwing");
    await bus.emit("throwing");

    expect(calls).toBe(1);
    expect(errors).toHaveLength(1);
    expect(bus.listenerCount()).toBe(0);
  });

  test("a stale named-listener controller cannot cancel its replacement", async () => {
    const bus = new EventBus<{ refresh: () => void }>({ sync: true });
    const calls: string[] = [];
    const stale = bus.on("refresh", () => calls.push("old"), "view");
    const current = bus.on("refresh", () => calls.push("new"), "view");

    expect(stale.active).toBe(false);
    expect(current.active).toBe(true);
    stale.cancel();
    await bus.emit("refresh");
    current.unsubscribe();
    await bus.emit("refresh");

    expect(calls).toEqual(["new"]);
    expect(bus.listenerCount()).toBe(0);
  });

  test("async listener failures are reported and do not stop dispatch", async () => {
    const errors: Array<[unknown, PropertyKey]> = [];
    const calls: string[] = [];
    const bus = new EventBus<{ load: () => void }>({
      onError: (error, context) => errors.push([error, context.key]),
    });

    bus.on("load", () => {
      throw new Error("load failure");
    });
    bus.on("load", () => calls.push("second"));

    await bus.emit("load");

    expect(errors).toHaveLength(1);
    expect(errors[0][0]).toBeInstanceOf(Error);
    expect(errors[0][1]).toBe("load");
    expect(calls).toEqual(["second"]);
  });

  test("custom logging and lifecycle controls remain observable", async () => {
    const logs: LogData[] = [];
    const bus = new EventBus<{
      add: (value: number) => void;
      reset: () => void;
    }>({
      sync: true,
      log: true,
      logger: { log: (data) => logs.push(data) },
    });

    const listener = bus.onUnique("add", () => undefined, "counter");
    const resetListener = bus.onStack("reset", () => undefined);
    await bus.emit("add", 1);
    listener.cancel();

    expect(logs.map((item) => item.action)).toEqual(["on", "on", "emit", "off"]);
    expect(bus.listenerCount("reset")).toBe(1);
    bus.clear("reset");
    expect(bus.listenerCount()).toBe(0);
    expect(resetListener.active).toBe(false);
  });
});
