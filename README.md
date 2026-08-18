# pretty-event-x

轻量、类型安全的 TypeScript 事件库，提供底层 `EventBus`、单事件封装 `StaticEvent` 和多键事件封装 `DynamicEvent`。

## 特性

- 事件名、参数与监听函数完全由 TypeScript 泛型约束。
- 支持默认、唯一（UNIQUE）和栈式（STACK）三种监听模式。
- 支持一次性监听、具名替换、批量清理和监听数量诊断。
- 同时发布 ESM、CommonJS 和 TypeScript 声明文件。
- 监听器异常彼此隔离，并可通过 `onError` 统一处理。
- 无运行时依赖。

## 安装

```bash
pnpm add pretty-event-x
```

也可以使用 npm 或 yarn：

```bash
npm install pretty-event-x
# 或
yarn add pretty-event-x
```

## EventBus 快速开始

先用事件映射声明事件名及其参数，再创建总线：

```ts
import { EventBus } from "pretty-event-x";

type AppEvents = {
  ready: () => void;
  change: (value: number, source: string) => void;
};

const bus = new EventBus<AppEvents>();

const listener = bus.on("change", (value, source) => {
  console.log(`${source}: ${value}`);
});

await bus.emit("change", 1, "counter");

listener.active;      // true
listener.cancel();
listener.active;      // false
```

`unsubscribe()` 是 `cancel()` 的同义方法，方便接入使用 unsubscribe 命名的生命周期代码。

## 执行时机

`emit()` 始终返回 `Promise<void>`。建议始终 `await`，以确保所有选中的监听器都已执行完毕：

```ts
const bus = new EventBus<AppEvents>({ sync: true });
await bus.emit("ready");
```

- `sync: false`：默认值，通过后续任务启动监听函数。
- `sync: true`：直接启动监听函数；异步处理函数仍会被等待。
- 无论选择哪种模式，监听器都按注册顺序处理。

派发使用监听器快照。监听器在回调中取消自己，不会导致本轮后续监听器被跳过。

## 监听模式

| 方法 | 模式 | 行为 |
| --- | --- | --- |
| `on()` | DEFAULT | 按注册顺序执行全部默认监听器。 |
| `onUnique()` | UNIQUE | 执行到第一个 UNIQUE 监听器后结束本轮派发。 |
| `onStack()` | STACK | 同一轮只执行最后遇到的 STACK 监听器。 |
| `once()` | DEFAULT | 最多执行一次；在回调前取消，可防止重入重复执行。 |

```ts
bus.onUnique("ready", () => console.log("only one"));
bus.onStack("ready", () => console.log("latest stack listener"));
```

`on_unique()` 与 `on_stack()` 为兼容旧版保留，新代码推荐使用驼峰命名。

## 具名监听器

传入第三个参数可以创建具名监听器。再次注册相同名称时，新监听器替换上一代监听器：

```ts
const stale = bus.on("change", () => {}, "view");
const current = bus.on("change", () => {}, "view");

stale.active;   // false
current.active; // true

stale.cancel(); // 不会误删 current
```

未传名称的匿名监听器不会互相替换。

## 清理与诊断

```ts
bus.listenerCount("change"); // 指定事件的监听数量
bus.listenerCount();         // 全部事件的监听数量

bus.clear("change");        // 清理指定事件
bus.clear();                 // 清理全部事件
```

也可以使用分组统一管理多个订阅：

```ts
const group = EventBus.createGroup(
  bus.on("ready", () => console.log("ready")),
  bus.on("change", (value) => console.log(value)),
);

group.push(bus.once("ready", () => console.log("once")));
group.destroy();
```

`destroy()` 可以重复调用，已经取消的控制器不会产生额外影响。

## 错误处理与日志

监听器异常不会中断其他监听器。默认使用 `console.error`，也可以集中处理：

```ts
const bus = new EventBus<AppEvents>({
  onError: (error, context) => {
    console.error(`event ${String(context.key)} failed`, error);
  },
});
```

开启日志后，可以使用内置日志器或注入自定义日志器：

```ts
const bus = new EventBus<AppEvents>({
  log: true,
  logger: {
    log(data) {
      console.log(data.action, data.key, data.payload);
    },
  },
});
```

## StaticEvent

`StaticEvent<T>` 表示一个固定事件键，适合导出为业务语义明确的单例事件：

```ts
import { StaticEvent } from "pretty-event-x";

export const increase = new StaticEvent<number>("increase", {
  label: "Increase counter",
  options: { sync: true },
});

const listener = increase.on((delta) => {
  console.log(delta);
});

await increase.emit(1);
listener.cancel();

increase.label;      // "Increase counter"
increase.toString(); // StaticEvent("Increase counter")[increase]
```

它提供 `on()`、`once()`、`unique()`、`stack()` 和 `emit()`。

## DynamicEvent

`DynamicEvent<K, T>` 让一组事件键共享同一种数据类型：

```ts
import { DynamicEvent } from "pretty-event-x";

const counter = new DynamicEvent<"plus" | "minus", number>({
  label: "counter",
  options: { sync: true },
});

counter.on("plus", (delta) => console.log(`+${delta}`));
counter.once("minus", (delta) => console.log(`-${delta}`));

await counter.emit("plus", 1);
await counter.emit("minus", 2);
```

它提供 `on()`、`once()`、`unique()`、`stack()` 和 `emit()`，每个方法都要求合法的事件键。


## Vite HMR

Vite 热更新会重新执行模块；如果每次都创建新的事件总线，旧模块注册的监听器与新模块派发事件时使用的实例可能分离。使用 `/vite` 子路径可以把同一个总线实例保存在 `import.meta.hot.data` 中：

```ts
import { createViteEventBus } from "pretty-event-x/vite";

type AppEvents = {
  change: (value: number) => void;
};

export const bus = createViteEventBus<AppEvents>(
  import.meta.hot,
  "app-events",
);
```

库内不会读取 `import.meta`，也不依赖 `vite/client`；调用方显式传入 `import.meta.hot`。生产构建中参数为 `undefined` 时，它会退化为普通的 `EventBus`。

总线身份与监听器生命周期是两件事。模块热更新时仍应取消旧模块注册的监听器：

```ts
const listener = bus.on("change", (value) => {
  console.log(value);
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => listener.cancel());
}
```

同一个 hot context 与 key 会返回同一个实例；不同业务总线应使用不同且稳定的 key。`options` 只在首次创建该 key 时生效。

## CommonJS

包同时提供 CommonJS 入口：

```js
const { EventBus, StaticEvent, DynamicEvent } = require("pretty-event-x");
```

## 开发

```bash
pnpm test       # 运行测试
pnpm typecheck  # 检查源码类型
pnpm coverage   # 生成覆盖率报告
pnpm build      # 构建 ESM、CommonJS 和声明文件
```

版本变化见 [CHANGELOG.md](./CHANGELOG.md)。

## License

ISC
