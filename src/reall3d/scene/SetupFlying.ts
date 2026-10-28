// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { CatmullRomCurve3, Vector3 } from 'three';
import { Events } from '../events/Events';
import {
    AddFlyPosition,
    ClearFlyPosition,
    FlySavePositions,
    GetControls,
    GetFlyPositionArray,
    GetFlyPositions,
    GetFlyTargetArray,
    GetSplatMesh,
    HttpPostMetaData,
    OnSetFlyPositions,
    OnSetFlyTargets,
    OnViewerAfterUpdate,
    StopAutoRotate,
    Flying,
    FlyDisable,
    FlyEnable,
    FlyOnce,
    GetMeta,
    FlyingPause,
    FlyingPlay,
    OnSetFlyDuration,
    ShowJoystick,
    MovePlayerByAngle,
    RunLoopByFrame,
    OnViewerDispose,
    IsPlayerMode,
} from '../events/EventConstants';
import { MetaData } from '../modeldata/MetaData';
import { ScenesJsonData } from '../mapviewer/Reall3dMapViewer';
import { addDynamicStyles, showSpeedText } from '../utils/CommonUtils';
import nipplejs from 'nipplejs';
import { CameraControls } from './SetupCameraControls';
import { globalEv } from '../events/GlobalEV';
import { isMobile } from '../utils/GlobalConstants';

export function setupFlying(events: Events) {
    const tryFire = (key: number, ...args: any): any => events.tryFire(key, ...args);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);

    const flyPositions: Vector3[] = [];
    const flyTargets: Vector3[] = [];
    let flyEnable: boolean = false;
    let flyOnceDone: boolean = false;
    let flyDuration = 125 * 1000;

    on(FlyDisable, () => (flyEnable = false));
    on(FlyEnable, () => (flyEnable = true));
    on(GetFlyPositions, () => flyPositions);
    on(GetFlyPositionArray, () => {
        const rs = [];
        for (let i = 0, max = flyPositions.length; i < max; i++) {
            rs.push(...flyPositions[i].toArray());
        }
        return rs;
    });
    on(GetFlyTargetArray, () => {
        const rs = [];
        for (let i = 0, max = flyTargets.length; i < max; i++) {
            rs.push(...flyTargets[i].toArray());
        }
        return rs;
    });
    on(OnSetFlyPositions, (v3s: number[]) => {
        for (let i = 0, max = (v3s.length / 3) | 0; i < max; i++) {
            flyPositions[i] = new Vector3(v3s[i * 3 + 0], v3s[i * 3 + 1], v3s[i * 3 + 2]);
        }
    });
    on(OnSetFlyTargets, (v3s: number[]) => {
        for (let i = 0, max = (v3s.length / 3) | 0; i < max; i++) {
            flyTargets[i] = new Vector3(v3s[i * 3 + 0], v3s[i * 3 + 1], v3s[i * 3 + 2]);
        }
    });
    on(OnSetFlyDuration, (duration: number = 125 * 1000) => {
        flyDuration = duration;
    });
    on(AddFlyPosition, () => {
        const controls: CameraControls = fire(GetControls);
        flyPositions.push(controls.object.position.clone());
        flyTargets.push(controls.target.clone());
    });
    on(ClearFlyPosition, () => {
        flyPositions.length = 0;
        flyTargets.length = 0;
    });
    on(FlySavePositions, async (bSave: boolean = true) => {
        const obj: MetaData = fire(GetMeta);
        if ((obj as any).scenes) {
            // 地图
            const meta = obj as ScenesJsonData;
            if (flyPositions.length) {
                const positions: number[] = [];
                const targets: number[] = [];
                for (let i = 0, max = flyPositions.length; i < max; i++) {
                    positions.push(...flyPositions[i].toArray());
                    targets.push(...flyTargets[i].toArray());
                }
                meta.flyPositions = positions;
                meta.flyTargets = targets;
            } else {
                delete meta.flyPositions;
                delete meta.flyTargets;
            }

            const controls: CameraControls = fire(GetControls);
            meta.position = controls.object.position.toArray();
            meta.lookAt = controls.target.toArray();

            bSave && (await fire(HttpPostMetaData, meta));
        } else {
            // 非地图场景
            const meta = obj as MetaData;
            if (flyPositions.length) {
                const positions: number[] = [];
                const targets: number[] = [];
                for (let i = 0, max = flyPositions.length; i < max; i++) {
                    positions.push(...flyPositions[i].toArray());
                    targets.push(...flyTargets[i].toArray());
                }
                meta.flyPositions = positions;
                meta.flyTargets = targets;
            } else {
                delete meta.flyPositions;
                delete meta.flyTargets;
            }
            bSave && (await fire(HttpPostMetaData, meta));
        }
        const meta = obj as MetaData;
        if (flyPositions.length) {
            const positions: number[] = [];
            const targets: number[] = [];
            for (let i = 0, max = flyPositions.length; i < max; i++) {
                positions.push(...flyPositions[i].toArray());
                targets.push(...flyTargets[i].toArray());
            }
            meta.flyPositions = positions;
            meta.flyTargets = targets;
        } else {
            delete meta.flyPositions;
            delete meta.flyTargets;
        }
        bSave && (await fire(HttpPostMetaData, meta));
    });

    on(FlyOnce, () => {
        if (flyOnceDone) return;
        (flyOnceDone = true) && fire(Flying, true);
    });

    let t = 0; // 插值因子
    let flyTotalTime = flyDuration;
    let flyStartTime = 0;
    let flyPauseTime = 0;
    let flyElapsedTime = 0;
    let flyElapsed = 0;
    let flySpeed = 1;
    let curvePos: CatmullRomCurve3 | null;
    let curveTgt: CatmullRomCurve3 | null;
    let isFlying = false;
    let manager: nipplejs.JoystickManager = null;
    on(Flying, (force: boolean) => {
        if (!flyPositions.length) return;
        if (!force && !fire(GetControls).autoRotate) return; // 避免在非自动旋转模式下执行
        isFlying = true;

        t = 0;
        flyTotalTime = flyDuration;
        flyStartTime = Date.now();
        flyPauseTime = 0;
        flyElapsedTime = flyStartTime;
        flyElapsed = 0;
        flySpeed = 1;
        curvePos = null;
        curveTgt = null;

        const controls: CameraControls = fire(GetControls);

        const points: Vector3[] = [controls.object.position.clone()];
        const tgts: Vector3[] = [controls.target.clone()];
        const all: Vector3[] = fire(GetFlyPositions) || [];
        for (let i = 0, max = Math.min(all.length, 1000); i < max; i++) {
            all[i] && points.push(all[i]);
            flyTargets[i] && tgts.push(flyTargets[i]);
        }
        curvePos = new CatmullRomCurve3(points);
        curvePos.closed = false;
        curveTgt = new CatmullRomCurve3(tgts);
        curveTgt.closed = false;

        fire(FlyEnable);
        tryFire(StopAutoRotate, false);
    });

    on(FlyingPause, () => {
        flyPauseTime = flyPauseTime || Date.now(); // 重复暂停仅首次有效
    });

    // 1,2,4,-2,-4
    on(FlyingPlay, (speed: number, elapsed: number, force = false, forceSpeed = false) => {
        if (!isFlying && !force) return;
        speed = Math.max(-4, Math.min(4, speed));

        if (forceSpeed) {
            return (flySpeed = speed);
        }

        if (elapsed) {
            flyElapsed = elapsed * flyDuration;
        }

        if (flyPauseTime) {
            flyElapsedTime = Date.now();
            flyPauseTime = 0;
            flySpeed = speed = speed < 0 ? -1 : 1;
        } else {
            flySpeed != speed && (flySpeed += speed > flySpeed ? 1 : -1);
        }

        if (!flyEnable) {
            fire(Flying, true);
            flySpeed = 1;
        }

        showSpeedText(flySpeed + ' X');

        return flySpeed;
    });

    on(
        OnViewerAfterUpdate,
        () => {
            const controls: CameraControls = fire(GetControls);
            if (flyPauseTime) return; // 暂停

            flyElapsed += flySpeed * (Date.now() - flyElapsedTime); // 累加最近一次计时至今的时长
            flyElapsedTime = Date.now();
            if (flyElapsed < 0 || flyElapsed > flyTotalTime) {
                fire(FlyDisable); // 播放结束
            }
            if (!flyEnable || !curvePos || !curveTgt) return;

            t = flyElapsed / flyTotalTime;
            const pt = curvePos.getPoint(t);
            const tgt = curveTgt.getPoint(t);

            const enableDamping = controls.enableDamping;
            controls.enableDamping = false;
            controls.object.position.set(pt.x, pt.y, pt.z);
            controls.target.set(tgt.x, tgt.y, tgt.z);
            controls.update();
            controls.enableDamping = enableDamping;
        },
        true,
    );

    const JoystickCss = `#reall3dviewer-joystick-container {position: absolute;bottom: 100px;left: calc(50vw - 50px);width: 100px;height: 100px;z-index: 999999;} #reall3dviewer-joystick-container.close {visibility: hidden;} @media (max-width: 768px) {#reall3dviewer-joystick-container {bottom: 50px;}}`;
    on(ShowJoystick, (show = true) => {
        addDynamicStyles(JoystickCss);
        const id = 'reall3dviewer-joystick-container';
        let dom: HTMLDivElement = document.querySelector(`#${id}`);
        if (dom) return show ? dom.classList.remove('close') : dom.classList.add('close');
        if (!show) return;

        dom = document.createElement('div');
        dom.id = id;
        document.body.appendChild(dom);

        initJoystick();
    });

    globalEv.replace('OnImageShow', () => {
        const meta: MetaData = fire(GetMeta);
        const enableJoystick = isMobile ? meta.mobileEnableJoystick : meta.pcEnableJoystick;
        enableJoystick && fire(ShowJoystick, false);
    });

    globalEv.replace('OnImageHidden', () => {
        const meta: MetaData = fire(GetMeta);
        const enableJoystick = isMobile ? meta.mobileEnableJoystick : meta.pcEnableJoystick;
        enableJoystick && fire(ShowJoystick, true);
    });

    on(
        OnViewerDispose,
        () => {
            // Joystick Dispose
            manager?.destroy();
            let dom = document.getElementById('reall3dviewer-joystick-container');
            dom && dom.parentNode.removeChild(dom);
            dom = document.getElementById('reall3dviewer-joystick-styles');
            dom && dom.parentNode.removeChild(dom);
        },
        true,
    );

    function initJoystick() {
        const options: nipplejs.JoystickManagerOptions = {
            zone: document.getElementById('reall3dviewer-joystick-container'), // 指定摇杆所在的 DOM 元素
            mode: 'static', // 摇杆模式，可选 'static'（静态）或 'dynamic'（动态）
            position: { left: '50%', top: '50%' }, // 摇杆的初始位置
            color: '#cccccccc', // 摇杆的颜色
            size: 100, // 摇杆的大小
            lockY: !fire(IsPlayerMode),
        };
        options.zone.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());

        let angleRadian = 0;
        let stopMove = true;
        fire(
            RunLoopByFrame,
            () => {
                !stopMove && fire(MovePlayerByAngle, angleRadian);
            },
            () => fire(IsPlayerMode),
            15,
        );

        let lastManagerTime = performance.now();
        manager = nipplejs.create(options);
        manager.on('move', function (evt, data: nipplejs.JoystickOutputData) {
            if (performance.now() - lastManagerTime < 100) return;

            if (fire(IsPlayerMode)) {
                angleRadian = (Math.PI / 2 - data.angle.radian + 2 * Math.PI) % (2 * Math.PI);
                stopMove = false;
                return;
            }

            // 计算 Y 轴偏移距离
            const yOffset = data.distance * Math.sin(data.angle.radian);
            // 计算 Y 轴偏移比例
            const maxDistance = options.size / 2; // 最大移动距离为摇杆半径
            let yRatio = yOffset / maxDistance;

            // 判断方向
            let speed = 0.00001;
            if (yRatio > 0) {
                speed = yRatio < 0.01 ? 1 : 1 + 4 * yRatio;
            } else if (yRatio < 0) {
                if (yRatio > -0.2) {
                    speed = 1 + yRatio * 5;
                } else {
                    speed = -1 + yRatio * 4;
                }
            }

            fire(FlyingPlay, speed);
            lastManagerTime = performance.now();
        });

        manager.on('end', (evt, data) => {
            if (fire(IsPlayerMode)) {
                stopMove = true;
                return;
            }

            fire(FlyingPlay, 1, 0, false, true);
        });
    }
}
