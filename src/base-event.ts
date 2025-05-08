import { DefaultEventMap, EventBus, EventBusOptions, CallbackMap } from "./event-bus";

export abstract class BaseEvent<T extends CallbackMap = DefaultEventMap> {
    protected bus: EventBus<T>

    constructor(options?: EventBusOptions) {
        this.bus = new EventBus(options);
    }
}

