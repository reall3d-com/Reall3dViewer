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
    GetScreenshotBase64,
    GetRenderer,
    GetCamera,
} from '../events/EventConstants';
import { loadFile } from '../modeldata/loaders/FileLoader';
import { PLYLoader } from 'three/examples/jsm/Addons.js';
import { Points, PointsMaterial, WebGLRenderer, WebGLRenderTarget } from 'three';

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

    on(GetScreenshotBase64, (w = 600, h = 338) => {
        const renderer: WebGLRenderer = fire(GetRenderer);
        const width = w || renderer.domElement.width;
        const height = h || renderer.domElement.height;
        const renderTarget = new WebGLRenderTarget(width, height);

        renderer.setRenderTarget(renderTarget);
        renderer.render(fire(GetScene), fire(GetCamera));
        renderer.setRenderTarget(null);

        // 读取像素数据
        const pixels = new Uint8Array(width * height * 4);
        renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels);

        // 创建Canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx!.createImageData(width, height);

        // 像素倒序（WebGL原点和Canvas不同）
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const destIdx = (y * width + x) * 4;
                const srcIdx = ((height - y - 1) * width + x) * 4; // 镜像
                imgData.data[destIdx] = pixels[srcIdx];
                imgData.data[destIdx + 1] = pixels[srcIdx + 1];
                imgData.data[destIdx + 2] = pixels[srcIdx + 2];
                imgData.data[destIdx + 3] = pixels[srcIdx + 3];
            }
        }
        ctx!.putImageData(imgData, 0, 0);

        return canvas.toDataURL('image/jpeg', 0.7); // 改成 JPG，质量 0.7
    });
}
