// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Color, DirectionalLight, FogExp2, MathUtils, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import {
    GetControls,
    GetOptions,
    MapCreateControls,
    GetRenderer,
    GetScene,
    MapCreateRenderer,
    MapCreateScene,
    MapCreateDirLight,
    GetCamera,
    ViewerDispose,
    GetCanvas,
    MapGetSplatMesh,
    MapSplatMeshRotateX,
    MapSplatMeshRotateY,
    MapSplatMeshRotateZ,
    MapSplatMeshMoveX,
    MapSplatMeshMoveY,
    MapSplatMeshMoveZ,
    MapSplatMeshScale,
    MapSplatMeshShowHide,
    MapSplatMeshSaveModelMatrix,
    HttpPostMetaData,
    MapSplatMeshSetPosition,
    CountFpsDefault,
    GetFpsDefault,
    CountFpsReal,
    GetFpsReal,
    IsDebugMode,
    ComputeFps,
    GetCameraFov,
    GetCameraPosition,
    GetCameraLookAt,
    GetCameraLookUp,
    MapSortSplatMeshRenderOrder,
    MapSceneTraverseDispose,
} from '../events/EventConstants';
import { Events } from '../events/Events';
import { Reall3dMapViewerOptions } from '../mapviewer/Reall3dMapViewerOptions';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { SplatMesh } from '../meshs/splatmesh/SplatMesh';
import { WarpSplatMesh } from '../mapviewer/warpsplatmesh/WarpSplatMesh';
import { isMobile } from '../utils/GlobalConstants';
import * as tt from '@gotoeasy/three-tile';

export function setupMapUtils(events: Events) {
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    const MaxActiveCount: number = isMobile ? 2 : 20;

    const fpsMap: Map<number, any> = new Map();
    const fpsRealMap: Map<number, any> = new Map();
    on(CountFpsDefault, () => fire(IsDebugMode) && fpsMap.set(Date.now(), 1));
    on(GetFpsDefault, () => fire(IsDebugMode) && fire(ComputeFps, fpsMap));
    on(CountFpsReal, () => fire(IsDebugMode) && fpsRealMap.set(Date.now(), 1));
    on(GetFpsReal, () => fire(IsDebugMode) && fire(ComputeFps, fpsRealMap));
    on(ComputeFps, (map: Map<number, any>) => {
        let dels: number[] = [];
        let now: number = Date.now();
        let rs: number = 0;
        for (const key of map.keys()) {
            now - key <= 1000 ? rs++ : dels.push(key);
        }
        dels.forEach(key => map.delete(key));
        return Math.min(rs, 60);
    });

    on(MapGetSplatMesh, () => {
        const scene: Scene = fire(GetScene);
        const camera: PerspectiveCamera = fire(GetCamera);
        const warpMeshs: WarpSplatMesh[] = [];
        scene?.traverse(function (child: any) {
            child.isWarpSplatMesh && (child as WarpSplatMesh).splatMesh?.visible && warpMeshs.push(child);
        });
        warpMeshs.sort((a, b) => camera.position.distanceTo(a.position) - camera.position.distanceTo(b.position));
        for (let i = 0; i < warpMeshs.length; i++) {
            warpMeshs[i].splatMesh.boundBox.visible = i < 1;
        }
        window['splat'] = warpMeshs[0]?.splatMesh;
        return warpMeshs[0]?.splatMesh;
    });

    on(MapSortSplatMeshRenderOrder, () => {
        const scene: Scene = fire(GetScene);
        const camera: PerspectiveCamera = fire(GetCamera);
        const warpMeshs: WarpSplatMesh[] = [];
        scene?.traverse(function (child: any) {
            child.isWarpSplatMesh && warpMeshs.push(child);
        });
        warpMeshs.sort((a, b) => camera.position.distanceTo(a.position) - camera.position.distanceTo(b.position));
        for (let i = 0; i < warpMeshs.length; i++) {
            warpMeshs[i].active = i < MaxActiveCount;
            warpMeshs[i].splatMesh && (warpMeshs[i].splatMesh.renderOrder = 1000 - i);
        }
    });

    on(MapSceneTraverseDispose, () => {
        const scene: Scene = fire(GetScene);
        const objects: any[] = [];
        scene?.traverse((object: any) => objects.push(object));
        objects.forEach((object: any) => {
            if (object.dispose) {
                object.dispose();
            } else {
                object.geometry?.dispose?.();
                object.material && object.material instanceof Array
                    ? object.material.forEach((material: any) => material?.dispose?.())
                    : object.material?.dispose?.();
            }
        });
        scene?.clear();
    });

    on(MapSplatMeshRotateX, (deg: number = 0.1) => {
        const splatMesh: SplatMesh = fire(MapGetSplatMesh);
        splatMesh && splatMesh.visible && splatMesh.rotateOnAxis(new Vector3(1, 0, 0), MathUtils.degToRad(deg));
    });
    on(MapSplatMeshRotateY, (deg: number = 0.1) => {
        const splatMesh: SplatMesh = fire(MapGetSplatMesh);
        splatMesh && splatMesh.visible && splatMesh.rotateOnAxis(new Vector3(0, 1, 0), MathUtils.degToRad(deg));
    });
    on(MapSplatMeshRotateZ, (deg: number = 0.1) => {
        const splatMesh: SplatMesh = fire(MapGetSplatMesh);
        splatMesh && splatMesh.visible && splatMesh.rotateOnAxis(new Vector3(0, 0, 1), MathUtils.degToRad(deg));
    });
    on(MapSplatMeshMoveX, (step: number = 0.01) => {
        const splatMesh: SplatMesh = fire(MapGetSplatMesh);
        splatMesh && splatMesh.visible && (splatMesh.position.x += step);
    });
    on(MapSplatMeshMoveY, (step: number = 0.01) => {
        const splatMesh: SplatMesh = fire(MapGetSplatMesh);
        splatMesh && splatMesh.visible && (splatMesh.position.y += step);
    });
    on(MapSplatMeshMoveZ, (step: number = 0.01) => {
        const splatMesh: SplatMesh = fire(MapGetSplatMesh);
        splatMesh && splatMesh.visible && (splatMesh.position.z += step);
    });
    on(MapSplatMeshSetPosition, (v3: Vector3) => {
        const splatMesh: SplatMesh = fire(MapGetSplatMesh);
        splatMesh && splatMesh.visible && v3 && splatMesh.position.copy(v3);
    });
    on(MapSplatMeshScale, (step: number = 0.01) => {
        const splatMesh: SplatMesh = fire(MapGetSplatMesh);
        splatMesh && splatMesh.visible && splatMesh.scale.set(splatMesh.scale.x + step, splatMesh.scale.y + step, splatMesh.scale.z + step);
    });
    on(MapSplatMeshShowHide, () => {
        const splatMesh: SplatMesh = fire(MapGetSplatMesh);
        splatMesh && (splatMesh.visible = !splatMesh.visible);
    });
    on(MapSplatMeshSaveModelMatrix, async (splatMesh?: SplatMesh) => {
        !splatMesh && (splatMesh = fire(MapGetSplatMesh));
        if (!splatMesh) return;
        const meta = splatMesh.meta || {};
        meta.transform = splatMesh.matrix.toArray();
        return await fire(HttpPostMetaData, JSON.stringify(meta), splatMesh.meta.url);
    });

    on(MapCreateRenderer, () => {
        const root = fire(GetOptions).root as HTMLElement;
        const renderer = new WebGLRenderer({
            antialias: false,
            stencil: true,
            alpha: true,
            logarithmicDepthBuffer: true,
            premultipliedAlpha: false,
            precision: 'highp',
            powerPreference: 'high-performance',
        });
        renderer.setSize(root.clientWidth, root.clientHeight);
        // renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.setPixelRatio(1); // 地图总是只按屏幕像素渲染

        on(GetRenderer, () => renderer);
        on(GetCanvas, () => renderer.domElement);
        return renderer;
    });

    on(MapCreateScene, () => {
        const opts: Reall3dMapViewerOptions = fire(GetOptions);
        const scene = new Scene();
        const backColor = opts.background || '#dbf0ff';
        scene.background = new Color(backColor);
        scene.fog = new FogExp2(backColor, 0);
        on(GetScene, () => scene);
        return scene;
    });

    on(MapCreateControls, () => {
        const fogFactor = 1.0;
        const camera: PerspectiveCamera = fire(GetCamera);
        const scene: Scene = fire(GetScene);
        const opts: Reall3dMapViewerOptions = fire(GetOptions);
        const controls = new MapControls(fire(GetCamera), opts.root as HTMLElement);
        controls.screenSpacePanning = false;
        controls.minDistance = 0.1;
        controls.maxDistance = 60000;
        controls.maxPolarAngle = 1.2;
        controls.enableDamping = true;
        controls.dampingFactor = 0.07;
        controls.zoomToCursor = true;

        const minPan = new Vector3().fromArray(opts.minPan || [-20000, 0.1, -60000]);
        const maxPan = new Vector3().fromArray(opts.maxPan || [50000, 10000, 0]);
        const _v = new Vector3();

        controls.addEventListener('change', () => {
            const polar = Math.max(controls.getPolarAngle(), 0.1); // camera polar
            const dist = Math.max(controls.getDistance(), 0.1); // dist of camera to controls
            controls.zoomSpeed = Math.max(Math.log(dist), 0) + 0.5; // set zoom speed on dist

            camera.far = MathUtils.clamp((dist / polar) * 8, 100, 100000); // set far and near on dist/polar
            camera.near = camera.far / 1000;
            camera.updateProjectionMatrix();

            if (scene.fog instanceof FogExp2) {
                scene.fog.density = (polar / (dist + 5)) * fogFactor * 0.25; // set fog density on dist/polar
            }
            controls.maxPolarAngle = Math.min(Math.pow(10000 / dist, 4), 1.2); // limit the max polar on dist

            _v.copy(controls.target);
            controls.target.clamp(minPan, maxPan);
            _v.sub(controls.target);
            camera.position.sub(_v);
        });

        on(GetControls, () => controls);

        on(GetCameraFov, () => camera.fov);
        on(GetCameraPosition, (copy: boolean = false) => (copy ? camera.position.clone() : camera.position));
        on(GetCameraLookAt, (copy: boolean = false) => (copy ? controls.target.clone() : controls.target));
        on(GetCameraLookUp, (copy: boolean = false) => (copy ? camera.up.clone() : camera.up));

        return controls;
    });

    on(MapCreateDirLight, () => {
        const dirLight = new DirectionalLight(0xffffff, 1);
        dirLight.position.set(0, 2e3, 1e3);
        return dirLight;
    });

    window.addEventListener('beforeunload', () => fire(ViewerDispose));
}

export function initMapViewerOptions(options: Reall3dMapViewerOptions): Reall3dMapViewerOptions {
    let { root = '#map', debugMode } = options;
    if (root) {
        root = typeof root === 'string' ? ((document.querySelector(root) || document.querySelector('#map')) as HTMLElement) : root;
    } else {
        root = document.querySelector('#map') as HTMLElement;
    }
    if (!root) {
        root = document.createElement('div');
        root.id = 'map';
        (document.querySelector('#gsviewer') || document.querySelector('body')).appendChild(root);
    }

    const opts: Reall3dMapViewerOptions = { ...options };
    opts.root = root;
    return opts;
}

export function initTileMap(): tt.TileMap {
    // const TOKEN = '7f8f4f56f3ccda758f9a497e2b981018';
    // const tdtImgSource = new tt.plugin.TDTSource({ token: TOKEN, style: 'img_w' });
    // const tdtVecSource = new tt.plugin.TDTSource({ token: TOKEN, style: 'cia_w' });
    // const imgSource = location.host.includes('reall3d.com') ? [tdtImgSource, tdtVecSource] : new tt.plugin.BingSource();

    const imgSource = new tt.plugin.BingSource();

    // const imgSource = new tt.plugin.BingSource();

    // const imgSource = [new tt.plugin.GDSource({ style: '6' }), new tt.plugin.GDSource({ style: '8' })];
    // const imgSource = [new tt.plugin.TXSource(), new tt.plugin.GDSource({ style: '8' })];

    // const imgSource = tt.TileSource.create({
    //     dataType: 'image',
    //     attribution: 'ArcGIS',
    //     url: 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    // });

    const tileMap = new tt.TileMap({ imgSource, lon0: 90, minLevel: 2, maxLevel: 16 });
    tileMap.scale.set(10, 10, 10);
    tileMap.rotateX(-Math.PI / 2);
    tileMap.autoUpdate = false;
    return tileMap;
}
