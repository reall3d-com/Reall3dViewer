// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
export interface MarkData {
    /** 类型 */
    type?: 'MarkDistanceLine' | 'MarkSinglePoint' | 'MarkMultiLines' | 'MarkMultiPlans' | 'MarkCirclePlan' | 'MarkSingleTag' | 'Mark3DSingleTag' | undefined;
    /** 名称（样式类名等标识用） */
    name?: string;
    /** 缩放 */
    scale?: number;
    /** 是否可相交检测（默认false） */
    intersectable?: boolean;
}
