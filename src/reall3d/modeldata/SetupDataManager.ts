// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Vector3 } from 'three';
import {
    OnFetchStart,
    SplatDataManagerAddModel,
    GetMaxRenderCount,
    SplatMeshCycleZoom,
    SplatTexdataManagerDataChanged,
    OnFetching,
    OnFetchStop,
    Information,
    IsBigSceneMode,
    SetGaussianText,
    GetGaussianText,
    RunLoopByFrame,
    UploadSplatTexture,
    SplatUpdateTopY,
    GetSplatActivePoints,
    GetOptions,
    StopAutoRotate,
    GetShTexheight,
    SplatUpdateSh12Texture,
    SplatUpdateSh3Texture,
    SplatUpdateShDegree,
    GetAabbCenter,
    SplatUpdateBoundBox,
    SplatUpdateMaxRadius,
    SplatUpdatePerformanceAct,
    SplatUpdatePointMode,
    OnSmallSceneShowDone,
    SplatUpdateParticleMode,
    SplatUpdateShPalettesTexture,
    ComputeTextureWidthHeight,
    GetMeta,
    GetSplatTiles,
    TriggerLoadSmallSceneData,
    SetTexdataChangeLastTime,
    GetLodActiveXyz,
    SplatDataManagerDispose,
    GetModelShDegree,
    GetLodModelShDegree,
    OnLoadAndRenderPointCloudPly,
} from '../events/EventConstants';
import { Events } from '../events/Events';
import { ModelStatus, SplatModel } from './ModelData';
import { ModelOptions } from './ModelOptions';
import { loadPly } from './loaders/PlyLoader';
import { loadSplat } from './loaders/SplatLoader';
import { loadSpx } from './loaders/SpxLoader';
import { loadSpz } from './loaders/SpzLoader';
import { computeCompressionRatio, glbKhrGs2Splat, isInverted, isNeedReload } from '../utils/CommonUtils';
import { SplatMeshOptions } from '../meshs/splatmesh/SplatMeshOptions';
import { isMobile, MobileDownloadLimitSplatCount, PcDownloadLimitSplatCount } from '../utils/GlobalConstants';
import { loadSog } from './loaders/SogLoader';
import { SplatFile } from './SplatTiles';
import { MetaData } from './MetaData';
import { globalEv } from '../events/GlobalEV';
import { loadFile } from './loaders/FileLoader';
import { DefaultLodMaxRenderCount, DefaultMaxTextWatermarkCount } from '../utils/DefaultValues';
import { clearSplatWasmMemory } from './wasm/WasmParser';

const BlankingTimeOfSmallScene = isMobile ? 100 : 50;

export function setupDataManager(events: Events) {
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    let disposed: boolean;
    let texdataChangeLastTime: number = Date.now() * 2;

    let fnResolveModelSplatCount: (value: unknown) => void;
    const promiseModelSplatCount: Promise<number> = new Promise(resolve => (fnResolveModelSplatCount = resolve));

    let textWatermarkData: Uint8Array = null; // 水印数据
    let splatModel: SplatModel;
    let texture0: SplatTexdata = { index: 0, version: 0, activeTime: 0 };
    let mergeRunning: boolean = false;
    let initBoundBox: boolean = false;
    let performanceStart = 0; // 小场景粒子加载效果使用
    let palettesUpdated = false;
    let smallSceneActivePoints: any = null; // Object
    let dataShDegree = 0;

    on(GetAabbCenter, () => splatModel?.aabbCenter || new Vector3());

    on(
        OnSmallSceneShowDone,
        () => {
            texture0 = null;
            splatModel = null;
            clearSplatWasmMemory();
        },
        true,
    );

    let _maxRenderCount = 0;
    on(GetMaxRenderCount, async (): Promise<number> => {
        if (_maxRenderCount) return _maxRenderCount;

        if (fire(IsBigSceneMode)) {
            // 大场景有默认限制
            await fire(GetSplatTiles);
            const meta: MetaData = fire(GetMeta);
            const cnt = (isMobile ? meta.maxRenderCountOfMobile : meta.maxRenderCountOfPc) || DefaultLodMaxRenderCount;
            _maxRenderCount = cnt + DefaultMaxTextWatermarkCount;
        } else {
            // 小场景默认不限制（需自行注意控制）
            const modelCnt = await promiseModelSplatCount;
            const meta: MetaData = fire(GetMeta);
            const cnt = (isMobile ? meta.maxRenderCountOfMobile : meta.maxRenderCountOfPc) || 0;
            _maxRenderCount = (cnt ? Math.min(modelCnt, cnt) : modelCnt) + DefaultMaxTextWatermarkCount;
        }

        return _maxRenderCount;
    });

    let triggerOnce = false;
    on(TriggerLoadSmallSceneData, () => {
        !triggerOnce &&
            fire(
                RunLoopByFrame,
                async () => await mergeAndUploadData(),
                () => !disposed && !splatModel?.smallSceneUploadDone,
                10,
            );
        triggerOnce = true;
    });

    on(GetShTexheight, async (shDegree: number, texwidth: number): Promise<number> => {
        const opts: SplatMeshOptions = fire(GetOptions);
        if (opts.bigSceneMode) return 1; // 大场景不支持

        let cnt = await fire(GetMaxRenderCount);

        if (!splatModel.dataShDegree) return 1; // splat
        if (shDegree >= 3) {
            if (splatModel.dataShDegree < 3) return 1; // 无SH3数据
        } else if (shDegree >= 1) {
            if (splatModel.dataShDegree < 1) return 1; // 无SH12数据
        } else {
            return 1;
        }

        const texheight = Math.ceil(cnt / texwidth);
        return texheight;
    });

    on(GetModelShDegree, async (): Promise<number> => {
        if (fire(IsBigSceneMode)) {
            return fire(GetLodModelShDegree);
        } else {
            await promiseModelSplatCount;
            return splatModel?.dataShDegree || dataShDegree;
        }
    });

    on(SetGaussianText, async (text: string, isY: boolean = true) => {
        try {
            const isNgativeY = isInverted(splatModel?.header); // 是否倒立（superedit打开呈现倒立）
            textWatermarkData = await fire(GetGaussianText, text, isY, isNgativeY, splatModel?.opts?.format);
            splatModel && (splatModel.textWatermarkVersion = Date.now());
        } catch (e) {
            console.info('failed to generate watermark');
        }
    });

    on(GetSplatActivePoints, () => {
        // 大场景按动态计算
        if (fire(IsBigSceneMode)) {
            return fire(GetLodActiveXyz);
        }

        // 小场景下载完成后按分块
        if (smallSceneActivePoints) return smallSceneActivePoints;

        if (splatModel?.status === ModelStatus.FetchDone || splatModel?.status === ModelStatus.FetchAborted) {
            const obj = {};
            const xyzs: Float32Array = texture0.xyz;
            for (let i = 0, count = xyzs.length / 3, x = 0, y = 0, z = 0, key = ''; i < count; i++) {
                x = xyzs[i * 3];
                y = xyzs[i * 3 + 1];
                z = xyzs[i * 3 + 2];
                key = `${Math.floor(x / 2) * 2 + 1},${Math.floor(y / 2) * 2 + 1},${Math.floor(z / 2) * 2 + 1}`;
                (obj[key] = obj[key] || []).push(x, y, z);
            }
            return (smallSceneActivePoints = obj);
        }

        // 小场景没下载完，不分块
        return texture0.xyz;
    });

    async function mergeAndUploadData() {
        if (disposed) return;

        if (splatModel && (splatModel.status === ModelStatus.Invalid || splatModel.status === ModelStatus.FetchFailed)) {
            (fire(GetOptions) as SplatMeshOptions).viewerEvents?.fire(StopAutoRotate);
            return fire(OnFetchStop, 0) || fire(Information, { renderSplatCount: 0, visibleSplatCount: 0, modelSplatCount: 0 }); // 无效
        }
        if (!splatModel || !splatModel.downloadSize) return; // 尚未下载

        const downloadDone = splatModel.status === ModelStatus.FetchDone || splatModel.status === ModelStatus.FetchAborted;
        updateBoundBox(downloadDone);
        if (downloadDone) {
            // 已下载完，通知一次进度条
            const downloadCount = Math.min(splatModel.fetchLimit, splatModel.downloadSplatCount);
            downloadCount && !splatModel.notifyFetchStopDone && (splatModel.notifyFetchStopDone = true) && fire(OnFetchStop, downloadCount);
            setTimeout(() => !textWatermarkData && fire(SetGaussianText, splatModel?.meta?.watermark));
        } else {
            // 没下载完，更新下载进度条
            fire(OnFetching, (100 * splatModel.downloadSize) / splatModel.fileSize);
        }

        if (!splatModel.dataSplatCount) return; // 尚无高斯数据

        // 调色板
        if (!palettesUpdated && splatModel.palettes) {
            fire(SplatUpdateShPalettesTexture, splatModel.palettes);
            palettesUpdated = true;
        }

        if (mergeRunning) return;
        mergeRunning = true;
        setTimeout(async () => {
            await mergeAndUploadSmallSceneData(downloadDone);
            mergeRunning = false;
        });
    }

    async function mergeAndUploadSmallSceneData(downloadDone: boolean) {
        if (disposed) return;

        const texture = texture0;
        const maxRenderCount = await fire(GetMaxRenderCount);

        const txtWatermarkData = textWatermarkData;
        let dataSplatCount = splatModel.dataSplatCount;
        let watermarkCount = downloadDone ? splatModel.watermarkCount : 0;
        let textWatermarkCount = splatModel.meta.showWatermark && downloadDone ? (txtWatermarkData?.byteLength || 0) / 32 : 0; // 动态输入的文字水印数
        splatModel.renderSplatCount = dataSplatCount + watermarkCount + textWatermarkCount; // 渲染数

        if (splatModel.renderSplatCount >= maxRenderCount) {
            // 中断下载等特殊情况
            splatModel.renderSplatCount = maxRenderCount;
            watermarkCount = 0;
            textWatermarkCount = 0;
            dataSplatCount > maxRenderCount && (dataSplatCount = maxRenderCount);
        }

        fire(Information, { visibleSplatCount: splatModel.renderSplatCount, modelSplatCount: splatModel.modelSplatCount + textWatermarkCount }); // 可见数=模型数据总点数

        if (Date.now() - texture.textureReadyTime < BlankingTimeOfSmallScene) return;
        if (splatModel.smallSceneUploadDone && splatModel.lastTextWatermarkVersion == splatModel.textWatermarkVersion) return; // 已传完(模型数据 + 动态文字水印)

        if (!texture.version) {
            fire(SplatUpdateTopY, (isInverted(splatModel.header) ? splatModel.header.MaxTopY : splatModel.header?.MinTopY) || 0); // 初次传入高点

            let ver: string = splatModel.opts.format;
            let ratio = '　';
            if (splatModel.opts.format == 'spx') {
                ver = 'spx v' + splatModel.header.Version + (splatModel.header.ExclusiveId ? (', ' + splatModel.header.ExclusiveId).substring(0, 5) : '');
                ratio += splatModel.CompressionRatio;
            } else if (splatModel.opts.format == 'spz') {
                ver = 'spz v' + splatModel.spzVersion;
                ratio += splatModel.CompressionRatio;
            } else if (splatModel.opts.format == 'sog') {
                ver = 'sog v' + splatModel.sogVersion;
                ratio += splatModel.CompressionRatio;
            } else if (splatModel.opts.format == 'splat') {
                ratio += splatModel.CompressionRatio;
            }

            ver = globalEv.tryFire('Information-ver') || ver;
            ratio = globalEv.tryFire('Information-ratio') || ratio;
            const size = globalEv.tryFire('Information-size') || '　' + (splatModel.fileSize / 1024 / 1024).toFixed(1) + 'M';
            fire(Information, { scene: `small (${ver}) ${ratio}${size}` }); // 初次提示场景模型版本
            globalEv.off('Information-ver');
            globalEv.off('Information-ratio');
            globalEv.off('Information-size');
        }

        splatModel.lastTextWatermarkVersion = splatModel.textWatermarkVersion;
        texture.textureReady = false;

        // 合并（模型数据 + 动态文字水印）
        const { texwidth, texheight } = fire(ComputeTextureWidthHeight, maxRenderCount);
        const ui32s = texture.texdata || new Uint32Array(texwidth * texheight * 4);
        const f32s = new Float32Array(ui32s.buffer);
        const mergeSplatData = new Uint8Array(ui32s.buffer);
        mergeSplatData.set(splatModel.splatData.subarray(0, dataSplatCount * 32), 0);
        watermarkCount && mergeSplatData.set(splatModel.watermarkData.subarray(0, watermarkCount * 32), dataSplatCount * 32);
        textWatermarkCount && mergeSplatData.set(txtWatermarkData.subarray(0, textWatermarkCount * 32), (dataSplatCount + watermarkCount) * 32);

        const xyz = new Float32Array(maxRenderCount * 3);
        for (let i = 0, n = 0; i < splatModel.renderSplatCount; i++) {
            xyz[i * 3] = f32s[i * 8];
            xyz[i * 3 + 1] = f32s[i * 8 + 1];
            xyz[i * 3 + 2] = f32s[i * 8 + 2];
        }

        const sysTime = Date.now();
        texture.version = sysTime;
        texture.texdata = ui32s;
        texture.xyz = xyz;
        texture.renderSplatCount = splatModel.renderSplatCount;
        texture.visibleSplatCount = splatModel.downloadSplatCount + textWatermarkCount;
        texture.modelSplatCount = splatModel.downloadSplatCount + textWatermarkCount;
        texture.watermarkCount = watermarkCount + textWatermarkCount;
        texture.minX = splatModel.minX;
        texture.maxX = splatModel.maxX;
        texture.minY = splatModel.minY;
        texture.maxY = splatModel.maxY;
        texture.minZ = splatModel.minZ;
        texture.maxZ = splatModel.maxZ;

        if (splatModel.meta.particleMode && !performanceStart) {
            performanceStart = performance.now();
            fire(SplatUpdatePerformanceAct, performanceStart);
            fire(SplatUpdatePointMode, false); // 小场景粒子效果时，固定不用点云
            fire(SplatUpdateParticleMode, 1); // 粒子加载效果
        }
        splatModel.maxRadius && fire(SplatUpdateMaxRadius, splatModel.maxRadius);
        fire(UploadSplatTexture, texture, splatModel.currentRadius, splatModel.currentRadius);
        fire(SetTexdataChangeLastTime, sysTime);

        if (downloadDone && !splatModel.smallSceneUploadDone) {
            splatModel.smallSceneUploadDone = true;
            !palettesUpdated && fire(SplatUpdateSh12Texture, splatModel.sh12Data);
            !palettesUpdated && fire(SplatUpdateSh3Texture, splatModel.sh3Data);
            const opts: SplatMeshOptions = fire(GetOptions);
            dataShDegree = splatModel.dataShDegree;
            fire(SplatUpdateShDegree, opts.shDegree === undefined ? 3 : opts.shDegree);
            Promise.resolve().then(() => {
                fire(GetSplatActivePoints); // 小场景下载完时主动触发一次坐标分块
                opts.disableTransitionEffectOnLoad && setTimeout(() => fire(OnSmallSceneShowDone), 6000); // 禁止特效时延后触发显示完成后期处理
            });

            if (splatModel.meta.particleMode) {
                // 粒子效果，先5秒加载过程，后5秒正常化过程
                setTimeout(
                    () => {
                        fire(SplatUpdatePerformanceAct, performance.now() + 5000); // 后5秒正常化过程
                        fire(SplatUpdateParticleMode, 2); // 逐渐变化到正常
                        setTimeout(() => !disposed && fire(OnSmallSceneShowDone, true), 6000); // 显示完成后期处理
                    },
                    Math.max(5000 + performanceStart - performance.now(), 0), // 先5秒加载过程
                );
            }
        }
        fire(Information, { renderSplatCount: splatModel.renderSplatCount });
    }

    async function addModel(opts: ModelOptions, meta: MetaData) {
        if (disposed) return;
        opts.fetchReload = isNeedReload(meta.updateDate || 0); // 7天内更新的重新下载

        const orgUrl = opts.url;
        if (opts.format === 'glb') {
            const fileBytes: Uint8Array = await loadFile(opts.url, events);
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
                opts.url = URL.createObjectURL(new Blob([spzBytes as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }));
                opts.format = 'spz';

                globalEv.on('Information-ver', () => `glb-spz`);
            } else if (/KHR_gaussian_splatting/.test(sJson)) {
                const splatBytes = glbKhrGs2Splat(fileBytes);
                opts.url = URL.createObjectURL(new Blob([splatBytes as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }));
                opts.format = 'splat';

                const ratio = '　' + computeCompressionRatio(splatBytes.byteLength / 32, fileBytes.byteLength);
                const size = '　' + (fileBytes.byteLength / 1024 / 1024).toFixed(1) + 'M';
                globalEv.on('Information-ver', () => `glb-gs`);
                globalEv.on('Information-ratio', () => ratio);
                globalEv.on('Information-size', () => size);
            } else {
                console.warn('SplatMesh only loads GLB models with the KHR_gaussian_splatting extension.');
            }
        }

        splatModel = new SplatModel(opts, meta);

        // 下载限制（小场景默认1亿点，约等同无限制，需注意按需配置）
        splatModel.fetchLimit = (isMobile ? meta.maxRenderCountOfMobile : meta.maxRenderCountOfPc) || 10000_0000;

        const fnCheckModelSplatCount = () => {
            if (disposed) return;
            // 除非下载失败，否则总是等待继续下载，直到得知模型文件的点数为止
            if (!splatModel || splatModel.status == ModelStatus.Invalid || splatModel.status == ModelStatus.FetchFailed) {
                return fnResolveModelSplatCount(0);
            }
            if (splatModel.modelSplatCount > 0) {
                fnResolveModelSplatCount(splatModel.modelSplatCount);
                if (!splatModel.meta.particleMode && splatModel.dataSplatCount) {
                    setTimeout(() => fire(SplatMeshCycleZoom), 5);
                } else {
                    setTimeout(fnCheckModelSplatCount, 10); // 没数据可以渲染，继续做以便触发过渡效果
                }
            } else {
                setTimeout(fnCheckModelSplatCount, 10);
            }
        };
        fnCheckModelSplatCount();

        if (!loadSplatModel(splatModel)) {
            console.error('Unsupported format:', opts.format);
            fire(OnFetchStop, 0);
            return;
        }
        if (opts.format === 'glb') {
            URL.revokeObjectURL(opts.url);
            opts.url = orgUrl;
        }
        fire(TriggerLoadSmallSceneData);
        fire(OnFetchStart);
        fire(Information, { cuts: `` });
    }

    function loadSplatModel(model: SplatModel) {
        if (model.opts.format === 'spx') {
            loadSpx(model);
        } else if (model.opts.format === 'splat') {
            loadSplat(model);
        } else if (model.opts.format === 'ply') {
            loadPly(model).then(() => {
                if (model.isPointCloudPly) {
                    (fire(GetOptions) as SplatMeshOptions).viewerEvents?.fire(OnLoadAndRenderPointCloudPly, model.opts.url);
                }
            });
        } else if (model.opts.format === 'spz') {
            loadSpz(model);
        } else if (model.opts.format === 'sog') {
            loadSog(model);
        } else {
            return false;
        }
        return true;
    }

    function updateBoundBox(downloadDone: boolean) {
        // 包围盒
        if (!initBoundBox) {
            if (splatModel.header) {
                initBoundBox = true;
                const min = new Vector3(splatModel.header.MinX, splatModel.header.MinY, splatModel.header.MinZ);
                const max = new Vector3(splatModel.header.MaxX, splatModel.header.MaxY, splatModel.header.MaxZ);
                fire(SplatUpdateBoundBox, min.x, min.y, min.z, max.x, max.y, max.z, splatModel.meta.showBoundBox);
            } else if (downloadDone) {
                initBoundBox = true;
                const min = new Vector3(splatModel.minX, splatModel.minY, splatModel.minZ);
                const max = new Vector3(splatModel.maxX, splatModel.maxY, splatModel.maxZ);
                fire(SplatUpdateBoundBox, min.x, min.y, min.z, max.x, max.y, max.z, splatModel.meta.showBoundBox);
            }
        }
    }

    function dispose() {
        if (disposed) return;
        disposed = true;
        splatModel?.abortController?.abort();
        splatModel = null;
        textWatermarkData = null;
        texture0 = null;
    }

    on(SplatDataManagerAddModel, (opts: ModelOptions, meta: MetaData) => addModel(opts, meta));

    on(SetTexdataChangeLastTime, (last: number) => (texdataChangeLastTime = last));
    on(SplatTexdataManagerDataChanged, (msDuring: number = 10000) => Date.now() - texdataChangeLastTime < msDuring);
    on(SplatDataManagerDispose, () => dispose());
}
