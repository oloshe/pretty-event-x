type EventKey = string | symbol;
type EventFunction<T = any> = (...payload: T[]) => void;
type EventMap = Record<EventKey, EventFunction>;
type ListenType = 'DEFAULT' | 'UNIQUE' | 'STACK';
type ListenerType<E> = {
    alias: string;
    func: E[keyof E];
    type: ListenType;
};
type Bus<E> = Record<keyof E, ListenerType<E>[]>;
type CancelFunc = () => void;

export type GetEventBusKey<T> = T extends EventBus<infer P> ? keyof P : unknown;

interface IEventBus<T extends EventMap> {
    on<Key extends keyof T>(key: Key, handler: T[Key], name?: string, type?: ListenType): EventHandler;
    on_unique<Key extends keyof T>(key: Key, handler: T[Key], name?: string): EventHandler;
    on_stack<Key extends keyof T>(key: Key, handler: T[Key], name?: string): EventHandler;
    once<Key extends keyof T>(key: Key, handler: T[Key]): EventHandler;
    off<Key extends keyof T>(key: Key, handler: T[Key]): void;
    emit<Key extends keyof T>(key: Key, ...payload: Parameters<T[Key]>): void;
    readonly bus: Partial<Bus<T>>;
    readonly timestamp: number;
}

export interface EventHandler {
    cancel: CancelFunc;
}

export interface EventBusOptions {
    /**
     * 是否同步执行，默认异步
     */
    sync?: boolean;
    log?: boolean;
    logger?: (data: LogData, ...payload: any[]) => void;
}

type LogData = LogDataOn | ILogData;

interface LogDataOn {
    action: 'on'
    key: string;
    type: string;
}

interface ILogData {
    action: 'off' | 'emit';
    key: string;
}

interface DefaultEventMap {
    [key: string | symbol]: (data: any) => void;
}

export class EventBus<T extends EventMap = DefaultEventMap> implements IEventBus<T> {
    private _bus: Partial<Bus<T>> = {};
    private readonly showLog: boolean;
    private readonly logFormat: (data: LogData, ...payload: any[]) => void;
    public readonly timestamp: number;
    public sync: boolean = false;

    constructor(opt?: EventBusOptions) {
        this.showLog = opt?.log ?? false;
        this.sync = opt?.sync ?? false;
        this.logFormat = opt?.logger || ((data, ...payload) => {
            console.log(`[EventBus] ${data.action} ${data.key}`, ...payload);
        });
        this.timestamp = Date.now();
    }

    get bus(): Partial<Bus<T>> {
        return this._bus;
    }

    on<Key extends keyof T>(key: Key, handler: T[Key], name?: string, type: ListenType = 'DEFAULT'): EventHandler {
        this.showLog && this.logFormat({ action: 'on', key: String(key), type: type });
        
        if (!this._bus[key]) this._bus[key] = [];
        
        const listeners = this._bus[key]!;
        const existing = listeners.find(item => item.alias === name);
        
        if (existing) {
            existing.func = handler;
            existing.type = type;
        } else {
            listeners.push({
                alias: name || '@anonymous',
                func: handler,
                type: type,
            });
        }
        
        return {
            cancel: () => this.off(key, handler)
        };
    }

    on_unique<Key extends keyof T>(key: Key, handler: T[Key], name?: string): EventHandler {
        return this.on(key, handler, name, 'UNIQUE');
    }

    on_stack<Key extends keyof T>(key: Key, handler: T[Key], name?: string): EventHandler {
        return this.on(key, handler, name, 'STACK');
    }

    once<Key extends keyof T>(key: Key, handler: T[Key]): EventHandler {
        const handleOnce = (...payload: Parameters<typeof handler>) => {
            handler(...payload);
            listener.cancel();
        };
        
        const listener = this.on(key, handleOnce as T[Key]);
        return listener;
    }

    off<Key extends keyof T>(key: Key, handler: T[Key]): void {
        const listeners = this._bus[key];
        if (!listeners) return;
        
        const index = listeners.findIndex(item => item.func === handler);
        if (index !== -1) {
            listeners.splice(index, 1);
            this.showLog && this.logFormat({ action: 'off', key: String(key) });
        }
    }

    async emit<Key extends keyof T>(key: Key, ...payload: Parameters<T[Key]>): Promise<void> {
        this.showLog && this.logFormat({ action: 'emit', key: String(key) }, ...payload);
        
        const listeners = this._bus[key];
        if (!listeners) return;
        
        let stackFn: T[keyof T] | undefined;
        
        for (let i = 0; i < listeners.length; i++) {
            const { func, type } = listeners[i];
            try {
                switch (type) {
                    case 'DEFAULT':
                        await this.run(func, ...payload);
                        break;
                    case 'UNIQUE':
                        await this.run(func, ...payload);
                        return;
                    case 'STACK':
                        stackFn = func;
                        break;
                }
            } catch (e) {
                console.error(e);
            }
        }
        
        if (stackFn) {
            try {
                await this.run(stackFn, ...payload);
            } catch (e) {
                console.error(e);
            }
        }
    }

    private run<Key extends keyof T>(func: T[keyof T], ...payload: Parameters<T[Key]>): Promise<void> {
        return new Promise((resolve) => {
            if (this.sync) {
                resolve(func(...payload));
            } else {
                setTimeout(() => {
                    resolve(func(...payload));
                }, 0);
            }
        });
    }

    static createGroup(...initItems: EventHandler[]): EventGroup {
        const list: EventHandler[] = initItems || [];
        return {
            push: (...item) => list.push(...item),
            destroy: () => {
                list.splice(0, list.length).forEach(item => item.cancel());
            }
        };
    }
}

// 辅助函数保持独立
export interface EventGroup {
    push: (...item: EventHandler[]) => number;
    destroy: () => void;
}
