// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { MarkCirclePlan } from './MarkCirclePlan';
import {
    AddMarkToWeakRef,
    ClearMarkPoint,
    ComputePlansArea,
    ComputePlansCenter,
    ComputePoint3Area,
    GetCamera,
    GetCSS3DRenderer,
    GetMarkWarpElement,
    GetOptions,
    GetScene,
    MarkFinish,
    LoadSmallSceneMetaData,
    MetaMarkRemoveData,
    MetaMarkSaveData,
    MarkUpdateVisible,
    HttpPostMetaData,
    ViewerNeedUpdate,
    DeleteMarkWeakRef,
    GetMarkFromWeakRef,
    GetMarkDataByName,
    UpdateMarkByName,
    MetaSaveSmallSceneCameraInfo,
    GetCameraInfo,
    UpdateAllMarkByMeterScale,
    ReComputePlansArea,
    Information,
    GetCachedWaterMark,
    MetaSaveWatermark,
    OnSetFlyPositions,
    OnSetFlyTargets,
    GetSplatMesh,
    GetControls,
    OnViewerDispose,
    IsPlayerMode,
    GetPlayer,
    GetCSS2DRenderer,
    IsSplatShowDone,
    OnInitMarks,
    GetMarkList,
    RenderCSS2D3D,
} from './../../events/EventConstants';
import { MarkMultiLines } from './MarkMultiLines';
import { CSS2DRenderer, CSS3DRenderer } from 'three/examples/jsm/Addons.js';
import { Events } from '../../events/Events';
import { Group, Object3D, Vector3 } from 'three';
import { Reall3dViewerOptions } from '../../viewer/Reall3dViewerOptions';
import { MarkDistanceLine } from './MarkDistanceLine';
import { MarkData } from './data/MarkData';
import { MarkSinglePoint } from './MarkSinglePoint';
import { MarkMultiPlans } from './MarkMulitPlans';
import { MarkDataSinglePoint } from './data/MarkDataSinglePoint';
import { MarkDataMultiPlans } from './data/MarkDataMultiPlans';
import { MarkDataMultiLines } from './data/MarkDataMultiLines';
import { MarkDataDistanceLine } from './data/MarkDataDistanceLine';
import { MetaData } from '../../modeldata/MetaData';
import { Mark3DSingleTag } from './Mark3DSingleTag';
import { CameraControls } from '../../scene/SetupCameraControls';

export function setupMark(events: Events) {
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);
    const markMap: Map<string, WeakRef<any>> = new Map();

    const divMarkWarp: HTMLDivElement = document.createElement('div');
    divMarkWarp.classList.add('mark-warp');
    document.body.appendChild(divMarkWarp);

    const css2DRenderer = new CSS2DRenderer();
    css2DRenderer.setSize(innerWidth, innerHeight);
    css2DRenderer.domElement.style.position = 'absolute';
    css2DRenderer.domElement.style.top = '0px';
    css2DRenderer.domElement.style.pointerEvents = 'none';
    css2DRenderer.domElement.classList.add('css2d');
    divMarkWarp.appendChild(css2DRenderer.domElement);

    const css3DRenderer = new CSS3DRenderer();
    css3DRenderer.setSize(innerWidth, innerHeight);
    css3DRenderer.domElement.style.position = 'absolute';
    css3DRenderer.domElement.style.top = '0px';
    css3DRenderer.domElement.style.pointerEvents = 'none';
    css3DRenderer.domElement.classList.add('css3d');
    divMarkWarp.appendChild(css3DRenderer.domElement);

    on(GetMarkWarpElement, () => divMarkWarp);
    on(GetCSS3DRenderer, () => css3DRenderer);
    on(GetCSS2DRenderer, () => css2DRenderer);
    on(RenderCSS2D3D, () => [css3DRenderer, css2DRenderer].forEach(item => item.render(fire(GetScene), fire(GetCamera))));
    on(OnViewerDispose, () => document.body.removeChild(divMarkWarp), true);

    on(GetMarkList, (intersectable = true) => {
        const ary = [];
        markMap.forEach(item => {
            const mk = item.deref();
            mk?.isIntersectable?.() && ary.push(mk);
        });
        return ary;
    });
    on(AddMarkToWeakRef, (mark: any) => {
        const name: string = mark?.getMarkData?.()?.name || mark?.name;
        if (!name) return;
        markMap.set(name, new WeakRef(mark));
    });
    on(DeleteMarkWeakRef, (mark: any) => {
        const name: string = mark?.getMarkData?.()?.name || mark?.name;
        markMap.delete(name);
    });
    on(GetMarkFromWeakRef, (name: string): any => markMap.get(name)?.deref());
    on(UpdateMarkByName, (name: string, data: MarkDataSinglePoint | MarkDataMultiPlans | MarkDataMultiLines | MarkDataDistanceLine) => {
        const mark = fire(GetMarkFromWeakRef, name);
        if (!mark || !data) return;
        mark.drawUpdate?.(data);
    });
    on(GetMarkDataByName, (name: string): MarkDataSinglePoint | MarkDataMultiPlans | MarkDataMultiLines | MarkDataDistanceLine => {
        const mark = fire(GetMarkFromWeakRef, name);
        if (!mark) return {};
        return mark.getMarkData?.();
    });

    let splatShowDone = false;
    on(IsSplatShowDone, () => splatShowDone);

    on(MarkUpdateVisible, (visible?: boolean) => {
        splatShowDone = true;
        if (visible !== undefined) fire(GetOptions).markVisible = visible;
        fire(GetScene).traverse((child: Object3D) => child['isCustomMark'] && (child.visible = fire(GetOptions).markVisible));
        fire(ViewerNeedUpdate);
    });

    on(MetaSaveSmallSceneCameraInfo, async (): Promise<boolean> => {
        const marks = [];
        fire(GetScene).traverse((child: any) => {
            if (child.isCustomMark) {
                const data = child.getMarkData?.();
                data && marks.push(data);
            }
        });

        const meta: MetaData = fire(GetSplatMesh).meta || {};
        if (marks.length) {
            meta.marks = marks;
        } else {
            delete meta.marks;
        }
        meta.cameraInfo = fire(GetCameraInfo);

        if (fire(IsPlayerMode)) {
            const player: Group = fire(GetPlayer);
            if (player) {
                meta.player = meta.player || {};
                meta.player.position = player.position.toArray();
            }
        }

        return await fire(HttpPostMetaData, meta);
    });

    on(MetaMarkSaveData, async (): Promise<boolean> => {
        const marks = [];
        fire(GetScene).traverse((child: any) => {
            if (child.isCustomMark) {
                const data = child.getMarkData?.();
                data && marks.push(data);
            }
        });

        const meta: MetaData = fire(GetSplatMesh).meta || {};
        if (marks.length) {
            meta.marks = marks;
        } else {
            delete meta.marks;
        }

        return await fire(HttpPostMetaData, meta);
    });

    on(MetaMarkRemoveData, async (): Promise<boolean> => {
        const meta: MetaData = fire(GetSplatMesh).meta || {};
        delete meta.marks;

        const rs = await fire(HttpPostMetaData, meta);

        const marks: WeakRef<any>[] = [];
        markMap.forEach(item => marks.push(item));
        marks.forEach(item => item.deref()?.dispose?.());
        fire(ViewerNeedUpdate);

        return rs;
    });

    on(MetaSaveWatermark, async (): Promise<boolean> => {
        const marks = [];
        fire(GetScene).traverse((child: any) => {
            if (child.isCustomMark) {
                const data = child.getMarkData?.();
                data && marks.push(data);
            }
        });
        const meta: MetaData = fire(GetSplatMesh).meta || {};
        meta.watermark = fire(GetCachedWaterMark) || '';

        return await fire(HttpPostMetaData, meta);
    });

    on(LoadSmallSceneMetaData, (metaData: MetaData) => {
        if (metaData.meterScale) {
            fire(GetOptions).meterScale = metaData.meterScale;
            fire(Information, { scale: `1 : ${fire(GetOptions).meterScale} m` });
        }
        (fire(GetControls) as CameraControls).updateByOptions({ ...metaData, ...(metaData.cameraInfo || {}) });

        fire(OnInitMarks, metaData); // 初始化标注，隐藏待激活显示

        fire(OnSetFlyPositions, metaData.flyPositions || []);
        fire(OnSetFlyTargets, metaData.flyTargets || []);
    });

    on(OnInitMarks, (metaData: MetaData) => {
        if (metaData.meterScale) {
            fire(GetOptions).meterScale = metaData.meterScale;
            fire(Information, { scale: `1 : ${fire(GetOptions).meterScale} m` });
        }

        const marks = metaData.marks || [];

        // 初始化标注，隐藏待激活显示
        marks.forEach((data: MarkData) => {
            if (data.type === 'MarkSinglePoint') {
                // 单点
                const mark = new MarkSinglePoint(events, data);
                mark.visible = false;
                fire(GetScene).add(mark);
            } else if (data.type === 'Mark3DSingleTag') {
                const mark = new Mark3DSingleTag(events, data);
                mark.visible = false;
                fire(GetScene).add(mark);
            } else if (data.type === 'MarkDistanceLine') {
                // 测量距离
                const mark = new MarkDistanceLine(events);
                mark.draw(data);
                mark.visible = false;
                fire(GetScene).add(mark);
            } else if (data.type === 'MarkMultiLines') {
                // 折线
                const mark = new MarkMultiLines(events);
                mark.draw(data, true);
                mark.visible = false;
                fire(GetScene).add(mark);
            } else if (data.type === 'MarkMultiPlans') {
                // 多面
                const mark = new MarkMultiPlans(events);
                mark.draw(data, true);
                mark.visible = false;
                fire(GetScene).add(mark);
            } else if (data.type === 'MarkCirclePlan') {
                // 圆面
                const mark = new MarkCirclePlan(events);
                mark.draw(data);
                mark.visible = false;
                fire(GetScene).add(mark);
            }
        });
    });

    on(MarkFinish, () => {
        const opts: Reall3dViewerOptions = fire(GetOptions);
        opts.markMode = false;
        fire(ClearMarkPoint);
        fire(ViewerNeedUpdate);
    });

    on(UpdateAllMarkByMeterScale, (markData: any, saveData: boolean = true) => {
        const meterScale: number = markData?.meterScale;
        if (!meterScale) return;
        if (typeof meterScale !== 'number' || meterScale <= 0) {
            console.warn('meterScale is not a number or <= 0', markData);
            return;
        }

        saveData && (fire(GetOptions).meterScale = markData.meterScale);
        fire(Information, { scale: `1 : ${meterScale} m` });

        for (const value of markMap.values()) {
            const mark = value.deref();
            if (!mark) continue;

            if (mark instanceof MarkDistanceLine) {
                (mark as MarkDistanceLine).updateByMeterScale(meterScale);
            } else if (mark instanceof MarkMultiLines) {
                (mark as MarkMultiLines).updateByMeterScale(meterScale);
            } else if (mark instanceof MarkMultiPlans) {
                (mark as MarkMultiPlans).updateByMeterScale(meterScale);
            }
        }
    });

    on(ComputePlansCenter, (positions: number[]): Vector3 => {
        const p0 = new Vector3().fromArray(positions.slice(0, 3));
        const p1 = new Vector3().fromArray(positions.slice(-6, -3));
        const p2 = new Vector3().fromArray(positions.slice(-3));
        const eq02 = p0.distanceTo(p2) < 0.0001;
        const eq12 = p1.distanceTo(p2) < 0.0001;
        const center = new Vector3();
        const cnt = eq02 || eq12 ? positions.length / 3 - 1 : positions.length / 3;
        for (let i = 0; i < cnt; i++) {
            center.add(new Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]));
        }
        center.divideScalar(cnt);
        return center;
    });

    on(ComputePlansArea, (positions: number[]): number => {
        const points: Vector3[] = [];
        for (let i = 0, cnt = positions.length / 3; i < cnt; i++) {
            points.push(new Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]));
        }
        const eq1 = points[0].distanceTo(points[points.length - 1]) < 0.0001;
        const eq2 = points[points.length - 2].distanceTo(points[points.length - 1]) < 0.0001;
        (eq1 || eq2) && points.pop();

        if (points.length < 3) return 0;

        let total: number = 0;
        for (let i = 0, cnt = points.length - 2; i < cnt; i++) {
            total += fire(ComputePoint3Area, points[0], points[i + 1], points[i + 2], fire(GetOptions).meterScale);
        }
        return total;
    });

    on(ReComputePlansArea, (points: Vector3[], meterScale: number): number => {
        let total: number = 0;
        for (let i = 0, cnt = points.length - 2; i < cnt; i++) {
            total += fire(ComputePoint3Area, points[0], points[i + 1], points[i + 2], meterScale);
        }
        return total;
    });

    on(ComputePoint3Area, (p1: Vector3, p2: Vector3, p3: Vector3, meterScale: number): number => {
        const a = p1.distanceTo(p2) * meterScale;
        const b = p2.distanceTo(p3) * meterScale;
        const c = p3.distanceTo(p1) * meterScale;
        const s = (a + b + c) / 2;
        return Math.sqrt(s * (s - a) * (s - b) * (s - c));
    });
}
