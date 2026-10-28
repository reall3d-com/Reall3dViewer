// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Events } from '../events/Events';
import {
    ComputeFps,
    GetFpsReal,
    CountFpsReal,
    Vector3ToString,
    CountFpsDefault,
    GetFpsDefault,
    Information,
    IsDebugMode,
    ViewerUtilsDispose,
    OnViewerBeforeUpdate,
    ControlsUpdate,
    ViewerDispose,
    GetCameraFov,
    GetCameraPosition,
    GetCameraLookAt,
    GetCameraLookUp,
    GetScene,
    ViewerNeedUpdate,
    Flying,
    OnFetchStop,
    OnLoadAndRenderObj,
    OnLoadAndRenderPointCloudPly,
    MarkUpdateVisible,
    LoadSmallSceneMetaData,
} from '../events/EventConstants';
import { loadFile } from '../modeldata/loaders/FileLoader';
import { PLYLoader } from 'three/examples/jsm/Addons.js';
import { Points, PointsMaterial } from 'three';

export function setupViewerUtils(events: Events) {
    let disposed: boolean = false;
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    on(ViewerUtilsDispose, () => (disposed = true));

    const fpsMap: Map<number, any> = new Map();
    const fpsRealMap: Map<number, any> = new Map();
    on(CountFpsDefault, () => fire(IsDebugMode) && fpsMap.set(Date.now(), 1));
    on(GetFpsDefault, () => fire(IsDebugMode) && fire(ComputeFps, fpsMap));
    on(CountFpsReal, () => fire(IsDebugMode) && fpsRealMap.set(Date.now(), 1));
    on(GetFpsReal, () => fire(IsDebugMode) && fire(ComputeFps, fpsRealMap));

    let iRenderCnt: number = 0;
    on(
        OnViewerBeforeUpdate,
        () => {
            if (disposed) return;
            fire(ControlsUpdate);
            if (fire(IsDebugMode)) {
                fire(CountFpsDefault);
                !(iRenderCnt++ % 5) &&
                    fire(Information, {
                        fps: fire(GetFpsDefault),
                        realFps: fire(GetFpsReal),
                        fov: fire(GetCameraFov),
                        position: fire(Vector3ToString, fire(GetCameraPosition)),
                        lookAt: fire(Vector3ToString, fire(GetCameraLookAt)),
                        lookUp: fire(Vector3ToString, fire(GetCameraLookUp)),
                    });
            }
        },
        true,
    );

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

    window.addEventListener('beforeunload', () => fire(ViewerDispose));

    on(OnLoadAndRenderObj, async (url: string) => {
        fire(Information, { scene: `small (obj)` });
        const datas = await loadFile(url, events);
        if (datas) {
            const url = URL.createObjectURL(new Blob([datas as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }));
            new OBJLoader().load(url, object => fire(GetScene).add(object));
            fire(ViewerNeedUpdate, true);
            fire(Flying, true);
        }
        fire(OnFetchStop, 0);
    });

    on(OnLoadAndRenderPointCloudPly, async (url: string) => {
        fire(Information, { scene: `small (ply)` });
        const datas = await loadFile(url, events);
        if (datas) {
            const url = URL.createObjectURL(new Blob([datas as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }));
            new PLYLoader().load(url, geometry => {
                const material = new PointsMaterial({ size: 0.05, vertexColors: true });
                const pointCloud = new Points(geometry, material);
                fire(GetScene).add(pointCloud);

                fire(ViewerNeedUpdate);
            });
        }

        fire(OnFetchStop, 0);
    });
}
