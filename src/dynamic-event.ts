import { BaseEvent } from "./base-event";
import { EventBusOptions, Callback, EventController, KeyOf, Key } from "./event-bus";

export class DynamicEvent<K extends Key, T> extends BaseEvent<Record<K, (data: T) => void>> {
    private _label: string;

    constructor(options: {
        label: string,
        options?: EventBusOptions
    }) {
        super(options?.options);
        this._label = options.label;
    }

    on(key: K, callback: Callback<T>): EventController {
        return this.bus.on(key, callback);
    }

    once(key: K, callback: Callback<T>): EventController {
        return this.bus.once(key, callback);
    }

    unique(key: K, callback: Callback<T>): EventController {
        return this.bus.on_unique(key, callback);
    }

    stack(key: K, callback: Callback<T>): EventController {
        return this.bus.on_stack(key, callback);
    }

    emit(key: K, data: T) {
        this.bus.emit(key, ...[data] as Parameters<Record<K, (data: T) => void>[K]>);
    }

    get label(): string {
        return this._label;
    }

    toString(): string {
        return `DynamicEvent("${this._label}")`;
    }
}