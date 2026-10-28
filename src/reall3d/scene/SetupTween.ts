// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Events } from '../events/Events';
import {
    AddFlyPosition,
    ClearFlyPosition,
    GetControls,
    GetFlyPositionArray,
    GetFlyPositions,
    GetFlyTargetArray,
    OnSetFlyPositions,
    OnSetFlyTargets,
    OnViewerAfterUpdate,
    StopAutoRotate,
    TweenFly,
    TweenFlyDisable,
    TweenFlyEnable,
    TweenFlyOnce,
} from '../events/EventConstants';
import { Easing, Tween } from '@tweenjs/tween.js';
import { Vector3 } from 'three';
import { CameraControls } from './SetupCameraControls';
export function setupTween(events: Events) {
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);

    const flyPositions: Vector3[] = [];
    const flyTargets: Vector3[] = [];
    let tween: Tween;
    let flyEnable: boolean = false;
    let flyOnceDone: boolean = false;

    on(TweenFlyDisable, () => (flyEnable = false));
    on(TweenFlyEnable, () => (flyEnable = true));
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
    on(AddFlyPosition, () => {
        const controls: CameraControls = fire(GetControls);
        flyPositions.push(controls.object.position.clone());
        flyTargets.push(controls.target.clone());
    });
    on(ClearFlyPosition, () => {
        flyPositions.length = 0;
        flyTargets.length = 0;
    });

    on(TweenFlyOnce, (idx: number = 0) => {
        if (flyOnceDone) return;
        (flyOnceDone = true) && fire(TweenFly);
    });

    on(TweenFly, (idx: number = 0, force: boolean = true) => {
        force && fire(TweenFlyEnable);
        if (idx < 0 || idx > 100 || !flyEnable) return; // 最多支持100个位置

        const toPos: Vector3 = (fire(GetFlyPositions) || [])[idx];
        if (!toPos) {
            fire(TweenFly, idx + 1, false);
            return;
        }

        fire(StopAutoRotate, false);

        const controls: CameraControls = fire(GetControls);
        const toTgt: Vector3 = flyTargets[idx] || controls.target.clone();
        const pos: Vector3 = controls.object.position.clone();
        const tgt: Vector3 = controls.target.clone();
        const pt = { ...pos, tx: tgt.x, ty: tgt.y, tz: tgt.z };
        tween = new Tween(pt).to({ x: toPos.x, y: toPos.y, z: toPos.z, tx: toTgt.x, ty: toTgt.y, tz: toTgt.z }, 3000);
        tween
            .delay(200)
            .easing(Easing.Sinusoidal.InOut)
            .start()
            .onUpdate(() => {
                if (flyEnable) {
                    controls.object.position.set(pt.x, pt.y, pt.z);
                    controls.target.set(pt.tx, pt.ty, pt.tz);
                }
            })
            .onComplete(() => {
                tween = null;
                fire(TweenFly, idx + 1, false);
            })
            .onStop(() => {
                tween = null;
            });
    });

    on(
        OnViewerAfterUpdate,
        () => {
            flyEnable && tween?.update();
        },
        true,
    );
}
