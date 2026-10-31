// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import '../assets/style/style.less';
import { Scene, AmbientLight, WebGLRenderer, Color, Matrix4, Camera, DirectionalLight, Mesh, MeshStandardMaterial } from 'three';
import { DRACOLoader, GLTFLoader } from 'three/examples/jsm/Addons.js';
import {
    GetCurrentDisplayShDegree,
    GetModelShDegree,
    IsBigSceneMode,
    IsControlPlaneVisible,
    OnSetFlyPositions,
    OnSetFlyTargets,
    SplatUpdateShDegree,
    ClearMarkPoint,
    CommonUtilsDispose,
    GetMarkFromWeakRef,
    ViewerDispose,
    Information,
    IsCameraChangedNeedUpdate,
    KeyActionCheckAndExecute,
    LoadSmallSceneMetaData,
    MetaMarkSaveData,
    MarkUpdateVisible,
    OnViewerAfterUpdate,
    OnViewerUpdate,
    RunLoopByTime,
    SetGaussianText,
    SplatSetPointcloudMode,
    SplatSwitchDisplayMode,
    SplatUpdateLightFactor,
    SplatUpdateShowWaterMark,
    StopAutoRotate,
    TraverseDisposeAndClear,
    UpdateAllMarkByMeterScale,
    ViewerUtilsDispose,
    ViewerCheckNeedUpdate,
    ViewerSetPointcloudMode,
    OnSetWaterMark,
    GetCachedWaterMark,
    MetaSaveWatermark,
    AddFlyPosition,
    Flying,
    ClearFlyPosition,
    FlyDisable,
    GetScene,
    OnViewerBeforeUpdate,
    GetOptions,
    GetControls,
    GetCanvas,
    GetRenderer,
    GetCamera,
    ViewerNeedUpdate,
    MetaMarkRemoveData,
    PrintInfo,
    GetSplatMesh,
    FlySavePositions,
    GetMeta,
    OnLoadAndRenderObj,
    GetMetaMatrix,
    UpdateQualityLevel,
    UpdateSortType,
    CountFpsReal,
    IsDebugMode,
    OnSetFlyDuration,
    StopBgAudio,
    ShowJoystick,
    OnViewerDispose,
    CaptureScreenshot,
    OnFetchStop,
    FocusAabbCenter,
    SplatUpdateFocal,
    IncreaseCameraFov,
    OnInitMarks,
    CheckViewerUpdateRow,
    IsDefaultPipeline,
    OnMetaDataLoaded,
    RenderCSS2D3D,
    RenderMinimap,
    LoadCircularAudioMask,
    RunLoopByFrame,
    PlaytBgAudio,
    OnLoadAndRenderPointCloudPly,
    SetViewerApi,
} from '../events/EventConstants';
import { SplatMesh } from '../meshs/splatmesh/SplatMesh';
import { ModelOptions } from '../modeldata/ModelOptions';
import { Events } from '../events/Events';
import { copyGsViewerOptions, initCamera, initGsViewerOptions, initRenderer } from '../utils/ViewerUtils';
import { Reall3dViewerOptions } from './Reall3dViewerOptions';
import { SplatMeshOptions } from '../meshs/splatmesh/SplatMeshOptions';
import { MarkData } from '../meshs/mark/data/MarkData';
import { computeCompressionRatio, getUrl, glbKhrGs2Splat, isPointCloudPly, isString, parseRgbPly } from '../utils/CommonUtils';
import { DecoderPath, isMobile, QualityLevels, SortTypes, ViewerVersion } from '../utils/GlobalConstants';
import { MetaData } from '../modeldata/MetaData';
import { globalEv } from '../events/GlobalEV';
import { setupPlayer } from '../scene/SetupPlayer';
import { loadFile } from '../modeldata/loaders/FileLoader';
import { MinimapOptions } from '../scene/SetupMinimap';
import { setupAllEventsVerwer } from '../scene/SetupAllEvents';
import { CameraControls } from '../scene/SetupCameraControls';

/**
 * Built-in Gaussian Splatting model viewer
 */
export class Reall3dViewer {
    private disposed: boolean = false;
    private splatMesh: SplatMesh;
    private events: Events;
    private metaMatrix: Matrix4;

    public needUpdate: boolean = true;

    constructor(opts: Reall3dViewerOptions = {}) {
        console.info('Reall3dViewer', ViewerVersion);
        this.init(initGsViewerOptions(opts));
        !opts.disableDropLocalFile && this.enableDropLocalFile();
    }

    private init(opts: Reall3dViewerOptions) {
        const that = this;
        opts.position = opts.position ? [...opts.position] : [0, -5, 15];
        opts.lookAt = opts.lookAt ? [...opts.lookAt] : [0, 0, 0];
        opts.lookUp = opts.lookUp ? [...opts.lookUp] : [0, -1, 0];

        const renderer: WebGLRenderer = initRenderer(opts);
        const scene: Scene = (opts.scene = opts.scene || new Scene());
        scene.background = new Color(opts.background);

        initCamera(opts);
        const controls = (opts.controls = new CameraControls(opts));
        controls.updateByOptions(opts);
        const camera = controls.object as Camera;

        let renterTime = 0;
        const events = new Events();
        opts.viewerEvents = events;
        that.events = events;
        const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
        const fire = (key: number, ...args: any): any => events.fire(key, ...args);

        on(GetMetaMatrix, () => that.metaMatrix);
        on(GetOptions, () => opts);
        on(GetCanvas, () => renderer.domElement);
        on(GetRenderer, () => renderer);
        on(GetScene, () => scene);
        on(GetControls, () => controls);
        on(GetCamera, () => camera);
        on(IsBigSceneMode, () => opts.bigSceneMode);
        on(ViewerSetPointcloudMode, (pointMode: boolean) => (opts.pointcloudMode = pointMode));

        let lastTimeNeedUpdate = 0;
        const aryUpdaters: any[] = [];
        on(ViewerNeedUpdate, () => {
            if (Date.now() - lastTimeNeedUpdate < 1000) return;
            lastTimeNeedUpdate = Date.now();

            that.needUpdate = true;
            // 稍微多点更新
            while (aryUpdaters.length) aryUpdaters.pop().stop = true; // 已有的都停掉
            let oUpdater = { count: 0, stop: false };
            aryUpdaters.push(oUpdater);

            fire(
                RunLoopByTime,
                () => {
                    that.needUpdate = true;
                    oUpdater.count++ >= 600 && (oUpdater.stop = true);
                },
                () => !that.disposed && (fire(IsControlPlaneVisible) || !oUpdater.stop),
                10,
            );
        });

        const splatMesh = new SplatMesh(copyGsViewerOptions(opts));
        that.splatMesh = splatMesh;
        on(GetSplatMesh, () => splatMesh);
        scene.add(splatMesh);

        setupAllEventsVerwer(events);

        on(UpdateQualityLevel, (qualityLevel: number) => {
            opts.qualityLevel = qualityLevel;
            splatMesh.options({ qualityLevel, renderer: undefined, scene: undefined });
        });

        on(UpdateSortType, (sortType: number) => {
            opts.sortType = sortType;
            splatMesh.options({ sortType, renderer: undefined, scene: undefined });
        });

        on(IncreaseCameraFov, (add = true) => {
            opts.fov += add ? 1 : -1;
            opts.fov = Math.max(10, Math.min(opts.fov, 80));
            const fov = opts.fov;
            controls.updateByOptions({ fov });
            splatMesh.fire(SplatUpdateFocal);
        });

        let minimapOpts: MinimapOptions;
        on(
            OnMetaDataLoaded,
            () => {
                minimapOpts = (fire(GetMeta) as MetaData).minimap;
                if (minimapOpts && isMobile) {
                    minimapOpts.size = minimapOpts.mobileSize || minimapOpts.size;
                    minimapOpts.corner = minimapOpts.mobileCorner || minimapOpts.corner || 'bottom-right';
                    minimapOpts.marginX = minimapOpts.mobileMarginX || 0;
                    minimapOpts.marginY = minimapOpts.mobileMarginY || 0;
                }
            },
            true,
        );

        const dirLight = new DirectionalLight(0xffffff, 1);
        dirLight.position.set(0, 2e3, 1e3);
        scene.add(dirLight);
        scene.add(new AmbientLight('#ffffff', 2));
        renderer.setAnimationLoop(that.update.bind(that));

        on(ViewerCheckNeedUpdate, () => {
            controls.update();
            !that.needUpdate && fire(IsCameraChangedNeedUpdate) && fire(ViewerNeedUpdate);
        });
        on(OnViewerBeforeUpdate, () => fire(KeyActionCheckAndExecute), true);
        on(OnViewerBeforeUpdate, () => fire(ViewerCheckNeedUpdate), true);
        // on(OnViewerBeforeUpdate, () => Date.now() - lastTimeNeedUpdate < 5000 && (that.needUpdate = true), true);
        on(CheckViewerUpdateRow, () => that.needUpdate && Date.now() - renterTime >= (isMobile ? 20 : opts.qualityLevel > 5 ? 1 : 18));

        on(
            OnViewerUpdate,
            () => {
                !(that.needUpdate = false) && (renterTime = Date.now()) && fire(IsDebugMode) && fire(CountFpsReal);
                if (!fire(IsDefaultPipeline)) return;

                renderer.render(scene, camera);
                fire(RenderCSS2D3D);
                minimapOpts && fire(RenderMinimap, minimapOpts);
            },
            true,
        );

        on(ViewerDispose, () => that.dispose());
        on(PrintInfo, () => console.info(JSON.stringify(fire(GetSplatMesh).meta || {}, null, 2)));

        let watermark: string = '';
        on(OnSetWaterMark, (text: string = '') => {
            watermark = text;
            that.splatMesh.fire(SetGaussianText, watermark, true); // 水印文字水平朝向
        });
        on(GetCachedWaterMark, () => watermark);
        fire(Information, { scale: `1 : ${fire(GetOptions).meterScale} m` });

        // that.initGsApi();
        fire(SetViewerApi);
    }

    /**
     * 允许拖拽本地文件进行渲染（支持模型文件、*.meta.json文件、*.scene.json文件）
     */
    private enableDropLocalFile(): void {
        const that = this;
        document.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.stopPropagation();
        });
        document.addEventListener('drop', async function (e) {
            e.preventDefault();
            e.stopPropagation();
            globalEv.fire(StopBgAudio);
            let file = e.dataTransfer.files[0];
            if (!file) return;

            let format: 'ply' | 'splat' | 'spx' | 'spz' | 'sog' | 'obj' | 'glb';
            let isSceneJson = false;
            if (file.name.endsWith('.spx')) {
                format = 'spx';
            } else if (file.name.endsWith('.splat')) {
                format = 'splat';
            } else if (file.name.endsWith('.ply')) {
                format = 'ply';
            } else if (file.name.endsWith('.spz')) {
                format = 'spz';
            } else if (file.name.endsWith('.sog') || file.name.endsWith('.zip')) {
                format = 'sog';
            } else if (file.name.endsWith('.obj')) {
                format = 'obj';
            } else if (file.name.endsWith('.scene.json')) {
                isSceneJson = true;
            } else if (file.name.endsWith('.glb')) {
                format = 'glb';
                globalEv.on('Information-ver', () => `glb`);
            } else if (file.name.endsWith('.meta.json')) {
                // 不得而知，待后续进一步检查
            } else {
                return console.error('unsupported format:', file.name);
            }

            const url = URL.createObjectURL(file);
            const opts: Reall3dViewerOptions = that.events.fire(GetOptions);
            opts.bigSceneMode = false;
            opts.debugMode = true;
            opts.autoRotate = false; // 本地拖拽大多是要看质量，默认不旋转
            opts.qualityLevel = QualityLevels.Default5; // 兼顾性能使用默认级别
            opts.disableTransitionEffectOnLoad = true; // 不要渐进过渡特效
            opts.pointcloudMode = false;
            opts.maxDistance = 10000;
            opts.disableRightClickFocus = false;
            opts.viewMode = undefined;
            opts.shDegree = 3;
            opts.fov = 45;
            that.reset(opts);
            if (isSceneJson) {
                await that.addScene(url);
            } else {
                await that.addModel({ url, format });
                that.events.fire(FocusAabbCenter);
            }
            URL.revokeObjectURL(url);
        });
    }

    /**
     * 刷新
     */
    public update(): void {
        const that = this;
        if (that.disposed) return;
        const fire = (key: number, ...args: any): any => that.events.fire(key, ...args);
        fire(OnViewerBeforeUpdate);
        fire(CheckViewerUpdateRow) && fire(OnViewerUpdate);
        fire(OnViewerAfterUpdate);
    }

    // 开发调试用临时接口
    public fire(n: number, p1?: any, p2?: any): void {
        const that = this;
        n === 1 && that.splatMesh.fire(SplatUpdateShowWaterMark, p1); // 显示/隐藏水印
        n === 2 && that.events.fire(AddFlyPosition);
        n === 3 && that.events.fire(Flying, true);
        n === 4 && that.events.fire(ClearFlyPosition);
        n === 5 && that.events.fire(FlySavePositions, true);
        n === 6 && that.events.fire(MetaMarkSaveData);
        n === 7 && that.events.fire(MetaMarkRemoveData);
        if (n === 8) {
            (async () => {
                let shDegree: number = await that.splatMesh.fire(GetModelShDegree);
                if (p1) shDegree = that.splatMesh.fire(GetCurrentDisplayShDegree) + p1;
                that.splatMesh.fire(SplatUpdateShDegree, shDegree);
            })();
        }
        if (n === 9) {
            if (!p1) {
                that.events.fire(UpdateQualityLevel, QualityLevels.Default5);
            } else {
                const level: number = (that.events.fire(GetOptions) as Reall3dViewerOptions).qualityLevel;
                that.events.fire(UpdateQualityLevel, Math.max(QualityLevels.L1, Math.min(level + p1, QualityLevels.L9)));
            }
        }
        if (n === 10) {
            if (!p1) {
                that.events.fire(UpdateSortType, SortTypes.Default1);
            } else {
                const types = that.events.fire(IsBigSceneMode) ? [1, 2] : [1, 2, 2010, 2011];
                const sortType: number = (that.events.fire(GetOptions) as Reall3dViewerOptions).sortType;
                let idx = types.indexOf(sortType) + p1;
                idx = Math.max(0, Math.min(idx, types.length - 1));
                that.events.fire(UpdateSortType, types[idx]);
            }
        }
    }

    /**
     * 设定或者获取最新配置项
     * @param opts 配置项
     * @returns 最新配置项
     */
    public options(opts?: Reall3dViewerOptions): Reall3dViewerOptions {
        const that = this;
        if (that.disposed) return {};
        const fire = (key: number, ...args: any): any => that.events.fire(key, ...args);
        let splatOpts: SplatMeshOptions;
        const scene: Scene = fire(GetScene);
        scene.traverse((obj: any) => !splatOpts && obj instanceof SplatMesh && (splatOpts = (obj as SplatMesh).options()));

        if (opts) {
            const viewOpts = fire(GetOptions);
            if (opts.autoRotate !== undefined) {
                viewOpts.autoRotate = opts.autoRotate;
                fire(GetControls).autoRotate = opts.autoRotate;
            }
            opts.pointcloudMode !== undefined && fire(SplatSetPointcloudMode, opts.pointcloudMode);
            opts.lightFactor !== undefined && fire(SplatUpdateLightFactor, opts.lightFactor);

            opts.debugMode !== undefined && (viewOpts.debugMode = opts.debugMode);
            opts.qualityLevel !== undefined &&
                (viewOpts.qualityLevel = opts.qualityLevel) &&
                this.splatMesh.options({ qualityLevel: opts.qualityLevel } as any);
            opts.sortType !== undefined && (viewOpts.sortType = opts.sortType) && this.splatMesh.options({ sortType: opts.sortType } as any);

            opts.markType !== undefined && (viewOpts.markType = opts.markType);
            if (opts.markVisible !== undefined) {
                fire(MarkUpdateVisible, opts.markVisible);
            }
            if (opts.meterScale !== undefined) {
                viewOpts.meterScale = opts.meterScale;
            }
            if (opts.markMode !== undefined) {
                viewOpts.markMode = opts.markMode;
                !opts.markMode && fire(ClearMarkPoint);
                fire(GetControls).autoRotate = fire(GetOptions).autoRotate = false;
            }
            if (opts.disableRightClickFocus !== undefined) {
                viewOpts.disableRightClickFocus = opts.disableRightClickFocus;
            }
            if (opts.disableTransitionEffectOnLoad !== undefined) {
                viewOpts.disableTransitionEffectOnLoad = opts.disableTransitionEffectOnLoad;
                this.splatMesh.options({ disableTransitionEffectOnLoad: opts.disableTransitionEffectOnLoad } as any);
            }
        }

        const controls: CameraControls = fire(GetControls);
        controls.updateByOptions(opts);

        fire(Information, { scale: `1 : ${fire(GetOptions).meterScale} m` });
        return Object.assign({ ...fire(GetOptions) }, splatOpts);
    }

    /**
     * 重置
     */
    public reset(opts: Reall3dViewerOptions = {}): void {
        const that = this;
        that.dispose();
        that.disposed = false;
        that.init(initGsViewerOptions(opts));
    }

    /**
     * 光圈过渡切换显示
     * @returns
     */
    public switchDeiplayMode() {
        const that = this;
        if (that.disposed) return;
        that.events.fire(SplatSwitchDisplayMode);
    }

    /**
     * 添加大场景
     * @param sceneUrl 场景地址
     */
    public async addScene(sceneUrl: string) {
        const that = this;
        if (that.disposed) return;
        const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => this.events.on(key, fn, multiFn);
        const fire = (key: number, ...args: any): any => that.events.fire(key, ...args);

        let meta: MetaData = {};
        try {
            const res = await fetch(sceneUrl, { mode: 'cors', credentials: 'omit', cache: 'reload' });
            if (res.status === 200) {
                meta = await res.json();
            } else {
                return console.error('scene file fetch failed, status:', res.status);
            }
        } catch (e) {
            return console.error('scene file fetch failed', e.message);
        }

        if (!meta.url) return console.error('missing lod meta url');
        if (!meta.url.endsWith('.json')) return console.error('The format is unsupported in the large scene mode', meta.url);
        meta.disableTransitionEffectOnLoad && that.options({ disableTransitionEffectOnLoad: true, pointcloudMode: false });
        meta.disableTransitionEffectOnLoad && that.splatMesh.options({ pointcloudMode: false } as any);

        // 重置
        const orgOpts: Reall3dViewerOptions = fire(GetOptions);
        const opts: Reall3dViewerOptions = { root: orgOpts.root, ...meta, ...(meta.cameraInfo || {}) };
        opts.bigSceneMode = true;
        opts.qualityLevel = meta.qualityLevel || QualityLevels.Default5;
        opts.sortType = meta.sortType || SortTypes.Radial2;
        opts.viewMode = meta.viewMode;
        meta.background && (opts.background = meta.background);
        that.reset({ ...opts });

        const baseUrl = getUrl(sceneUrl, location.href);

        meta.player?.url && (meta.player.url = getUrl(meta.player.url, baseUrl));
        meta.player?.trigerRunMp3 && (meta.player.trigerRunMp3 = getUrl(meta.player.trigerRunMp3, baseUrl));
        meta.collisionUrl && (meta.collisionUrl = getUrl(meta.collisionUrl, baseUrl));
        meta.minimap && (meta.minimap.url = getUrl(meta.minimap.url, baseUrl));
        meta.audioMask && (meta.audioMask.audioUrl = getUrl(meta.audioMask.audioUrl, baseUrl));
        meta.audioMask?.audioUrl && fire(LoadCircularAudioMask, meta.audioMask);
        meta.url = getUrl(meta.url, baseUrl);
        meta.bgAudio && (meta.bgAudio = getUrl(meta.bgAudio, getUrl(sceneUrl, location.href)));
        meta.audio?.mp3 && (meta.audio.mp3 = getUrl(meta.audio.mp3, getUrl(sceneUrl, location.href)));

        on(GetMeta, () => meta);
        fire(OnMetaDataLoaded);
        setupPlayer(that.events);

        meta.bgAudio && globalEv.fire(PlaytBgAudio, meta.bgAudio, true);

        that.metaMatrix = meta.transform ? new Matrix4().fromArray(meta.transform) : null;

        // 按元数据调整更新相机、标注等信息
        that.splatMesh.meta = meta;
        isMobile && (meta.cameraInfo?.position || meta.cameraInfo?.lookAt) && that.events.fire(GetControls)._dollyOut(0.7); // 手机适当缩小

        fire(OnSetFlyPositions, meta.flyPositions || []);
        fire(OnSetFlyTargets, meta.flyTargets || []);
        fire(OnSetFlyDuration, meta.flyDuration);
        fire(OnInitMarks, meta);

        // 加载模型
        that.splatMesh.addModel({ url: meta.url, baseUrl }, meta);
        await fire(OnSetWaterMark, meta.watermark || meta.name);
        fire(GetControls).updateRotateAxis();

        ((isMobile && meta.mobileEnableJoystick) || (!isMobile && meta.pcEnableJoystick)) && fire(ShowJoystick);
    }

    /**
     * 添加要渲染的高斯模型（小场景模式）
     * @param urlOpts 高斯模型链接或元数据文件链接或选项
     */
    public async addModel(urlOpts: string | ModelOptions): Promise<void> {
        const that = this;
        if (that.disposed) return;
        const on = (key: number | string, fn?: Function, multiFn?: boolean): Function | Function[] => this.events.on(key, fn, multiFn);
        const fire = (key: number, ...args: any): any => that.events.fire(key, ...args);

        // 参数整理
        let isMetaUrl = false;
        let metaUrl = '';
        let modelOpts: ModelOptions = { url: '' };
        if (isString(urlOpts)) {
            if ((urlOpts as string).endsWith('.meta.json')) {
                metaUrl = urlOpts as string;
                isMetaUrl = true;
            } else {
                modelOpts.url = urlOpts as string;
            }
        } else if (!(urlOpts as ModelOptions).format) {
            metaUrl = (urlOpts as ModelOptions).url;
            isMetaUrl = true;
        } else {
            modelOpts = urlOpts as ModelOptions;
        }
        if (!modelOpts.url && !metaUrl) return console.error('model url is empty');

        // 获取元数据
        const opts: Reall3dViewerOptions = fire(GetOptions);
        opts.bigSceneMode = false;
        let meta: MetaData = {};
        if (!modelOpts.url.startsWith('blob:')) {
            try {
                metaUrl = metaUrl || modelOpts.url.substring(0, modelOpts.url.lastIndexOf('.')) + '.meta.json'; // xxx/abc.spx => xxx/abc.meta.json
                const res = await fetch(metaUrl, { mode: 'cors', credentials: 'omit', cache: 'reload' });
                if (res.status === 200) {
                    meta = await res.json();
                } else {
                    console.warn('meta file fetch failed, status:', res.status);
                }
            } catch (e) {
                console.warn('meta file fetch failed', e.message, modelOpts.url);
            }
        }

        // 检查整理
        meta.showWatermark = !!meta.showWatermark; // 是否显示水印文字
        meta.disableTransitionEffectOnLoad && that.options({ disableTransitionEffectOnLoad: true, pointcloudMode: false });
        meta.disableTransitionEffectOnLoad && that.splatMesh.options({ pointcloudMode: false } as any);

        meta.url = meta.url || modelOpts.url;
        if (!modelOpts.format) {
            modelOpts.url = isMetaUrl ? meta.url : modelOpts.url;
            const urlfile = modelOpts.url.split('?')[0];
            if (urlfile.endsWith('.spx')) {
                modelOpts.format = 'spx';
            } else if (urlfile.endsWith('.splat')) {
                modelOpts.format = 'splat';
            } else if (urlfile.endsWith('.ply')) {
                modelOpts.format = 'ply';
            } else if (urlfile.endsWith('.spz')) {
                modelOpts.format = 'spz';
            } else if (urlfile.endsWith('.zip') || urlfile.endsWith('.sog') || urlfile.endsWith('/meta.json') || urlfile == 'meta.json') {
                modelOpts.format = 'sog';
            } else if (urlfile.endsWith('.obj')) {
                modelOpts.format = 'obj';
            } else if (urlfile.endsWith('.glb')) {
                modelOpts.format = 'glb';
            } else {
                console.error('unknow format!', modelOpts.url);
                return;
            }
        }

        // 优先顺序： meta -> opts -> default
        meta.qualityLevel = meta.qualityLevel || opts.qualityLevel || QualityLevels.Default5;
        meta.sortType = meta.sortType || opts.sortType || SortTypes.Default1;
        meta.minimap && (meta.minimap.url = getUrl(meta.minimap.url, getUrl(metaUrl, location.href)));
        meta.audioMask && (meta.audioMask.audioUrl = getUrl(meta.audioMask.audioUrl, getUrl(metaUrl, location.href)));
        meta.audioMask?.audioUrl && fire(LoadCircularAudioMask, meta.audioMask);
        meta.disableTransitionEffectOnLoad && that.options({ disableTransitionEffectOnLoad: true, pointcloudMode: false });
        meta.disableTransitionEffectOnLoad && that.splatMesh.options({ pointcloudMode: false } as any);
        meta.bgAudio && (meta.bgAudio = getUrl(meta.bgAudio, getUrl(metaUrl, location.href)));
        meta.audio?.mp3 && (meta.audio.mp3 = getUrl(meta.audio.mp3, getUrl(metaUrl, location.href)));

        on(GetMeta, () => meta);
        fire(OnMetaDataLoaded);
        setupPlayer(that.events);
        fire(OnSetFlyDuration, meta.flyDuration);

        meta.bgAudio && globalEv.fire(PlaytBgAudio, meta.bgAudio, true);

        that.metaMatrix = meta.transform ? new Matrix4().fromArray(meta.transform) : null;

        // 按元数据调整更新相机、标注等信息
        fire(LoadSmallSceneMetaData, meta);
        this.options({ qualityLevel: meta.qualityLevel, sortType: meta.sortType, background: meta.background }); // 允许根据具体模型特点在meta中定义渲染质量级别，均衡质量性能资源

        // 加载模型
        if (modelOpts.format === 'glb') {
            const fileBytes: Uint8Array = await loadFile(modelOpts.url, that.events);
            fire(OnFetchStop, 100);
            const ui32s = new Uint32Array(fileBytes.slice(0, 32).buffer);
            const jsonLength4 = Math.floor((ui32s[3] + 3) / 4) * 4;
            const sJson = new TextDecoder().decode(fileBytes.slice(20, 20 + jsonLength4));

            // 扩展标准尚未发布，当前先初步对应
            if (/KHR_gaussian_splatting_compression_spz_2/.test(sJson)) {
                const oJson = JSON.parse(sJson);
                const buffersOffset = 20 + jsonLength4 + 8;
                const spzBytes = fileBytes
                    .subarray(buffersOffset, buffersOffset + oJson.buffers[0].byteLength)
                    .subarray(oJson.bufferViews[0].byteOffset || 0, oJson.bufferViews[0].byteLength);
                const glburl = modelOpts.url;
                modelOpts.url = URL.createObjectURL(new Blob([spzBytes as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }));
                modelOpts.format = 'spz';

                globalEv.on('Information-ver', () => `glb-spz`);

                this.splatMesh.addModel(modelOpts, meta);
                await fire(OnSetWaterMark, meta.watermark || meta.name);
                URL.revokeObjectURL(modelOpts.url);
                modelOpts.url = glburl;
            } else if (/KHR_gaussian_splatting/.test(sJson)) {
                const splatBytes = glbKhrGs2Splat(fileBytes);
                const glburl = modelOpts.url;
                modelOpts.url = URL.createObjectURL(new Blob([splatBytes as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }));
                modelOpts.format = 'splat';

                const ratio = '　' + computeCompressionRatio(splatBytes.byteLength / 32, fileBytes.byteLength);
                const size = '　' + (fileBytes.byteLength / 1024 / 1024).toFixed(1) + 'M';
                globalEv.on('Information-ver', () => `glb-gs`);
                globalEv.on('Information-ratio', () => ratio);
                globalEv.on('Information-size', () => size);

                this.splatMesh.addModel(modelOpts, meta);
                await fire(OnSetWaterMark, meta.watermark || meta.name);
                URL.revokeObjectURL(modelOpts.url);
                modelOpts.url = glburl;
            } else if (/com_github_gotoeasy_gsbox_webp_rgb_ply/.test(sJson)) {
                const oJson = JSON.parse(sJson);
                const buffersOffset = 20 + jsonLength4 + 8;
                const dataBytes = fileBytes
                    .subarray(buffersOffset, buffersOffset + oJson.buffers[0].byteLength)
                    .subarray(oJson.bufferViews[0].byteOffset || 0, oJson.bufferViews[0].byteLength);

                const { count, plyBytes, xyzs, minY, maxY } = await parseRgbPly(dataBytes);
                on('GetRgbPlyXyzs', () => xyzs);
                on('GetRgbPlyMinY', () => minY);
                on('GetRgbPlyMaxY', () => maxY);
                const urlBlob = URL.createObjectURL(new Blob([plyBytes as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }));
                modelOpts.format = 'ply';

                await fire(OnLoadAndRenderPointCloudPly, urlBlob);
                fire(Information, { renderSplatCount: count, visibleSplatCount: count, modelSplatCount: count, scene: 'small (glb-ply)' });
                URL.revokeObjectURL(urlBlob);
            } else {
                const urlBlob = URL.createObjectURL(new Blob([fileBytes as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }));
                await this.loadGlb(urlBlob, meta);
                URL.revokeObjectURL(urlBlob);
            }
        } else if (modelOpts.format === 'obj') {
            this.options({ autoRotate: false });
            await fire(OnLoadAndRenderObj, modelOpts.url);
        } else if (modelOpts.format === 'ply' && modelOpts.url.startsWith('blob:')) {
            const fileBytes: Uint8Array = await loadFile(modelOpts.url, that.events);
            fire(OnFetchStop, 100);

            let header = new TextDecoder().decode(fileBytes.slice(0, 1024 * 2));
            const header_end = 'end_header\n';
            const header_end_index = header.indexOf(header_end);
            if (header_end_index < 0) {
                if (fileBytes.byteLength > 1024 * 2) throw new Error('Unable to read .ply file header');
                return;
            }
            header = header.substring(0, header_end_index);
            if (isPointCloudPly(header)) {
                await fire(OnLoadAndRenderPointCloudPly, modelOpts.url);
            } else {
                this.splatMesh.addModel(modelOpts, meta);
                await fire(OnSetWaterMark, meta.watermark || meta.name);
            }
        } else {
            this.splatMesh.addModel(modelOpts, meta);
            await fire(OnSetWaterMark, meta.watermark || meta.name);
        }

        isMobile && fire(GetControls)._dollyOut?.(0.7); // 手机适当缩小
        ((isMobile && meta.mobileEnableJoystick) || (!isMobile && meta.pcEnableJoystick)) && fire(ShowJoystick);
    }

    private async loadGlb(urlBlob: string, meta: MetaData) {
        const fire = (key: number, ...args: any): any => this.events.fire(key, ...args);

        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath(DecoderPath);
        loader.setDRACOLoader(dracoLoader);

        loader.load(
            urlBlob,
            gltf => {
                const model = gltf.scene;

                // 对 MeshStandardMaterial 的极端参数进行修复，改为非金属，保证漫反射
                model.traverse(obj => {
                    if (!(obj as Mesh).isMesh) return;
                    const mat = (obj as Mesh).material;
                    if (mat instanceof MeshStandardMaterial && mat.metalness >= 1 && mat.roughness >= 1) mat.metalness = 0;
                });

                (fire(GetScene) as Scene).add(model);
                fire(LoadSmallSceneMetaData, meta);
                fire(MarkUpdateVisible, true);
                fire(ViewerNeedUpdate);
            },
            () => {},
            err => console.error(err),
        );
    }

    // /**
    //  * 根据需要暴露的接口
    //  */
    // private initGsApi() {
    //     const that = this;
    //     const fire = (key: number, ...args: any): any => this.events.fire(key, ...args);
    //     const switchAutoRotate = () => {
    //         setTimeout(() => window.focus());
    //         fire(FlyDisable);
    //         fire(GetControls).autoRotate = fire(GetOptions).autoRotate = !fire(GetOptions).autoRotate;
    //     };
    //     const changePointCloudMode = (pointcloudMode: boolean = true) => {
    //         setTimeout(() => window.focus());
    //         pointcloudMode = !!pointcloudMode;
    //         const opts: Reall3dViewerOptions = fire(GetOptions);
    //         if (opts.pointcloudMode === pointcloudMode) return;
    //         opts.bigSceneMode ? fire(SplatSetPointcloudMode, pointcloudMode) : fire(SplatSwitchDisplayMode);
    //     };
    //     const showMark = (visible: boolean = true) => {
    //         setTimeout(() => window.focus());
    //         fire(MarkUpdateVisible, !!visible);
    //     };
    //     const startMark = (markType: number): boolean => {
    //         setTimeout(() => window.focus());
    //         const opts: Reall3dViewerOptions = fire(GetOptions);
    //         if (opts.markMode) return false;
    //         if (markType === 1) {
    //             opts.markType = 'point';
    //         } else if (markType === 2) {
    //             opts.markType = 'lines';
    //         } else if (markType === 3) {
    //             opts.markType = 'plans';
    //         } else if (markType === 4) {
    //             opts.markType = 'distance';
    //         } else {
    //             return false;
    //         }
    //         opts.markMode = true;
    //         fire(StopAutoRotate);
    //         return true;
    //     };
    //     const deleteMark = async (name: string): Promise<boolean> => {
    //         setTimeout(() => window.focus());
    //         if (!name) return false;
    //         fire(GetMarkFromWeakRef, name)?.dispose();
    //         fire(ViewerNeedUpdate);
    //         return await fire(MetaMarkSaveData);
    //     };
    //     const updateMark = async (data: MarkData, saveData: boolean = true): Promise<boolean> => {
    //         fire(UpdateAllMarkByMeterScale, data, saveData);
    //         fire(GetMarkFromWeakRef, data?.name)?.drawUpdate?.(data, saveData);
    //         fire(ViewerNeedUpdate);
    //         if (saveData) {
    //             setTimeout(() => window.focus());
    //             return await fire(MetaMarkSaveData);
    //         }
    //         return true;
    //     };
    //     const showWaterMark = (visible: boolean = true) => {
    //         setTimeout(() => window.focus());
    //         that.splatMesh.fire(SplatUpdateShowWaterMark, !!visible);
    //     };
    //     const setWaterMark = (text: string, save: boolean = true) => {
    //         fire(OnSetWaterMark, text);
    //         save && fire(MetaSaveWatermark, text);
    //     };
    //     const captureScreenshot = () => fire(CaptureScreenshot);
    //     window['$api'] = {
    //         captureScreenshot,
    //         switchAutoRotate,
    //         changePointCloudMode,
    //         showMark,
    //         startMark,
    //         deleteMark,
    //         updateMark,
    //         showWaterMark,
    //         setWaterMark,
    //     };
    // }

    /**
     * 销毁渲染器不再使用
     */
    public dispose(): void {
        const that = this;
        if (that.disposed) return;
        that.disposed = true;
        const fire = (key: number, ...args: any): any => that.events.fire(key, ...args);

        const renderer: WebGLRenderer = fire(GetRenderer);
        const canvas = renderer.domElement as HTMLCanvasElement;

        fire(OnViewerDispose);
        fire(CommonUtilsDispose);
        fire(ViewerUtilsDispose);
        (fire(GetControls) as CameraControls).dispose();

        fire(TraverseDisposeAndClear, fire(GetScene));

        renderer.clear();
        renderer.dispose();

        canvas.parentElement.removeChild(canvas);
        that.splatMesh = null;
        that.events.clear();
        that.events = null;
    }
}
