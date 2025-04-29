import { EventBus, EventBusOptions } from "./event-bus";

export abstract class BaseEvent {
    protected bus: EventBus

    constructor(options?: EventBusOptions) {
        this.bus = new EventBus(options);
    }

    protected randomString(length: number) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}

