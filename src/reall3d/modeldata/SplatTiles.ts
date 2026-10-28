// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { SpxHeader } from './ModelData';

export const SplatLodJsonMagic = 'splat-lod';

export interface SplatTiles {
    // 版本
    version: number;
    // 区分
    magic: string;
    // 备注
    comment?: string;
    // LOD级别数量
    lodLevels: number;
    // 总Splat数量
    totalCount: number;
    // 环境模型
    environment?: string | SplatFile;

    /**
     * Target LOD levels to select from available data levels.
     * For example, if data contains levels 0~6, you may select only three levels [0,1,6] for actual use.
     * Defaults to all available levels in the data.
     */
    pcLodTargets?: number[];
    mobileLodTargets?: number[];
    // 内部使用
    lodTargets?: number[];
    lodTargetsTotalCount: number;
    lodTargetsFileCount: number;
    maxFileSplatCount: number;

    /**
     * Distance thresholds to switch between LOD levels.
     * Different camera distances determine which LOD level to render.
     * For three LOD levels, define two split points [100,50],
     * meaning: beyond 100 units uses lowest detail, within 50 units uses highest detail.
     */
    pcLodDistances?: number[];
    mobileLodDistances?: number[];
    // 内部使用
    lodDistances?: number[];

    // 文件集
    files: Record<string, SplatFile>;
    // 树结构组织的空间块
    tree: SplatTileNode;

    // 内部计算用
    fetchSet?: Set<string>;
    topLodReady?: boolean;
}

export interface SplatFile {
    fileKey: string;
    url?: string;
    lod?: number;
    count?: number;

    // 状态
    status?: DataStatus;
    lastTime?: number;

    // 是否就绪
    textureReady?: boolean;
    offset?: number;

    // 数据
    spxHeader?: SpxHeader;
    downloadCount?: number;
    downloadData?: Uint8Array;
    xyz?: Float32Array;
    abortController?: AbortController;

    // 内部计算用
    currentDistance?: number;

    targetLayer?: number;
}

export interface SplatTileNode {
    center: number[];
    radius: number;
    fileKey?: string;
    children?: SplatTileNode[];
    lods?: TileMapping[];

    // 内部计算用
    currentDistance?: number;
    currentVisible?: boolean;
    currentRenderLod?: number;
}

export interface TileMapping {
    fileKey: string;
    offset: number;
    count: number;
}

export enum DataStatus {
    None = 0,
    WaitFetch = 0b1,
    Fetching = 0b10,
    FetchDone = 0b100,
    FetchAborted = 0b1000,
    FetchFailed = 0b10000,
    Invalid = 0b100000,
}

export function traveSplatTree(splatNode: SplatTileNode, fnCall: (node: SplatTileNode) => any) {
    if (fnCall(splatNode) !== false) {
        const children: SplatTileNode[] = splatNode.children || [];
        for (let cld of children) {
            traveSplatTree(cld, fnCall);
        }
    }
}
