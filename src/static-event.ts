import { BaseEvent } from "./base-event";
import { EventBusOptions, EventHandler } from "./event-bus";

export class StaticEvent<T> extends BaseEvent {
    private _label: string;
    key: string;

    constructor(key: string, options: {
        label?: string;
        options?: EventBusOptions;
    } = {}) {
        super(options?.options);
        this.key = `${key}-${this.randomString(5)}`;
        this._label = options?.label || key;
    }

    on(callback: (data: T) => void): EventHandler {
        return this.bus.on(this.key, callback);
    }

    once(callback: (data: T) => void): EventHandler {
        return this.bus.once(this.key, callback);
    }

    unique(callback: (data: T) => void): EventHandler {
        return this.bus.on_unique(this.key, callback);
    }

    stack(callback: (data: T) => void): EventHandler {
        return this.bus.on_stack(this.key, callback);
    }

    emit(data: T) {
        this.bus.emit(this.key, data);
    }

    get label(): string {
        return this._label;
    }

    toString(): string {
        return `StaticEvent(Label = ${this._label} Key = ${this.key} )`;
    }
}