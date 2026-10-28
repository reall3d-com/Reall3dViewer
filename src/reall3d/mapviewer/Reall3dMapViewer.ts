// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { AmbientLight, Clock, DirectionalLight, EventDispatcher, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { Events } from '../events/Events';
import { Reall3dMapViewerOptions } from './Reall3dMapViewerOptions';
import {
    CountFpsDefault,
    CountFpsReal,
    GetCameraFov,
    GetCameraLookAt,
    GetCameraLookUp,
    GetCameraPosition,
    GetFpsDefault,
    GetFpsReal,
    GetOptions,
    ViewerDispose,
    Information,
    IsDebugMode,
    KeyActionCheckAndExecute,
    MapCreateControls,
    MapCreateDirLight,
    MapCreateRenderer,
    MapCreateScene,
    OnViewerAfterUpdate,
    OnViewerBeforeUpdate,
    OnViewerUpdate,
    Vector3ToString,
    MapSortSplatMeshRenderOrder,
    MapSceneTraverseDispose,
    GetCSS3DRenderer,
    GetCamera,
    GetMeta,
    OnSetFlyPositions,
    OnSetFlyTargets,
    AddFlyPosition,
    Flying,
    ClearFlyPosition,
    FlySavePositions,
    OnSetFlyDuration,
    OnViewerDispose,
    GetCSS2DRenderer,
    RenderCSS2D3D,
    OnMetaDataLoaded,
    PlaytBgAudio,
} from '../events/EventConstants';
import { initMapViewerOptions, initTileMap } from '../scene/SetupMapUtils';
import { setupAllEventsMapVerwer } from '../scene/SetupAllEvents';
import { CSS2DRenderer, CSS3DRenderer } from 'three/examples/jsm/Addons.js';
import { WarpSplatMesh } from './warpsplatmesh/WarpSplatMesh';
import { isMobile, ViewerVersion } from '../utils/GlobalConstants';
import * as tt from '@gotoeasy/three-tile';
import { globalEv } from '../events/GlobalEV';

/**
 * Built-in Map viewer with Gaussian Splatting model support
 */
export class Reall3dMapViewer extends EventDispatcher<tt.plugin.GLViewerEventMap> {
    public scene: Scene;
    public renderer: WebGLRenderer;
    public camera: PerspectiveCamera;
    public controls: MapControls;
    public ambLight: AmbientLight;
    public dirLight: DirectionalLight;
    public container: HTMLElement;
    public tileMap: tt.TileMap;
    public events: Events;

    private clock: Clock = new Clock();
    private updateTime: number = 0;
    private disposed: boolean = false;

    constructor(options: Reall3dMapViewerOptions = {}) {
        console.info('Reall3dMapViewer', ViewerVersion);
        super();

        const that = this;
        const events = new Events();
        that.events = events;
        const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
        const fire = (key: number, ...args: any): any => events.fire(key, ...args);

        that.tileMap = initTileMap();
        const opts: Reall3dMapViewerOptions = initMapViewerOptions(options);
        on(GetOptions, () => opts);
        that.camera = new PerspectiveCamera(60, 1, 0.01, 100);
        on(GetCamera, () => that.camera);

        setupAllEventsMapVerwer(events);

        that.container = opts.root as HTMLElement;
        that.renderer = fire(MapCreateRenderer);
        that.scene = fire(MapCreateScene);
        that.controls = fire(MapCreateControls);
        that.ambLight = new AmbientLight(0xffffff, 1);
        that.scene.add(that.ambLight);
        that.dirLight = fire(MapCreateDirLight);
        that.scene.add(that.dirLight);
        that.scene.add(that.tileMap);
        that.container.appendChild(that.renderer.domElement);

        window.addEventListener('resize', that.resize.bind(that));
        that.resize();
        that.renderer.setAnimationLoop(that.animate.bind(that));
        isMobile && (that.controls as any)._dollyOut?.(0.7); // 手机适当缩小

        on(OnMetaDataLoaded, () => {}, true);
        on(ViewerDispose, () => that.dispose());

        on(
            OnViewerBeforeUpdate,
            () => {
                fire(CountFpsReal);
                that.controls.update();
                fire(MapSortSplatMeshRenderOrder);
                fire(KeyActionCheckAndExecute);
            },
            true,
        );

        on(
            OnViewerUpdate,
            () => {
                that.tileMap.update(that.camera);
                try {
                    that.renderer.render(that.scene, that.camera);
                    fire(RenderCSS2D3D);
                } catch (e) {
                    console.warn(e.message);
                }
            },
            true,
        );

        on(
            OnViewerAfterUpdate,
            () => {
                that.dispatchEvent({ type: 'update', delta: that.clock.getDelta() });
                that.updateTime = Date.now();

                fire(IsDebugMode) &&
                    fire(Information, {
                        fps: fire(GetFpsDefault),
                        realFps: fire(GetFpsReal),
                        fov: fire(GetCameraFov),
                        position: fire(Vector3ToString, fire(GetCameraPosition)),
                        lookAt: fire(Vector3ToString, fire(GetCameraLookAt)),
                        lookUp: fire(Vector3ToString, fire(GetCameraLookUp)),
                    });
            },
            true,
        );
    }

    /**
     * 打开地图场景
     * @param 场景索引文件地址
     */
    public addScenes(urlScenesJson: string) {
        const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => this.events.on(key, fn, multiFn);
        const fire = (key: number, ...args: any): any => this.events.fire(key, ...args);

        const that = this;
        fetch(urlScenesJson, { mode: 'cors', credentials: 'omit', cache: 'reload' })
            .then(response => (!response.ok ? {} : response.json()))
            .then((data: ScenesJsonData) => {
                const position = new Vector3().fromArray(data.position || [17000, 30000, -35000]);
                const lookAt = new Vector3().fromArray(data.lookAt || [17000, 0, -35000]);
                that.controls.object.position.copy(position);
                that.controls.target.copy(lookAt);
                that.dirLight.target.position.copy(lookAt);

                on(GetMeta, () => data);
                fire(OnMetaDataLoaded);
                fire(OnSetFlyPositions, data.flyPositions || []);
                fire(OnSetFlyTargets, data.flyTargets || []);
                fire(OnSetFlyDuration, data.flyDuration);

                const set = new Set<string>();
                for (let url of data.scenes) {
                    url = new URL(url, urlScenesJson).href;

                    if (!set.has(url)) {
                        new WarpSplatMesh(url, that);
                        set.add(url);
                    }
                }

                data.scenes = [...set];

                data.bgAudio && (data.bgAudio = new URL(data.bgAudio, urlScenesJson).href);
                data.bgAudio && globalEv.fire(PlaytBgAudio, data.bgAudio, true);

                setTimeout(() => !that.disposed && fire(Flying, true), 1000);
            })
            .catch(e => {
                console.error(e.message);
            });
    }

    // 开发调试用临时接口
    public fire(n: number, p1?: any, p2?: any): void {
        const that = this;
        n === 2 && that.events.fire(AddFlyPosition);
        n === 3 && that.events.fire(Flying, true);
        n === 4 && that.events.fire(ClearFlyPosition);
        n === 5 && that.events.fire(FlySavePositions);
    }

    private resize() {
        const that = this;
        if (that.disposed) return;
        const { width, height, top, left } = that.container.getBoundingClientRect();
        // that.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        that.renderer.setPixelRatio(1); // 地图总是只按屏幕像素渲染
        that.renderer.setSize(width, height);
        that.camera.aspect = width / height;
        that.camera.updateProjectionMatrix();
        const cSS3DRenderer: CSS3DRenderer = that.events.fire(GetCSS3DRenderer);
        cSS3DRenderer.setSize(width, height);
        cSS3DRenderer.domElement.style.position = 'absolute';
        cSS3DRenderer.domElement.style.left = `${left}px`;
        cSS3DRenderer.domElement.style.top = `${top}px`;
        const cSS2DRenderer: CSS2DRenderer = that.events.fire(GetCSS2DRenderer);
        cSS2DRenderer.setSize(width, height);
        cSS2DRenderer.domElement.style.position = 'absolute';
        cSS2DRenderer.domElement.style.left = `${left}px`;
        cSS2DRenderer.domElement.style.top = `${top}px`;
    }

    private animate() {
        const that = this;
        const fire = (key: number, ...args: any): any => that.events.fire(key, ...args);
        fire(CountFpsDefault);
        if (Date.now() - that.updateTime > 17) {
            fire(OnViewerBeforeUpdate);
            fire(OnViewerUpdate);
            fire(OnViewerAfterUpdate);
        }
    }

    /**
     * 销毁
     */
    public dispose() {
        const that = this;
        if (that.disposed) return;
        that.disposed = true;

        const canvas = that.renderer.domElement;

        that.events.fire(OnViewerDispose);

        that.events.fire(MapSceneTraverseDispose);
        that.renderer.clear();
        that.renderer.dispose();
        that.events.clear();

        that.scene = null;
        that.renderer = null;
        that.camera = null;
        that.controls = null;
        that.ambLight = null;
        that.dirLight = null;
        that.container.removeChild(canvas);
        that.container.classList.add('hidden');
        that.container = null;
        that.clock = null;
        that.events = null;
        that.tileMap = null;

        document.querySelector('#gsviewer .debug.dev-panel')?.classList?.remove('map');
    }
}

/**
 * 地图入口索引文件
 */
export interface ScenesJsonData {
    /**
     *  名称
     */
    name?: string;

    /**
     * 版本
     */
    version?: string;

    /**
     * 初始相机位置
     */
    position?: number[];

    /**
     * 初始相机视点
     */
    lookAt?: number[];

    /**
     * 场景url列表
     */
    scenes?: string[];

    /** bg Audio */
    bgAudio?: string;

    /** Fly-through camera positions */
    flyPositions?: number[];
    /** Fly-through camera look-at points */
    flyTargets?: number[];
    /** Fly duration */
    flyDuration?: number;
}
