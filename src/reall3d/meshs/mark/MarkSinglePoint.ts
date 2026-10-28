// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Group, Vector3 } from 'three';
import { CSS3DSprite } from 'three/examples/jsm/Addons.js';
import { Events } from '../../events/Events';
import {
    AddMarkToWeakRef,
    DeleteMarkWeakRef,
    GetOptions,
    MarkFinish,
    StopAutoRotate,
    TraverseDisposeAndClear,
    ViewerNeedUpdate,
} from '../../events/EventConstants';
import { MarkData } from './data/MarkData';
import { MarkDataSinglePoint } from './data/MarkDataSinglePoint';

export class MarkSinglePoint extends Group {
    public readonly isCustomMark: boolean = true;
    private disposed: boolean = false;
    private events: Events;
    private data: MarkDataSinglePoint;
    private css3dTag: CSS3DSprite;

    constructor(events: Events, obj: Vector3 | MarkDataSinglePoint, name?: string) {
        super();
        this.events = events;
        const that = this;

        let data: MarkDataSinglePoint;
        if (obj instanceof Vector3) {
            const cnt: number = document.querySelectorAll('.mark-wrap-point').length + 1;
            data = {
                type: 'MarkSinglePoint',
                name: name || 'point' + Date.now(),
                point: obj.toArray(),
                iconName: '#svgicon-point2',
                iconColor: '#eeee00',
                iconOpacity: 0.8,
                mainTagColor: '#c4c4c4',
                mainTagBackground: '#2E2E30',
                mainTagOpacity: 0.8,
                title: '标记点' + cnt,
                note: '',
                scale: 0.01,
                intersectable: false,
            };
        } else {
            data = {
                type: 'MarkSinglePoint',
                name: obj.name || 'point' + Date.now(),
                point: [...obj.point],
                iconName: obj.iconName || '#svgicon-point2',
                iconColor: obj.iconColor || '#eeee00',
                iconOpacity: obj.iconOpacity || 0.8,
                mainTagColor: obj.mainTagColor || '#c4c4c4',
                mainTagBackground: obj.mainTagBackground || '#2E2E30',
                mainTagOpacity: obj.mainTagOpacity || 0.8,
                title: obj.title || '标记点',
                note: obj.note || '',
                scale: obj.scale || 0.01,
                intersectable: obj.intersectable || false,
            };
        }

        const tagWarp: HTMLDivElement = document.createElement('div');
        tagWarp.innerHTML = `<div style='flex-direction: column;align-items: center;display: flex;pointer-events: none;margin-bottom: 40px;'>
                                <span class="${data.name}" style="color:${data.mainTagColor};background:${data.mainTagBackground};opacity:${data.mainTagOpacity};padding:1px 5px 2px 5px;border-radius: 4px;margin-bottom: 5px;user-select: none;font-size: 12px;pointer-events: auto;">${data.title}</span>
                                <svg height="20" width="20" style="color:${data.iconColor};opacity:${data.iconOpacity};"><use href="${data.iconName}" fill="currentColor" /></svg>
                             </div>`;
        tagWarp.classList.add('mark-wrap-point', `mark-wrap-${data.name}`);
        tagWarp.style.position = 'absolute';
        tagWarp.style.borderRadius = '4px';
        tagWarp.style.cursor = 'pointer';
        tagWarp.onclick = () => {
            if (that.events.fire(GetOptions).markMode) return;
            // @ts-ignore
            const onActiveMark = parent?.onActiveMark;
            onActiveMark?.(that.getMarkData(true));
            that.events.fire(StopAutoRotate);
        };
        tagWarp.oncontextmenu = (e: MouseEvent) => e.preventDefault();

        const css3dTag = new CSS3DSprite(tagWarp);
        css3dTag.position.set(data.point[0], data.point[1], data.point[2]);
        css3dTag.element.style.pointerEvents = 'none';
        css3dTag.scale.set(data.scale, data.scale, data.scale);

        that.data = data;
        that.css3dTag = css3dTag;
        that.add(css3dTag);
        events.fire(AddMarkToWeakRef, that);
    }

    /**
     * 绘制更新
     */
    public drawUpdate(data?: MarkDataSinglePoint, saveData: boolean = true) {
        if (this.disposed) return;
        const that = this;

        if (data?.iconName) {
            saveData && (that.data.iconName = data.iconName);
            const svg: SVGElement = this.css3dTag.element.querySelector(`.mark-wrap-${that.data.name} svg`);
            svg.innerHTML = `<use href="${data.iconName}" fill="currentColor" />`;
        }
        if (data?.iconColor) {
            saveData && (that.data.iconColor = data.iconColor);
            const svg: SVGElement = this.css3dTag.element.querySelector(`.mark-wrap-${that.data.name} svg`);
            svg.style.color = data.iconColor;
        }
        if (data?.iconOpacity) {
            saveData && (that.data.iconOpacity = data.iconOpacity);
            const svg: SVGElement = this.css3dTag.element.querySelector(`.mark-wrap-${that.data.name} svg`);
            svg.style.opacity = data.iconOpacity.toString();
        }
        if (data?.mainTagColor) {
            saveData && (that.data.mainTagColor = data.mainTagColor);
            (this.css3dTag.element.querySelector(`.${that.data.name}`) as HTMLSpanElement).style.color = data.mainTagColor;
        }
        if (data?.mainTagBackground) {
            saveData && (that.data.mainTagBackground = data.mainTagBackground);
            (this.css3dTag.element.querySelector(`.${that.data.name}`) as HTMLSpanElement).style.background = data.mainTagBackground;
        }
        if (data?.mainTagOpacity) {
            saveData && (that.data.mainTagOpacity = data.mainTagOpacity);
            (this.css3dTag.element.querySelector(`.${that.data.name}`) as HTMLSpanElement).style.opacity = data.mainTagOpacity.toString();
        }
        if (data?.title !== undefined) {
            saveData && (that.data.title = data.title);
            (this.css3dTag.element.querySelector(`.${that.data.name}`) as HTMLSpanElement).innerText = data.title;
        }
        if (data?.note !== undefined) {
            saveData && (that.data.note = data.note);
        }

        that.events.fire(ViewerNeedUpdate);
    }

    public resetMeterScale(markData: any) {
        if (markData?.meterScale === undefined) return;
        this.events.fire(GetOptions).meterScale = markData.meterScale;
    }

    /**
     * 绘制结束
     */
    public drawFinish() {
        if (this.disposed) return;
        const that = this;
        that.events.fire(MarkFinish);

        // @ts-ignore
        const onActiveMark = parent?.onActiveMark;
        const data: any = that.getMarkData(true);
        data.isNew = true;
        data.meterScale = that.events.fire(GetOptions).meterScale;
        onActiveMark?.(data);
    }

    public getMarkData(simple: boolean = false): MarkData {
        const data: MarkDataSinglePoint = { ...this.data };
        if (simple) {
            delete data.point;
        } else {
            data.point = [...data.point];
        }
        return data;
    }

    public isIntersectable(): boolean {
        return this.data.intersectable;
    }

    public dispose() {
        if (this.disposed) return;
        const that = this;
        that.disposed = true;

        that.events.fire(TraverseDisposeAndClear, that);
        that.removeFromParent();
        that.events.fire(DeleteMarkWeakRef, that);

        const wrap: HTMLDivElement = document.querySelector(`.mark-wrap-${that.data.name}`);
        wrap?.parentElement?.removeChild?.(wrap);

        that.events = null;
        that.data = null;
        that.css3dTag = null;
    }
}
