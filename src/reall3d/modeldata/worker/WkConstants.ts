// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
// Worker常量
let n: number = 0;
/** Splat纹理 */
export const WkTexdata = `$${n++}`;
/** Splat索引 */
export const WkDepthIndex = `$${n++}`;
/** 当前模型已下载数据的最大半径 */
export const WkCurrentMaxRadius = `$${n++}`;
/** 模型的最大半径（小场景bin格式用） */
export const WkMaxRadius = `$${n++}`;
/** 模型中心点高度（小场景bin格式用） */
export const WkTopY = `$${n++}`;
/** 纹理索引 */
export const WkIndex = `$${n++}`;
/** 数据版本(时间戳) */
export const WkVersion = `$${n++}`;
/** 渲染的高斯数量 */
export const WkRenderSplatCount = `$${n++}`;
/** 可见的高斯数量 */
export const WkVisibleSplatCount = `$${n++}`;
/** 模型中的高斯数量 */
export const WkModelSplatCount = `$${n++}`;
/** 排序开始时间 */
export const WkSortStartTime = `$${n++}`;
/** 排序消耗时间 */
export const WkSortTime = `$${n++}`;
/** 纹理就绪 */
export const WkA09SglTextureReady = `$${n++}`;
/** 大场景双纹理就绪 */
export const WkA09DblTextureReady = `$${n++}`;
/** 模型数据缓冲 */
export const WkSplatDataBuffer = `$${n++}`;
/** 最大渲染数量 */
export const WkMaxRenderCount = `$${n++}`;
/** bin格式版本 */
export const WkBinVersion = `$${n++}`;
/** 视图投影矩阵 */
export const WkViewProjection = `$${n++}`;
/** 上传纹理的版本 */
export const WkUploadTextureVersion = `$${n++}`;
/** 排序用已就绪的坐标 */
export const WkXyz = `$${n++}`;
/** 排序用已就绪的水印坐标 */
export const WkWxyz = `$${n++}`;
/** 包围盒 */
export const WkMinX = `$${n++}`;
/** 包围盒 */
export const WkMaxX = `$${n++}`;
/** 包围盒 */
export const WkMinY = `$${n++}`;
/** 包围盒 */
export const WkMaxY = `$${n++}`;
/** 包围盒 */
export const WkMinZ = `$${n++}`;
/** 包围盒 */
export const WkMaxZ = `$${n++}`;
/** 初始化 */
export const WkA09Init = `$${n++}`;
/** 水印数量 */
export const WkWatermarkCount = `$${n++}`;
/** 相机方向 */
export const WkCameraDirection = `$${n++}`;
/** 相机位置 */
export const WkCameraPosition = `$${n++}`;
/** 渲染质量级别 */
export const WkQualityLevel = `$${n++}`;
/** 更新参数 */
export const WkA09UpdateParams = `$${n++}`;
/** 排序桶使用的位数 */
export const WkBucketBits = `$${n++}`;
/** 排序类型 */
export const WkSortType = `$${n++}`;
/** 深度远近分段比例 */
export const WkDepthNearRate = `$${n++}`;
/** 深度远近分段值（设定时优先） */
export const WkDepthNearValue = `$${n++}`;
/** 销毁 */
export const WkA02Dispose = `$${n++}`;
/** 下载指定链接数据 */
export const WkA02FetcherUrl = `$${n++}`;
/** 下载结束 */
export const WkA90FetcherDone = `$${n++}`;
/** 下载状态 */
export const WkFetcherStatus = `$${n++}`;
/** 下载数据 */
export const WkFetcherSplatData = `$${n++}`;
/** 下载数量 */
export const WkFetcherDownloadSplatCount = `$${n++}`;
/** 下载数据的球谐系数级别 */
export const WkFetcherDataShDegree = `$${n++}`;
/** 下载数据的球谐系数调色板 */
export const WkFetcherPalettes = `$${n++}`;
/** 高斯点纹理索引 */
export const WkXyzIndex = `$${n++}`;
/** 双缓冲纹理数据 */
export const WkTexData = `$${n++}`;

/** 属性 */
export const WkDownloadCount = `$${n++}`;
/** 属性 */
export const WkDownloadData = `$${n++}`;
/** 属性 */
export const WkFileKey = `$${n++}`;
/** 属性 */
export const WkFileKeys = `$${n++}`;
/** 属性 */
export const WkJson = `$${n++}`;
/** 属性 */
export const WkOffset = `$${n++}`;
/** 属性 */
export const WkTextureSize = `$${n++}`;
/** 属性 */
export const WkLayer = `$${n++}`;
/** 属性 */
export const WkBox = `$${n++}`;
/** 属性 */
export const WkUrl = `$${n++}`;

/** 传SplatTiles */
export const WkA10SplatTilesReady = `$${n++}`;
/** 通知下载 */
export const WkA10Download = `$${n++}`;
/** 通知信息 */
export const WkA10Information = `$${n++}`;
/** 通知排序 */
export const WkA10SortPartXyz = `$${n++}`;
/** 通知目标层级 */
export const WkA10ReturnLayer = `$${n++}`;
/** 通知更新双缓冲 */
export const WkA10UpdateDblTexture = `$${n++}`;
/** 通知更新包围盒 */
export const WkA10BoundBox = `$${n++}`;
/** 回收数据 */
export const WkA10Recycle = `$${n++}`;

/** 初始化 */
export const WkA01Init = `$${n++}`;
/** 传送纹理信息 */
export const WkA01SetTextureSize = `$${n++}`;
/** 刷新 */
export const WkA01Refresh = `$${n++}`;
/** 下载完成 */
export const WkA01FetchOkGpuCache = `$${n++}`;
/** 下载完成 */
export const WkA01FetchOkMemCache = `$${n++}`;
/** 下载失败 */
export const WkA01FetchNG = `$${n++}`;
/** 取目标层级 */
export const WkA01CalcTargetLayer = `$${n++}`;
/** 双缓冲激活 */
export const WkA01DblActive = `$${n++}`;
/** 销毁 */
export const WkA01Dispose = `$${n++}`;
/** 回收 */
export const WkA01BackXyz = `$${n++}`;
/** 回收 */
export const WkA01BackXyzIndex = `$${n++}`;
/** 回收 */
export const WkA01BackSplatBuffer = `$${n++}`;

/** 更新排序数据 */
export const WkA09SortPart = `$${n++}`;
/** 回收 */
export const WkA90BackXyz = `$${n++}`;
/** 回收 */
export const WkA90BackXyzIndex = `$${n++}`;
/** 排序结果 */
export const WkA90DepthIndex = `$${n++}`;
/** 回收 */
export const WkA09BackDepthIndex = `$${n++}`;
/** 排序 */
export const WkA09Sort = `$${n++}`;
