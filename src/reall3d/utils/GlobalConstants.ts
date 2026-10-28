// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
export const ViewerVersion = 'v3.0.0'; // Reall3dViewer 版本

export const isCloudDevice = /CloudDevice/i.test(navigator.userAgent);
export const isMobile =
    /Mobi|Android|Phone|iPod|webOS|BlackBerry|Mini/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
export const HalfChars = 'QWERTYUIOPLKJHGFDSAZXCVBNM1234567890qwertyuioplkjhgfdsazxcvbnm`~!@#$%^&*()-_=+\\|]}[{\'";::,<.>//? \t';
export const SplatDataSize20 = 20;
export const SplatDataSize16 = 16;
export const WasmBlockSize: number = 64 * 1024;
export const MobileDownloadLimitSplatCount = 1024 * 10000; // 移动端高斯点数下载限制
export const PcDownloadLimitSplatCount = 10240 * 10000; // PC端高斯点数下载限制
export const SH_C0 = 0.28209479177387814;
export const MaxProcessCnt = isMobile ? 102400 : 512000;

export const DecoderPath = 'https://reall3d.com/reall3dviewer/libs/draco/'; // 'https://unpkg.com/three@0.171.0/examples/jsm/libs/draco/gltf/'

/** 【官方创建者Reall3d】Creater: Reall3d */
export const SpxCreaterReall3d = 0;
/** 【spx中定义的公开格式】spx open format */
export const SpxOpenFormat0 = 0;

/** 【spx中定义的公开数据块格式】Open Block Content Format 22, basic data */
export const SpxBlockFormatData22 = 22;
/** 【spx中定义的公开数据块格式】Open Block Content Format 22, basic data */
export const SpxBlockFormatData23 = 23;
/** 【spx中定义的公开数据块格式】Open Block Content Format 22, basic data, webp encoding */
export const SpxBlockFormatData220 = 220;
/** 【spx中定义的公开数据块格式】Open Block Content Format 22, basic data, webp encoding */
export const SpxBlockFormatData230 = 230;
/** 【spx中定义的公开数据块格式】Open Block Content Format 8, sh palettes */
export const SpxBlockFormatSH8 = 8;
/** 【spx中定义的公开数据块格式】Open Block Content Format 9, sh palettes, webp encoding */
export const SpxBlockFormatSH9 = 9;

/** 【spx中定义的公开数据块格式】Open Block Content Format 20, basic data */
export const SpxBlockFormatData20 = 20;
/** 【spx中定义的公开数据块格式】Open Block Content Format 19, basic data */
export const SpxBlockFormatData19 = 19;
/** 【spx中定义的公开数据块格式】Open Block Content Format 190, basic data */
export const SpxBlockFormatData190 = 190;
/** 【spx中定义的公开数据块格式】Open Block Content Format 10190, basic data [TEST] */
export const SpxBlockFormatData10190 = 10190;
/** 【spx中定义的公开数据块格式】Open Block Content Format 1, data of SH degree 1 （SH1 only） */
export const SpxBlockFormatSH1 = 1;
/** 【spx中定义的公开数据块格式】Open Block Content Format 2, data of SH degree 2 （SH1 + SH2） */
export const SpxBlockFormatSH2 = 2;
/** 【spx中定义的公开数据块格式】Open Block Content Format 3, data of SH degree 3 （SH3 only） */
export const SpxBlockFormatSH3 = 3;
/** 【spx中定义的公开数据块格式】Open Block Content Format 4, data of SH degree 1~3 （SH1 + SH2 + SH3） */
export const SpxBlockFormatSH4 = 4;

/** 【Reall3D扩展的专属格式】the exclusive format extended by reall3d */
export const SpxExclusiveFormatReall3d = 3141592653;

/**
 * 【质量级别】
 * 从1-9共9个级别，默认第5级，级别越高渲染质量越好，资源利用越高，越影响性能。
 * 根据选用的级别，渲染器会自适应调整各种相关影响因素以达成效果，也可尽量避免人工调整错误所带来的影响。
 * （自动调整的相关因素，包括球谐系数级别、渲染像素阈值、渲染透明度阈值、近似计算、排序桶数量限制等等）
 */
export enum QualityLevels {
    /** Level 1，渲染质量最低，性能最好，应用于低端设备时更适用 */
    L1 = 1,
    /** Level 2 渲染质量偏低 */
    L2 = 2,
    /** Level 3 渲染质量较低 */
    L3 = 3,
    /** Level 4，渲染质量略低 */
    L4 = 4,
    /** Level 5，默认级别，渲染质量及性能综合表现良好 */
    Default5 = 5,
    /** Level 4，渲染质量略高 */
    L6 = 6,
    /** Level 4，渲染质量较高 */
    L7 = 7,
    /** Level 4，渲染质量偏高 */
    L8 = 8,
    /** Level 4，渲染质量最高，性能最差，应用于高端设备时更适用 */
    L9 = 9,
}

/**
 * 【排序类型】
 * 并不存在一种即性能高效又普遍适用的排序方法，这里提供默认方式作为普适性使用，以及其他多种方式供个性化场景选择使用。
 *
 * 允许按不同场景选择参数，配合调优的近端分段参数depthNearRate或depthNearValue一并写入meta达到个性化优化效果。
 * 注意应避免动态切换排序类型，否则可能因为不相吻合而适得其反
 * 例:室内迷宫场景，即使场景尺寸远大于2000，但实际拐弯抹角每个角度可能都最多看10个深度尺寸，
 *    这时选择【2010】并设定depthNearValue=10就是合适的。
 *
 * 默认以外的排序类型都是为了具体个性化场景而准备的，应当具体实验后再确定选用。
 */
export enum SortTypes {
    /** 默认，按视图投影矩阵计算z-depth进行全量排序 */
    Default1 = 1,
    /** 径向排序，环顾四周情景较多的时候适用 */
    Radial2 = 2,
    /** 按相机方向计算z-depth进行排序，剔除背后和远端数据，仅渲染近端，有遮挡只能看到近端场景时适用（大场景自适应数据剔除，不适用此类型） */
    ZdepthFrontNearest2010 = 2010,
    /** 按相机方向计算z-depth进行排序，剔除背后数据（大场景自适应数据剔除，不适用此类型） */
    ZdepthFront2011 = 2011,
}
