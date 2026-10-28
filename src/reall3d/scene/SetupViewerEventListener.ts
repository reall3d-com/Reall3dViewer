// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Matrix4, PerspectiveCamera, Vector3, Scene, Quaternion, Intersection } from 'three';
import { Events } from '../events/Events';
import {
    GetCanvas,
    StopAutoRotate,
    GetOptions,
    StartAutoRotate,
    GetRenderer,
    GetCamera,
    KeyActionCheckAndExecute,
    SplatMeshSwitchDisplayMode,
    SplatUpdatePointMode,
    RotateAt,
    RotateLeft,
    RotateRight,
    RaycasterRayIntersectPoints,
    CameraSetLookAt,
    SelectPointAndLookAt,
    ControlPlaneSwitchVisible,
    GetCanvasSize,
    GetControls,
    ViewerNeedUpdate,
    ControlsUpdateRotateAxis,
    GetScene,
    SplatSetPointcloudMode,
    SplatSwitchDisplayMode,
    IsControlPlaneVisible,
    SplatUpdateLightFactor,
    SelectMarkPoint,
    SplatUpdateMarkPoint,
    ClearMarkPoint,
    GetCSS3DRenderer,
    RaycasterRayDistanceToPoint,
    MarkUpdateVisible,
    MetaSaveSmallSceneCameraInfo,
    MarkFinish,
    CancelCurrentMark,
    Flying,
    AddFlyPosition,
    ClearFlyPosition,
    PrintInfo,
    GetSplatMesh,
    OnViewerUpdate,
    FocusAabbCenter,
    GetAabbCenter,
    FlySavePositions,
    StopBgAudio,
    FlyingPause,
    MovePlayer,
    MovePlayerToTarget,
    OnViewerDispose,
    IsPlayerMode,
    IncreaseCameraFov,
    IsPlayerMode1,
    GetCSS2DRenderer,
    IsFlyMode,
    RaycasterRayIntersectMarks,
    IntersectsPhysicsObjects,
    OnCanvasMouseMove,
} from '../events/EventConstants';
import { Reall3dViewerOptions } from '../viewer/Reall3dViewerOptions';
import { SplatMesh } from '../meshs/splatmesh/SplatMesh';
import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { MarkDistanceLine } from '../meshs/mark/MarkDistanceLine';
import { MarkMultiLines } from '../meshs/mark/MarkMultiLines';
import { MarkSinglePoint } from '../meshs/mark/MarkSinglePoint';
import { MarkMultiPlans } from '../meshs/mark/MarkMulitPlans';
import { MarkCirclePlan } from '../meshs/mark/MarkCirclePlan';
import { globalEv } from '../events/GlobalEV';
import { QualityLevels } from '../utils/GlobalConstants';
import { CSS2DRenderer } from 'three/examples/jsm/Addons.js';
import { Mark3DSingleTag } from '../meshs/mark/Mark3DSingleTag';
import { CameraControls } from './SetupCameraControls';

class MouseState {
    public down: number = 0;
    public move: boolean = false;
    public downTime: number = 0;
    public isDbClick: boolean = false;
    public x: number = 0;
    public y: number = 0;
    public downX: number = 0;
    public downY: number = 0;
    public lastClickX: number = 0;
    public lastClickY: number = 0;
    public lastClickPointTime: number = 0;
    public lastMovePoint: Vector3 = null;
    public lastMovePointTime: number = 0;
    public touchStartDistance = 0; // 双指刚开始触摸时的距离
    public touchCurrentDistance = 0; // 双指实时距离
    public isPinching = false; // 是否正在双指缩放
}

export function setupViewerEventListener(events: Events) {
    const on = (key: number | string, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number | string, ...args: any): any => events.fire(key, ...args);
    const canvas: HTMLCanvasElement = fire(GetCanvas);
    let keySet: Set<string> = new Set();

    let disposed: boolean;
    let mouseState: MouseState = new MouseState();
    let lastActionTome: number;

    on(StartAutoRotate, () => {
        fire(GetControls).autoRotate = fire(GetOptions).autoRotate = true;
    });
    on(StopAutoRotate, (flyDisable: boolean = true) => {
        fire(GetControls).autoRotate = fire(GetOptions).autoRotate = false;
        // flyDisable && fire(FlyDisable);
        flyDisable && fire(FlyingPause);
    });

    on(RotateAt, (rotateLeft: boolean = true) => {
        if (disposed) return;
        const controls: CameraControls = fire(GetControls);
        const angle = rotateLeft ? Math.PI / 128 : -(Math.PI / 128);
        const matrix4: Matrix4 = new Matrix4().makeRotationAxis(new Vector3(0, 0, -1).transformDirection(controls.object.matrixWorld), angle);
        controls.object.up.transformDirection(matrix4);
        fire(ViewerNeedUpdate);
    });
    on(RotateLeft, () => {
        if (disposed) return;
        events.fire(RotateAt, true);
    });
    on(RotateRight, () => {
        if (disposed) return;
        events.fire(RotateAt, false);
    });

    on(SplatSetPointcloudMode, (isPointcloudMode?: boolean) => {
        const opts: Reall3dViewerOptions = fire(GetOptions);
        isPointcloudMode ??= !opts.pointcloudMode;
        opts.pointcloudMode = isPointcloudMode;
        const scene: Scene = fire(GetScene);
        scene.traverse((obj: any) => obj instanceof SplatMesh && (obj as SplatMesh).fire(SplatUpdatePointMode, isPointcloudMode));
    });
    on(SplatSwitchDisplayMode, () => {
        const scene: Scene = fire(GetScene);
        scene.traverse((obj: any) => obj instanceof SplatMesh && (obj as SplatMesh).fire(SplatMeshSwitchDisplayMode));
    });
    on(SplatUpdateLightFactor, (lightFactor: number) => {
        const scene: Scene = fire(GetScene);
        scene.traverse((obj: any) => obj instanceof SplatMesh && (obj as SplatMesh).fire(SplatUpdateLightFactor, lightFactor));
    });
    on(FocusAabbCenter, () => {
        const scene: Scene = fire(GetScene);
        let splat: SplatMesh;
        scene.traverse((obj: any) => obj instanceof SplatMesh && (splat = obj));
        splat && fire(CameraSetLookAt, splat.fire(GetAabbCenter));
    });

    on(KeyActionCheckAndExecute, () => {
        if (!keySet.size) return;

        const opts: Reall3dViewerOptions = fire(GetOptions);
        if (!opts.enableKeyboard) return keySet.clear();

        if (opts.markMode && keySet.has('Escape')) {
            fire(CancelCurrentMark);
            keySet.clear();
            return;
        }

        if (fire(IsPlayerMode)) {
            const forward = keySet.has('KeyW') || keySet.has('ArrowUp');
            const backward = keySet.has('KeyS') || keySet.has('ArrowDown');
            const left = keySet.has('KeyA') || keySet.has('ArrowLeft');
            const right = keySet.has('KeyD') || keySet.has('ArrowRight');
            const run = keySet.has('ShiftLeft') || keySet.has('ShiftRight');
            fire(MovePlayer, forward, backward, left, right, run);
            if (keySet.has('KeyY')) {
                fire(FlySavePositions, false);
                fire(MetaSaveSmallSceneCameraInfo);
                keySet.clear();
            } else if (keySet.has('Escape')) {
                globalEv.fire(StopBgAudio);
                keySet.clear();
                // } else if (keySet.has('ArrowLeft')) {
                //     fire(RotateLeft);
                //     fire(ControlPlaneSwitchVisible, true);
                //     keySet.clear();
                // } else if (keySet.has('ArrowRight')) {
                //     fire(RotateRight);
                //     fire(ControlPlaneSwitchVisible, true);
                //     keySet.clear();
            }
            return;
        }

        if (keySet.has('Space')) {
            opts.bigSceneMode ? fire(SplatSetPointcloudMode) : fire(SplatSwitchDisplayMode);
            keySet.clear();
        } else if (keySet.has('Escape')) {
            globalEv.fire(StopBgAudio);
            keySet.clear();
        } else if (keySet.has('KeyR')) {
            opts.autoRotate ? fire(StopAutoRotate) : fire(StartAutoRotate);
            keySet.clear();
        } else if (keySet.has('KeyM')) {
            fire(MarkUpdateVisible, !opts.markVisible);
            keySet.clear();
        } else if (keySet.has('ArrowLeft')) {
            fire(RotateLeft);
            fire(ControlPlaneSwitchVisible, true);
            keySet.clear();
        } else if (keySet.has('ArrowRight')) {
            fire(RotateRight);
            fire(ControlPlaneSwitchVisible, true);
            keySet.clear();
        } else if (keySet.has('KeyP')) {
            fire(Flying, true);
            keySet.clear();
        } else if (keySet.has('Equal')) {
            fire(AddFlyPosition);
            keySet.clear();
        } else if (keySet.has('Minus')) {
            fire(ClearFlyPosition);
            keySet.clear();
        } else if (keySet.has('KeyY')) {
            fire(FlySavePositions, false);
            fire(MetaSaveSmallSceneCameraInfo);
            keySet.clear();
        } else if (keySet.has('KeyI')) {
            fire(PrintInfo);
            keySet.clear();
        } else if (keySet.has('KeyF')) {
            fire(FocusAabbCenter);
            keySet.clear();
        } else if (keySet.has('F2')) {
            !opts.bigSceneMode && window.open('/editor/index.html?url=' + encodeURIComponent((fire(GetSplatMesh) as SplatMesh).meta.url));
            keySet.clear();
        } else if (keySet.has('KeyW')) {
            moveForward(fire(GetControls), 0.15);
            keySet.clear();
        } else if (keySet.has('KeyS')) {
            moveBackward(fire(GetControls), 0.15);
            keySet.clear();
        } else if (keySet.has('KeyA')) {
            moveLeft(fire(GetControls), 0.15);
            keySet.clear();
        } else if (keySet.has('KeyD')) {
            moveRight(fire(GetControls), 0.15);
            keySet.clear();
        } else if (keySet.has('KeyQ')) {
            rotateTargetLeft(fire(GetControls));
            keySet.clear();
        } else if (keySet.has('KeyE')) {
            rotateTargetRight(fire(GetControls));
            keySet.clear();
        } else if (keySet.has('KeyC')) {
            rotateTargetUp(fire(GetControls));
            keySet.clear();
        } else if (keySet.has('KeyZ')) {
            rotateTargetDown(fire(GetControls));
            keySet.clear();
        }
    });

    on(SelectPointAndLookAt, async (x: number, y: number) => {
        if (mouseState.move) return; // 鼠标有移动时忽略
        const opts: Reall3dViewerOptions = fire(GetOptions);
        if (opts.disableRightClickFocus) return; // 禁用右击聚焦时忽略

        const rs: Vector3[] = await fire(RaycasterRayIntersectPoints, x, y);
        if (rs.length) {
            if (fire(IsPlayerMode)) {
                !opts.markMode && (await fire(MovePlayerToTarget, rs[0]));
            } else {
                fire(CameraSetLookAt, rs[0], true, false); // 最后参数false时平移效果，true时旋转效果
            }
        }
    });

    on(SelectMarkPoint, async (x: number, y: number) => {
        const scene: Scene = fire(GetScene);
        const splats: SplatMesh[] = [];
        scene.traverse(child => child instanceof SplatMesh && splats.push(child));

        const rs: Vector3[] = await fire(RaycasterRayIntersectPoints, x, y);
        if (rs.length) {
            splats.length && splats[0].fire(SplatUpdateMarkPoint, rs[0].x, rs[0].y, rs[0].z, true);
            return new Vector3(rs[0].x, rs[0].y, rs[0].z);
        } else {
            splats.length && splats[0].fire(SplatUpdateMarkPoint, 0, 0, 0, false);
        }
        return null;
    });

    // 彩色点云需要按点检测时使用
    on('SelectRgbPlyMarkPoint', async (x: number, y: number) => {
        const rs: Vector3[] = await fire('IntersectRgbPlyPoints', x, y);
        if (rs.length) {
            return new Vector3(rs[0].x, rs[0].y, rs[0].z);
        }
        return null;
    });

    on(ClearMarkPoint, async () => {
        const scene: Scene = fire(GetScene);
        const splats: SplatMesh[] = [];
        scene.traverse(child => child instanceof SplatMesh && splats.push(child));
        for (let i = 0; i < splats.length; i++) {
            splats[i].fire(SplatUpdateMarkPoint, 0, 0, 0, false);
        }
    });

    const keydownEventListener = (e: KeyboardEvent) => {
        if (e.target['type'] === 'text') return;

        if (disposed || e.code === 'F5') return;
        if (e.code === 'AudioVolumeDown' || e.code === 'AudioVolumeUp') return;
        e.preventDefault();

        lastActionTome = Date.now();
        const opts: Reall3dViewerOptions = fire(GetOptions);
        if (fire(IsPlayerMode)) {
            keySet.add(e.code);
            return;
        }

        if (e.code !== 'KeyR') {
            keySet.add(e.code);
            fire(StopAutoRotate);
        }
    };

    const keyupEventListener = (e: KeyboardEvent) => {
        if (disposed) return;
        fire(ViewerNeedUpdate);
        if (e.target['type'] === 'text') return;

        lastActionTome = Date.now();
        if (fire(IsPlayerMode)) {
            keySet.delete(e.code);
            return;
        }

        e.code === 'KeyR' && keySet.add(e.code);
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
            fire(ControlsUpdateRotateAxis);
        }
    };

    on(
        OnViewerUpdate,
        () => {
            if (fire(IsControlPlaneVisible) && Date.now() - lastActionTome > 2000) {
                fire(ControlPlaneSwitchVisible, false);
                // 旋转轴调整后 2 秒内无操作，自动保存相机位置
                fire(MetaSaveSmallSceneCameraInfo);
            }
        },
        true,
    );

    const blurEventListener = () => {
        keySet.clear();
    };

    const wheelEventListener = (e: WheelEvent) => {
        parent && setTimeout(() => window.focus());
        e.preventDefault();
        if (disposed) return;
        fire(StopAutoRotate);
        lastActionTome = Date.now();

        (fire(IsPlayerMode1) || fire(IsFlyMode)) && fire(IncreaseCameraFov, e.deltaY > 0);
    };

    const canvasContextmenuEventListener = (e: MouseEvent) => {
        e.preventDefault();
        if (disposed) return;
        fire(StopAutoRotate);
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
        fire(StopAutoRotate);

        mouseState.down = e.button === 2 ? 2 : 1;
        mouseState.move = false;
        mouseState.isDbClick = Date.now() - mouseState.downTime < 300;
        mouseState.downX = e.clientX;
        mouseState.downY = e.clientY;

        lastActionTome = Date.now();
        mouseState.downTime = Date.now();
    };

    const canvasMousemoveEventListener = async (e: MouseEvent) => {
        e.preventDefault();
        if (disposed) return;
        fire(ViewerNeedUpdate);

        if (mouseState.down) {
            mouseState.move = true;
            lastActionTome = Date.now();
        }

        const opts: Reall3dViewerOptions = fire(GetOptions);
        if (opts.markMode) {
            const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY); // 显示提示点
            if (point && !mouseState.down && opts.markType === 'distance' && markDistanceLine) {
                markDistanceLine.drawUpdate({ endPoint: point.toArray() });
            } else if (!mouseState.down && opts.markType === 'circle' && markCirclePlan) {
                if (point) {
                    markCirclePlan.drawUpdate(null, true, point);
                    mouseState.lastMovePoint = point;
                    mouseState.lastMovePointTime = Date.now();
                } else {
                    mouseState.lastMovePoint = null;
                    mouseState.lastMovePointTime = 0;
                }
            } else if (!mouseState.down && opts.markType === 'lines' && markMultiLines) {
                if (point) {
                    markMultiLines.drawUpdate(null, true, point);
                    mouseState.lastMovePoint = point;
                    mouseState.lastMovePointTime = Date.now();
                } else {
                    mouseState.lastMovePoint = null;
                    mouseState.lastMovePointTime = 0;
                }
            } else if (!mouseState.down && opts.markType === 'plans' && markMultiPlans) {
                if (point) {
                    markMultiPlans.drawUpdate(null, true, point);
                    mouseState.lastMovePoint = point;
                    mouseState.lastMovePointTime = Date.now();
                } else {
                    mouseState.lastMovePoint = null;
                    mouseState.lastMovePointTime = 0;
                }
            }
            // fire(ViewerNeedUpdate);
        }

        !mouseState.down && events.tryFire(OnCanvasMouseMove, e.clientX, e.clientY);
    };

    const diff = 5; // 偏差范围内按单击处理
    const canvasMouseupEventListener = async (e: MouseEvent) => {
        e.preventDefault();
        if (disposed) return;
        const opts: Reall3dViewerOptions = fire(GetOptions);

        if (mouseState.isDbClick) {
            // 双击停止标注
            if (markMultiLines) {
                if (Math.abs(e.clientX - mouseState.lastClickX) < 2 && Math.abs(e.clientY - mouseState.lastClickY) < 2) {
                    // 两次双击的屏幕距离差小于2，则判定为停止标注的有效双击
                    markMultiLines.drawFinish(mouseState.lastClickPointTime > 0);
                    markMultiLines = null;
                    mouseState.lastMovePoint = null;
                }
            } else if (markMultiPlans) {
                if (Math.abs(e.clientX - mouseState.lastClickX) < 2 && Math.abs(e.clientY - mouseState.lastClickY) < 2) {
                    // 两次双击的屏幕距离差小于2，则判定为停止标注的有效双击
                    markMultiPlans.drawFinish(mouseState.lastClickPointTime > 0);
                    markMultiPlans = null;
                    mouseState.lastMovePoint = null;
                }
            }
        }

        if (opts.markMode) {
            if (mouseState.down === 1 && !mouseState.move && Date.now() - mouseState.downTime < 500) {
                if (opts.markType === 'tag3d') {
                    const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
                    if (point) {
                        const mark3DSingletag = new Mark3DSingleTag(events, await fire(SelectMarkPoint, e.clientX, e.clientY));
                        fire(GetScene).add(mark3DSingletag);
                        mark3DSingletag.drawFinish();
                    }
                } else if (opts.markType === 'point') {
                    const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
                    if (point) {
                        const markSinglePoint = new MarkSinglePoint(events, await fire(SelectMarkPoint, e.clientX, e.clientY));
                        fire(GetScene).add(markSinglePoint);
                        markSinglePoint.drawFinish();
                    }
                } else if (opts.markType === 'distance') {
                    if (!markDistanceLine) {
                        // 开始测量
                        const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
                        if (point) {
                            markDistanceLine = new MarkDistanceLine(events);
                            markDistanceLine.drawStart(point);
                            fire(GetScene).add(markDistanceLine);
                        }
                    } else {
                        // 完成测量
                        const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
                        if (point) {
                            markDistanceLine.drawFinish(point);
                            markDistanceLine = null;
                        } else {
                            mouseState.isDbClick && fire(CancelCurrentMark); // 取消标记
                        }
                    }
                } else if (opts.markType === 'lines') {
                    if (!markMultiLines) {
                        // 开始
                        const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
                        if (point) {
                            markMultiLines = new MarkMultiLines(events);
                            markMultiLines.drawStart(point);
                            fire(GetScene).add(markMultiLines);
                        }
                    } else {
                        // 继续
                        if (mouseState.lastMovePoint && fire(RaycasterRayDistanceToPoint, e.clientX, e.clientY, mouseState.lastMovePoint) < 0.03) {
                            // 点击位置与移动提示点相近，按选中提示点处理
                            markMultiLines.drawUpdate(null, true, mouseState.lastMovePoint, true);
                            mouseState.lastClickPointTime = Date.now();
                        } else {
                            // 按点击位置计算选点
                            const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
                            if (point) {
                                markMultiLines.drawUpdate(null, true, point, true);
                                mouseState.lastClickPointTime = Date.now();
                            } else {
                                mouseState.lastClickPointTime = 0;
                            }
                        }
                    }
                } else if (opts.markType === 'plans') {
                    if (!markMultiPlans) {
                        // 开始
                        const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
                        if (point) {
                            markMultiPlans = new MarkMultiPlans(events);
                            markMultiPlans.drawStart(point);
                            fire(GetScene).add(markMultiPlans);
                        }
                    } else {
                        // 继续
                        if (mouseState.lastMovePoint && fire(RaycasterRayDistanceToPoint, e.clientX, e.clientY, mouseState.lastMovePoint) < 0.03) {
                            // 点击位置与移动提示点相近，按选中提示点处理
                            markMultiPlans.drawUpdate(null, true, mouseState.lastMovePoint, true);
                            mouseState.lastClickPointTime = Date.now();
                        } else {
                            // 按点击位置计算选点
                            const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
                            if (point) {
                                markMultiPlans.drawUpdate(null, true, point, true);
                                mouseState.lastClickPointTime = Date.now();
                            } else {
                                mouseState.lastClickPointTime = 0;
                            }
                        }
                    }
                } else if (opts.markType === 'circle') {
                    if (!markCirclePlan) {
                        // 开始
                        const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
                        if (point) {
                            markCirclePlan = new MarkCirclePlan(events);
                            markCirclePlan.drawStart(point);
                            fire(GetScene).add(markCirclePlan);
                        }
                    } else {
                        // 完成
                        const point: Vector3 = await fire(SelectMarkPoint, e.clientX, e.clientY);
                        if (point) {
                            markCirclePlan.drawFinish(point);
                            markCirclePlan = null;
                        } else {
                            mouseState.isDbClick && fire(CancelCurrentMark); // 取消标记
                        }
                    }
                }

                mouseState.lastClickX = e.clientX;
                mouseState.lastClickY = e.clientY;
            }
        }

        if (fire(IsPlayerMode)) {
            if (mouseState.down === 1 && !opts.markMode) {
                if (Math.abs(e.clientX - mouseState.downX) < diff && Math.abs(e.clientY - mouseState.downY) < diff) {
                    const intersect: Intersection<any> = fire(IntersectsPhysicsObjects, e.clientX, e.clientY);
                    await fire(MovePlayerToTarget, intersect?.point);
                }
            }
        } else if (fire(IsFlyMode)) {
            if (mouseState.down === 1 && !opts.markMode) {
                if (Math.abs(e.clientX - mouseState.downX) < diff && Math.abs(e.clientY - mouseState.downY) < diff) {
                    const mark = fire(RaycasterRayIntersectMarks, e.clientX, e.clientY);
                    globalEv.tryFire('OnClickMark', mark);
                }
            }
        } else {
            mouseState.down === 2 && !mouseState.move && fire(SelectPointAndLookAt, e.clientX, e.clientY); // 右击不移动，调整旋转中心
        }

        mouseState.down = 0;
        mouseState.move = false;
        lastActionTome = Date.now();
    };

    function getTwoFingerDistance(touch1: Touch, touch2: Touch): number {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    function canvasTouchstartEventListener(event: TouchEvent) {
        event.preventDefault();
        if (disposed) return;
        fire(StopAutoRotate);
        mouseState.down = event.touches.length;
        if (mouseState.down === 1) {
            mouseState.move = false;
            mouseState.x = event.touches[0].clientX;
            mouseState.y = event.touches[0].clientY;
            mouseState.downX = event.touches[0].clientX;
            mouseState.downY = event.touches[0].clientY;
        } else if (event.touches.length === 2) {
            mouseState.isPinching = true;
            mouseState.touchStartDistance = getTwoFingerDistance(event.touches[0], event.touches[1]);
        }
        lastActionTome = Date.now();
    }
    function canvasTouchmoveEventListener(event: TouchEvent) {
        if (event.touches.length === 1) {
            mouseState.move = true;
        } else if (event.touches.length === 2) {
            mouseState.touchCurrentDistance = getTwoFingerDistance(event.touches[0], event.touches[1]);
            const scale = mouseState.touchCurrentDistance / mouseState.touchStartDistance;
            mouseState.touchStartDistance = mouseState.touchCurrentDistance; // 支持连续缩放
            (fire(IsPlayerMode1) || fire(IsFlyMode)) && fire(IncreaseCameraFov, scale < 1);
        }
    }
    async function canvasTouchendEventListener(e: TouchEvent) {
        mouseState.isPinching = false;
        if (mouseState.down === 1 && Date.now() - lastActionTome > 300) return;

        const [clientX, clientY] = [e.changedTouches[0].clientX, e.changedTouches[0].clientY];

        if (fire(IsPlayerMode)) {
            if (mouseState.down === 1 && Math.abs(clientX - mouseState.downX) < diff && Math.abs(clientY - mouseState.downY) < diff) {
                const intersect: Intersection<any> = fire(IntersectsPhysicsObjects, clientX, clientY);
                await fire(MovePlayerToTarget, intersect?.point);
            }
        } else if (fire(IsFlyMode)) {
            if (mouseState.down === 1 && Math.abs(clientX - mouseState.downX) < diff && Math.abs(clientY - mouseState.downY) < diff) {
                const mark = fire(RaycasterRayIntersectMarks, clientX, clientY);
                globalEv.tryFire('OnClickMark', mark);
            }
        } else {
            mouseState.down === 1 && !mouseState.move && fire(SelectPointAndLookAt, clientX, clientY);
        }
    }

    window.addEventListener('keydown', keydownEventListener);
    window.addEventListener('keyup', keyupEventListener);
    window.addEventListener('blur', blurEventListener);
    canvas.addEventListener('wheel', wheelEventListener, { passive: false });
    canvas.addEventListener('contextmenu', canvasContextmenuEventListener);
    canvas.addEventListener('mousedown', canvasMousedownEventListener);
    canvas.addEventListener('mousemove', canvasMousemoveEventListener);
    canvas.addEventListener('mouseup', canvasMouseupEventListener);
    canvas.addEventListener('touchstart', canvasTouchstartEventListener, { passive: false });
    canvas.addEventListener('touchmove', canvasTouchmoveEventListener, { passive: false });
    canvas.addEventListener('touchend', canvasTouchendEventListener, { passive: false });

    window.addEventListener('resize', resize);
    resize();
    function resize() {
        const { width, height, top, left } = fire(GetCanvasSize, true);
        const camera: PerspectiveCamera = fire(GetCamera);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        const cSS3DRenderer: CSS3DRenderer = fire(GetCSS3DRenderer);
        cSS3DRenderer.setSize(width, height);
        cSS3DRenderer.domElement.style.position = 'absolute';
        cSS3DRenderer.domElement.style.left = `${left}px`;
        cSS3DRenderer.domElement.style.top = `${top}px`;
        const cSS2DRenderer: CSS2DRenderer = fire(GetCSS2DRenderer);
        cSS2DRenderer.setSize(width, height);
        cSS2DRenderer.domElement.style.position = 'absolute';
        cSS2DRenderer.domElement.style.left = `${left}px`;
        cSS2DRenderer.domElement.style.top = `${top}px`;
        const renderer = fire(GetRenderer);
        // renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.setPixelRatio(Math.min(devicePixelRatio, fire(GetOptions).qualityLevel > QualityLevels.Default5 ? 2 : 1));
        renderer.setSize(width, height);
    }

    on(
        OnViewerDispose,
        () => {
            disposed = true;
            window.removeEventListener('keydown', keydownEventListener);
            window.removeEventListener('keyup', keyupEventListener);
            window.removeEventListener('blur', blurEventListener);
            canvas.removeEventListener('wheel', wheelEventListener);
            canvas.removeEventListener('contextmenu', canvasContextmenuEventListener);
            canvas.removeEventListener('mousedown', canvasMousedownEventListener);
            canvas.removeEventListener('mousemove', canvasMousemoveEventListener);
            canvas.removeEventListener('mouseup', canvasMouseupEventListener);
            canvas.removeEventListener('touchstart', canvasTouchstartEventListener);
            canvas.removeEventListener('touchmove', canvasTouchmoveEventListener);
            canvas.removeEventListener('touchend', canvasTouchendEventListener);
            window.removeEventListener('resize', resize);
        },
        true,
    );

    // 使用当前相机的up向量定义水平面
    function moveCameraHorizontal(controls, direction, step = 0.012) {
        // 使用相机的up向量作为平面法线
        const planeNormal = controls.object.up.clone().normalize();

        // 将方向向量投影到以up向量为法线的平面上
        const projectedDirection = new Vector3().copy(direction).normalize().projectOnPlane(planeNormal).normalize();

        const moveVector = projectedDirection.multiplyScalar(step);

        const originalDamping = controls.enableDamping;
        controls.enableDamping = false;
        controls.object.position.add(moveVector);
        controls.target.add(moveVector);
        controls.update();
        controls.enableDamping = originalDamping;
    }
    // 左移
    function moveLeft(controls, step = 0.2) {
        const direction = new Vector3();
        controls.object.getWorldDirection(direction);
        const leftDir = new Vector3().crossVectors(controls.object.up, direction).normalize();

        moveCameraHorizontal(controls, leftDir, step);
    }
    // 右移
    function moveRight(controls, step = 0.2) {
        const direction = new Vector3();
        controls.object.getWorldDirection(direction);
        const rightDir = new Vector3().crossVectors(controls.object.up, direction).normalize().negate();

        moveCameraHorizontal(controls, rightDir, step);
    }
    // 前进
    function moveForward(controls, step = 0.2) {
        const forwardDir = new Vector3();
        controls.object.getWorldDirection(forwardDir);
        moveCameraHorizontal(controls, forwardDir, step);
    }
    // 后退
    function moveBackward(controls, step = 0.2) {
        const backwardDir = new Vector3();
        controls.object.getWorldDirection(backwardDir).negate();
        moveCameraHorizontal(controls, backwardDir, step);
    }

    /**
     * 相机位置不变，目标点顺时针转动（像人转动头部）
     * @param {OrbitControls} controls - 轨道控制器
     * @param {number} angle - 转动角度（弧度制）
     */
    function rotateTargetClockwise(controls, angle = 0.006) {
        // 获取相机当前位置和目标点位置
        const cameraPosition = controls.object.position.clone();
        const targetPosition = controls.target.clone();

        // 计算相机到目标的向量
        const direction = new Vector3().subVectors(targetPosition, cameraPosition);

        // 获取相机的上方向（旋转轴）
        const upVector = controls.object.up.clone().normalize();

        // 创建四元数表示顺时针旋转
        const quaternion = new Quaternion();
        quaternion.setFromAxisAngle(upVector, -angle); // 负角度表示顺时针

        // 应用旋转到方向向量
        direction.applyQuaternion(quaternion);

        // 计算新的目标点位置
        const newTargetPosition = new Vector3().addVectors(cameraPosition, direction);

        // 更新目标点
        controls.target.copy(newTargetPosition);
        controls.update();
    }
    // 左看
    function rotateTargetLeft(controls) {
        rotateTargetClockwise(controls, -0.01);
    }
    // 右看
    function rotateTargetRight(controls) {
        rotateTargetClockwise(controls, 0.01);
    }

    /**
     * 相机位置不变，目标点上下转动（像人抬头低头）
     * @param {OrbitControls} controls - 轨道控制器
     * @param {number} angle - 转动角度（弧度制），正数为抬头，负数为低头
     */
    function rotateTargetVertical(controls, angle = 0.006) {
        // 获取相机当前位置和目标点位置
        const cameraPosition = controls.object.position.clone();
        const targetPosition = controls.target.clone();

        // 计算相机到目标的向量
        const direction = new Vector3().subVectors(targetPosition, cameraPosition);

        // 获取相机的右侧方向（用于垂直旋转的轴）
        const forwardDir = new Vector3();
        controls.object.getWorldDirection(forwardDir);
        const rightVector = new Vector3().crossVectors(controls.object.up, forwardDir).normalize();

        // 创建四元数表示垂直旋转
        const quaternion = new Quaternion();
        quaternion.setFromAxisAngle(rightVector, angle);

        // 应用旋转到方向向量
        direction.applyQuaternion(quaternion);

        // 计算新的目标点位置
        const newTargetPosition = new Vector3().addVectors(cameraPosition, direction);

        // 更新目标点
        controls.target.copy(newTargetPosition);
        controls.update();
    }

    // 抬头
    function rotateTargetUp(controls, angle = 0.01) {
        rotateTargetVertical(controls, -angle);
    }

    // 低头
    function rotateTargetDown(controls, angle = 0.01) {
        rotateTargetVertical(controls, angle);
    }
}
