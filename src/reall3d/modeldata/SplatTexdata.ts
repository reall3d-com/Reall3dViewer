// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
/**
 * Splat Texture Data
 */
interface SplatTexdata {
    /** 索引（0 | 1） */
    index: number;
    /** 纹理版本（毫秒时间戳） */
    version?: number;
    /** 纹理数据 */
    texdata?: Uint32Array;
    /** 坐标数据 */
    xyz?: Float32Array;
    /** 高斯点纹理索引 */
    xyzIndex?: Uint32Array;
    /** 纹理数据就绪标志 */
    textureReady?: boolean;
    /** 纹理数据就绪时间点 */
    textureReadyTime?: number;
    /** 是否渲染中的活动状态 */
    active?: boolean;
    activeTime?: number;

    /** 包围盒极限点 */
    minX?: number;
    /** 包围盒极限点 */
    maxX?: number;
    /** 包围盒极限点 */
    minY?: number;
    /** 包围盒极限点 */
    maxY?: number;
    /** 包围盒极限点 */
    minZ?: number;
    /** 包围盒极限点 */
    maxZ?: number;

    /** 待渲染的Splat数量 */
    renderSplatCount?: number;
    /** 可见且可用的Splat数量 */
    visibleSplatCount?: number;
    /** 所有处理中的模型Splat数量合计 */
    modelSplatCount?: number;
    /** 模型数据中的水印数量 */
    watermarkCount?: number;
}
