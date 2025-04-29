import { describe, expect, test } from "vitest";
import { StaticEvent } from "../src/static-event";
import { DynamicEvent } from "../src/dynamic-event";
import { EventBus } from "../src/event-bus";

describe('event-bus', () => {
    test('base', async () => {
        const bus = new EventBus({ log: true });
        let succ = false;
        bus.on('test', (data) => {
            succ = true;
        });
        await bus.emit('test', 1);
        expect(succ).toBe(true);
        expect(bus.bus["test"]?.length).toBe(1);
    });

    test('name', async () => {
        const bus = new EventBus<{
            add: (data: number) => void;
        }>({ log: true });
        let counter = 0;
        bus.on('add', (data) => {
            counter += data * 2;
        }, 'add');
        await bus.emit('add', 1);
        expect(counter).toBe(2);
        
        counter = 0;
        bus.on('add', (data) => {
            counter += data 
        }, 'add');
        await bus.emit('add', 1);
        expect(counter).toBe(1);
    });

    test('group', async () => {
        const bus = new EventBus<{
            add: (data: number) => void;
            minus: (data: number) => void;
        }>({ log: true });
        let counter = 0;
        const group = EventBus.createGroup();
        group.push(
            bus.on('add', (data) => {
                counter += data;
            }, 'add'),
            bus.on('minus', (data) => {
                counter -= data;
            }, 'minus'),
        );
        await bus.emit('add', 1);
        expect(counter).toBe(1);
        await bus.emit('minus', 1);
        expect(counter).toBe(0);
        group.destroy();

        await bus.emit('add', 1);
        expect(counter).toBe(0);
        await bus.emit('minus', 1);
        expect(counter).toBe(0);
    })
});

describe('static', () => {
    test('label', async () => {
        const increase = new StaticEvent<number>('addCounter', { label: 'addCounter' });
        console.log(increase.toString());
        expect(increase.label).toBe('addCounter');
    })

    test('on', async () => {
        let counter = 0;
        const increase = new StaticEvent<number>('addCounter', { options: { sync: true } });
        increase.on((delta) => {
            counter += delta;
        });
        increase.emit(1);
        increase.emit(3);
        increase.emit(6);
        expect(counter).toBe(10);
    })
    
    test('once', async () => {
        let counter = 0;
        const increase = new StaticEvent<number>('addCounter', { options: { sync: true } });
        increase.once((delta) => {
            counter += delta;
        });
        increase.emit(1);
        increase.emit(3);
        increase.emit(6);
        expect(counter).toBe(1);
    })
    
    
    test('stack', async () => {
        let counter = 0;
        const increase = new StaticEvent<number>('addCounter', { options: { sync: true } });
        increase.stack((delta) => {
            counter += delta + 123;
        });
        increase.stack((delta) => {
            counter += delta + 456;
        });
        increase.stack((delta) => {
            counter += delta;
        });
        increase.emit(1);
        increase.emit(3);
        increase.emit(6);
        expect(counter).toBe(10);
    })
    
    test('unique', async () => {
        let counter = 0;
        const increase = new StaticEvent<number>('addCounter', { options: { sync: true } });
        increase.unique((delta) => {
            counter += delta;
        });
        increase.unique((delta) => {
            counter += delta + 456;
        });
        increase.unique((delta) => {
            counter += delta + 123;
        });
        increase.emit(1);
        increase.emit(3);
        increase.emit(6);
        expect(counter).toBe(10);
    })
});

describe('dynamic', () => {

    test('label', async () => {
        const increase = new DynamicEvent<'minus' | 'plus', number>({ label: 'counter', options: { sync: true } });
        console.log(increase.toString());
        expect(increase.label).toBe('counter');
    })

    test('on', async () => {
        let counter = 0;
        const increase = new DynamicEvent<'minus' | 'plus', number>({ label: 'counter', options: { sync: true } });
        increase.on('minus', (delta) => {
            counter -= delta;
        });
        increase.on('plus', (delta) => {
            counter += delta;
        });
        increase.emit('minus', 1);
        increase.emit('plus', 3);
        increase.emit('minus', 6);
        expect(counter).toBe(-4);
    })
    
    test('once', async () => {
        let counter = 0;
        const increase = new DynamicEvent<'minus' | 'plus', number>({ label: 'counter', options: { sync: true } });
        increase.once('minus', (delta) => {
            counter -= delta;
        });
        increase.once('plus', (delta) => {
            counter += delta;
        });
        increase.emit('minus', 1);
        increase.emit('plus', 3);
        increase.emit('minus', 6);
        expect(counter).toBe(2);        
    })

    test('stack', async () => {
        let counter = 0;
        const increase = new DynamicEvent<'minus' | 'plus', number>({ label: 'counter', options: { sync: true } });
        increase.stack('minus', (delta) => {
            counter -= delta + 123;
        });
        increase.stack('plus', (delta) => {
            counter += delta + 456;
        });
        increase.stack('plus', (delta) => {
            counter += delta;
        });
        increase.stack('minus', (delta) => {
            counter -= delta;
        });
        increase.emit('minus', 1);
        increase.emit('plus', 3);
        increase.emit('minus', 6);
        expect(counter).toBe(-4);
    })

    test('unique', async () => {
        let counter = 0;
        const increase = new DynamicEvent<'minus' | 'plus', number>({ label: 'counter', options: { sync: true } });
        increase.unique('minus', (delta) => {
            counter -= delta;
        });
        increase.unique('plus', (delta) => {
            counter += delta;
        });
        increase.unique('plus', (delta) => {
            counter += delta + 456;
        });
        increase.emit('minus', 1);
        increase.emit('plus', 3);
        increase.emit('minus', 6);
        expect(counter).toBe(-4);
    })
});