// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
export class Events {
    private map: Map<number | string, Function | Function[]>;

    constructor() {
        this.map = new Map();
    }

    public on(key: number | string, fn: Function = null, multiFn: boolean = false): Function | Function[] {
        // key不对时，不处理
        if (!key) {
            console.error('Invalid event key', key);
            return null;
        }

        // 无fn时，返回值
        if (!fn) return this.map.get(key);

        // 设定为单方法或方法数组（类别冲突时，不处理）
        if (multiFn) {
            // 多处理方法
            let ary: Function | Function[] = this.map.get(key);
            if (!ary) {
                ary = [];
                this.map.set(key, ary);
                ary.push(fn);
            } else if (typeof ary == 'function') {
                console.error('Invalid event type', 'multiFn=true', key);
            } else {
                ary.push(fn);
            }
        } else {
            // 单处理方法
            let ary: Function | Function[] = this.map.get(key);
            if (!ary) {
                this.map.set(key, fn);
            } else if (typeof ary == 'function') {
                console.warn('Replace event', key);
            } else {
                console.error('Invalid event type', 'multiFn=false', key);
            }
        }

        return this.map.get(key);
    }

    public fire(key: number | string, ...args: any): any {
        const fn = this.map.get(key);
        if (!fn) {
            this.map.size && console.log('Undefined event:', key, '(', ...args, ')');
            return;
        }
        if (typeof fn == 'function') {
            return fn(...args);
        }

        let rs: any[] = [];
        fn.forEach(f => rs.push(f(...args)));
        return rs;
    }
    public tryFire(key: number | string, ...args: any): any {
        return this.map.get(key) ? this.fire(key, ...args) : undefined;
    }

    public off(key: number | string): void {
        this.map.delete(key);
    }

    public replace(key: number | string, fn: Function = null): void {
        this.off(key);
        this.on(key, fn);
    }

    public clear(): void {
        this.map.clear();
    }
}
