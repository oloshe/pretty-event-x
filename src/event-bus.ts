export type Key = string;
export type KeyOf<T> = keyof T;
export type Callback<T = any> = (...payload: T[]) => void;
export type CallbackMap = Record<Key, Callback>;
export type CallbackType = "DEFAULT" | "UNIQUE" | "STACK";
export type IListener<E> = {
  alias: string;
  func: E[KeyOf<E>];
  type: CallbackType;
};
export type Bus<E> = Record<KeyOf<E>, IListener<E>[]>;
export type CancelFunc = () => void;
export type GetEventBusKey<T> = T extends EventBus<infer P> ? keyof P : unknown;

type ListenerEntry<E> = IListener<E> & {
  name: string | undefined;
  generation: number;
};

type MutableBus<E> = Record<KeyOf<E>, ListenerEntry<E>[]>;

export interface EventController {
  readonly alias: string;
  readonly type: CallbackType;
  readonly active: boolean;
  cancel: CancelFunc;
  unsubscribe: CancelFunc;
}

export interface EventGroup {
  push: (...item: EventController[]) => number;
  destroy: () => void;
}

export interface DefaultEventMap {
  [key: string | symbol]: (data: any) => void;
}

export interface EventErrorContext {
  key: PropertyKey;
  handler: Callback;
}

export interface IBusLogger {
  log: (data: LogData) => void;
}

export interface EventBusOptions {
  /**
   * 是否同步执行，默认异步
   */
  sync?: boolean;
  log?: boolean;
  logger?: IBusLogger;
  /**
   * 接收监听器异常，且不会中断其他监听器。
   */
  onError?: (error: unknown, context: EventErrorContext) => void;
}

export class EventBus<T extends CallbackMap = DefaultEventMap> {
  private _bus: Partial<MutableBus<T>> = {};
  private readonly logger: IBusLogger | undefined;
  private readonly onError: NonNullable<EventBusOptions["onError"]>;
  public readonly timestamp: number;
  public sync: boolean = false;

  constructor(opt?: EventBusOptions) {
    this.sync = opt?.sync ?? false;
    if (opt?.log ?? false) {
      this.logger = opt?.logger ?? new BusLogger();
    }
    this.onError = opt?.onError ?? ((error) => console.error(error));
    this.timestamp = Date.now();
  }

  get bus(): Partial<Bus<T>> {
    return this._bus;
  }

  on<EventKey extends KeyOf<T>>(
    key: EventKey,
    handler: T[EventKey],
    alias?: string,
    type: CallbackType = "DEFAULT"
  ): EventController {
    this.logger?.log({ action: "on", key: String(key), type });

    if (!this._bus[key]) this._bus[key] = [];

    const listeners = this._bus[key]!;
    const existing = alias === undefined
      ? undefined
      : listeners.find((item) => item.name === alias);

    const displayAlias = alias ?? "@anonymous";
    let entry: ListenerEntry<T>;

    if (existing) {
      existing.func = handler;
      existing.type = type;
      existing.generation += 1;
      entry = existing;
    } else {
      entry = {
        alias: displayAlias,
        name: alias,
        func: handler,
        type,
        generation: 0,
      };
      listeners.push(entry);
    }

    const generation = entry.generation;
    let cancelled = false;
    const cancel = () => {
      if (cancelled) return;
      cancelled = true;
      this.removeEntry(key, entry, generation);
    };
    const isActive = () =>
      this._bus[key]?.includes(entry) ?? false;

    return {
      get alias() {
        return displayAlias;
      },
      get type() {
        return type;
      },
      get active() {
        if (cancelled || entry.generation !== generation) return false;
        return isActive();
      },
      cancel,
      unsubscribe: cancel,
    };
  }

  onUnique<EventKey extends KeyOf<T>>(
    key: EventKey,
    handler: T[EventKey],
    alias?: string
  ): EventController {
    return this.on(key, handler, alias, "UNIQUE");
  }

  onStack<EventKey extends KeyOf<T>>(
    key: EventKey,
    handler: T[EventKey],
    alias?: string
  ): EventController {
    return this.on(key, handler, alias, "STACK");
  }

  once<EventKey extends KeyOf<T>>(
    key: EventKey,
    handler: T[EventKey]
  ): EventController {
    let listener: EventController;
    const handleOnce = (...payload: Parameters<T[EventKey]>) => {
      listener.cancel();
      return handler(...payload);
    };

    listener = this.on(key, handleOnce as T[EventKey]);
    return listener;
  }

  off<EventKey extends KeyOf<T>>(key: EventKey, handler: T[EventKey]): void {
    const listeners = this._bus[key];
    if (!listeners) return;

    const entry = listeners.find((item) => item.func === handler);
    if (entry) this.removeEntry(key, entry, entry.generation);
  }

  async emit<EventKey extends KeyOf<T>>(
    key: EventKey,
    ...payload: Parameters<T[EventKey]>
  ): Promise<void> {
    this.logger?.log({ action: "emit", key: String(key), payload });

    const listeners = this._bus[key]?.map((item) => ({ ...item }));
    if (!listeners) return;

    let stackFn: T[KeyOf<T>] | undefined;

    for (const { func, type } of listeners) {
      try {
        switch (type) {
          case "DEFAULT":
            await this.run(func, ...payload);
            break;
          case "UNIQUE":
            await this.run(func, ...payload);
            return;
          case "STACK":
            stackFn = func;
            break;
        }
      } catch (error) {
        this.onError(error, { key, handler: func });
      }
    }

    if (stackFn) {
      try {
        await this.run(stackFn, ...payload);
      } catch (error) {
        this.onError(error, { key, handler: stackFn });
      }
    }
  }

  clear(key?: KeyOf<T>): void {
    if (key === undefined) {
      this._bus = {};
      return;
    }
    delete this._bus[key];
  }

  listenerCount(key?: KeyOf<T>): number {
    if (key !== undefined) return this._bus[key]?.length ?? 0;
    return (Reflect.ownKeys(this._bus) as KeyOf<T>[]).reduce(
      (total, currentKey) => total + (this._bus[currentKey]?.length ?? 0),
      0
    );
  }

  private removeEntry<EventKey extends KeyOf<T>>(
    key: EventKey,
    entry: ListenerEntry<T>,
    generation: number
  ): void {
    if (entry.generation !== generation) return;
    const listeners = this._bus[key];
    if (!listeners) return;
    const index = listeners.indexOf(entry);
    if (index === -1) return;
    listeners.splice(index, 1);
    this.logger?.log({ action: "off", key: String(key) });
  }

  private run<EventKey extends KeyOf<T>>(
    func: T[KeyOf<T>],
    ...payload: Parameters<T[EventKey]>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const invoke = () => {
        try {
          resolve(func(...payload));
        } catch (error) {
          reject(error);
        }
      };

      if (this.sync) {
        invoke();
      } else {
        setTimeout(invoke, 0);
      }
    });
  }

  static createGroup(...initItems: EventController[]): EventGroup {
    const list: EventController[] = initItems || [];
    return {
      push: (...item) => list.push(...item),
      destroy: () => {
        list.splice(0, list.length).forEach((item) => item.cancel());
      },
    };
  }
}

export interface LogData {
  action: "on" | "off" | "emit";
  key: string;
  type?: string;
  payload?: unknown[];
}

export class BusLogger implements IBusLogger {
  log(data: LogData) {
    switch (data.action) {
      case "on":
        console.log(`[EX.${data.action} << ${data.key}]`);
        break;
      case "off":
        console.log(`[EX.${data.action} / ${data.key}]`);
        break;
      case "emit":
        console.log(`[EX.${data.action} >> ${data.key}]`, ...(data.payload || []));
        break;
    }
  }
}
