// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import {
    WkA09SortPart,
    WkBucketBits,
    WkCameraDirection,
    WkCameraPosition,
    WkDepthNearRate,
    WkDepthNearValue,
    WkA09Init,
    WkQualityLevel,
    WkSortType,
    WkA09UpdateParams,
    WkWatermarkCount,
    WkXyzIndex,
    WkA90BackXyz,
    WkA90BackXyzIndex,
    WkA09BackDepthIndex,
    WkA90DepthIndex,
    WkA09DblTextureReady,
    WkA09Sort,
} from './WkConstants';
import {
    WkIndex,
    WkMaxRenderCount,
    WkModelSplatCount,
    WkRenderSplatCount,
    WkSortTime,
    WkDepthIndex,
    WkA09SglTextureReady,
    WkVersion,
    WkViewProjection,
    WkVisibleSplatCount,
    WkSortStartTime,
    WkMinX,
    WkMaxX,
    WkMinY,
    WkMaxY,
    WkMinZ,
    WkMaxZ,
    WkXyz,
} from './WkConstants';
import { isMobile, QualityLevels, SortTypes } from '../../utils/GlobalConstants';

const worker: Worker = self as any;
let texture0: SplatTexdata = { index: 0, version: 0 };
let texture1: SplatTexdata = { index: 1, version: 0 };
let isSorterReady: boolean = false;
let qualityLevel: number = QualityLevels.Default5; // 1~9,默认5
let sortType: number = SortTypes.Default1;
let maxRenderCount: number = 0;

let sortRunning: boolean;
let Epsilon: number = isMobile ? 0.5 : 0.2;
let viewProj: number[];
let lastViewProj: number[] = [];
let distances: Int32Array | number[] = [];
let depths: Float32Array = new Float32Array(0);
let int32Tmp1: Int32Array = new Int32Array(0);
let counters: Int32Array = new Int32Array(0);
let splatIndexPool: Uint32Array[] = [];
let cameraDir: number[];
let cameraPos: number[];

let lastSortVersion: number = 0;
let lastSortCameraPos: number[] = [];
// let isBigSceneMode: boolean;
let depthNearRate = 0.4; // 按比例计算分段(近端占比0.4是为了调试看到效果，实际应用应根据模型尺寸具体调整)
let depthNearValue = 0; // 按设定值计算分段(设定时优先)

function runSort(sortViewProj: number[], sortCameraDir: number[], sortCameraPos: number[]) {
    if (!isSorterReady) return; // 尚未就绪
    let texture: SplatTexdata = texture0.version > texture1.version ? texture0 : texture1;
    if (!texture.version) return; // 初期还没有数据

    const { xyz, xyzIndex, renderSplatCount, visibleSplatCount, modelSplatCount, watermarkCount, index, version } = texture;

    if (lastSortVersion === version) {
        if (sortType === SortTypes.Radial2) {
            if (lastSortCameraPos?.length) {
                const [x1, y1, z1] = lastSortCameraPos;
                const [x2, y2, z2] = sortCameraPos;
                const dx = x1 - x2;
                const dy = y1 - y2;
                const dz = z1 - z2;
                const diff = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (diff < 0.5) return;
            }
        } else {
            let diff =
                Math.abs(lastViewProj[2] - sortViewProj[2]) + // 相机前方向 X
                Math.abs(lastViewProj[6] - sortViewProj[6]) + // 相机前方向 Y
                Math.abs(lastViewProj[10] - sortViewProj[10]) + // 相机前方向 Z
                Math.abs(lastViewProj[12] - sortViewProj[12]) + // 相机位置 X
                Math.abs(lastViewProj[13] - sortViewProj[13]) + // 相机位置 Y
                Math.abs(lastViewProj[14] - sortViewProj[14]); // 相机位置 Z
            if (diff < Epsilon) return;
        }
    }
    lastViewProj = sortViewProj;
    lastSortVersion = version;
    lastSortCameraPos = sortCameraPos;

    let startTime = Date.now();
    let renderCount: number;
    if (!renderSplatCount) {
        const depthIndex = new Uint32Array(0);
        // 没有渲染数据时直接处理
        worker.postMessage(
            {
                [WkA90DepthIndex]: true,
                [WkDepthIndex]: depthIndex,
                [WkRenderSplatCount]: 0,
                [WkVisibleSplatCount]: visibleSplatCount,
                [WkModelSplatCount]: modelSplatCount,
                [WkIndex]: index,
                [WkVersion]: version,
                [WkSortTime]: 0,
                [WkSortStartTime]: startTime,
            },
            [depthIndex.buffer],
        );
        return;
    }

    // 排序
    let sortTime = 0;
    let bucketBits = 0;
    let depthIndex: Uint32Array = poolSplatIndexPop();
    const dataCount = renderSplatCount - watermarkCount;
    const fnCalcDepth = sortType === SortTypes.Default1 ? calcDepthByViewProj : sortType === SortTypes.Radial2 ? calcDepthsRadial : calcDepthByCameraDir;
    const sortVpOrDir = sortType === SortTypes.Default1 ? sortViewProj : sortCameraDir;
    const dotPos = sortCameraDir[0] * sortCameraPos[0] + sortCameraDir[1] * sortCameraPos[1] + sortCameraDir[2] * sortCameraPos[2];

    let { maxDepth, minDepth } = calcMinMaxDepth(texture, sortVpOrDir, fnCalcDepth, dotPos, sortCameraPos);
    if (maxDepth - minDepth <= 0.00001) {
        // 都挤一起了没必要排序
        for (let i = 0; i < dataCount; ++i) depthIndex[i] = i;
        renderCount = dataCount + watermarkCount;
    } else {
        let maxBucketCnt = getBucketCount(maxRenderCount).bucketCnt;
        counters.length < maxBucketCnt ? (counters = new Int32Array(maxBucketCnt)) : counters.fill(0);
        // distances.length < maxRenderCount && (distances = new Int32Array(maxRenderCount));
        sortType !== SortTypes.Default1 && depths.length < maxRenderCount && (depths = new Float32Array(maxRenderCount));

        if (sortType === SortTypes.ZdepthFrontNearest2010) {
            // 【2010】按相机方向（剔除背后和远端数据，仅留近端数据提高渲染性能）
            int32Tmp1.length < maxRenderCount && (int32Tmp1 = new Int32Array(maxRenderCount));
            // prettier-ignore
            const arg = { depthIndex, depths, distances, counters, int32Tmp1, xyz, dataCount, watermarkCount, maxDepth, minDepth, dotPos, sortCameraDir, depthNearRate, depthNearValue };
            ({ renderCount, bucketBits } = sortDirWithPruneOnlyNear2010(arg));
        } else if (sortType === SortTypes.ZdepthFront2011) {
            // 【2011】按相机方向（剔除相机背面数据提高渲染性能）
            int32Tmp1.length < maxRenderCount && (int32Tmp1 = new Int32Array(maxRenderCount));
            // prettier-ignore
            const arg = { depthIndex, depths, distances, counters, int32Tmp1, xyz, dataCount, watermarkCount, maxDepth, minDepth, dotPos, sortCameraDir, depthNearRate, depthNearValue };
            ({ renderCount, bucketBits } = sortDirWithPrune2011(arg));
        } else if (sortType === SortTypes.Radial2) {
            // 【2】径向排序，环顾四周情景较多的时候适用
            const arg = { depthIndex, distances, counters, xyz, xyzIndex, dataCount, watermarkCount, maxDepth, sortCameraPos };
            ({ renderCount, bucketBits } = sortByRadial(arg));
        } else {
            // 【1】默认，按视图投影矩阵排序（全量渲染）
            const arg = { depthIndex, distances, counters, xyz, xyzIndex, dataCount, watermarkCount, maxDepth, minDepth, sortViewProj };
            ({ renderCount, bucketBits } = sortByViewProjDefault(arg));
        }
    }

    // 水印
    // TODO LOD xyzIndex
    for (let i = 0; i < watermarkCount; ++i) depthIndex[dataCount + i] = dataCount + i;

    sortTime = Date.now() - startTime;
    worker.postMessage(
        {
            [WkA90DepthIndex]: true,
            [WkDepthIndex]: depthIndex,
            [WkRenderSplatCount]: renderCount, // 按实际变化并非一定固定
            [WkVisibleSplatCount]: visibleSplatCount,
            [WkModelSplatCount]: modelSplatCount,
            [WkIndex]: index,
            [WkVersion]: version,
            [WkSortStartTime]: startTime,
            [WkSortTime]: sortTime,
            [WkBucketBits]: bucketBits || 16,
            [WkSortType]: sortType || 1,
        },
        [depthIndex.buffer],
    );
}

/** 按相机方向（剔除背后和远端数据，仅留近端数据提高渲染性能） */
function sortDirWithPruneOnlyNear2010(oArg: any) {
    const { depthIndex, depths, distances, counters, int32Tmp1: dataIdx1, xyz, dataCount, watermarkCount, minDepth, dotPos, sortCameraDir } = oArg;
    const maxDepth1 = Math.min(oArg.maxDepth, 0);
    const minDepth1 = oArg.depthNearValue ? maxDepth1 - Math.abs(oArg.depthNearValue) : maxDepth1 - (maxDepth1 - minDepth) * oArg.depthNearRate;
    const dx = sortCameraDir[0];
    const dy = sortCameraDir[1];
    const dz = sortCameraDir[2];
    let nearCnt = 0;
    const subMinDepth1 = -minDepth1;
    const dotPosSubMinDepth1 = dotPos - minDepth1;
    for (let i = 0, offset = 0; i < dataCount; ++i) {
        const x = xyz[offset];
        const y = xyz[offset + 1];
        const z = xyz[offset + 2];
        const d = dotPosSubMinDepth1 - dx * x - dy * y - dz * z;
        depths[i] = d;
        dataIdx1[nearCnt] = i;
        const idx = ((d <= subMinDepth1 && d >= 0) as any) | 0;
        nearCnt += idx;
        offset += 3;
    }
    const renderCount = nearCnt + watermarkCount;
    const { bucketBits, bucketCnt } = getBucketCount(nearCnt);
    const depthInv = (bucketCnt - 1) / (maxDepth1 - minDepth1);
    for (let i = 0; i < nearCnt; ++i) {
        const index = dataIdx1[i];
        const d = depths[index];
        const idx = (d * depthInv) | 0;
        distances[i] = idx;
        counters[idx]++;
    }
    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < nearCnt; ++i) {
        const d = distances[i];
        const pos = --counters[d];
        depthIndex[pos] = dataIdx1[i];
    }
    return { renderCount, bucketBits };
}

/** 按相机方向（剔除相机背面数据提高渲染性能） */
function sortDirWithPrune2011(oArg: any) {
    const { depthIndex, depths, distances, counters, int32Tmp1: dataIdx1, xyz, dataCount, watermarkCount, minDepth, dotPos, sortCameraDir } = oArg;
    const maxDepth1 = Math.min(oArg.maxDepth, 0);
    const dx = sortCameraDir[0];
    const dy = sortCameraDir[1];
    const dz = sortCameraDir[2];
    let frontCnt = 0;
    const subMinDepth = -minDepth;
    const dotPosSubMinDepth = dotPos - minDepth;
    for (let i = 0, offset = 0; i < dataCount; ++i) {
        const x = xyz[offset];
        const y = xyz[offset + 1];
        const z = xyz[offset + 2];
        const d = dotPosSubMinDepth - dx * x - dy * y - dz * z;
        depths[i] = d;
        dataIdx1[frontCnt] = i;
        const idx = ((d <= subMinDepth) as any) | 0;
        frontCnt += idx;
        offset += 3;
    }

    const renderCount = frontCnt + watermarkCount;
    const { bucketBits, bucketCnt } = getBucketCount(frontCnt);

    const { invBinRange, binBase, binDivider } = computeBinViewProject({ maxDepth: maxDepth1, minDepth, bucketCnt, sortViewProj14: 0 });

    for (let i = 0; i < frontCnt; ++i) {
        const index = dataIdx1[i];
        const dist = depths[index];
        const d = dist * invBinRange; // 将view‑z映射为[0,32)的浮点bin坐标，整数部分=大段号，小数部分=段内位置frac
        const bin = d >>> 0; // 取浮点d的整数部分，即属于哪一个深度大段；有可能得到32，依靠哨兵数组防护
        const sortKey = (binBase[bin] + binDivider[bin] * (d - bin)) >>> 0; // 全局排序桶索引；先浮点数完整插值 base + divider*frac，最后整体一次无符号截断，不在段内提前取整，消除分段台阶
        distances[i] = sortKey;
        counters[sortKey]++;
    }

    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    for (let i = 0; i < frontCnt; ++i) {
        const d = distances[i];
        const pos = --counters[d];
        depthIndex[pos] = dataIdx1[i];
    }
    return { renderCount, bucketBits };
}

function sortByViewProjDefault(oArg: any) {
    const { depthIndex, distances, counters, xyz, xyzIndex, dataCount, watermarkCount, maxDepth, minDepth, sortViewProj } = oArg;
    const renderCount = dataCount + watermarkCount;
    let { bucketBits, bucketCnt } = getBucketCount(dataCount);

    const { invBinRange, minBase, binBase, binDivider } = computeBinViewProject({ maxDepth, minDepth, bucketCnt, sortViewProj14: sortViewProj[14] });
    const vp2 = sortViewProj[2];
    const vp6 = sortViewProj[6];
    const vp10 = sortViewProj[10];

    for (let i = 0, offset = 0; i < dataCount; ++i) {
        const x = xyz[offset];
        const y = xyz[offset + 1];
        const z = xyz[offset + 2];

        const dist = minBase - vp2 * x - vp6 * y - vp10 * z; // 该点投影后的view‑z深度
        const d = dist * invBinRange; // 将view‑z映射为[0,32)的浮点bin坐标，整数部分=大段号，小数部分=段内位置frac
        const bin = d >>> 0; // 取浮点d的整数部分，即属于哪一个深度大段；有可能得到32，依靠哨兵数组防护
        const sortKey = (binBase[bin] + binDivider[bin] * (d - bin)) >>> 0; // 全局排序桶索引；先浮点数完整插值 base + divider*frac，最后整体一次无符号截断，不在段内提前取整，消除分段台阶

        distances[i] = sortKey; // 保存该点最终排序key
        offset += 3;
    }
    for (let i = 0; i < dataCount; ++i) counters[distances[i]]++;

    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    if (xyzIndex) {
        // 存在xyzIndex索引数组场景
        for (let i = 0; i < dataCount; ++i) {
            const d = distances[i];
            const pos = --counters[d];
            depthIndex[pos] = xyzIndex[i];
        }
    } else {
        // 直接使用原始点下标场景
        for (let i = 0; i < dataCount; ++i) {
            const d = distances[i];
            const pos = --counters[d];
            depthIndex[pos] = i;
        }
    }
    return { renderCount, bucketBits };
}

function sortByRadial(oArg: any) {
    const { depthIndex, distances, counters, xyz, xyzIndex, dataCount, watermarkCount, maxDepth, sortCameraPos } = oArg;
    const renderCount = dataCount + watermarkCount;
    const { bucketBits, bucketCnt } = getBucketCount(dataCount);

    const { invRange, binBase, binDivider, NUM_BINS } = computeBinRadial({ maxDepth, minDepth: 0, bucketCnt });
    const [cx, cy, cz] = sortCameraPos;

    for (let i = 0, offset = 0; i < dataCount; ++i) {
        const x = xyz[offset];
        const y = xyz[offset + 1];
        const z = xyz[offset + 2];

        const dx = x - cx;
        const dy = y - cy;
        const dz = z - cz;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const val = maxDepth - d;

        // 因浮点误差需要检查处理
        let segFloat = val * invRange;
        if (segFloat < 0) segFloat = 0;
        else if (segFloat >= NUM_BINS) segFloat = NUM_BINS - 1e-6;

        const bin = segFloat >>> 0;
        const frac = segFloat - bin;

        const sortKey = (binBase[bin] + frac * binDivider[bin]) >>> 0;

        distances[i] = sortKey;
        counters[sortKey]++;
        offset += 3;
    }

    for (let i = 1; i < bucketCnt; ++i) counters[i] += counters[i - 1];
    if (xyzIndex) {
        for (let i = 0; i < dataCount; ++i) {
            const d = distances[i];
            const pos = --counters[d];
            depthIndex[pos] = xyzIndex[i];
        }
    } else {
        for (let i = 0; i < dataCount; ++i) {
            const d = distances[i];
            const pos = --counters[d];
            depthIndex[pos] = i;
        }
    }
    return { renderCount, bucketBits };
}

function computeBinRadial(oParams: any) {
    const { maxDepth, minDepth, bucketCnt } = oParams;
    const NUM_BINS = 31; // 将[minDepth,maxDepth]深度轴均匀切分为NUM_BINS个大段
    // 权重配置
    const WEIGHTS = [
        { maxDistance: 0, weight: 500.0 },
        { maxDistance: 2, weight: 100.0 },
        { maxDistance: 5, weight: 50.0 },
        { maxDistance: 10, weight: 5.0 },
        { maxDistance: Infinity, weight: 1.0 },
    ];

    const range = maxDepth - minDepth; // 径向距离总跨度：minDepth=最近径向距离，maxDepth=最远径向距离
    const cameraBin = NUM_BINS - 1; // 相机段固定在最后一个bin

    const weightByDistance = new Float32Array(NUM_BINS); // weightByDistance[i]：第i个径向大段的分配权重
    for (let i = 0; i < NUM_BINS; i++) {
        const distFromCamera = Math.abs(i - cameraBin); // 当前段i距离相机所在段(31)的段间隔
        let w = 1.0;
        for (const tier of WEIGHTS) {
            if (distFromCamera <= tier.maxDistance) {
                w = tier.weight;
                break;
            }
        }
        weightByDistance[i] = w;
    }

    const binBase = new Float32Array(NUM_BINS + 1); // binBase[i]：第i个大段在全局sortKey桶空间的起始偏移
    const binDivider = new Float32Array(NUM_BINS + 1); // binDivider[i]：第i个大段分配到的桶总数

    const totalWeight = weightByDistance.reduce((sum, w) => sum + w, 0); // 合计权重

    let accumulated = 0; // 累加器：已经分配出去的桶总量
    for (let i = 0; i < NUM_BINS; i++) {
        // 按权重占比分配桶，保底至少1个桶，不能为0
        const div = Math.max(1, Math.round((weightByDistance[i] / totalWeight) * bucketCnt));
        binBase[i] = accumulated;
        binDivider[i] = div;
        accumulated += div;
    }
    if (accumulated > bucketCnt) {
        const excess = accumulated - bucketCnt;
        binDivider[NUM_BINS - 1] = Math.max(1, binDivider[NUM_BINS - 1] - excess);
    }
    // 避免数组越界
    binBase[NUM_BINS] = binBase[NUM_BINS - 1] + binDivider[NUM_BINS - 1];
    binDivider[NUM_BINS] = 0;

    const invRange = NUM_BINS / range; // 系数：把val映射到 [0,32) 浮点bin坐标
    return { invRange, binBase, binDivider, NUM_BINS };
}

function computeBinViewProject(oParams: any) {
    const { maxDepth, minDepth, bucketCnt, sortViewProj14 } = oParams;
    const NUM_BINS = 31; // 将[minDepth,maxDepth]深度轴均匀切分为NUM_BINS个大段
    // 权重配置
    const WEIGHTS = [
        { maxDistance: 0, weight: 500.0 },
        { maxDistance: 2, weight: 100.0 },
        { maxDistance: 5, weight: 50.0 },
        { maxDistance: 10, weight: 5.0 },
        { maxDistance: Infinity, weight: 1.0 },
    ];

    // view‑z linear sort
    const range = maxDepth - minDepth; // 整个有效view‑z深度区间总跨度
    const cameraOffsetFromRangeStart = -minDepth; // 相机的view‑z值，相对于深度区间起点minDepth的偏移量
    let cameraBinFloat = (cameraOffsetFromRangeStart / range) * NUM_BINS; // 相机落在32段中的浮点位置
    let cameraBin = Math.max(0, Math.min(NUM_BINS - 1, Math.floor(cameraBinFloat))); // 相机所在大段的整数下标 0~31

    // 生成每一个bin的权重
    const weightByDistance = new Float32Array(NUM_BINS); // weightByDistance[i]：第i个深度大段的分配权重
    for (let i = 0; i < NUM_BINS; i++) {
        const distFromCamera = Math.abs(i - cameraBin); // 当前段i，距离相机所在段cameraBin的段间隔
        let w = 1.0;
        for (const tier of WEIGHTS) {
            if (distFromCamera <= tier.maxDistance) {
                w = tier.weight;
                break;
            }
        }
        weightByDistance[i] = w;
    }

    // 数组长度NUM_BINS+1=33；下标32为哨兵，防止浮点运算bin=32越界访问
    const binBase = new Float32Array(NUM_BINS + 1); //  binBase[i]：第i个大段，在全局sortKey桶空间中的起始偏移(base)
    const binDivider = new Float32Array(NUM_BINS + 1); // binDivider[i]：第i个大段分配到的总桶数量(divider)

    const totalWeight = weightByDistance.reduce((sum, w) => sum + w, 0); // 合计权重

    let accumulated = 0; // 累加器：累计已经分配出去的桶数量
    for (let i = 0; i < NUM_BINS; i++) {
        // 根据权重占比分配本段桶数，至少保证1个桶，不能为0
        const div = Math.max(1, Math.round((weightByDistance[i] / totalWeight) * bucketCnt));
        binBase[i] = accumulated;
        binDivider[i] = div;
        accumulated += div;
    }
    if (accumulated > bucketCnt) {
        const excess = accumulated - bucketCnt;
        binDivider[NUM_BINS - 1] = Math.max(1, binDivider[NUM_BINS - 1] - excess);
    }
    // 避免数组越界
    binBase[NUM_BINS] = binBase[NUM_BINS - 1] + binDivider[NUM_BINS - 1];
    binDivider[NUM_BINS] = 0;

    const invBinRange = NUM_BINS / range; // 系数：把view‑z深度值映射到 [0,32) 浮点bin坐标
    const minBase = -minDepth - sortViewProj14; // view‑z投影计算常量
    return { invBinRange, minBase, binBase, binDivider, NUM_BINS };
}

function calcDepthByViewProj(svp: number[], x: number, y: number, z: number): number {
    return -(svp[2] * x + svp[6] * y + svp[10] * z + svp[14]);
}
function calcDepthByCameraDir(dir: number[], x: number, y: number, z: number, dotPos: number): number {
    return dotPos - dir[0] * x - dir[1] * y - dir[2] * z; // 大于0为在相机背后
}

function calcDepthsRadial(cameraPos: number[], x: number, y: number, z: number): number {
    const dx = x - cameraPos[0];
    const dy = y - cameraPos[1];
    const dz = z - cameraPos[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function calcMinMaxDepth(texture: SplatTexdata, viewProjOrCameraDir: number[], fnDepth: Function, dotPos: number, sortCameraPos: number[]): any {
    let maxDepth = -Infinity;
    let minDepth = Infinity;
    const vertices = [
        [texture.minX, texture.minY, texture.minZ],
        [texture.minX, texture.minY, texture.maxZ],
        [texture.minX, texture.maxY, texture.minZ],
        [texture.minX, texture.maxY, texture.maxZ],
        [texture.maxX, texture.minY, texture.minZ],
        [texture.maxX, texture.minY, texture.maxZ],
        [texture.maxX, texture.maxY, texture.minZ],
        [texture.maxX, texture.maxY, texture.maxZ],
    ];
    for (const vertex of vertices) {
        let dep: number;
        if (fnDepth === calcDepthByViewProj) {
            dep = fnDepth(viewProjOrCameraDir, vertex[0], vertex[1], vertex[2]);
        } else if (fnDepth === calcDepthByCameraDir) {
            dep = fnDepth(viewProjOrCameraDir, vertex[0], vertex[1], vertex[2], dotPos);
        } else {
            dep = fnDepth(sortCameraPos, vertex[0], vertex[1], vertex[2]);
        }
        maxDepth = Math.max(maxDepth, dep);
        minDepth = Math.min(minDepth, dep);
    }
    return { maxDepth, minDepth };
}

const throttledSort = () => {
    if (!sortRunning) {
        sortRunning = true;
        const sortViewProj = viewProj;
        const sortCameraDir = cameraDir;
        const sortCameraPos = cameraPos;
        runSort(sortViewProj, sortCameraDir, sortCameraPos);
        setTimeout(() => !(sortRunning = false) && sortViewProj !== viewProj && throttledSort());
    }
};

function getBucketCount(splatCnt: number) {
    // 没有数据无排序，简单返回
    if (!splatCnt) return { bucketBits: 1, bucketCnt: 1 };

    let level = qualityLevel;
    // 按级别确定精度，达到允许自定义调整的目的，手机降低1级并控制不低于1级
    let bucketBits = 11 + (isMobile ? Math.max(level - 1, QualityLevels.L1) : level);
    // 低级别时，根据数据量计算，进一步降低精度，确保至少8位不失控
    if (level < QualityLevels.L3) {
        bucketBits = Math.max(Math.min(bucketBits, Math.round(Math.log2(splatCnt / 32))), 8);
    } else if (level < QualityLevels.L4) {
        bucketBits = Math.max(Math.min(bucketBits, Math.round(Math.log2(splatCnt / 16))), 8);
    } else if (level < QualityLevels.Default5) {
        bucketBits = Math.max(Math.min(bucketBits, Math.round(Math.log2(splatCnt / 8))), 8);
    }
    // 高级别时，根据数据量计算控制，避免不必要的浪费
    if (level >= QualityLevels.Default5) {
        bucketBits = Math.min(bucketBits, Math.round(Math.log2(splatCnt / 8)));
    }

    return { bucketBits, bucketCnt: 2 ** bucketBits };
}

function poolSplatIndexPop(): Uint32Array {
    return splatIndexPool.pop() || new Uint32Array(maxRenderCount);
}

function poolSplatIndexPush(ui32s: Uint32Array) {
    ui32s.fill(0) && splatIndexPool.push(ui32s);
}

worker.onmessage = (e: any) => {
    const data: any = e.data;
    if (data[WkA09SglTextureReady]) {
        let texture = texture0;

        texture.minX = data[WkMinX];
        texture.maxX = data[WkMaxX];
        texture.minY = data[WkMinY];
        texture.maxY = data[WkMaxY];
        texture.minZ = data[WkMinZ];
        texture.maxZ = data[WkMaxZ];
        // texture.xyz && worker.postMessage({ [WkSorterXyzDone]: texture.xyz }, [texture.xyz.buffer]);
        texture.xyz = new Float32Array(data[WkXyz].buffer);
        texture.watermarkCount = data[WkWatermarkCount];
        texture.version = data[WkVersion];
        texture.renderSplatCount = data[WkRenderSplatCount];
        texture.visibleSplatCount = data[WkVisibleSplatCount];
        texture.modelSplatCount = data[WkModelSplatCount];
    } else if (data[WkA09DblTextureReady]) {
        let texture = data[WkIndex] === 0 ? texture0 : texture1;

        texture.minX = data[WkMinX];
        texture.maxX = data[WkMaxX];
        texture.minY = data[WkMinY];
        texture.maxY = data[WkMaxY];
        texture.minZ = data[WkMinZ];
        texture.maxZ = data[WkMaxZ];
        texture.xyz && worker.postMessage({ [WkA90BackXyz]: true, [WkXyz]: texture.xyz }, [texture.xyz.buffer]);
        texture.xyz = new Float32Array(data[WkXyz].buffer);
        texture.watermarkCount = data[WkWatermarkCount];
        texture.version = data[WkVersion];
        texture.renderSplatCount = data[WkRenderSplatCount];
        texture.visibleSplatCount = data[WkVisibleSplatCount];
        texture.modelSplatCount = data[WkModelSplatCount];
    } else if (data[WkA09SortPart]) {
        let texture = texture0;

        texture.xyz && worker.postMessage({ [WkA90BackXyz]: true, [WkXyz]: texture.xyz }, [texture.xyz.buffer]);
        texture.xyzIndex && worker.postMessage({ [WkA90BackXyzIndex]: true, [WkXyzIndex]: texture.xyzIndex }, [texture.xyzIndex.buffer]);

        texture.minX = data[WkMinX];
        texture.maxX = data[WkMaxX];
        texture.minY = data[WkMinY];
        texture.maxY = data[WkMaxY];
        texture.minZ = data[WkMinZ];
        texture.maxZ = data[WkMaxZ];
        texture.xyz = new Float32Array(data[WkXyz].buffer);
        texture.xyzIndex = new Uint32Array(data[WkXyzIndex].buffer);
        texture.index = data[WkIndex];
        texture.watermarkCount = data[WkWatermarkCount];
        texture.version = data[WkVersion];
        texture.renderSplatCount = data[WkRenderSplatCount];
        texture.visibleSplatCount = data[WkVisibleSplatCount];
        texture.modelSplatCount = data[WkModelSplatCount];
    } else if (data[WkA09Sort]) {
        viewProj = data[WkViewProjection];
        cameraDir = data[WkCameraDirection];
        cameraPos = data[WkCameraPosition];
        throttledSort();
    } else if (data[WkA09UpdateParams]) {
        qualityLevel = Math.max(QualityLevels.L1, Math.min(data[WkQualityLevel] || QualityLevels.Default5, QualityLevels.L9)); // 限制1~9,默认5
        sortType = data[WkSortType] || sortType;
        depthNearRate = data[WkDepthNearRate] || depthNearRate;
        depthNearValue = data[WkDepthNearValue] || depthNearValue;
    } else if (data[WkA09BackDepthIndex]) {
        poolSplatIndexPush(data[WkDepthIndex] as Uint32Array);
    } else if (data[WkA09Init]) {
        maxRenderCount = data[WkMaxRenderCount];
        qualityLevel = Math.max(QualityLevels.L1, Math.min(data[WkQualityLevel] || QualityLevels.Default5, QualityLevels.L9)); // 限制1~9,默认5
        sortType = data[WkSortType] || sortType;
        depthNearRate = data[WkDepthNearRate] || depthNearRate;
        depthNearValue = data[WkDepthNearValue] || depthNearValue;
        isSorterReady = true;
    }
};
