// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { PerspectiveCamera, Vector3, WebGLRenderer } from 'three';
import { SplatMeshOptions, TransitionEffects } from '../meshs/splatmesh/SplatMeshOptions';
import { Reall3dViewerOptions } from '../viewer/Reall3dViewerOptions';
import { QualityLevels, SortTypes } from './GlobalConstants';
import { MetaData } from '../modeldata/MetaData';
import { getUrl } from './CommonUtils';
import { SplatTiles } from '../modeldata/SplatTiles';

export function initSplatMeshOptions(options: SplatMeshOptions): SplatMeshOptions {
    const opts: SplatMeshOptions = { ...options };

    // 默认参数校验设定
    opts.bigSceneMode ??= false;
    opts.pointcloudMode ??= !opts.bigSceneMode; // 小场景默认点云模式，大场景默认正常模式
    opts.name ??= '';
    opts.showWatermark ??= false;
    opts.shDegree ??= 0;
    opts.depthTest ??= true;
    opts.debugMode ??= false;
    opts.mapMode && (opts.sortType = SortTypes.Default1);
    opts.transitionEffect ??= TransitionEffects.ModelCenterCirccle;

    return opts;
}

export function initGsViewerOptions(options: Reall3dViewerOptions): Reall3dViewerOptions {
    const opts: Reall3dViewerOptions = { ...options };

    // 默认参数校验设定
    opts.position = opts.position ? [...opts.position] : [0, -5, 15];
    opts.lookAt = opts.lookAt ? [...opts.lookAt] : [0, 0, 0];
    opts.lookUp = opts.lookUp ? [...opts.lookUp] : [0, -1, 0];
    opts.fov ??= 45;
    opts.near ??= 0.01;
    opts.far ??= 10000;
    opts.enableDamping ??= true;
    opts.autoRotate ??= true;
    opts.enableZoom ??= true;
    opts.enableRotate ??= true;
    opts.enablePan ??= true;
    opts.enableKeyboard ??= true;
    opts.bigSceneMode ??= false;
    opts.pointcloudMode ??= !opts.bigSceneMode; // 小场景默认点云模式，大场景默认正常模式
    opts.lightFactor ??= 1.1;
    opts.debugMode ??= location.protocol === 'http:' || /^test\./.test(location.host); // 生产环境不开启
    opts.markMode ??= false;
    opts.markVisible ??= true;
    opts.meterScale ??= 1;
    opts.background ??= '#000000';
    opts.minDistance ??= 0.1;
    opts.maxDistance ??= 5000;
    opts.qualityLevel ??= QualityLevels.Default5;
    opts.sortType ??= SortTypes.Default1;
    opts.transitionEffect ??= TransitionEffects.ModelCenterCirccle;
    opts.disableRightClickFocus ??= false;

    return opts;
}

export function initRenderer(opts: Reall3dViewerOptions): WebGLRenderer {
    let root: HTMLElement;
    if (opts.root) {
        root = typeof opts.root === 'string' ? document.querySelector(opts.root) || document.querySelector('#gsviewer') : opts.root;
    } else {
        root = document.querySelector('#gsviewer');
    }
    if (!root) {
        root = document.createElement('div');
        root.id = 'gsviewer';
        document.body.appendChild(root);
    }

    let renderer = null;
    if (!opts.renderer) {
        renderer = new WebGLRenderer({
            antialias: false,
            stencil: false,
            premultipliedAlpha: false,
            precision: 'highp',
            powerPreference: 'high-performance',
        });
        renderer.setSize(root.clientWidth, root.clientHeight);
        renderer.setPixelRatio(Math.min(devicePixelRatio, opts.qualityLevel > QualityLevels.Default5 ? 2 : 1));
        opts.renderer = renderer;
    } else {
        renderer = opts.renderer;
    }
    renderer.autoClear = true;

    const canvas = renderer.domElement;
    canvas.classList.add('gsviewer-canvas');
    root.appendChild(renderer.domElement);
    return renderer;
}

export function initCamera(opts: Reall3dViewerOptions): PerspectiveCamera {
    let camera = opts.camera;
    if (!camera) {
        const canvas: HTMLCanvasElement = opts.renderer.domElement;
        const aspect = canvas.width / canvas.height;
        let lookUp: Vector3 = new Vector3().fromArray(opts.lookUp);
        let lookAt: Vector3 = new Vector3().fromArray(opts.lookAt);
        let position = new Vector3().fromArray(opts.position);

        camera = new PerspectiveCamera(opts.fov, aspect, opts.near, opts.far);
        camera.position.copy(position);
        camera.up.copy(lookUp).normalize();
        camera.lookAt(lookAt);
        opts.camera = camera;
    }
    return opts.camera;
}

export function copyGsViewerOptions(gsViewerOptions: Reall3dViewerOptions): SplatMeshOptions {
    const { renderer, scene } = gsViewerOptions;
    const opts: SplatMeshOptions = { renderer, scene };
    opts.viewerEvents = gsViewerOptions.viewerEvents;
    opts.debugMode = gsViewerOptions.debugMode;
    opts.renderer = gsViewerOptions.renderer;
    opts.scene = gsViewerOptions.scene;
    opts.controls = gsViewerOptions.controls;
    opts.bigSceneMode = gsViewerOptions.bigSceneMode;
    opts.pointcloudMode = gsViewerOptions.pointcloudMode;
    opts.shDegree = gsViewerOptions.shDegree;
    opts.qualityLevel = gsViewerOptions.qualityLevel;
    opts.sortType = gsViewerOptions.sortType;
    opts.disableTransitionEffectOnLoad = !!gsViewerOptions.disableTransitionEffectOnLoad;
    opts.transitionEffect = gsViewerOptions.transitionEffect || TransitionEffects.ModelCenterCirccle;
    opts.viewMode = gsViewerOptions.viewMode;

    return opts;
}

// 大场景默认配置，并非推荐配置，仅方便直接查看用
export async function genDefaultSceneMeta(lodUrl: string): Promise<MetaData> {
    const name = 'default settings';
    const version = '1.0';
    const autoRotate = false;
    const pointcloudMode = false;
    const url = getUrl(lodUrl, location.href);
    let meta: MetaData = { name, version, autoRotate, pointcloudMode, url };
    let lod = {} as SplatTiles;
    try {
        const res = await fetch(lodUrl, { mode: 'cors', credentials: 'omit', cache: 'reload' });
        if (res.status === 200) {
            lod = await res.json();
        } else {
            console.error('scene file fetch failed, status:', res.status);
            return meta;
        }
    } catch (e) {
        console.error('scene file fetch failed', e.message);
        return meta;
    }

    const targets = [];
    const distances = [];
    for (let i = 0; i < lod.lodLevels; i++) {
        targets.push(i);
        i && distances.push(i * 10);
    }
    meta.mobileLodTargets = [...targets];
    meta.mobileLodDistances = [...distances];
    meta.pcLodTargets = [...targets];
    meta.pcLodDistances = [...distances];
    meta.cameraInfo = { position: [0, -5, 15], lookAt: [0, 0, 0], lookUp: [0, -1, 0] };

    return meta;
}
