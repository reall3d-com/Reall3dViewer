// ================================
// Copyright (c) 2025 reall3d.com
// ================================
import { BinHeader } from './formats/BinFormat';
import { ModelOptions } from './ModelOptions';

/**
 * 模型状态
 */
export enum ModelStatus {
    /** 就绪 */
    FetchReady = 0,
    /** 请求中 */
    Fetching,
    /** 正常完成 */
    FetchDone,
    /** 请求前被取消 */
    CancelFetch,
    /** 请求途中被中断 */
    FetchAborted,
    /** 请求失败 */
    FetchFailed,
    /** 无效的模型格式或数据 */
    Invalid,
}

/**
 * Splat模型
 */
export class SplatModel {
    /** 模型选项 */
    public readonly opts: ModelOptions;

    /** 模型文件大小 */
    public fileSize: number = 0;
    /** 模型已下载大小 */
    public downloadSize: number = 0;

    /** 模型状态 */
    public status: ModelStatus = ModelStatus.FetchReady;

    /** 模型数据 */
    public splatData: Uint8Array = null;
    /** 一个高斯点数据长度 */
    public rowLength: number = 0;
    /** 模型的高斯数量 */
    public modelSplatCount: number = 0;
    /** 已下载的高斯数量 */
    public downloadSplatCount: number = 0;
    /** 已下载的高斯数量(大场景临时计算用) */
    public downloadSplatCountTmp: number = 0;
    /** 待渲染的高斯数量（大场景时动态计算需要渲染的数量） */
    public renderSplatCount: number = 0;

    /** 隐藏（隐藏一定时间用作缓存用途） */
    public hide: boolean = false;
    /** 隐藏时间点（超一定时间后删除） */
    public hideTime: number;

    /** 中断控制器 */
    public abortController: AbortController;

    /** 开始下载时间 */
    public downloadStartTime: number = 0;
    /** 小场景模式下，光圈过渡效果处理标志 */
    public switchDisplayModeDone: boolean = false;

    /** bin格式模型的头信息 */
    public binHeader: BinHeader = null;

    /** 大场景下当前时点是否可见（根据相机计算动态变化更新） */
    public checkVisible: boolean = true;
    /** 大场景下当前时点离相机距离（根据相机计算动态变化更新） */
    public checkDistance: number = 0;
    /** 大场景时的合并占比（临时计算用） */
    public allocatedPercent: number = 0;
    /** 大场景时的合并数量（临时计算用） */
    public allocatedPoints: number = 0;

    public meta: any;
    public map: Map<string, SplatModel>;
    public set: Set<SplatModel>;

    constructor(opts: ModelOptions, meta: any = {}) {
        this.opts = { ...opts };

        this.meta = meta;
        meta.autoCut && (this.set = new Set());

        if (!opts.format) {
            if (opts.url?.endsWith('.bin')) {
                this.opts.format = 'bin';
            } else if (opts.url?.endsWith('.splat')) {
                this.opts.format = 'splat';
            } else if (opts.url?.endsWith('.sp20')) {
                this.opts.format = 'sp20';
            } else if (opts.url?.endsWith('.json')) {
                this.opts.format = 'json';
            } else {
                console.error('unknow format!');
            }
        }
        this.abortController = new AbortController();
    }

    /**
     * 解析bin文件头
     * @param data 文件头数据
     * @returns Bin文件头信息
     */
    public parseBinHeaderData(rs: any): BinHeader {
        const header = new BinHeader(rs);

        this.binHeader = header;
        return this.binHeader;
    }
}
