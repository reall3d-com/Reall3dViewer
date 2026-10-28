// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { isMobile } from './GlobalConstants';

export const DefaultLodCacheFileCount = isMobile ? 30 : 50; // 默认值：大场景缓存的文件数量
export const DefaultLodMaxRenderCount = isMobile ? 220_0000 : 320_0000; // 默认值：大场景最大渲染数量
export const DefaultMaxTextWatermarkCount = 10240; // 默认值：文字水印最大高斯点数量

export const DefaultLightFactor = 1.0; // 默认值：高斯颜色的亮度系数
