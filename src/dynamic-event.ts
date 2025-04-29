import { BaseEvent } from "./base-event";
import { EventBusOptions, EventHandler } from "./event-bus";

export class DynamicEvent<K = string, T = any> extends BaseEvent {
    private _label: string;
    private shuffix: string;

    constructor(options: {
        label: string,
        options?: EventBusOptions
    }) {
        super(options?.options);
        this._label = options.label;
        this.shuffix = this.randomString(5);
    }

    on(key: K, callback: (data: T) => void): EventHandler {
        return this.bus.on(this.getKey(key), callback);
    }

    once(key: K, callback: (data: T) => void): EventHandler {
        return this.bus.once(this.getKey(key), callback);
    }

    unique(key: K, callback: (data: T) => void): EventHandler {
        return this.bus.on_unique(this.getKey(key), callback);
    }

    stack(key: K, callback: (data: T) => void): EventHandler {
        return this.bus.on_stack(this.getKey(key), callback);
    }

    emit(key: K, data: T) {
        this.bus.emit(this.getKey(key), data);
    }

    private getKey(key: K): string {
        return (key as string) + '-' + this.shuffix;
    }

    get label(): string {
        return this._label;
    }

    toString(): string {
        return `DynamicEvent(Label = ${this._label} Shuffix = ${this.shuffix})`;
    }
}