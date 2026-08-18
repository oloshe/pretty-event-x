import { EventBus } from "./event-bus";
import type { CallbackMap, DefaultEventMap, EventBusOptions } from "./event-bus";

/** Vite 热更新上下文的最小结构，不向消费者传递 Vite 类型依赖。 */
export interface HotContextLike {
  readonly data: Record<string, unknown>;
}

/**
 * 在 Vite HMR 更新之间复用同一个事件总线实例。
 *
 * 库本身不会读取 `import.meta`；调用方需要显式传入 `import.meta.hot`。
 */
export function createViteEventBus<
  T extends CallbackMap = DefaultEventMap
>(
  hot: HotContextLike | undefined,
  key: string,
  options?: EventBusOptions
): EventBus<T> {
  if (!hot) return new EventBus<T>(options);

  const storageKey = `pretty-event-x:event-bus:${key}`;
  const existing = hot.data[storageKey];
  if (existing) return existing as EventBus<T>;

  const bus = new EventBus<T>(options);
  hot.data[storageKey] = bus;
  return bus;
}
