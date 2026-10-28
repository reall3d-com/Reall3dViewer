// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Object3D, PerspectiveCamera, Vector3, WebGLRenderer, WebGLRenderTarget } from 'three';
import { Events } from '../events/Events';
import {
    Vector3ToString,
    IsFetching,
    RunLoopByFrame,
    RunLoopByTime,
    GetOptions,
    OnFetchStop,
    OnFetchStart,
    Information,
    IsDebugMode,
    IsSmallSceneRenderDataReady,
    OnTextureReadySplatCount,
    OnFetching,
    EncodeBase64,
    DecodeBase64,
    GetCanvasSize,
    GetCanvas,
    TraverseDisposeAndClear,
    IsCameraChangedNeedLoadData,
    GetCamera,
    CommonUtilsDispose,
    ComputeTextureWidthHeight,
    GetRenderer,
    UpdateFetchStatus,
    IsLodFetching,
    StopBgAudio,
    OnViewerDispose,
    GetScene,
    CaptureScreenshot,
    SetCursor,
    LoadCircularAudioMask,
    GetMeta,
    ComputeTextureWidthHeightDepth,
    IsBigSceneMode,
    HttpQueryGaussianText,
} from '../events/EventConstants';
import { isMobile, QualityLevels, ViewerVersion } from '../utils/GlobalConstants';
import { globalEv } from '../events/GlobalEV';
import CircularAudioMask, { CircularAudioMaskOptions } from '../meshs/media/CircularAudioMask';
import { MetaData } from '../modeldata/MetaData';
import { DefaultLodCacheFileCount } from '../utils/DefaultValues';

export function setupCommonUtils(events: Events) {
    let disposed: boolean = false;
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    let circularAudioMask: CircularAudioMask;
    on(LoadCircularAudioMask, (opt: CircularAudioMaskOptions) => (circularAudioMask = new CircularAudioMask(opt)));

    on(IsDebugMode, () => fire(GetOptions).debugMode);

    on(CommonUtilsDispose, () => (disposed = true));
    on(
        OnViewerDispose,
        () => {
            globalEv.fire(StopBgAudio);
            circularAudioMask?.dispose();
            circularAudioMask = null;
        },
        true,
    );

    let oTexSize = null;
    on(ComputeTextureWidthHeight, (splatCount: number, maxFileSplatCount: number, lodTargetsFileCount: number) => {
        if (oTexSize) return oTexSize;
        const renderer = fire(GetRenderer) as WebGLRenderer;
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const maxTextureSize: number = renderer.capabilities.maxTextureSize;
        const maxTextureLayers: number = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);

        if (fire(IsBigSceneMode)) {
            if ((fire(GetMeta) as MetaData).useGpuCache) {
                const rs = fire(ComputeTextureWidthHeightDepth, splatCount, maxFileSplatCount, lodTargetsFileCount);
                oTexSize = { ...rs, maxTextureSize, maxTextureLayers };
            } else {
                const totalPixels = 2 * splatCount;
                let texwidth = 1024;
                let texheightary = 512; // 粗算
                let texdepth = Math.ceil(Math.ceil(totalPixels / texwidth) / texheightary); // 确保不超上限
                texheightary = Math.ceil(totalPixels / texwidth / texdepth); // 重算
                const texheight = texheightary * texdepth;
                oTexSize = { texwidth, texheight, texdepth, texheightary, maxTextureSize, maxTextureLayers };
            }
        } else {
            const totalPixels = 2 * splatCount;
            let texwidth = 1024;
            while (texwidth * maxTextureSize < totalPixels) {
                texwidth *= 2;
            }
            texwidth = Math.min(texwidth, maxTextureSize / 2);

            const maxCnt = 524288; // 1024*1024/2
            let texheightary = Math.ceil(Math.min(maxCnt * 2, totalPixels) / texwidth); // 粗算
            let texdepth = Math.min(maxTextureLayers, Math.ceil(Math.ceil(totalPixels / texwidth) / texheightary)); // 确保不超上限
            texheightary = Math.ceil(totalPixels / texwidth / texdepth); // 重算
            const texheight = texheightary * texdepth;

            oTexSize = { texwidth, texheight, texdepth, texheightary, maxTextureSize, maxTextureLayers };
        }

        return oTexSize;
    });

    on(ComputeTextureWidthHeightDepth, (splatCount: number, maxFileSplatCount: number, lodTargetsFileCount: number) => {
        const meta: MetaData = fire(GetMeta);
        const cachedepth = (isMobile ? meta.mobileLodCacheFileCount : meta.pcLodCacheFileCount) || DefaultLodCacheFileCount;
        const texwidth = 1024;
        let texheightary = Math.ceil((maxFileSplatCount * 2) / texwidth); // 单个文件通常不超100万点
        let texdepth = Math.min(lodTargetsFileCount, cachedepth);
        let texheight = texheightary * texdepth;
        const fullCache = texdepth >= lodTargetsFileCount;

        if (fullCache) {
            // 紧凑排列
            texheightary = 1024;
            texdepth = Math.ceil((splatCount * 2) / (texwidth * texheightary));
            texheight = texheightary * texdepth;
        }

        return { texwidth, texheight, texdepth, texheightary, fullCache };
    });

    // 按帧率执行
    let iFrameCount: number = 0;
    (function countFrame() {
        iFrameCount++;
        !disposed && requestAnimationFrame(countFrame);
    })();

    on(RunLoopByFrame, (fnRun: Function, fnIsContinue: Function = null, div: number = 0) => {
        const run = () => {
            if (!disposed) {
                div > 0 ? !(iFrameCount % div) && fnRun(iFrameCount) : fnRun(iFrameCount);
                fnIsContinue && fnIsContinue() && requestAnimationFrame(run);
            }
        };
        run();
    });

    // 默认按每秒50次执行
    on(RunLoopByTime, (fnRun: Function, fnIsContinue: Function = null, delay: number = 20) => {
        const run = () => {
            if (!disposed) {
                fnRun();
                fnIsContinue && fnIsContinue() && setTimeout(run, delay);
            }
        };
        run();
    });

    let loading = false;
    let renderSplatCount: number = 0;
    let textureReadySplatCount: number = 0;
    on(IsLodFetching, () => loading);
    on(UpdateFetchStatus, (isLoading: boolean) => {
        loading = isLoading;
        if (isLoading) {
            (async () => document.querySelector('#gsviewer .logo')?.classList.add('loading'))();
        } else {
            (async () => document.querySelector('#gsviewer .logo')?.classList.remove('loading'))();
        }
        (async () => {
            if (!fire(IsBigSceneMode)) {
                const wrap: HTMLElement = document.querySelector('#gsviewer #progressBarWrap');
                wrap && wrap.style.display != 'none' && (wrap.style.display = 'none');
            }
        })();
    });
    on(OnFetchStart, () => {
        loading = true;

        (async () => {
            if (!fire(IsBigSceneMode)) {
                const wrap: HTMLElement = document.querySelector('#gsviewer #progressBarWrap');
                if (wrap) {
                    wrap.style.display = 'block';
                    const dom: HTMLElement = document.querySelector('#gsviewer #progressBar');
                    dom && (dom.style.width = `0%`);
                }
            }
        })();
        (async () => document.querySelector('#gsviewer .logo')?.classList.add('loading'))();
        // @ts-ignore
        parent?.onProgress && parent.onProgress(0.001, '0.001%');
        // @ts-ignore
        window.onProgress && window.onProgress(0.001, '0.001%');
    });
    on(OnFetchStop, (totalRenderSplatCount: number) => {
        totalRenderSplatCount && (renderSplatCount = totalRenderSplatCount);
        loading = false;

        if (totalRenderSplatCount !== undefined) {
            (async () => {
                const wrap: HTMLElement = document.querySelector('#gsviewer #progressBarWrap');
                wrap && (wrap.style.display = 'none');
            })();
            (async () => document.querySelector('#gsviewer .logo')?.classList.remove('loading'))();

            // @ts-ignore
            parent?.onProgress && parent.onProgress(0, '100%', 9); // 用自定义的 9 代表完全加载完成
            // @ts-ignore
            window.onProgress && window.onProgress(0, '100%', 9); // 用自定义的 9 代表完全加载完成
        }
    });
    on(OnFetching, (per: number) => {
        loading = true;
        (async () => {
            const dom: HTMLElement = document.querySelector('#gsviewer #progressBar');
            dom && (dom.style.width = `${per}%`);
        })();
        // @ts-ignore
        parent?.onProgress && parent.onProgress(per, `${per}%`);
        // @ts-ignore
        window.onProgress && window.onProgress(per, `${per}%`);
    });
    on(IsFetching, () => loading);
    on(OnTextureReadySplatCount, (renderCount: number) => {
        textureReadySplatCount = renderCount;
    });
    on(IsSmallSceneRenderDataReady, () => {
        return !loading && renderSplatCount && textureReadySplatCount >= renderSplatCount;
    });

    let oSize = null;
    on(GetCanvasSize, (force = false) => {
        if (!force && oSize) return oSize;
        const root: HTMLElement = (fire(GetCanvas) as HTMLCanvasElement).parentElement;
        const rect = root.getBoundingClientRect();
        return (oSize = { width: rect.width, height: rect.height, left: rect.left, top: rect.top });
    });

    on(Vector3ToString, (v: Vector3): string => {
        let x = v.x.toFixed(3).split('.');
        let y = v.y.toFixed(3).split('.');
        let z = v.z.toFixed(3).split('.');
        if (x[1] === '000' || x[1] === '00000') x[1] = '0';
        if (y[1] === '000' || y[1] === '00000') y[1] = '0';
        if (z[1] === '000' || z[1] === '00000') z[1] = '0';
        return `${x.join('.')}, ${y.join('.')}, ${z.join('.')}`;
    });

    on(EncodeBase64, (str: string): string => btoa(str));
    on(DecodeBase64, (str: string): string => atob(str));

    const epsilon = 0.001;
    let lastLoadDataPosition: Vector3 = new Vector3();
    let lastLoadDataDirection2: Vector3 = new Vector3();
    let lastLoadDataFov: number = 0;
    on(IsCameraChangedNeedLoadData, () => {
        const camera: PerspectiveCamera = fire(GetCamera);
        const fov = camera.fov;
        const position = camera.position.clone();
        const direction = camera.getWorldDirection(new Vector3());
        if (
            Math.abs(lastLoadDataFov - fov) < epsilon &&
            Math.abs(position.x - lastLoadDataPosition.x) < epsilon &&
            Math.abs(position.y - lastLoadDataPosition.y) < epsilon &&
            Math.abs(position.z - lastLoadDataPosition.z) < epsilon &&
            Math.abs(direction.x - lastLoadDataDirection2.x) < epsilon &&
            Math.abs(direction.y - lastLoadDataDirection2.y) < epsilon &&
            Math.abs(direction.z - lastLoadDataDirection2.z) < epsilon
        ) {
            return false;
        }

        lastLoadDataFov = fov;
        lastLoadDataPosition = position;
        lastLoadDataDirection2 = direction;

        return true;
    });

    on(TraverseDisposeAndClear, (obj3d: Object3D) => {
        if (!obj3d) return;

        const objects: any[] = [];
        obj3d.traverse((object: any) => objects.push(object));
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
        obj3d.clear();
    });

    on(
        Information,
        async ({
            renderSplatCount,
            visibleSplatCount,
            modelSplatCount,
            fps,
            realFps,
            sortTime,
            bucketBits,
            sortType,
            qualityLevel,
            fov,
            position,
            lookUp,
            lookAt,
            worker,
            scene,
            // updateSceneData,
            scale,
            lodTotalCount,
            cuts,
            shDegree,
        }: Partial<Record<string, any>> = {}) => {
            if (!fire(IsDebugMode)) return;

            shDegree !== undefined && setInfo('shDegree', `${shDegree}`);
            renderSplatCount !== undefined && setInfo('renderSplatCount', `${renderSplatCount}`);
            visibleSplatCount !== undefined && setInfo('visibleSplatCount', `${visibleSplatCount}`);
            modelSplatCount !== undefined && setInfo('modelSplatCount', `${modelSplatCount}`);
            // models && setInfo('models', models);
            // renderModels !== undefined && setInfo('renderModels', renderModels);
            fps !== undefined && setInfo('fps', fps);
            realFps !== undefined && setInfo('realFps', `raw ${realFps}`);
            sortTime !== undefined &&
                setInfo('sort', `${sortTime} ms （L ${fire(GetOptions).qualityLevel || QualityLevels.Default5}, ${bucketBits || ''} B, T ${sortType || ''}）`);
            if (cuts !== undefined) {
                if (lodTotalCount !== undefined) {
                    setInfo('cuts', cuts === '' ? '' : `${lodTotalCount}（${cuts} cuts）`);
                } else {
                    setInfo('cuts', cuts === '' ? '' : `（${cuts} cuts）`);
                }
            }
            worker && setInfo('worker', `${worker}`);
            // updateSceneData && setInfo('updateSceneData', `（up ${updateSceneData} ms）`);
            scene && setInfo('scene', scene);
            fov && setInfo('fov', fov);
            position && setInfo('position', position);
            lookUp && setInfo('lookUp', lookUp);
            lookAt && setInfo('lookAt', lookAt);
            lookAt && setInfo('viewer-version', ViewerVersion);

            // @ts-ignore
            let memory = performance.memory || { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 };
            let strMemory = '';
            let usedJSHeapSize = memory.usedJSHeapSize / 1024 / 1024;
            usedJSHeapSize > 1000 ? (strMemory += (usedJSHeapSize / 1024).toFixed(2) + ' G') : (strMemory += usedJSHeapSize.toFixed(0) + ' M');
            strMemory += ' / ';
            let totalJSHeapSize = memory.totalJSHeapSize / 1024 / 1024;
            totalJSHeapSize > 1000 ? (strMemory += (totalJSHeapSize / 1024).toFixed(2) + ' G') : (strMemory += totalJSHeapSize.toFixed(0) + ' M');
            let jsHeapSizeLimit = memory.jsHeapSizeLimit / 1024 / 1024;
            strMemory += ' / ';
            jsHeapSizeLimit > 1000 ? (strMemory += (jsHeapSizeLimit / 1024).toFixed(2) + ' G') : (strMemory += jsHeapSizeLimit.toFixed(0) + ' M');
            setInfo('memory', strMemory);

            scale && setInfo('scale', scale);
        },
    );
    async function setInfo(name: string, txt: any) {
        let dom: HTMLDivElement = document.querySelector(`#gsviewer .debug .${name}`);
        dom && (dom.innerText = txt);
    }

    on(CaptureScreenshot, (fileName = 'screenshot.png') => {
        const renderer: WebGLRenderer = fire(GetRenderer);
        const width = renderer.domElement.width;
        const height = renderer.domElement.height;
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

        const dataURL = canvas.toDataURL('image/png');

        const link = document.createElement('a');
        link.href = dataURL;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    let varCursor = 'default';
    on(SetCursor, (cursor: 'pointer' | 'default' | 'grab' | 'grabbing' | 'move' | 'crosshair' | 'wait' | 'not-allowed' | 'none' = 'default') => {
        if (varCursor === cursor) return;
        varCursor = cursor;
        const canvas: HTMLCanvasElement = fire(GetCanvas);
        canvas && (canvas.style.cursor = cursor);
    });

    on(HttpQueryGaussianText, (text: string = '', fmt = '') => {
        const url = 'https://reall3d.com/gsfont/api/getGaussianText';
        const formData = new FormData();
        formData.append('text', text.substring(0, 100)); // 限制查取最大100字
        formData.append('fmt', fmt);
        formData.append('ver', ViewerVersion);
        formData.append('tk', sessionStorage.getItem('tk-gstext') || '');

        return new Promise(resolve => {
            fetch(url, { method: 'POST', body: formData })
                .then(response => (response.ok ? response.json() : {}))
                .then((data: any) => (data.success ? resolve(JSON.parse(data.data)) : resolve([])))
                .catch(e => resolve([]));
        });
    });
}
