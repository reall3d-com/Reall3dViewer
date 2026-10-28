// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Matrix4, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { Events } from '../../events/Events';
import {
    SplatUpdatePerformanceNow,
    SplatUpdatePointMode,
    SplatUpdateLightFactor,
    IsPointcloudMode,
    CreateSplatMesh,
    SplatMeshDispose,
    SplatDataManagerDispose,
    WorkerDispose,
    GetScene,
    GetOptions,
    GetCanvas,
    GetRenderer,
    IsBigSceneMode,
    SplatDataManagerAddModel,
    NotifyWkA09Sort,
    SplatTexdataManagerDataChanged,
    NotifyViewerNeedUpdate,
    ViewerNeedUpdate,
    TraverseDisposeAndClear,
    GetCamera,
    GetCameraFov,
    GetCameraPosition,
    GetViewProjectionMatrixArray,
    GetViewProjectionMatrix,
    CommonUtilsDispose,
    GetSplatMesh,
    GetCameraLookAt,
    GetCameraDirection,
    SplatUpdateBoundBox,
    SplatSetBoundBoxVisible,
    GetRenderQualityLevel,
    WorkerUpdateParams,
    GetSortType,
    OnQualityLevelChanged,
    IsSplatMeshCreated,
    OnSmallSceneShowDone,
    IsCameraLookAtPoint,
    IsSmallSceneShowDone,
    LodDownloadAddLodMeta,
    SplatMeshSwitchDisplayMode,
    GetMeta,
    LodDownloadManagerDispose,
    OnStartLodShown,
} from '../../events/EventConstants';
import { SplatMeshOptions } from './SplatMeshOptions';
import { ModelOptions } from '../../modeldata/ModelOptions';
import { initSplatMeshOptions } from '../../utils/ViewerUtils';
import { isInFrustum } from '../../utils/CommonUtils';
import { MetaData } from '../../modeldata/MetaData';
import { BoundBox } from '../boundbox/BoundBox';
import { QualityLevels, SortTypes } from '../../utils/GlobalConstants';
import { AudioText, AudioTextOptions } from '../media/AudioText';
import { setupAllEventsSplatMesh } from '../../scene/SetupAllEvents';

/**
 * Gaussian splatting mesh
 */
export class SplatMesh extends Mesh {
    public readonly isSplatMesh: boolean = true;
    public meta: MetaData;
    private disposed: boolean = false;
    private events: Events;
    private opts: SplatMeshOptions;
    private audioText: AudioText;
    public boundBox: BoundBox;

    /**
     * 构造函数
     * @param options 渲染器、场景、相机都应该传入
     */
    constructor(options: SplatMeshOptions) {
        super();
        const that = this;
        const events = new Events();
        const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
        const fire = (key: number, ...args: any): any => events.fire(key, ...args);
        let isSplatMeshCreated = false;

        const opts: SplatMeshOptions = initSplatMeshOptions(options); // 默认参数校验设定
        const camera = (opts.camera || opts.controls?.object) as PerspectiveCamera;
        on(GetOptions, () => opts);
        on(GetMeta, () => that.meta);
        on(GetCanvas, () => opts.renderer.domElement);
        on(GetCamera, () => camera);
        on(GetCameraFov, () => camera.fov);
        on(GetCameraPosition, (copy: boolean = false) => (copy ? camera.position.clone() : camera.position));
        on(GetCameraLookAt, (copy: boolean = false) => (opts.controls ? (copy ? opts.controls.target.clone() : opts.controls.target) : new Vector3()));
        on(GetViewProjectionMatrixArray, () => camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).multiply(that.matrix).toArray());
        on(GetViewProjectionMatrix, () => camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse));
        on(GetCameraDirection, () => camera.getWorldDirection(new Vector3()).toArray());
        on(GetRenderer, () => opts.renderer);
        on(GetScene, () => opts.scene);
        on(IsBigSceneMode, () => opts.bigSceneMode);
        on(IsPointcloudMode, () => opts.pointcloudMode);
        on(GetSplatMesh, () => that);
        on(GetSortType, () => opts.sortType || SortTypes.Default1);
        on(IsSplatMeshCreated, () => isSplatMeshCreated);
        on(IsCameraLookAtPoint, (tgtPoint: Vector3, maxDistanceToCam = 1.0): boolean => {
            return Math.abs(camera.position.distanceTo(tgtPoint)) < maxDistanceToCam && isInFrustum(camera, tgtPoint);
        });

        on(NotifyViewerNeedUpdate, () => opts.viewerEvents?.fire(ViewerNeedUpdate));

        let isSmallSceneShowDone = false;
        on(IsSmallSceneShowDone, () => isSmallSceneShowDone);
        on(OnSmallSceneShowDone, () => (isSmallSceneShowDone = true), true);
        on(OnSmallSceneShowDone, () => setTimeout(() => that.audioText?.opts.autoPlay && !that.audioText?.opts.position && that.audioText?.play(), 5000), true);
        on(OnStartLodShown, () => setTimeout(() => that.audioText?.opts.autoPlay && !that.audioText?.opts.position && that.audioText?.play(), 5000), true);

        setupAllEventsSplatMesh(events);

        that.name = `${opts.name || that.id}`;

        that.events = events;
        that.opts = opts;

        (async () => {
            that.copy(await events.fire(CreateSplatMesh));
            that.meta.transform && that.applyMatrix4(new Matrix4().fromArray(that.meta.transform));
            that.frustumCulled = false;
            that.onBeforeRender = () => {
                fire(NotifyWkA09Sort);
                fire(SplatUpdatePerformanceNow, performance.now());

                if (
                    that.audioText.opts.position &&
                    fire(IsSmallSceneShowDone) &&
                    fire(IsCameraLookAtPoint, new Vector3().fromArray(that.audioText.opts.position), that.audioText.opts.distance)
                ) {
                    that.audioText.play();
                }
            };
            that.onAfterRender = () => {
                fire(SplatTexdataManagerDataChanged, 10000) && fire(NotifyViewerNeedUpdate); // 纹理数据更新后10秒内总是要刷新
            };

            isSplatMeshCreated = true;
            fire(OnQualityLevelChanged);
        })();

        // 包围盒
        const boundBox = new BoundBox();
        boundBox.visible = false;
        boundBox.renderOrder = 99999;
        that.boundBox = boundBox;
        that.add(boundBox);
        on(SplatUpdateBoundBox, (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, show?: boolean) => {
            boundBox.update(minX, minY, minZ, maxX, maxY, maxZ, show);
        });
        on(SplatSetBoundBoxVisible, (visible: boolean = true) => (boundBox.visible = visible));
    }

    /**
     * 设定或者获取最新配置项
     * @param opts 配置项
     * @returns 最新配置项
     */
    public options(opts?: any): any {
        const that = this;
        if (that.disposed) return;
        const fire = (key: number, ...args: any): any => that.events.fire(key, ...args);
        const thisOpts = that.opts;

        if (opts) {
            opts.pointcloudMode !== undefined && !fire(SplatUpdatePointMode, opts.pointcloudMode) && (thisOpts.pointcloudMode = opts.pointcloudMode);
            opts.lightFactor !== undefined && fire(SplatUpdateLightFactor, opts.lightFactor);
            opts.qualityLevel !== undefined && (thisOpts.qualityLevel = opts.qualityLevel) && fire(OnQualityLevelChanged);
            !thisOpts.mapMode && opts.sortType !== undefined && (thisOpts.sortType = opts.sortType) && fire(WorkerUpdateParams);
            opts.disableTransitionEffectOnLoad !== undefined && (thisOpts.disableTransitionEffectOnLoad = opts.disableTransitionEffectOnLoad);

            fire(NotifyViewerNeedUpdate);
        }
        return { ...thisOpts };
    }

    /**
     * 添加渲染指定高斯模型
     * @param opts 高斯模型选项
     * @param meta 元数据
     */
    public addModel(opts: ModelOptions, meta: MetaData = {}) {
        const that = this;
        if (that.disposed) return;

        if (!opts.format) {
            if (opts.url.endsWith('.spx')) {
                opts.format = 'spx';
            } else if (opts.url.endsWith('.splat')) {
                opts.format = 'splat';
            } else if (opts.url.endsWith('.ply')) {
                opts.format = 'ply';
            } else if (opts.url.endsWith('.spz')) {
                opts.format = 'spz';
            } else if (opts.url.endsWith('.zip') || opts.url.endsWith('.sog') || opts.url.endsWith('/meta.json') || opts.url == 'meta.json') {
                opts.format = 'sog';
            } else if (opts.url.endsWith('.glb')) {
                opts.format = 'glb';
            } else if (opts.url.endsWith('.glb')) {
                opts.format = 'glb';
            } else if (opts.url.endsWith('.lod.json') || opts.url.endsWith('lod-meta.json')) {
            } else {
                console.error('unsupported format:', opts.url);
                return;
            }
        }

        that.events.on(GetRenderQualityLevel, () => meta.qualityLevel || QualityLevels.Default5);

        that.meta = meta;
        const atOpts: AudioTextOptions = { autoPlay: meta.audio?.autoPlay, mp3: meta.audio?.mp3, textDurations: meta.audio?.textDurations };
        if (meta.audio?.position) {
            atOpts.event = that.events;
            atOpts.position = meta.audio?.position;
            atOpts.distance = meta.audio?.distance;
        }
        that.audioText = new AudioText(atOpts);
        if (meta.url?.endsWith('.lod.json') || meta.url?.endsWith('lod-meta.json')) {
            that.events.fire(LodDownloadAddLodMeta, opts, meta);
        } else {
            that.events.fire(SplatDataManagerAddModel, opts, meta);
        }
    }

    public fire(key: number, ...args: any): any {
        const that = this;
        if (that.disposed) return;
        return that.events.fire(key, ...args);
    }

    /**
     * 设定点云或正常显示模式
     */
    public setPointMode(isPointMode: boolean) {
        this.events.fire(SplatUpdatePointMode, isPointMode);
    }

    /**
     * 光圈过渡效果切换点云或正常显示模式
     */
    public switchDisplayMode() {
        this.events.fire(SplatMeshSwitchDisplayMode);
    }

    /**
     * 销毁
     */
    public dispose(): void {
        const that = this;
        if (that.disposed) return;
        that.disposed = true;
        const fire = (key: number, ...args: any): any => that.events.fire(key, ...args);

        fire(TraverseDisposeAndClear, that);
        fire(TraverseDisposeAndClear, that.boundBox);
        that.removeFromParent();
        that.boundBox.removeFromParent();
        that.audioText?.dispose();

        fire(CommonUtilsDispose);
        fire(WorkerDispose);
        fire(SplatDataManagerDispose);
        fire(SplatMeshDispose);

        that.events.clear();
        that.events = null;
        that.opts = null;
        that.onAfterRender = null;
        that.boundBox = null;
        that.audioText = null;
    }
}
