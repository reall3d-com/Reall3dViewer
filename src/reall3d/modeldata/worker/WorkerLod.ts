// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Matrix4, Plane, Vector3 } from 'three';
import { computeSplatNodeCameraDistance, extractFrustumPlanes, getUrl, Queue, sleep } from '../../utils/CommonUtils';
import { isMobile, SortTypes } from '../../utils/GlobalConstants';
import { MetaData } from '../MetaData';
import { DataStatus, SplatFile, SplatLodJsonMagic, SplatTileNode, SplatTiles } from '../SplatTiles';
import { hashString } from 'three/src/nodes/core/NodeUtils.js';
import {
    WkCameraPosition,
    WkA10Information,
    WkA10SortPartXyz,
    WkA01FetchNG,
    WkA01FetchOkGpuCache,
    WkA10Download,
    WkDownloadCount,
    WkDownloadData,
    WkFileKey,
    WkA10SplatTilesReady,
    WkViewProjection,
    WkXyz,
    WkJson,
    WkOffset,
    WkA01Init,
    WkA01Refresh,
    WkA01Dispose,
    WkA01BackXyz,
    WkA01BackXyzIndex,
    WkXyzIndex,
    WkA01BackSplatBuffer,
    WkTexData,
    WkA01SetTextureSize,
    WkA01CalcTargetLayer,
    WkA10ReturnLayer,
    WkLayer,
    WkA01FetchOkMemCache,
    WkA10UpdateDblTexture,
    WkA01DblActive,
    WkIndex,
    WkA10BoundBox,
    WkBox,
    WkA10Recycle,
    WkSortType,
    WkA01UpdateParams,
} from './WkConstants';
import { DefaultLodCacheFileCount, DefaultLodMaxRenderCount } from '../../utils/DefaultValues';

const BlankingTimeOfLargeScene = isMobile ? 300 : 200;
let disposed = false;
const worker: Worker = self as any;

let sceneMeta: MetaData = null;
let splatTiles: SplatTiles = null;

const MaxDownloadCount = isMobile ? 4 : 6;
const todoSplatFileSet = new Set<SplatFile>();
const fetchingSet = new Set<string>();
const memCachedFileSet = new Set<SplatFile>();
let maxMemCacheFileCount = 0;
let doingCheckDownload = false;
let isDownloadAllDone = false;
let totalDownloadedCount = 0;
let isFullCache = false;

const texture0: SplatTexdata = { index: 0, version: 0, activeTime: 0 };
const texture1: SplatTexdata = { index: 1, version: 0, activeTime: 0 };
const frustumPlanes = new Array(6).fill(null).map(() => new Plane());
const _v3Tmp = new Vector3();
let mergeDoing = false;
let lastLodHash: number = 0;

const mergeDataCache: Uint8Array[] = [];
const xyzCache: Float32Array[] = [];
const xyzIndexCache: Uint32Array[] = [];

const memFileQueue = new Queue<QueueItem>();
const gpuFileQueue = new Queue<QueueItem>();
const calcLayerQueue = new Queue<QueueItem>();

const layers: SplatFile[] = [];
let maxLayer = 10; // 初始化，会被自动更正
let penalty = 3;
let sortType = SortTypes.Radial2;

const fifoFileSet: Set<string>[] = [new Set(), new Set(), new Set()];

export interface QueueItem {
    fileKey?: string;
    layer?: number;
    downloadData?: Uint8Array;
    xyz?: Float32Array;
    downloadCount?: number;
    offset?: number;
    resolve?: Function;
}

function getMergeFileSet(): Set<string> {
    const fi = fifoFileSet[0];
    fifoFileSet[0] = fifoFileSet[1];
    fifoFileSet[1] = fifoFileSet[2];
    fifoFileSet[2] = fi;
    fi.clear();
    return fi;
}

function onWkA01FetchOkGpuCache(fileKey: string, layer: number, xyz: Float32Array, downloadCount: number, offset: number) {
    gpuFileQueue.add({ fileKey, layer, xyz, downloadCount, offset });
}

function onWkA01FetchOkMemCache(fileKey: string, downloadCount: number, downloadData: Uint8Array, xyz: Float32Array) {
    memFileQueue.add({ fileKey, downloadCount, downloadData, xyz });
}

function onWkA01SetTextureSize(wkJson: string) {
    const oTexSize = JSON.parse(wkJson);
    maxLayer = oTexSize.texdepth;
    sceneMeta?.useGpuCache && (isFullCache = oTexSize.fullCache);
}

function onWkA01Refresh(wkViewProjection: number[], wkCameraPosition: number[]) {
    if (!splatTiles) return;
    mergeLod(new Matrix4().fromArray(wkViewProjection), new Vector3().fromArray(wkCameraPosition));
}

function onWkA01CalcTargetLayer(fileKey: string) {
    // 坑位足，直接用
    let targetLayer = layers.length;
    if (targetLayer < maxLayer) {
        const file = splatTiles.files[fileKey];
        file.targetLayer = targetLayer;
        file.textureReady = false;
        layers[targetLayer] = file;
        postWkA10TargetLayer(fileKey, targetLayer);
        return;
    }

    // 堆积起来待异步妥当处理
    new Promise<number>(resolve => calcLayerQueue.add({ fileKey, resolve })).then(layer => postWkA10TargetLayer(fileKey, layer));
}

function onWkA01FetchNG(fileKey: string) {
    const splatFile = splatTiles.files[fileKey];
    splatFile.lastTime = Date.now() + 10000; // 允许10秒后重试
    splatFile.status = DataStatus.None;
    splatFile.textureReady = false;
    splatFile.downloadCount = 0;
    splatFile.downloadData = null;
    splatFile.xyz = null;
    fetchingSet.delete(fileKey);
}

function onWkA01DblActive(index: number) {
    if (index) {
        texture0.active = false;
        texture1.active = true;
    } else {
        texture0.active = true;
        texture1.active = false;
    }
}

function findReplaceableSplatFile(): SplatFile {
    const usedSet = new Set<string>([...fifoFileSet[0], ...fifoFileSet[1], ...fifoFileSet[2]]);
    let file: SplatFile = null;
    const baseTime = Date.now();
    for (let i = 0; i < maxLayer; i++) {
        const f = layers[i];
        if (f.lastTime > baseTime || !f.textureReady || usedSet.has(f.fileKey)) continue; // 排除刚更新的、排除已被占坑的、排除使用中的
        (!file || f.lastTime < file.lastTime) && (file = f); // 筛选出最旧的
    }
    return file;
}

async function mergeLod(viewProjMatrix: Matrix4, cameraPosition: Vector3) {
    if (disposed || mergeDoing) return;
    mergeDoing = true;

    checkDownload();
    await sleep();

    if (sceneMeta.useGpuCache) {
        await mergeLodGpuCache(viewProjMatrix, cameraPosition);
    } else {
        await mergeLodMemoryCache(viewProjMatrix, cameraPosition);
    }

    mergeDoing = false;
}

function setDownloadDataGpuCache(): boolean {
    let data: QueueItem = null;
    let derty = false;
    while (!gpuFileQueue.isEmpty()) {
        data = gpuFileQueue.get();
        const file = splatTiles.files[data.fileKey];
        file.xyz = data.xyz;
        file.offset = data.offset;
        file.downloadCount = data.downloadCount;
        file.status = DataStatus.FetchDone;

        totalDownloadedCount += file.downloadCount;
        fetchingSet.delete(file.fileKey);

        file.lastTime = Math.max(Date.now() + 100, file.lastTime);
        file.textureReady = true; // sceneMeta.useGpuCache; // TODO 可以统一按true管理

        derty = true;
    }
    return derty;
}

function setDownloadDataMemCache(): boolean {
    let data: any = null;
    let derty = false;
    while (!memFileQueue.isEmpty()) {
        data = memFileQueue.get();
        const { fileKey, downloadCount, downloadData, xyz } = data;
        const file = splatTiles.files[fileKey];
        file.downloadData = downloadData;
        file.xyz = xyz;
        file.downloadCount = downloadCount;
        file.status = DataStatus.FetchDone;

        totalDownloadedCount += file.downloadCount;
        fetchingSet.delete(file.fileKey);
        memCachedFileSet.add(file);

        file.lastTime = Math.max(Date.now() + 100, file.lastTime);
        derty = true;
    }

    if (memCachedFileSet.size > maxMemCacheFileCount) {
        const files = [...memCachedFileSet];
        files.sort((a, b) => b.lastTime - a.lastTime); // 降序
        while (memCachedFileSet.size > maxMemCacheFileCount) {
            const file = files.pop();
            memCachedFileSet.delete(file);

            totalDownloadedCount -= file.downloadCount;
            file.textureReady = false;
            file.downloadCount = 0;
            file.downloadData = null;
            file.xyz = null;
            file.status = DataStatus.None;
        }
    }

    return derty;
}

async function mergeLodGpuCache(viewProjMatrix: Matrix4, cameraPosition: Vector3) {
    const derty1 = calcAllWkA10TargetLayer(); // 占坑可能出现脏数据
    const derty2 = setDownloadDataGpuCache(); // 填坑可能出现脏数据
    const derty = derty1 || derty2;
    if (!splatTiles.topLodReady) return;

    const mergeFileSet: Set<string> = getMergeFileSet(); // 合并的文件集，自动管理直接取用

    const maxRenderCount = (isMobile ? sceneMeta.maxRenderCountOfMobile : sceneMeta.maxRenderCountOfPc) || DefaultLodMaxRenderCount;
    // const txtWatermarkData = textWatermarkData;
    const watermarkCount = 0; // splatModel.watermarkCount; // 待合并的水印数（模型数据部分）
    const textWatermarkCount = 0; // (txtWatermarkData?.byteLength || 0) / 32; // 待合并的水印数（可动态变化的文字水印部分）
    const environmentCount = (splatTiles.environment as SplatFile)?.downloadCount || 0;
    const maxDataMergeCount = maxRenderCount - watermarkCount - textWatermarkCount - environmentCount; // 最大数据合并点数

    postInformation({ modelSplatCount: `${totalDownloadedCount + textWatermarkCount} (${isFullCache ? 'gf' : 'gp'})` });

    let texture = texture0;
    if (!derty && Date.now() - texture.activeTime < BlankingTimeOfLargeScene) return;

    // 视锥剔除
    extractFrustumPlanes(viewProjMatrix, frustumPlanes); // 更新视锥体平面
    fnCheckSplatNodeChildVisible(cameraPosition);
    await sleep();

    // 数量检查
    const topLod = getTopLod();
    let sumCurrentSplatCount = 0;
    let leafs: SplatTileNode[] = []; // 所有叶节点
    let targetLeafs: SplatTileNode[] = leafs;
    let reduceLeafs: SplatTileNode[] = []; // 降级处理时的目标范围
    let visibleCuts = 0;

    traveSplatTree(splatTiles.tree, leaf => {
        if (!leaf.lods) return;

        leaf.currentVisible && visibleCuts++;
        leafs.push(leaf);
        leaf.currentRenderLod < topLod && reduceLeafs.push(leaf);
        sumCurrentSplatCount += leaf.lods[leaf.currentRenderLod]?.count || 0; // 块中不一定各lod都有数据
    });
    let currentTotalVisibleCnt = visibleCuts > 0 ? sumCurrentSplatCount : 0;
    await sleep();

    let topTooLarge = false;
    if (sumCurrentSplatCount > maxDataMergeCount) {
        const reduceLod = (tgtLod: number) => {
            for (let i = 0; i < reduceLeafs.length; i++) {
                const reduceNode = reduceLeafs[i];
                if (reduceNode.currentRenderLod != tgtLod) continue;

                const newLod = fnAddTargetLod(reduceNode, tgtLod + 1);
                if (newLod < splatTiles.lodLevels) {
                    sumCurrentSplatCount += reduceNode.lods[newLod].count - reduceNode.lods[tgtLod].count;
                    if (sumCurrentSplatCount <= maxDataMergeCount) break;
                } else {
                    sumCurrentSplatCount -= reduceNode.lods[tgtLod].count;
                }
            }
        };

        // 排序
        reduceLeafs.sort((a, b) => b.currentDistance - a.currentDistance); // 按距离降序
        await sleep();

        while (sumCurrentSplatCount > maxDataMergeCount) {
            let minLod = splatTiles.lodLevels;
            for (const reduceNode of reduceLeafs) {
                minLod = Math.min(minLod, reduceNode.currentRenderLod);
            }
            if (minLod >= topLod) {
                console.warn('Top LOD data is too large');
                topTooLarge = true;
                break;
            }
            reduceLod(minLod);
        }
        await sleep();
    }

    // 检查是否忽略
    if (topTooLarge) {
        leafs.sort((a, b) => {
            if (a.currentVisible !== b.currentVisible) {
                return a.currentVisible ? -1 : 1;
            } else {
                return a.currentDistance - b.currentDistance;
            }
        });
        await sleep();
        let cnt = 0;
        let total = environmentCount + watermarkCount + textWatermarkCount;
        for (let node of leafs) {
            total += node.lods[topLod]?.count || 0;
            if (total > maxDataMergeCount) {
                break;
            }
            cnt++;
        }
        targetLeafs = leafs.slice(0, cnt);
        lastLodHash = hashString(Date.now() + '');
    } else {
        const chks = reduceLeafs.filter(v => v.currentRenderLod < topLod);
        chks.sort((a, b) => {
            if (a.lods[a.currentRenderLod].fileKey === b.lods[b.currentRenderLod].fileKey) {
                return a.lods[a.currentRenderLod].offset - b.lods[b.currentRenderLod].offset;
            }
            return a.lods[a.currentRenderLod].fileKey < b.lods[b.currentRenderLod].fileKey ? -1 : 1;
        });
        await sleep();
        let chkKey = '';
        for (let node of chks) {
            let oMapping = node.lods[node.currentRenderLod];
            chkKey += `${oMapping.fileKey},${oMapping.offset};`;
        }
        const lodHash = hashString(chkKey);
        if (!derty && lastLodHash === lodHash) return;
        lastLodHash = lodHash;
    }
    await sleep();

    // 合并
    const sysTime = Date.now();
    texture.version = sysTime;
    texture.active = true;

    const xyzIndex = xyzIndexCache.pop() || new Uint32Array(maxRenderCount);
    const xyz = xyzCache.pop() || new Float32Array(maxRenderCount * 3);
    let n = 0;
    let mergeDataCount = 0;

    if (visibleCuts > 0) {
        for (let node of targetLeafs) {
            const tileMapping = node.lods[node.currentRenderLod];
            if (!tileMapping) continue;

            const file = splatTiles.files[tileMapping.fileKey];
            file.lastTime = Math.max(Date.now(), file.lastTime);
            xyz.set(file.xyz.subarray(tileMapping.offset * 3, (tileMapping.offset + tileMapping.count) * 3), mergeDataCount * 3);
            mergeDataCount += tileMapping.count;

            for (let i = tileMapping.offset, max = tileMapping.offset + tileMapping.count; i < max; ++i) {
                xyzIndex[n++] = file.offset + i;
            }

            mergeFileSet.add(file.fileKey);
        }
    }
    await sleep();

    if (environmentCount) {
        const file = splatTiles.environment as SplatFile;
        xyz.set(file.xyz.subarray(0, environmentCount * 3), mergeDataCount * 3);
        mergeDataCount += environmentCount;
        for (let i = file.offset, max = file.offset + environmentCount; i < max; ++i) {
            xyzIndex[n++] = file.offset + i;
        }
        mergeFileSet.add(file.fileKey);
    }
    // if (watermarkCount) {
    //     mergeSplatData.set(splatModel.watermarkData.subarray(0, watermarkCount * 32), mergeDataCount * 32);
    //     mergeDataCount += watermarkCount;
    // }
    // if (textWatermarkCount) {
    //     mergeSplatData.set(txtWatermarkData.subarray(0, textWatermarkCount * 32), (mergeDataCount + watermarkCount) * 32);
    //     mergeDataCount += textWatermarkCount;
    // }

    // 保险起见以最终数据数量为准
    const totalRenderSplatCount = mergeDataCount; // + watermarkCount + textWatermarkCount;
    const mins: number[] = [xyz[0], xyz[1], xyz[2]];
    const maxs: number[] = [xyz[0], xyz[1], xyz[2]];
    for (let i = 0, x = 0, y = 0, z = 0; i < totalRenderSplatCount; i++) {
        x = xyz[i * 3];
        y = xyz[i * 3 + 1];
        z = xyz[i * 3 + 2];

        mins[0] = Math.min(mins[0], x);
        mins[1] = Math.min(mins[1], y);
        mins[2] = Math.min(mins[2], z);
        maxs[0] = Math.max(maxs[0], x);
        maxs[1] = Math.max(maxs[1], y);
        maxs[2] = Math.max(maxs[2], z);
    }
    await sleep();

    texture.xyz = xyz;
    texture.xyzIndex = xyzIndex;
    texture.renderSplatCount = totalRenderSplatCount;
    texture.visibleSplatCount = currentTotalVisibleCnt + watermarkCount + textWatermarkCount + environmentCount;
    texture.modelSplatCount = totalDownloadedCount + textWatermarkCount;
    texture.watermarkCount = watermarkCount + textWatermarkCount;
    texture.minX = mins[0];
    texture.maxX = maxs[0];
    texture.minY = mins[1];
    texture.maxY = maxs[1];
    texture.minZ = mins[2];
    texture.maxZ = maxs[2];
    texture.version = Date.now();
    texture.activeTime = texture.version;

    postSortPartXyz(texture);

    const cuts = `${visibleCuts}/${leafs.length}`;
    const lodTotalCount = splatTiles.totalCount;
    const modelSplatCount = `${texture.modelSplatCount} (g${isFullCache ? 'f' : 'p'})`;
    postInformation({ scene: 'large', lodTotalCount, cuts, visibleSplatCount: texture.visibleSplatCount, modelSplatCount });
}

async function mergeLodMemoryCache(viewProjMatrix: Matrix4, cameraPosition: Vector3) {
    const derty = setDownloadDataMemCache();
    if (!splatTiles.topLodReady) return;

    const mergeFileSet: Set<string> = getMergeFileSet(); // 合并的文件集，自动管理直接取用

    const maxRenderCount = (isMobile ? sceneMeta.maxRenderCountOfMobile : sceneMeta.maxRenderCountOfPc) || DefaultLodMaxRenderCount;
    // const txtWatermarkData = textWatermarkData;
    const watermarkCount = 0; // splatModel.watermarkCount; // 待合并的水印数（模型数据部分）
    const textWatermarkCount = 0; // (txtWatermarkData?.byteLength || 0) / 32; // 待合并的水印数（可动态变化的文字水印部分）
    const environmentCount = (splatTiles.environment as SplatFile)?.downloadCount || 0;
    const maxDataMergeCount = maxRenderCount - watermarkCount - textWatermarkCount - environmentCount; // 最大数据合并点数

    postInformation({ modelSplatCount: `${totalDownloadedCount + textWatermarkCount} (${isFullCache ? 'mf' : 'mp'})` });

    let texture: SplatTexdata = texture0.version <= texture1.version ? texture0 : texture1;
    if (texture.active) return; // 待切换完成
    if (!derty && Date.now() - Math.max(texture0.activeTime, texture1.activeTime) < BlankingTimeOfLargeScene) return;

    // 视锥剔除
    extractFrustumPlanes(viewProjMatrix, frustumPlanes); // 更新视锥体平面
    fnCheckSplatNodeChildVisible(cameraPosition);
    await sleep();

    // 数量检查
    const topLod = getTopLod();
    let sumCurrentSplatCount = 0;
    let leafs: SplatTileNode[] = []; // 所有叶节点
    let targetLeafs: SplatTileNode[] = leafs;
    let reduceLeafs: SplatTileNode[] = []; // 降级处理时的目标范围
    let visibleCuts = 0;

    traveSplatTree(splatTiles.tree, leaf => {
        if (!leaf.lods) return;

        leaf.currentVisible && visibleCuts++;
        leafs.push(leaf);
        leaf.currentRenderLod < topLod && reduceLeafs.push(leaf);
        sumCurrentSplatCount += leaf.lods[leaf.currentRenderLod]?.count || 0; // 块中不一定各lod都有数据
    });
    let currentTotalVisibleCnt = visibleCuts > 0 ? sumCurrentSplatCount : 0;
    await sleep();

    let topTooLarge = false;
    if (sumCurrentSplatCount > maxDataMergeCount) {
        const reduceLod = (tgtLod: number) => {
            for (let i = 0; i < reduceLeafs.length; i++) {
                const reduceNode = reduceLeafs[i];
                if (reduceNode.currentRenderLod != tgtLod) continue;

                const newLod = fnAddTargetLod(reduceNode, tgtLod + 1);
                if (newLod < splatTiles.lodLevels) {
                    sumCurrentSplatCount += reduceNode.lods[newLod].count - reduceNode.lods[tgtLod].count;
                    if (sumCurrentSplatCount <= maxDataMergeCount) break;
                } else {
                    sumCurrentSplatCount -= reduceNode.lods[tgtLod].count;
                }
            }
        };

        // 排序
        reduceLeafs.sort((a, b) => b.currentDistance - a.currentDistance); // 按距离降序
        await sleep();

        while (sumCurrentSplatCount > maxDataMergeCount) {
            let minLod = splatTiles.lodLevels;
            for (const reduceNode of reduceLeafs) {
                minLod = Math.min(minLod, reduceNode.currentRenderLod);
            }
            if (minLod >= topLod) {
                console.warn('Top LOD data is too large');
                topTooLarge = true;
                break;
            }
            reduceLod(minLod);
        }
        await sleep();
    }

    // 检查是否忽略
    if (topTooLarge) {
        leafs.sort((a, b) => {
            if (a.currentVisible !== b.currentVisible) {
                return a.currentVisible ? -1 : 1;
            } else {
                return a.currentDistance - b.currentDistance;
            }
        });
        await sleep();
        let cnt = 0;
        let total = environmentCount + watermarkCount + textWatermarkCount;
        for (let node of leafs) {
            total += node.lods[topLod]?.count || 0;
            if (total > maxDataMergeCount) {
                break;
            }
            cnt++;
        }
        targetLeafs = leafs.slice(0, cnt);
        lastLodHash = hashString(Date.now() + '');
    } else {
        const chks = reduceLeafs.filter(v => v.currentRenderLod < topLod);
        chks.sort((a, b) => {
            if (a.lods[a.currentRenderLod].fileKey === b.lods[b.currentRenderLod].fileKey) {
                return a.lods[a.currentRenderLod].offset - b.lods[b.currentRenderLod].offset;
            }
            return a.lods[a.currentRenderLod].fileKey < b.lods[b.currentRenderLod].fileKey ? -1 : 1;
        });
        await sleep();
        let chkKey = '';
        for (let node of chks) {
            let oMapping = node.lods[node.currentRenderLod];
            chkKey += `${oMapping.fileKey},${oMapping.offset};`;
        }
        const lodHash = hashString(chkKey);
        // if (!!fire(GetSplatActivePoints) && lastLodHash === lodHash) return ;
        if (!derty && lastLodHash === lodHash) return;
        lastLodHash = lodHash;
    }
    await sleep();

    // 合并
    const sysTime = Date.now();
    texture.version = sysTime;

    const mergeSplatData = mergeDataCache.pop() || new Uint8Array(maxRenderCount * 32);
    const xyz = xyzCache.pop() || new Float32Array(maxRenderCount * 3);
    let n = 0;
    let mergeDataCount = 0;

    if (visibleCuts > 0) {
        const fileKeySet = new Set();
        for (let node of targetLeafs) {
            const tileMapping = node.lods[node.currentRenderLod];
            if (!tileMapping) continue;

            fileKeySet.add(tileMapping.fileKey);

            const file = splatTiles.files[tileMapping.fileKey];
            file.lastTime = Math.max(Date.now(), file.lastTime);
            mergeSplatData.set(file.downloadData.subarray(tileMapping.offset * 32, (tileMapping.offset + tileMapping.count) * 32), mergeDataCount * 32);
            xyz.set(file.xyz.subarray(tileMapping.offset * 3, (tileMapping.offset + tileMapping.count) * 3), mergeDataCount * 3);
            mergeDataCount += tileMapping.count;

            mergeFileSet.add(file.fileKey);
        }
    }
    await sleep();

    if (environmentCount) {
        const file = splatTiles.environment as SplatFile;
        mergeSplatData.set(file.downloadData.subarray(0, environmentCount * 32), mergeDataCount * 32);
        xyz.set(file.xyz.subarray(0, environmentCount * 3), mergeDataCount * 3);
        mergeDataCount += environmentCount;
    }
    // if (watermarkCount) {
    //     mergeSplatData.set(splatModel.watermarkData.subarray(0, watermarkCount * 32), mergeDataCount * 32);
    //     mergeDataCount += watermarkCount;
    // }
    // if (textWatermarkCount) {
    //     mergeSplatData.set(txtWatermarkData.subarray(0, textWatermarkCount * 32), (mergeDataCount + watermarkCount) * 32);
    //     mergeDataCount += textWatermarkCount;
    // }

    // 保险起见以最终数据数量为准
    const totalRenderSplatCount = mergeDataCount; // + watermarkCount + textWatermarkCount;
    const mins: number[] = [xyz[0], xyz[1], xyz[2]];
    const maxs: number[] = [xyz[0], xyz[1], xyz[2]];
    for (let i = 0, x = 0, y = 0, z = 0; i < totalRenderSplatCount; i++) {
        x = xyz[i * 3];
        y = xyz[i * 3 + 1];
        z = xyz[i * 3 + 2];

        mins[0] = Math.min(mins[0], x);
        mins[1] = Math.min(mins[1], y);
        mins[2] = Math.min(mins[2], z);
        maxs[0] = Math.max(maxs[0], x);
        maxs[1] = Math.max(maxs[1], y);
        maxs[2] = Math.max(maxs[2], z);
    }
    await sleep();

    texture.texdata = new Uint32Array(mergeSplatData.buffer);
    texture.xyz = xyz;
    texture.renderSplatCount = totalRenderSplatCount;
    texture.visibleSplatCount = currentTotalVisibleCnt + watermarkCount + textWatermarkCount + environmentCount;
    texture.modelSplatCount = totalDownloadedCount + textWatermarkCount;
    texture.watermarkCount = watermarkCount + textWatermarkCount;
    texture.minX = mins[0];
    texture.maxX = maxs[0];
    texture.minY = mins[1];
    texture.maxY = maxs[1];
    texture.minZ = mins[2];
    texture.maxZ = maxs[2];
    texture.version = Date.now();
    texture.activeTime = texture.version;

    postUpdateTextureMemCache(texture);

    const cuts = `${visibleCuts}/${leafs.length}`;
    const lodTotalCount = splatTiles.totalCount;
    const modelSplatCount = `${texture.modelSplatCount} (${isFullCache ? 'mf' : 'mp'})`;
    postInformation({ scene: 'large', lodTotalCount, cuts, visibleSplatCount: texture.visibleSplatCount, modelSplatCount });
}

function fnAddTargetLod(splatTile: SplatTileNode, requireLevel: number, isFallback = false): number {
    const topLod = getTopLod();
    if (!splatTiles.lodTargets.includes(requireLevel)) {
        if (requireLevel < topLod) {
            return fnAddTargetLod(splatTile, requireLevel + 1, false);
        } else {
            splatTile.currentRenderLod = topLod;
        }
        return splatTile.currentRenderLod;
    }

    !isFallback && todoDownloadLod(splatTiles.files[splatTile.lods[requireLevel]?.fileKey]);

    const tileMapping = splatTile.lods[requireLevel];
    if (!tileMapping) {
        if (requireLevel < topLod) {
            return fnAddTargetLod(splatTile, requireLevel + 1, false);
        } else {
            splatTile.currentRenderLod = topLod;
        }
    } else {
        const file = splatTiles.files[tileMapping.fileKey];
        file.currentDistance = splatTile.currentDistance;
        if (sceneMeta.useGpuCache ? file?.textureReady : file?.downloadCount) {
            splatTile.currentRenderLod = requireLevel;
        } else {
            if (requireLevel < topLod) {
                fnAddTargetLod(splatTile, requireLevel + 1, true);
            } else {
                splatTile.currentRenderLod = topLod;
            }
        }
    }

    return splatTile.currentRenderLod;
}

function fnCheckSplatNodeChildVisible(cameraPosition: Vector3) {
    const topLod = getTopLod();
    traveSplatTree(splatTiles.tree, node => {
        const state = fnCheckSplatNodeVisible(node, cameraPosition);
        // if (state == 0) {
        //     // 完全不可见，旗下全部叶节点直接设定
        //     traveSplatTree(node, nd => {
        //         if (nd.lods) {
        //             nd.currentVisible = false;
        //             nd.currentRenderLod = topLod;
        //         }
        //     });
        //     return false;
        // } else if (state > 0) {
        //     // 完全可见（部分可见的叶节点都是完全可见），旗下全部叶节点直接计算设定
        //     traveSplatTree(node, nd => {
        //         if (!nd.lods) return;

        //         nd.currentVisible = true;
        //         fnAddTargetLod(nd, fnCalcRequireLodLevel(nd, cameraPosition));
        //     });
        // }

        if (state == 0) {
            // 完全不可见，旗下全部叶节点直接设定
            if (sortType === SortTypes.Radial2) {
                // 径向距离排序时，后方使用较低层级
                traveSplatTree(node, nd => {
                    if (!nd.lods) return;

                    nd.currentVisible = false;
                    fnAddTargetLod(nd, fnCalcRequireLodLevel(nd, cameraPosition));
                });
            } else {
                // 默认投影排序时，后方使用最粗糙层
                traveSplatTree(node, nd => {
                    if (nd.lods) {
                        nd.currentVisible = false;
                        nd.currentRenderLod = topLod;
                    }
                });
                return false;
            }
        } else if (state > 0) {
            // 完全可见（部分可见的叶节点都是完全可见），旗下全部叶节点直接计算设定
            traveSplatTree(node, nd => {
                if (!nd.lods) return;

                nd.currentVisible = true;
                fnAddTargetLod(nd, fnCalcRequireLodLevel(nd, cameraPosition));
            });
        }
    });
}

function fnCheckSplatNodeVisible(node: SplatTileNode, cameraPosition: Vector3): number {
    // 视锥剔除，第1个为近截面，第6个为远截面忽略计算
    const v3Center = _v3Tmp.fromArray(node.center);
    const distances: number[] = [];
    for (let i = 0; i < 5; i++) {
        const distance = frustumPlanes[i].distanceToPoint(v3Center); // 计算球心到平面的有符号距离
        if (distance < -node.radius) {
            node.currentVisible = false; // 若球体完全在平面外侧（负方向），则不可见
            return 0; // 不可见
        }
        distances[i] = distance;
    }
    node.currentVisible = true;
    node.currentDistance = computeSplatNodeCameraDistance(cameraPosition, node);
    if (node.lods) {
        // 叶节点按完全可见处理
        // node.currentDistance = computeSplatNodeCameraDistance(cameraPosition, node);
        return 1;
    } else {
        // node.currentDistance = distances[0] >= 0 ? Math.max(0, distances[0] - node.radius) : Math.min(0, distances[0] + node.radius);
    }

    for (let distance of distances) {
        if (distance < 0 || distance < node.radius) return -1; // 部分可见
    }
    return 1; // 完全可见
}

function getTopLod() {
    return splatTiles.lodTargets[splatTiles.lodTargets.length - 1];
}

function fnCalcRequireLodLevel(leafNode: SplatTileNode, cameraPosition: Vector3) {
    const distance = computeSplatNodeCameraDistance(cameraPosition, leafNode);
    leafNode.currentDistance = sortType === SortTypes.Default1 || leafNode.currentVisible ? distance : distance * penalty;
    // lodDistances/lodTargets都已升序
    let requireLevel = getTopLod();
    for (let i = splatTiles.lodDistances.length - 1; i >= 0; i--) {
        if (!leafNode.lods[splatTiles.lodTargets[i]]) continue; // 该块无此lod数据

        if (leafNode.currentDistance >= splatTiles.lodDistances[i]) {
            requireLevel = splatTiles.lodTargets[i];
            break;
        }
    }

    return requireLevel;
}

async function onWkA01Init(wkJson: string) {
    sceneMeta = JSON.parse(wkJson);
    maxMemCacheFileCount = (isMobile ? sceneMeta.mobileLodCacheFileCount : sceneMeta.pcLodCacheFileCount) || DefaultLodCacheFileCount;
    sceneMeta.url.endsWith('.lod.json') ? await downloadAndParseLodJson(sceneMeta.url) : await downloadAndParseLodMetaJson(sceneMeta.url);
    if (!sceneMeta.useGpuCache) {
        isFullCache = maxMemCacheFileCount >= splatTiles.lodTargetsFileCount;
    }
    checkDownload();
}

async function downloadAndParseLodMetaJson(lodMetaJsonUrl: string) {
    let lodTargetsTotalCount = 0;

    let lodMeta: any = null;
    try {
        const res = await fetch(lodMetaJsonUrl, { mode: 'cors', credentials: 'omit', cache: 'reload' });
        if (res.status === 200) {
            lodMeta = await res.json();
            // 通知更新包围盒
            const mins = lodMeta.tree.bound.min;
            const maxs = lodMeta.tree.bound.max;
            postWkA10BoundBox([mins[0], mins[1], mins[2], maxs[0], maxs[1], maxs[2]]);
        } else {
            return console.error('lod scene file fetch failed, status:', res.status);
        }
    } catch (e) {
        return console.error('lod scene file fetch failed', e.message);
    }

    const files = {};
    for (let i = 0; i < lodMeta.filenames.length; i++) {
        files[i + ''] = { url: lodMeta.filenames[i], count: 0 };
    }
    lodMeta.files = files;
    delete lodMeta.filenames;

    splatTiles = lodMeta;
    splatTiles.pcLodTargets = sceneMeta.pcLodTargets || defaultLodTargets();
    splatTiles.mobileLodTargets = sceneMeta.mobileLodTargets || defaultLodTargets();
    splatTiles.pcLodDistances = sceneMeta.pcLodDistances || defaultLodDistances(splatTiles.pcLodTargets.length);
    splatTiles.mobileLodDistances = sceneMeta.mobileLodDistances || defaultLodDistances(splatTiles.mobileLodTargets.length);
    const targetLods = isMobile ? splatTiles.mobileLodTargets : splatTiles.pcLodTargets;

    let totalCount = 0;
    let maxFileSplatCount = 0;
    const targetFileSet = new Set();
    traveSplatTree(lodMeta.tree, node => {
        const nd = node as any;
        const { center, radius } = calcCenterRadius(nd.bound.min, nd.bound.max);
        nd.center = center;
        nd.radius = radius;
        delete nd.bound;

        if (nd.lods) {
            const lods = [];
            for (let key of Object.keys(nd.lods)) {
                const lod = parseInt(key);
                const obj = nd.lods[key];
                const fileKey = obj.file + '';
                lods[lod] = { fileKey, offset: obj.offset, count: obj.count };
                files[fileKey].lod = lod;
                totalCount += obj.count;
                if (targetLods.includes(lod)) {
                    files[fileKey].count += obj.count;
                    maxFileSplatCount = Math.max(maxFileSplatCount, files[fileKey].count);
                    lodTargetsTotalCount += obj.count;
                    targetFileSet.add(fileKey);
                }
            }
            nd.lods = lods;
        }
    });

    splatTiles.version = 1;
    splatTiles.magic = SplatLodJsonMagic;
    splatTiles.totalCount = totalCount;
    splatTiles.maxFileSplatCount = maxFileSplatCount;
    splatTiles.lodTargetsFileCount = targetFileSet.size;
    splatTiles.lodTargetsTotalCount = lodTargetsTotalCount;

    splatTiles.fetchSet = new Set<string>();
    splatTiles.lodTargets = getLodTargets(splatTiles);
    splatTiles.lodDistances = getLodDistances(splatTiles);

    const toplod = getTopLod();
    for (let key of Object.keys(splatTiles.files)) {
        const file = splatTiles.files[key];
        file.fileKey = key;
        file.status = DataStatus.None;
        file.lastTime = file.lod < toplod ? 0 : Date.now() * 2;
        file.url = getUrl(file.url, lodMetaJsonUrl);
    }
    if (splatTiles.environment) {
        const file = { fileKey: 'environment', url: getUrl(splatTiles.environment as string, lodMetaJsonUrl) };
        splatTiles.environment = file;
        splatTiles.lodTargetsFileCount++;
        splatTiles.files['environment'] = file;
    }

    postSplatTilesReady();
}

function defaultLodTargets(): number[] {
    const rs: number[] = [];
    for (let i = 0; i < splatTiles.lodLevels; i++) {
        rs.push(i);
    }
    return rs;
}

function defaultLodDistances(lodTargetsCnt: number): number[] {
    const rs: number[] = [];
    for (let i = 1; i < lodTargetsCnt; i++) {
        rs.push(i * 5);
    }
    return rs;
}

async function downloadAndParseLodJson(lodJsonUrl: string) {
    let lodTargetsTotalCount = 0;

    try {
        const res = await fetch(lodJsonUrl, { mode: 'cors', credentials: 'omit', cache: 'reload' });
        if (res.status === 200) {
            let lodJson = await res.json();

            const mins = lodJson.tree.bound?.min;
            const maxs = lodJson.tree.bound?.max;
            postWkA10BoundBox([mins[0], mins[1], mins[2], maxs[0], maxs[1], maxs[2]]);
            splatTiles = lodJson;
            splatTiles.pcLodTargets = sceneMeta.pcLodTargets || defaultLodTargets();
            splatTiles.mobileLodTargets = sceneMeta.mobileLodTargets || defaultLodTargets();
            splatTiles.pcLodDistances = sceneMeta.pcLodDistances || defaultLodDistances(splatTiles.pcLodTargets.length);
            splatTiles.mobileLodDistances = sceneMeta.mobileLodDistances || defaultLodDistances(splatTiles.mobileLodTargets.length);

            const targetLods = isMobile ? splatTiles.mobileLodTargets : splatTiles.pcLodTargets;
            splatTiles.fetchSet = new Set<string>();
            splatTiles.lodTargets = getLodTargets(splatTiles);
            splatTiles.lodDistances = getLodDistances(splatTiles);

            const toplod = getTopLod();
            const targetFileSet = new Set();
            let maxFileSplatCount = 0;
            for (let key of Object.keys(splatTiles.files)) {
                const file = splatTiles.files[key];
                file.fileKey = key;
                file.status = DataStatus.None;
                file.lastTime = file.lod < toplod ? 0 : Date.now() * 2;
                file.url = getUrl(file.url, lodJsonUrl);
                lodTargetsTotalCount += targetLods.includes(file.lod) ? file.count : 0;
                maxFileSplatCount = Math.max(maxFileSplatCount, file.count);
                targetLods.includes(file.lod) && targetFileSet.add(key);
            }
            splatTiles.lodTargetsTotalCount = lodTargetsTotalCount;
            splatTiles.lodTargetsFileCount = targetFileSet.size;
            splatTiles.maxFileSplatCount = maxFileSplatCount;

            if (splatTiles.environment) {
                const file = { fileKey: 'environment', url: getUrl(splatTiles.environment as string, lodJsonUrl) };
                splatTiles.environment = file;
                splatTiles.lodTargetsFileCount++;
                splatTiles.files['environment'] = file;
            }
        } else {
            return console.error('lod scene file fetch failed, status:', res.status);
        }
    } catch (e) {
        return console.error('lod scene file fetch failed', e.message);
    }

    postSplatTilesReady();
}

function traveSplatTree(splatNode: SplatTileNode, fnCall: (node: SplatTileNode) => any) {
    if (fnCall(splatNode) !== false) {
        const children: SplatTileNode[] = splatNode.children || [];
        for (let cld of children) {
            traveSplatTree(cld, fnCall);
        }
    }
}

function calcCenterRadius(mins: any, maxs: any) {
    const center = [(maxs[0] + mins[0]) / 2, (maxs[1] + mins[1]) / 2, (maxs[2] + mins[2]) / 2];
    const sizeX = maxs[0] - mins[0];
    const sizeY = maxs[1] - mins[1];
    const sizeZ = maxs[2] - mins[2];
    const radius = Math.sqrt(sizeX * sizeX + sizeY * sizeY + sizeZ * sizeZ) / 2;
    return { center, radius };
}

function getLodTargets(splatTiles: SplatTiles): number[] {
    let lodTargets = [...new Set((isMobile ? splatTiles.mobileLodTargets : splatTiles.pcLodTargets) || [])];
    if (!lodTargets?.length || lodTargets.length >= splatTiles.lodLevels) {
        lodTargets = [];
        for (let i = 0; i < splatTiles.lodLevels; i++) {
            lodTargets.push(i);
        }
    }
    lodTargets.sort((a, b) => a - b); // 升序
    return lodTargets;
}

function getLodDistances(splatTiles: SplatTiles): number[] {
    const tgtLodCount = splatTiles.lodTargets.length;
    let lodDistances = [...new Set((isMobile ? splatTiles.mobileLodDistances : splatTiles.pcLodDistances) || [])];

    if (lodDistances.length == tgtLodCount) {
        lodDistances.sort((a, b) => a - b); // 升序
        lodDistances[0] = 0; // 确保首个0
    } else if (lodDistances.length == tgtLodCount - 1) {
        lodDistances.push(0);
        lodDistances.sort((a, b) => a - b); // 升序
    } else {
        // 设定有误就重置
        lodDistances = [];
        for (let i = 0; i < tgtLodCount; i++) {
            lodDistances.push(i * 20);
        }
        lodDistances.sort((a, b) => a - b); // 升序
    }

    delete splatTiles.pcLodTargets;
    delete splatTiles.mobileLodTargets;
    delete splatTiles.pcLodDistances;
    delete splatTiles.mobileLodDistances;

    return lodDistances;
}

function checkTopLodDownloadStatus() {
    if (splatTiles.topLodReady) return;
    let ready = true;
    let cnt = 0;
    const topLod = getTopLod();
    for (let key of Object.keys(splatTiles.files)) {
        let file = splatTiles.files[key];
        if (file.lod === topLod) {
            if (sceneMeta.useGpuCache ? file.textureReady : file.downloadCount) {
                cnt++;
            } else {
                ready = false;
            }
        }
    }
    splatTiles.topLodReady = ready || cnt >= 4;
}

async function checkDownload() {
    const fetchingCnt = fetchingSet.size;
    if (doingCheckDownload || isDownloadAllDone || fetchingCnt >= MaxDownloadCount) return; // 正忙、或已全部下载、或已下载受限
    doingCheckDownload = true;

    checkTopLodDownloadStatus();

    // 遍历检查
    let unfinishedCnt = 0;
    let lod0Files: SplatFile[] = [];
    if ((splatTiles?.environment as SplatFile)?.url) {
        const status = (splatTiles.environment as SplatFile).status;
        status < DataStatus.FetchDone && unfinishedCnt++;
        !status && lod0Files.push(splatTiles.environment as SplatFile);
    }
    const topLod = getTopLod();
    for (let file of Object.values(splatTiles.files)) {
        if (!file.status) {
            file.lod === topLod && lod0Files.length < MaxDownloadCount && lod0Files.push(file);
        }
        file.status < DataStatus.FetchDone && unfinishedCnt++;
    }
    isDownloadAllDone = unfinishedCnt <= 0;

    // 顶层级优先下载
    for (let splatFile of lod0Files) {
        splatFile.downloadCount = 0;
        splatFile.lastTime = Date.now() * 2; // 确保环境及顶层常驻
        postDownloadSplatFile(splatFile);
    }
    if (lod0Files.length) {
        doingCheckDownload = false;
        return; // 可能内含调色板，让优先下载完
    }

    // 调整优先顺序
    const allsets = [...todoSplatFileSet];
    const alldone = allsets.filter(v => v.status == DataStatus.FetchDone); // 仅处理待下载的
    const alltodos = allsets.filter(v => !v.status); // 仅处理待下载的
    alltodos.sort((a, b) => a.currentDistance - b.currentDistance); // 从近到远排序
    const todos = alltodos.slice(0, Math.min(MaxDownloadCount - fetchingCnt, alltodos.length)); // 截取近处限制数内节点

    // 待下载
    for (let splatFile of todos) {
        splatFile.downloadCount = 0;
        splatFile.lastTime = Date.now();
        postDownloadSplatFile(splatFile);
    }

    if (isFullCache) {
        for (let file of alldone) todoSplatFileSet.delete(file);
    } else {
        todoSplatFileSet.clear();
    }

    doingCheckDownload = false;
}

function todoDownloadLod(splatFile: SplatFile) {
    splatFile && !splatFile.status && Date.now() > splatFile.lastTime && todoSplatFileSet.add(splatFile);
}

function postDownloadSplatFile(splatFile: SplatFile) {
    if (disposed || fetchingSet.has(splatFile.fileKey)) return;
    worker.postMessage({ [WkA10Download]: true, [WkFileKey]: splatFile.fileKey });
    splatFile.textureReady = false;
    splatFile.downloadCount = 0;
    splatFile.status = DataStatus.Fetching; // 下载中
    fetchingSet.add(splatFile.fileKey);
}

function postSplatTilesReady() {
    worker.postMessage({ [WkA10SplatTilesReady]: true, [WkJson]: JSON.stringify(splatTiles) });
}

function postInformation(obj: any) {
    worker.postMessage({ [WkA10Information]: true, [WkJson]: JSON.stringify(obj) });
}

function postWkA10BoundBox(minmax: number[]) {
    worker.postMessage({ [WkA10BoundBox]: true, [WkBox]: minmax });
}

function postSortPartXyz(texture: SplatTexdata) {
    if (disposed) return;
    const xyz = texture.xyz;
    const xyzIndex = texture.xyzIndex;
    texture.xyz = null;
    texture.xyzIndex = null;
    worker.postMessage({ [WkA10SortPartXyz]: true, [WkJson]: JSON.stringify(texture), [WkXyz]: xyz, [WkXyzIndex]: xyzIndex }, [xyz.buffer, xyzIndex.buffer]);
}

function postUpdateTextureMemCache(texture: SplatTexdata) {
    if (disposed) return;
    const { texdata: txdata, xyz } = texture;
    texture.xyz = null;
    texture.texdata = null;
    worker.postMessage({ [WkA10UpdateDblTexture]: true, [WkJson]: JSON.stringify(texture), [WkXyz]: xyz, [WkTexData]: txdata }, [xyz.buffer, txdata.buffer]);
}

function postWkA10TargetLayer(fileKey: string, targetLayer: number) {
    worker.postMessage({ [WkA10ReturnLayer]: true, [WkFileKey]: fileKey, [WkLayer]: targetLayer });
}

function postWkA10Recycle(oldFile: SplatFile) {
    const { fileKey, offset, downloadCount, xyz } = oldFile;
    worker.postMessage({ [WkA10Recycle]: true, [WkFileKey]: fileKey, [WkOffset]: offset, [WkDownloadCount]: downloadCount, [WkXyz]: xyz }, [xyz.buffer]);
}

function calcAllWkA10TargetLayer(): boolean {
    let derty = false;
    let todo: QueueItem = null;
    while (!calcLayerQueue.isEmpty()) {
        const oldFile = findReplaceableSplatFile();
        if (!oldFile) {
            break;
        }
        todo = calcLayerQueue.get();

        // 回收数据
        postWkA10Recycle(oldFile);

        // 设置为脏数据
        totalDownloadedCount -= oldFile.downloadCount;
        oldFile.textureReady = false;
        oldFile.downloadCount = 0;
        oldFile.xyz = null;
        oldFile.lastTime = Date.now() + 5000; // 指定时间后才能再次下载
        oldFile.status = DataStatus.None;

        // 替换占坑
        const fileKey = todo.fileKey;
        const newFile = splatTiles.files[fileKey];
        newFile.targetLayer = oldFile.targetLayer;
        newFile.textureReady = false;
        layers[newFile.targetLayer] = newFile;
        todo.resolve(newFile.targetLayer);

        derty = true;
    }

    return derty;
}

worker.onmessage = (e: any) => {
    if (disposed) return;
    const data: any = e.data;
    if (data[WkA01Init]) {
        // 初始化
        // sortType = data[WkSortType] === SortTypes.Default1 ? SortTypes.Default1 : SortTypes.Radial2;
        onWkA01Init(data[WkJson]);
    } else if (data[WkA01UpdateParams]) {
        // 更新参数
        sortType = data[WkSortType] === SortTypes.Default1 ? SortTypes.Default1 : SortTypes.Radial2;
    } else if (data[WkA01SetTextureSize]) {
        // 纹理尺寸
        onWkA01SetTextureSize(data[WkJson]);
    } else if (data[WkA01Refresh]) {
        // 刷新
        onWkA01Refresh(data[WkViewProjection], data[WkCameraPosition]);
    } else if (data[WkA01CalcTargetLayer]) {
        // 取目标层级
        onWkA01CalcTargetLayer(data[WkFileKey]);
    } else if (data[WkA01FetchOkGpuCache]) {
        // 下载成功
        onWkA01FetchOkGpuCache(data[WkFileKey], data[WkLayer], new Float32Array(data[WkXyz].buffer), data[WkDownloadCount], data[WkOffset]);
    } else if (data[WkA01FetchOkMemCache]) {
        // 下载成功
        onWkA01FetchOkMemCache(data[WkFileKey], data[WkDownloadCount], data[WkDownloadData], data[WkXyz]);
    } else if (data[WkA01FetchNG]) {
        // 下载失败
        onWkA01FetchNG(data[WkFileKey]);
    } else if (data[WkA01DblActive]) {
        // 双缓冲激活
        onWkA01DblActive(data[WkIndex]);
    } else if (data[WkA01BackXyz]) {
        // 回收
        xyzCache.push(new Float32Array(data[WkXyz].buffer));
    } else if (data[WkA01BackXyzIndex]) {
        // 回收
        xyzIndexCache.push(new Uint32Array(data[WkXyzIndex].buffer));
    } else if (data[WkA01BackSplatBuffer]) {
        // 回收
        mergeDataCache.push(new Uint8Array(data[WkTexData].buffer));
    } else if (data[WkA01Dispose]) {
        // 销毁
        disposed = true;
    }
};
