// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Vector3, MathUtils } from 'three';
import { Events } from '../events/Events';
import {
    GetCanvas,
    KeyActionCheckAndExecute,
    RaycasterRayIntersectPoints,
    SelectPointAndLookAt,
    MarkFinish,
    CancelCurrentMark,
    MapGetSplatMesh,
    MapSplatMeshRotateX,
    MapSplatMeshRotateY,
    MapSplatMeshRotateZ,
    GetCameraPosition,
    GetCameraLookAt,
    MapSplatMeshMoveY,
    GetOptions,
    AddFlyPosition,
    ClearFlyPosition,
    Flying,
    FlySavePositions,
    OnViewerDispose,
    FlyingPause,
    StopBgAudio,
} from '../events/EventConstants';
import { SplatMesh } from '../meshs/splatmesh/SplatMesh';
import { MarkDistanceLine } from '../meshs/mark/MarkDistanceLine';
import { MarkMultiLines } from '../meshs/mark/MarkMultiLines';
import { MarkMultiPlans } from '../meshs/mark/MarkMulitPlans';
import { MarkCirclePlan } from '../meshs/mark/MarkCirclePlan';
import { Reall3dMapViewerOptions } from '../mapviewer/Reall3dMapViewerOptions';
import { globalEv } from '../events/GlobalEV';

class MouseState {
    public down: number = 0;
    public move: boolean = false;
    public downTime: number = 0;
    public isDbClick: boolean = false;
    public x: number = 0;
    public y: number = 0;
    public lastClickX: number = 0;
    public lastClickY: number = 0;
    public lastClickPointTime: number = 0;
    public lastMovePoint: Vector3 = null;
    public lastMovePointTime: number = 0;
}

export function setupMapEventListener(events: Events) {
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);
    let keySet: Set<string> = new Set();

    let disposed: boolean;
    let mouseState: MouseState = new MouseState();
    let lastActionTome: number;

    on(KeyActionCheckAndExecute, () => {
        if (!keySet.size) return;

        const opts: Reall3dMapViewerOptions = fire(GetOptions);
        if (!opts.enableKeyboard) return keySet.clear();
        const canEdit = opts.editMode;

        // if (opts.markMode && keySet.has('Escape')) {
        //     fire(CancelCurrentMark);
        //     keySet.clear();
        //     return;
        // }

        if (keySet.has('Escape')) {
            globalEv.fire(StopBgAudio);
            keySet.clear();
            return;
        }

        if (keySet.has('KeyH')) {
            const splatMesh: SplatMesh = fire(MapGetSplatMesh);
            splatMesh && (splatMesh.visible = !splatMesh.visible);
            keySet.clear();
        } else if (keySet.has('Equal')) {
            if (canEdit) {
                const splatMesh: SplatMesh = fire(MapGetSplatMesh);
                if (!splatMesh || !splatMesh.visible) return keySet.clear();
                if (keySet.has('KeyX')) {
                    const angleInRadians = MathUtils.degToRad(0.1);
                    splatMesh.rotateOnAxis(new Vector3(1, 0, 0), angleInRadians);
                } else {
                    splatMesh.scale.set(splatMesh.scale.x + 0.01, splatMesh.scale.y + 0.01, splatMesh.scale.z + 0.01);
                }
            } else {
                fire(AddFlyPosition);
                keySet.clear();
            }
        } else if (keySet.has('Minus')) {
            if (canEdit) {
                const splatMesh: SplatMesh = fire(MapGetSplatMesh);
                if (!splatMesh || !splatMesh.visible) return keySet.clear();
                if (keySet.has('KeyX')) {
                    const angleInRadians = MathUtils.degToRad(-0.1);
                    splatMesh.rotateOnAxis(new Vector3(1, 0, 0), angleInRadians);
                } else {
                    splatMesh.scale.set(splatMesh.scale.x - 0.01, splatMesh.scale.y - 0.01, splatMesh.scale.z - 0.01);
                }
            } else {
                fire(ClearFlyPosition);
                keySet.clear();
            }
        } else if (keySet.has('KeyP')) {
            fire(Flying, true);
            keySet.clear();
        } else if (keySet.has('ArrowUp')) {
            if (canEdit) {
                const splatMesh: SplatMesh = fire(MapGetSplatMesh);
                splatMesh && splatMesh.visible && (splatMesh.position.z += 0.1);
            }
            // keySet.clear();
        } else if (keySet.has('ArrowDown')) {
            if (canEdit) {
                const splatMesh: SplatMesh = fire(MapGetSplatMesh);
                splatMesh && splatMesh.visible && (splatMesh.position.z -= 0.1);
            }
            // keySet.clear();
        } else if (keySet.has('ArrowRight')) {
            if (canEdit) {
                const splatMesh: SplatMesh = fire(MapGetSplatMesh);
                splatMesh && splatMesh.visible && (splatMesh.position.x += 0.1);
            }
            // keySet.clear();
        } else if (keySet.has('ArrowLeft')) {
            if (canEdit) {
                const splatMesh: SplatMesh = fire(MapGetSplatMesh);
                splatMesh && splatMesh.visible && (splatMesh.position.x -= 0.1);
            }
            // keySet.clear();
        } else if (keySet.has('KeyU')) {
            if (canEdit) {
                const splatMesh: SplatMesh = fire(MapGetSplatMesh);
                if (splatMesh) {
                    const meta = splatMesh.meta || {};
                    meta.transform = splatMesh.matrix.toArray();
                    // fire(HttpPostMetaData, JSON.stringify(meta, null, 2), splatMesh.url);
                }
            }
            // keySet.clear();
        } else if (keySet.has('KeyQ')) {
            canEdit && fire(MapSplatMeshRotateX, 0.1);
        } else if (keySet.has('KeyW')) {
            canEdit && fire(MapSplatMeshRotateY, 0.1);
        } else if (keySet.has('KeyE')) {
            canEdit && fire(MapSplatMeshRotateZ, 0.1);
        } else if (keySet.has('KeyA')) {
            canEdit && fire(MapSplatMeshRotateX, -0.1);
        } else if (keySet.has('KeyS')) {
            canEdit && fire(MapSplatMeshRotateY, -0.1);
        } else if (keySet.has('KeyD')) {
            canEdit && fire(MapSplatMeshRotateZ, -0.1);
        } else if (keySet.has('KeyY')) {
            if (canEdit) {
                fire(MapSplatMeshMoveY, keySet.has('ShiftLeft') || keySet.has('ShiftRight') ? -0.1 : 0.1);
            } else {
                fire(FlySavePositions, true);
                keySet.clear();
            }
        } else if (keySet.has('KeyC')) {
            console.info('position=', (fire(GetCameraPosition) as Vector3).toArray(), 'lookat=', (fire(GetCameraLookAt) as Vector3).toArray());
        }
    });

    const keydownEventListener = (e: KeyboardEvent) => {
        if (e.target['type'] === 'text') return;

        if (disposed || e.code === 'F5') return;
        if (e.code === 'AudioVolumeDown' || e.code === 'AudioVolumeUp') return;
        e.preventDefault();
        keySet.add(e.code);
        lastActionTome = Date.now();
    };

    const keyupEventListener = (e: KeyboardEvent) => {
        if (e.target['type'] === 'text') return;

        if (disposed) return;

        keySet.clear();
        lastActionTome = Date.now();
    };

    const blurEventListener = () => {
        keySet.clear();
    };

    const wheelEventListener = (e: MouseEvent) => {
        parent && setTimeout(() => window.focus());
        e.preventDefault();
        if (disposed) return;
        fire(FlyingPause);
        lastActionTome = Date.now();
    };

    const canvasContextmenuEventListener = async (e: MouseEvent) => {
        e.preventDefault();
        if (disposed) return;
        // const ps: Vector3[] = await fire(SelectPointAndLookAt, e.offsetX, e.offsetY);
        // fire(MapSplatMeshSetPosition, ps[0]);
        fire(FlyingPause);
        lastActionTome = Date.now();
    };

    let markDistanceLine: MarkDistanceLine;
    let markMultiLines: MarkMultiLines;
    let markMultiPlans: MarkMultiPlans;
    let markCirclePlan: MarkCirclePlan;

    on(CancelCurrentMark, () => {
        markDistanceLine?.dispose();
        markMultiLines?.dispose();
        markMultiPlans?.dispose();
        markCirclePlan?.dispose();
        markDistanceLine = null;
        markMultiLines = null;
        markMultiPlans = null;
        markCirclePlan = null;
        mouseState.lastMovePoint = null;
        fire(MarkFinish);
    });

    const canvasMousedownEventListener = async (e: MouseEvent) => {
        parent && setTimeout(() => window.focus());
        e.preventDefault();
        if (disposed) return;

        mouseState.down = e.button === 2 ? 2 : 1;
        mouseState.move = false;
        mouseState.isDbClick = Date.now() - mouseState.downTime < 300;

        fire(FlyingPause);
        lastActionTome = Date.now();
        mouseState.downTime = Date.now();
    };

    const canvasMousemoveEventListener = async (e: MouseEvent) => {
        e.preventDefault();
        if (disposed) return;

        if (mouseState.down) {
            mouseState.move = true;
            lastActionTome = Date.now();
        }

        // const opts: MapViewerOptions = fire(GetOptions);
        // if (opts.markMode) {
        //     const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY); // 显示提示点
        //     if (point && !mouseState.down && opts.markType === 'distance' && markDistanceLine) {
        //         markDistanceLine.drawUpdate({ endPoint: point.toArray() });
        //     } else if (!mouseState.down && opts.markType === 'circle' && markCirclePlan) {
        //         if (point) {
        //             markCirclePlan.drawUpdate(null, true, point);
        //             mouseState.lastMovePoint = point;
        //             mouseState.lastMovePointTime = Date.now();
        //         } else {
        //             mouseState.lastMovePoint = null;
        //             mouseState.lastMovePointTime = 0;
        //         }
        //     } else if (!mouseState.down && opts.markType === 'lines' && markMultiLines) {
        //         if (point) {
        //             markMultiLines.drawUpdate(null, true, point);
        //             mouseState.lastMovePoint = point;
        //             mouseState.lastMovePointTime = Date.now();
        //         } else {
        //             mouseState.lastMovePoint = null;
        //             mouseState.lastMovePointTime = 0;
        //         }
        //     } else if (!mouseState.down && opts.markType === 'plans' && markMultiPlans) {
        //         if (point) {
        //             markMultiPlans.drawUpdate(null, true, point);
        //             mouseState.lastMovePoint = point;
        //             mouseState.lastMovePointTime = Date.now();
        //         } else {
        //             mouseState.lastMovePoint = null;
        //             mouseState.lastMovePointTime = 0;
        //         }
        //     }
        //     // fire(ViewerNeedUpdate);
        // }
    };

    const canvasMouseupEventListener = async (e: MouseEvent) => {
        e.preventDefault();
        if (disposed) return;
        // const opts: MapViewerOptions = fire(GetOptions);

        // if (mouseState.isDbClick) {
        //     // 双击停止标注
        //     if (markMultiLines) {
        //         if (Math.abs(e.clientX - mouseState.lastClickX) < 2 && Math.abs(e.clientY - mouseState.lastClickY) < 2) {
        //             // 两次双击的屏幕距离差小于2，则判定为停止标注的有效双击
        //             markMultiLines.drawFinish(mouseState.lastClickPointTime > 0);
        //             markMultiLines = null;
        //             mouseState.lastMovePoint = null;
        //         }
        //     } else if (markMultiPlans) {
        //         if (Math.abs(e.clientX - mouseState.lastClickX) < 2 && Math.abs(e.clientY - mouseState.lastClickY) < 2) {
        //             // 两次双击的屏幕距离差小于2，则判定为停止标注的有效双击
        //             markMultiPlans.drawFinish(mouseState.lastClickPointTime > 0);
        //             markMultiPlans = null;
        //             mouseState.lastMovePoint = null;
        //         }
        //     }
        // }

        // if (opts.markMode) {
        //     if (mouseState.down === 1 && !mouseState.move && Date.now() - mouseState.downTime < 500) {
        //         if (opts.markType === 'point') {
        //             const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
        //             if (point) {
        //                 const markSinglePoint = new MarkSinglePoint(events, await fire(SelectMarkPoint, e.clientX, e.clientY));
        //                 fire(GetScene).add(markSinglePoint);
        //                 markSinglePoint.drawFinish();
        //             }
        //         } else if (opts.markType === 'distance') {
        //             if (!markDistanceLine) {
        //                 // 开始测量
        //                 const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
        //                 if (point) {
        //                     markDistanceLine = new MarkDistanceLine(events);
        //                     markDistanceLine.drawStart(point);
        //                     fire(GetScene).add(markDistanceLine);
        //                 }
        //             } else {
        //                 // 完成测量
        //                 const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
        //                 if (point) {
        //                     markDistanceLine.drawFinish(point);
        //                     markDistanceLine = null;
        //                 } else {
        //                     mouseState.isDbClick && fire(CancelCurrentMark); // 取消标记
        //                 }
        //             }
        //         } else if (opts.markType === 'lines') {
        //             if (!markMultiLines) {
        //                 // 开始
        //                 const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
        //                 if (point) {
        //                     markMultiLines = new MarkMultiLines(events);
        //                     markMultiLines.drawStart(point);
        //                     fire(GetScene).add(markMultiLines);
        //                 }
        //             } else {
        //                 // 继续
        //                 if (mouseState.lastMovePoint && fire(RaycasterRayDistanceToPoint, e.clientX, e.clientY, mouseState.lastMovePoint) < 0.03) {
        //                     // 点击位置与移动提示点相近，按选中提示点处理
        //                     markMultiLines.drawUpdate(null, true, mouseState.lastMovePoint, true);
        //                     mouseState.lastClickPointTime = Date.now();
        //                 } else {
        //                     // 按点击位置计算选点
        //                     const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
        //                     if (point) {
        //                         markMultiLines.drawUpdate(null, true, point, true);
        //                         mouseState.lastClickPointTime = Date.now();
        //                     } else {
        //                         mouseState.lastClickPointTime = 0;
        //                     }
        //                 }
        //             }
        //         } else if (opts.markType === 'plans') {
        //             if (!markMultiPlans) {
        //                 // 开始
        //                 const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
        //                 if (point) {
        //                     markMultiPlans = new MarkMultiPlans(events);
        //                     markMultiPlans.drawStart(point);
        //                     fire(GetScene).add(markMultiPlans);
        //                 }
        //             } else {
        //                 // 继续
        //                 if (mouseState.lastMovePoint && fire(RaycasterRayDistanceToPoint, e.clientX, e.clientY, mouseState.lastMovePoint) < 0.03) {
        //                     // 点击位置与移动提示点相近，按选中提示点处理
        //                     markMultiPlans.drawUpdate(null, true, mouseState.lastMovePoint, true);
        //                     mouseState.lastClickPointTime = Date.now();
        //                 } else {
        //                     // 按点击位置计算选点
        //                     const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
        //                     if (point) {
        //                         markMultiPlans.drawUpdate(null, true, point, true);
        //                         mouseState.lastClickPointTime = Date.now();
        //                     } else {
        //                         mouseState.lastClickPointTime = 0;
        //                     }
        //                 }
        //             }
        //         } else if (opts.markType === 'circle') {
        //             if (!markCirclePlan) {
        //                 // 开始
        //                 const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
        //                 if (point) {
        //                     markCirclePlan = new MarkCirclePlan(events);
        //                     markCirclePlan.drawStart(point);
        //                     fire(GetScene).add(markCirclePlan);
        //                 }
        //             } else {
        //                 // 完成
        //                 const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
        //                 if (point) {
        //                     markCirclePlan.drawFinish(point);
        //                     markCirclePlan = null;
        //                 } else {
        //                     mouseState.isDbClick && fire(CancelCurrentMark); // 取消标记
        //                 }
        //             }
        //         }

        //         mouseState.lastClickX = e.clientX;
        //         mouseState.lastClickY = e.clientY;
        //     }
        // }

        // mouseState.down === 2 && !mouseState.move && fire(SelectPointAndLookAt, e.clientX, e.clientY); // 右击不移动，调整旋转中心

        mouseState.down = 0;
        mouseState.move = false;
        lastActionTome = Date.now();
    };

    function canvasTouchstartEventListener(event: TouchEvent) {
        event.preventDefault();
        if (disposed) return;
        fire(FlyingPause);
        mouseState.down = event.touches.length;
        if (mouseState.down === 1) {
            mouseState.move = false;
            mouseState.x = event.touches[0].clientX;
            mouseState.y = event.touches[0].clientY;
        }
    }
    function canvasTouchmoveEventListener(event: TouchEvent) {
        if (event.touches.length === 1) {
            mouseState.move = true;
        }
    }
    function canvasTouchendEventListener(event: TouchEvent) {
        if (mouseState.down === 1 && !mouseState.move) {
            fire(SelectPointAndLookAt, mouseState.x, mouseState.y);
        }
    }

    window.addEventListener('keydown', keydownEventListener);
    window.addEventListener('keyup', keyupEventListener);
    window.addEventListener('blur', blurEventListener);
    window.addEventListener('wheel', wheelEventListener, { passive: false });
    setTimeout(() => {
        const canvas: HTMLCanvasElement = fire(GetCanvas);
        canvas.addEventListener('contextmenu', canvasContextmenuEventListener);
        canvas.addEventListener('mousedown', canvasMousedownEventListener);
        canvas.addEventListener('mousemove', canvasMousemoveEventListener);
        canvas.addEventListener('mouseup', canvasMouseupEventListener);
        canvas.addEventListener('touchstart', canvasTouchstartEventListener, { passive: false });
        canvas.addEventListener('touchmove', canvasTouchmoveEventListener, { passive: false });
        canvas.addEventListener('touchend', canvasTouchendEventListener, { passive: false });
    }, 10);

    on(
        OnViewerDispose,
        () => {
            disposed = true;
            window.removeEventListener('keydown', keydownEventListener);
            window.removeEventListener('keyup', keyupEventListener);
            window.removeEventListener('blur', blurEventListener);
            window.removeEventListener('wheel', wheelEventListener);
            const canvas: HTMLCanvasElement = fire(GetCanvas);
            canvas.removeEventListener('contextmenu', canvasContextmenuEventListener);
            canvas.removeEventListener('mousedown', canvasMousedownEventListener);
            canvas.removeEventListener('mousemove', canvasMousemoveEventListener);
            canvas.removeEventListener('mouseup', canvasMouseupEventListener);
            canvas.removeEventListener('touchstart', canvasTouchstartEventListener);
            canvas.removeEventListener('touchmove', canvasTouchmoveEventListener);
            canvas.removeEventListener('touchend', canvasTouchendEventListener);
        },
        true,
    );

    on(SelectPointAndLookAt, async (x: number, y: number) => {
        const rs: Vector3[] = await fire(RaycasterRayIntersectPoints, x, y);
        return rs;
    });
}
