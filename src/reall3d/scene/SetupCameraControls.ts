// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import {
    GetCameraInfo,
    GetCameraLookAt,
    GetCameraLookUp,
    GetCameraPosition,
    GetCameraFov,
    GetControls,
    ControlsUpdate,
    ControlsUpdateRotateAxis,
    IsCameraChangedNeedUpdate,
    CameraSetLookAt,
    FocusMarkerUpdate,
    RunLoopByFrame,
    ControlPlaneUpdate,
    FocusMarkerAutoDisappear,
    ControlsSetFlyCameraMode,
    IsPointInFront,
} from '../events/EventConstants';
import { Camera, Matrix4, PerspectiveCamera, Plane, Vector3 } from 'three';
import { Events } from '../events/Events';
import { GetCamera } from '../events/EventConstants';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Reall3dViewerOptions } from '../viewer/Reall3dViewerOptions';

/**
 * 相机参数信息
 */
export interface CameraInfo {
    /**
     * 相机视场
     */
    fov?: number;

    /**
     * 相机近截面距离
     */
    near?: number;

    /**
     * 相机远截面距离
     */
    far?: number;

    /**
     * 相机宽高比
     */
    aspect?: number;

    /**
     * 相机位置
     */
    position: number[];

    /**
     * 相机注视点
     */
    lookAt?: number[];

    /**
     * 相机上向量
     */
    lookUp?: number[];
}

export function setupCameraControls(events: Events) {
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    const controls: OrbitControls = fire(GetControls);
    on(GetCameraFov, () => fire(GetCamera).fov);
    on(GetCameraPosition, (copy: boolean = false) => (copy ? controls.object.position.clone() : controls.object.position));
    on(GetCameraLookAt, (copy: boolean = false) => (copy ? controls.target.clone() : controls.target));
    on(GetCameraLookUp, (copy: boolean = false) => (copy ? fire(GetCamera).up.clone() : fire(GetCamera).up));

    on(IsPointInFront, (point: Vector3) => {
        const matrix: Matrix4 = (controls.object as Camera).projectionMatrix.clone().multiply((controls.object as Camera).matrixWorldInverse);
        const m = matrix.elements;
        const nearPlane = new Plane();
        nearPlane.set(new Vector3(m[3] + m[2], m[7] + m[6], m[11] + m[10]), m[15] + m[14]).normalize();
        return nearPlane.distanceToPoint(point) > 0;
    });

    let flyCameraMode = false;
    on(ControlsSetFlyCameraMode, () => {
        if (flyCameraMode) return;
        flyCameraMode = true;

        // TODO
        const direction = new Vector3().subVectors(controls.target, controls.object.position).normalize().multiplyScalar(0.01);
        controls.target.copy(controls.object.position.clone().add(direction));
        controls.panSpeed = controls.target.distanceTo(controls.object.position) > controls.minDistance ? 1 : 50;
        controls.update();
    });

    let oEnables: any;
    const aryProcessAnimate: any[] = [];
    on(CameraSetLookAt, (target: Vector3, animate: boolean = false, rotateAnimate: boolean) => {
        flyCameraMode = false;
        controls.panSpeed = controls.target.distanceTo(controls.object.position) > controls.minDistance ? 1 : 50;

        fire(FocusMarkerUpdate, target);
        if (!animate) {
            controls.target.copy(target);
            const direction = new Vector3().subVectors(target, controls.object.position);
            direction.length() < 1 && controls.object.position.copy(target).sub(direction.setLength(1));
            direction.length() > 50 && controls.object.position.copy(target).sub(direction.setLength(50));
            fire(ControlPlaneUpdate);
            fire(FocusMarkerAutoDisappear);
            return;
        }

        while (aryProcessAnimate.length) aryProcessAnimate.pop().stop = true;
        let process = { alpha: 0, time: Date.now(), stop: false };
        aryProcessAnimate.push(process);

        // 适当时间内禁用拖动旋转避免操作冲突
        oEnables = oEnables || { enablePan: controls.enablePan, enableRotate: controls.enableRotate };
        controls.enablePan = false;
        controls.enableRotate = false;

        const oldTarget: Vector3 = fire(GetCameraLookAt, true);
        const oldPos: Vector3 = fire(GetCameraPosition, true);
        const dir = oldTarget.clone().sub(oldPos).normalize();
        const newPos = target.clone().sub(dir.multiplyScalar(target.clone().sub(oldPos).dot(dir)));

        fire(
            RunLoopByFrame,
            () => {
                process.alpha = (Date.now() - process.time) / 600;
                fire(GetControls).target.copy(oldTarget.clone().lerp(target, process.alpha));
                !rotateAnimate && fire(GetControls).object.position.copy(oldPos.clone().lerp(newPos, process.alpha));
                fire(ControlPlaneUpdate);
                if (process.alpha >= 0.9) {
                    controls.enablePan = oEnables.enablePan;
                    controls.enableRotate = oEnables.enableRotate;
                }
                if (process.alpha >= 1) {
                    process.stop = true;
                    fire(FocusMarkerAutoDisappear);
                }
            },
            () => !process.stop,
        );
    });

    on(GetCameraInfo, (): CameraInfo => {
        let position = fire(GetCameraPosition).toArray();
        let lookUp = fire(GetCameraLookUp).toArray();
        let lookAt = fire(GetCameraLookAt).toArray();
        return { position, lookUp, lookAt };
    });

    on(ControlsUpdate, () => (fire(GetControls) as CameraControls).update());
    on(ControlsUpdateRotateAxis, () => (fire(GetControls) as CameraControls).updateRotateAxis());

    // ---------------------
    const epsilon = 0.01;
    let lastCameraPosition: Vector3 = new Vector3();
    let lastCameraDirection: Vector3 = new Vector3();
    let lastCameraFov: number = 0;
    on(IsCameraChangedNeedUpdate, () => {
        const camera: PerspectiveCamera = fire(GetControls).object;
        const fov = camera.fov;
        const position = camera.position.clone();
        const direction = camera.getWorldDirection(new Vector3());
        if (
            Math.abs(lastCameraFov - fov) < epsilon &&
            Math.abs(position.x - lastCameraPosition.x) < epsilon &&
            Math.abs(position.y - lastCameraPosition.y) < epsilon &&
            Math.abs(position.z - lastCameraPosition.z) < epsilon &&
            Math.abs(direction.x - lastCameraDirection.x) < epsilon &&
            Math.abs(direction.y - lastCameraDirection.y) < epsilon &&
            Math.abs(direction.z - lastCameraDirection.z) < epsilon
        ) {
            return false;
        }
        lastCameraFov = fov;
        lastCameraPosition = position;
        lastCameraDirection = direction;
        return true;
    });
}

/**
 * 旋转控制器
 */
export class CameraControls extends OrbitControls {
    constructor(opts: Reall3dViewerOptions) {
        const camera: Camera = opts.camera;
        super(camera, opts.renderer.domElement);

        const that = this;
        that.dampingFactor = 0.1;
        that.rotateSpeed = 0.3;
        that.autoRotateSpeed = 0.8;
        that.updateByOptions(opts);
    }

    public updateByOptions(opts: Reall3dViewerOptions = {}) {
        if (!opts) return;
        const that = this;

        opts.enableDamping !== undefined && (that.enableDamping = opts.enableDamping);
        opts.autoRotate !== undefined && (that.autoRotate = opts.autoRotate);
        opts.enableZoom !== undefined && (that.enableZoom = opts.enableZoom);
        opts.enableRotate !== undefined && (that.enableRotate = opts.enableRotate);
        opts.enablePan !== undefined && (that.enablePan = opts.enablePan);
        opts.minDistance !== undefined && (that.minDistance = opts.minDistance);
        opts.maxDistance !== undefined && (that.maxDistance = opts.maxDistance);
        opts.minPolarAngle !== undefined && (that.minPolarAngle = opts.minPolarAngle);
        opts.maxPolarAngle !== undefined && (that.maxPolarAngle = opts.maxPolarAngle);

        opts.fov !== undefined && ((that.object as PerspectiveCamera).fov = opts.fov);
        opts.near !== undefined && ((that.object as PerspectiveCamera).near = opts.near);
        opts.far !== undefined && ((that.object as PerspectiveCamera).far = opts.far);
        if (opts.fov !== undefined || opts.near !== undefined || opts.far !== undefined) {
            (that.object as PerspectiveCamera).updateProjectionMatrix();
        }
        opts.position && that.object.position.fromArray(opts.position);
        opts.lookAt && that.target.fromArray(opts.lookAt);
        opts.lookUp && that.object.up.fromArray(opts.lookUp);

        that.updateRotateAxis();
        that.update();
    }

    /**
     * 更新旋转轴
     */
    public updateRotateAxis() {
        // @ts-ignore
        this._quat?.setFromUnitVectors?.(this.object.up, new Vector3(0, 1, 0));
        // @ts-ignore
        this._quatInverse = this._quat?.clone?.()?.invert?.();
    }
}
