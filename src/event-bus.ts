export type Key = string;
export type KeyOf<T> = keyof T;
export type Callback<T = any> = (...payload: T[]) => void;
export type CallbackMap = Record<Key, Callback>;
export type CallbackType = 'DEFAULT' | 'UNIQUE' | 'STACK';
export type IListener<E> = {
    alias: string;
    func: E[KeyOf<E>];
    type: CallbackType;
};
export type Bus<E> = Record<KeyOf<E>, IListener<E>[]>;
export type CancelFunc = () => void;
export type GetEventBusKey<T> = T extends EventBus<infer P> ? keyof P : unknown;

export interface EventController {
    cancel: CancelFunc;
}

export interface EventGroup {
    push: (...item: EventController[]) => number;
    destroy: () => void;
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

export interface DefaultEventMap {
    [key: string | symbol]: (data: any) => void;
}

export class EventBus<T extends CallbackMap = DefaultEventMap> {
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

    on<Key extends KeyOf<T>>(key: Key, handler: T[Key], name?: string, type: CallbackType = 'DEFAULT'): EventController {
        this.showLog && this.logFormat({ action: 'on', key: key as string, type: type });
        
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

    on_unique<Key extends KeyOf<T>>(key: Key, handler: T[Key], name?: string): EventController {
        return this.on(key, handler, name, 'UNIQUE');
    }

    on_stack<Key extends KeyOf<T>>(key: Key, handler: T[Key], name?: string): EventController {
        return this.on(key, handler, name, 'STACK');
    }

    once<Key extends KeyOf<T>>(key: Key, handler: T[Key]): EventController {
        const handleOnce = (...payload: Parameters<typeof handler>) => {
            handler(...payload);
            listener.cancel();
        };
        
        const listener = this.on(key, handleOnce as T[Key]);
        return listener;
    }

    off<Key extends KeyOf<T>>(key: Key, handler: T[Key]): void {
        const listeners = this._bus[key];
        if (!listeners) return;
        
        const index = listeners.findIndex(item => item.func === handler);
        if (index !== -1) {
            listeners.splice(index, 1);
            this.showLog && this.logFormat({ action: 'off', key: String(key) });
        }
    }

    async emit<Key extends KeyOf<T>>(key: Key, ...payload: Parameters<T[Key]>): Promise<void> {
        this.showLog && this.logFormat({ action: 'emit', key: String(key) }, ...payload);
        
        const listeners = this._bus[key];
        if (!listeners) return;
        
        let stackFn: T[KeyOf<T>] | undefined;
        
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

    private run<Key extends KeyOf<T>>(func: T[KeyOf<T>], ...payload: Parameters<T[Key]>): Promise<void> {
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

    static createGroup(...initItems: EventController[]): EventGroup {
        const list: EventController[] = initItems || [];
        return {
            push: (...item) => list.push(...item),
            destroy: () => {
                list.splice(0, list.length).forEach(item => item.cancel());
            }
        };
    }
}
