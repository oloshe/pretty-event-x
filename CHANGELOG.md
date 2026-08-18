# Changelog

本项目的重要变化记录在此文件中。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [2.0.0]

### Added

- 为监听控制器增加 `active` 状态和 `unsubscribe()` 别名。
- 增加 `onUnique()`、`onStack()` 驼峰命名 API。
- 增加 `clear()` 和 `listenerCount()` 生命周期与诊断 API。
- 增加 `onError` 监听器异常处理入口。
- 增加自定义日志器支持，并公开日志相关类型。
- 增加事件总线可靠性回归测试与源码类型检查脚本。
- 增加 ESM、CommonJS 和 TypeScript 声明文件的显式包入口。
- 增加 `pretty-event-x/vite` 子路径和 `createViteEventBus()`，在 Vite HMR 更新之间复用事件总线实例。

### Changed

- `DynamicEvent.emit()` 与 `StaticEvent.emit()` 现在返回底层 `EventBus.emit()` 的 Promise。
- 具名监听器采用代次语义：新注册会替换同名监听器，旧控制器会失效。
- 派发基于监听器快照，派发期间修改订阅不会跳过本轮后续监听器。
- `once()` 在调用处理函数前取消订阅，重入派发时也最多执行一次。
- `vite-plugin-dts` 仅处理 `src` 目录，不再扫描测试与构建配置。
- JavaScript 构建产物使用 Terser 完整压缩；TypeScript 声明文件显式保留源码注释。
- 测试脚本改为一次性运行；监听模式和原有 `sync` / `emit()` 语义保持兼容。

### Fixed

- 修复监听器在回调中取消自己时，下一个监听器被跳过的问题。
- 修复 `once()` 处理函数重入或抛错时可能重复执行的问题。
- 修复旧具名监听控制器可能误删替换后监听器的问题。
- 修复异步调度的监听器同步抛错无法被事件总线捕获的问题。
- 修复传入自定义 `logger` 后仍使用默认日志器的问题。

### Compatibility

- 保留 `EventBus` 类式构造方式。
- 保留 `on_unique()` 与 `on_stack()`，并标记为弃用别名。
- 保留 `emit(): Promise<void>` 与 `sync` 选项，不引入破坏性的同步/异步双 API。
