// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
// 圆形音频遮罩
export class CircularAudioMask {
    private options: Required<CircularAudioMaskOptions>;
    private container: HTMLElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private audioElement: HTMLAudioElement | null = null;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private sourceNode: AudioNode | null = null;
    private dataArray: Uint8Array | null = null;
    private readonly uniqueId = `mask-${Date.now()}`;
    private animationId: number = 0;
    private isPlaying: boolean = false;
    private rotation = 0;
    private angleCache: { cos: number; sin: number }[] = [];
    private weightTable: number[][] = [];
    private bandEnergies: number[] = [];
    private frame = 0;
    private disposed: boolean = false;

    private defaultBands: FrequencyBand[] = [
        { name: 's1', range: [20, 50], weight: 3.0 },
        { name: 's3', range: [100, 180], weight: 4.8 },
        { name: 's4', range: [180, 300], weight: 2.5 },
        { name: 's5', range: [300, 450], weight: 2.6 },
        { name: 's6', range: [450, 700], weight: 2.0 },
        { name: 's11', range: [4000, 7000], weight: 8.4 },
        { name: 's7', range: [700, 1000], weight: 18.8 },
        { name: 's8', range: [1000, 1600], weight: 2.6 },
        { name: 's9', range: [1600, 2500], weight: 6.4 },
        { name: 's2', range: [50, 100], weight: 5.2 },
        { name: 's10', range: [2500, 4000], weight: 8.2 },
    ];

    constructor(options: CircularAudioMaskOptions = {}) {
        this.options = {
            container: options.container || document.body,
            audioUrl: options.audioUrl || undefined,
            volume: options.volume || 0.5,
            width: options.width || '100%',
            height: options.height || '100%',
            fullScreen: options.fullScreen ?? true,
            baseRadius: options.baseRadius, // || 360,
            maxExpansion: options.maxExpansion, // || 60,
            segments: options.segments || 360,
            maskColor: options.maskColor || '#000000',
            maskOpacity: options.maskOpacity ?? 0.5,
            glowColor: options.glowColor || '#00ffff',
            glowBlur: options.glowBlur || 15,
            glowWidth: options.glowWidth || 3,
            showGlow: options.showGlow ?? true,
            fftSize: options.fftSize || 2048,
            smoothingTimeConstant: options.smoothingTimeConstant ?? 0.8,
            minDecibels: options.minDecibels ?? -70,
            maxDecibels: options.maxDecibels ?? -20,
            frequencyBands: options.frequencyBands || this.defaultBands,
            onReady: options.onReady || (() => {}),
            onError: options.onError || console.error,
            onBeat: options.onBeat || (() => {}),
            zIndex: options.zIndex || 9999,
            rotateSpeed: options.rotateSpeed || 0.0015,
        };

        this.rotation = 0;
        this.initDOM();
        !this.options.baseRadius && this.applyAdaptiveRadius();
        this.buildAngleCache();
        this.buildWeightTable();

        if (this.options.audioUrl) {
            this.play(this.options.audioUrl).catch(this.options.onError);
        }
    }

    /**
     * 自适应半径：仅当用户未提供对应参数时，根据容器实际尺寸计算并覆盖
     */
    private applyAdaptiveRadius(): void {
        if (!this.container) return;

        const computeAdaptiveRadius = (
            containerWidth: number,
            containerHeight: number,
        ): {
            baseRadius: number;
            maxExpansion: number;
        } => {
            const innerRadius = Math.min(containerWidth, containerHeight) / 2; // 内切圆半径（取宽高较小值的一半）
            const maxExpansion = Math.max(10, innerRadius * 0.15); // 最大扩张幅度：内切圆半径的 15%（可调整比例）
            let baseRadius = innerRadius - maxExpansion - 10; // 基础半径 = 内切圆半径 - 最大扩张幅度 - 额外留白（10px）
            baseRadius = Math.max(20, baseRadius); // 确保基础半径至少为 20px
            return { baseRadius, maxExpansion };
        };

        const rect = this.container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const { baseRadius, maxExpansion } = computeAdaptiveRadius(rect.width, rect.height);
        this.options.baseRadius = baseRadius;
        this.options.maxExpansion = maxExpansion;
    }

    // 预计算每个 segment 的角度 cos/sin，消除每帧三角函数开销
    private buildAngleCache(): void {
        const { segments } = this.options;
        const cache: { cos: number; sin: number }[] = [];
        const step = (Math.PI * 2) / segments;
        for (let i = 0; i < segments; i++) {
            const angle = i * step;
            cache.push({
                cos: Math.cos(angle),
                sin: Math.sin(angle),
            });
        }
        this.angleCache = cache;
    }

    // 预计算高斯权重表
    private buildWeightTable(): void {
        const { segments, frequencyBands } = this.options;
        const table: number[][] = [];
        const twoPi = Math.PI * 2;
        const bandCount = frequencyBands.length;

        for (let i = 0; i < segments; i++) {
            const segAngle = (i / segments) * twoPi;
            const row: number[] = [];
            for (let j = 0; j < bandCount; j++) {
                const bandAngle = (j / bandCount) * twoPi + Math.PI / 2;
                let diff = Math.abs(segAngle - bandAngle);
                if (diff > Math.PI) diff = twoPi - diff;
                row.push(Math.exp(-(diff * diff) / 0.03));
            }
            table.push(row);
        }
        this.weightTable = table;
    }

    // 每帧计算频带能量
    private computeBandEnergies(): number[] {
        if (!this.analyser || !this.dataArray) {
            return new Array(this.options.frequencyBands.length).fill(0);
        }

        const bands = this.options.frequencyBands;
        const len = bands.length;
        const energies = (this.bandEnergies = this.bandEnergies || new Array(len));
        let i = 0;

        for (; i < len; i++) {
            const b = bands[i];
            energies[i] = this.getFrequencyEnergy(b.range[0], b.range[1]) * b.weight;
        }

        return energies;
    }

    private initDOM(): void {
        const exist = document.getElementById(this.uniqueId);
        if (exist) {
            this.container = exist as HTMLElement;
            this.canvas = this.container.querySelector('canvas') ?? null;
            this.ctx = this.canvas?.getContext('2d') ?? null;
            return;
        }

        let target: HTMLElement;
        if (typeof this.options.container === 'string') {
            const el = document.querySelector(this.options.container);
            if (!el) throw new Error(`Container not found: ${this.options.container}`);
            target = el as HTMLElement;
        } else {
            target = this.options.container;
        }

        this.container = document.createElement('div');
        this.container.id = this.uniqueId;
        this.container.style.cssText = `
            position:${this.options.fullScreen ? 'fixed' : 'relative'};
            top:0;left:0;width:100%;height:100%;z-index:${this.options.zIndex};
            pointer-events:none;overflow:hidden;
            `;

        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none';
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) throw new Error('Canvas 2D not supported');

        this.container.appendChild(this.canvas);
        target.appendChild(this.container);

        this.resize();
        window.addEventListener('resize', this.handleResize);
        this.drawStatic();
    }

    private createAudioElement(): HTMLAudioElement {
        if (this.audioElement) return this.audioElement;
        const audio = document.createElement('audio');
        audio.crossOrigin = 'anonymous';
        audio.style.display = 'none';
        audio.volume = Math.max(0, Math.min(1, this.options.volume)); // ✅ 初始化时应用音量
        this.audioElement = audio;
        this.container?.appendChild(audio);
        return audio;
    }

    private async initAudioContext(): Promise<void> {
        if (this.audioContext) return;
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AC();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = this.options.fftSize;
        this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant;
        this.analyser.minDecibels = this.options.minDecibels;
        this.analyser.maxDecibels = this.options.maxDecibels;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    private async connectSource(source: AudioSource): Promise<void> {
        await this.initAudioContext();
        if (!this.audioContext || !this.analyser) return;
        if (this.sourceNode) this.sourceNode.disconnect();

        switch (source.type) {
            case 'url':
            case 'file':
            case 'blob':
                const audio = this.createAudioElement();
                audio.src = source.data as string;
                this.sourceNode = this.audioContext.createMediaElementSource(audio);
                this.sourceNode.connect(this.analyser);
                this.analyser.connect(this.audioContext.destination);
                break;
            case 'stream':
                this.sourceNode = this.audioContext.createMediaStreamSource(source.data as MediaStream);
                this.sourceNode.connect(this.analyser);
                break;
            case 'element':
                this.sourceNode = this.audioContext.createMediaElementSource(source.data as HTMLAudioElement);
                this.sourceNode.connect(this.analyser);
                this.analyser.connect(this.audioContext.destination);
                break;
        }

        this.options.onReady();
    }

    async play(src?: any): Promise<void> {
        try {
            if (!src) throw new Error('No source');
            let s: AudioSource;

            if (typeof src === 'string') s = { type: 'url', data: src };
            else if (src instanceof File) s = { type: 'file', data: src };
            else if (src instanceof Blob) s = { type: 'blob', data: src };
            else if (src instanceof MediaStream) s = { type: 'stream', data: src };
            else if (src instanceof HTMLAudioElement) s = { type: 'element', data: src };
            else throw new Error('Invalid source');

            if (this.audioContext?.state === 'suspended') await this.audioContext.resume();

            await this.connectSource(s);
            await this.audioElement?.play();
            this.startAnimation();
        } catch (e) {
            this.options.onError(e as Error);
        }
    }

    pause() {
        this.audioElement?.pause();
        this.stopAnimation();
    }

    stop() {
        this.stopAnimation();
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }
        this.drawStatic();
    }

    private startAnimation() {
        if (this.disposed || this.isPlaying) return;
        this.isPlaying = true;
        this.animate();
    }

    private stopAnimation() {
        this.isPlaying = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = 0;
        }
    }

    private animate = () => {
        if (this.disposed || !this.isPlaying || !this.ctx) return;

        this.frame++ % 2 === 0 && this.analyser?.getByteFrequencyData(this.dataArray as any);
        this.rotation += this.options.rotateSpeed;
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.drawMask();

        this.animationId = requestAnimationFrame(this.animate);
    };

    private getFrequencyEnergy(startHz: number, endHz: number): number {
        if (!this.analyser || !this.dataArray || !this.audioContext) return 0;

        const sampleRate = this.audioContext.sampleRate;
        const nyquist = sampleRate / 2;
        const binCount = this.analyser.frequencyBinCount;

        const i1 = ((startHz / nyquist) * binCount) | 0;
        const i2 = ((endHz / nyquist) * binCount) | 0;
        const arr = this.dataArray;
        const maxI = arr.length - 1;

        let sum = 0;
        let count = 0;

        for (let i = i1; i <= i2 && i <= maxI; i++) {
            sum += arr[i];
            count++;
        }

        return count ? sum / count / 255 : 0;
    }

    private drawStatic() {
        if (!this.ctx) return;
        const { width, height } = this;
        this.ctx.clearRect(0, 0, width, height);

        const cx = width / 2;
        const cy = height / 2;
        const br = this.options.baseRadius;

        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const t = c.getContext('2d')!;

        t.fillStyle = this.options.maskColor;
        t.globalAlpha = this.options.maskOpacity;
        t.fillRect(0, 0, width, height);

        t.globalCompositeOperation = 'destination-out';
        t.globalAlpha = 1;
        t.beginPath();
        t.arc(cx, cy, br, 0, Math.PI * 2);
        t.fill();

        this.ctx.drawImage(c, 0, 0);
    }

    private rList: number[];

    private drawMask() {
        if (this.disposed || !this.ctx) return;

        const { baseRadius, maxExpansion, maskColor, maskOpacity, glowColor, glowBlur, glowWidth, showGlow } = this.options;
        const { width, height } = this;
        const cx = width / 2;
        const cy = height / 2;
        const segments = this.options.segments;

        const bandEnergies = this.computeBandEnergies();
        const rList = (this.rList = this.rList || new Array(segments));
        const weightTable = this.weightTable;

        // 一次性计算所有半径
        for (let i = 0; i < segments; i++) {
            let e = 0;
            const w = weightTable[i];
            for (let j = 0; j < bandEnergies.length; j++) {
                e += bandEnergies[j] * w[j];
            }
            rList[i] = baseRadius + e * maxExpansion;
        }

        const ctx = this.ctx;
        const rot = this.rotation;
        const angleCache = this.angleCache;

        // 保存状态一次
        const prevComp = ctx.globalCompositeOperation;
        const prevAlpha = ctx.globalAlpha;

        // 绘制遮罩
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = maskOpacity;
        ctx.fillStyle = maskColor;
        ctx.fillRect(0, 0, width, height);

        // 挖孔
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
        ctx.beginPath();

        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        for (let i = 0; i < segments; i++) {
            const ac = angleCache[i].cos;
            const as = angleCache[i].sin;
            const c = ac * cosR - as * sinR;
            const s = ac * sinR + as * cosR;
            const r = rList[i];
            const x = cx + c * r;
            const y = cy + s * r;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.fill();

        // 发光：只在需要时开启，减少状态切换
        if (showGlow) {
            ctx.globalCompositeOperation = 'screen';
            ctx.shadowBlur = glowBlur;
            ctx.shadowColor = glowColor;
            ctx.strokeStyle = glowColor;
            ctx.lineWidth = glowWidth;

            ctx.beginPath();
            for (let i = 0; i < segments; i++) {
                const ac = angleCache[i].cos;
                const as = angleCache[i].sin;
                const c = ac * Math.cos(rot) - as * Math.sin(rot);
                const s = ac * Math.sin(rot) + as * Math.cos(rot);
                const r = rList[i];
                const x = cx + c * r;
                const y = cy + s * r;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();

            ctx.shadowBlur = 0;
        }

        // 恢复状态
        ctx.globalCompositeOperation = prevComp;
        ctx.globalAlpha = prevAlpha;
    }

    private handleResize = () => this.resize();

    private resize() {
        if (!this.canvas || !this.container) return;
        const rect = this.container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx?.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx?.scale(dpr, dpr);

        (this.canvas as any).w = rect.width;
        (this.canvas as any).h = rect.height;
    }

    private get width() {
        return (this.canvas as any)?.w || 0;
    }

    private get height() {
        return (this.canvas as any)?.h || 0;
    }

    updateOptions(opt: Partial<CircularAudioMaskOptions>) {
        const oldSeg = this.options.segments;
        const oldBands = this.options.frequencyBands;
        Object.assign(this.options, opt);

        if (oldSeg !== this.options.segments) {
            this.buildAngleCache();
        }
        if (oldSeg !== this.options.segments || oldBands !== this.options.frequencyBands) {
            this.buildWeightTable();
        }
    }

    setVolume(v: number) {
        if (this.audioElement) {
            this.audioElement.volume = Math.max(0, Math.min(1, v));
        }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;

        this.stopAnimation();
        window.removeEventListener('resize', this.handleResize);

        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            this.audioElement.src = '';
            this.audioElement.load();
            this.audioElement.remove();
            this.audioElement = null;
        }

        try {
            this.sourceNode?.disconnect();
        } catch {}
        try {
            this.analyser?.disconnect();
        } catch {}
        this.audioContext?.close().catch(() => {});

        if (this.container?.parentNode) this.container.parentNode.removeChild(this.container);
        else document.getElementById(this.uniqueId)?.remove();

        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.dataArray = null;
        this.isPlaying = false;
    }
}

export type { CircularAudioMaskOptions, FrequencyBand };
export default CircularAudioMask;

/**
 * 音频频率波段配置
 * 用于定义不同频率范围的音频响应参数
 */
interface FrequencyBand {
    /** 波段唯一标识名称 */
    name: string;
    /** 频率范围 [起始频率(Hz), 结束频率(Hz)] */
    range: [number, number];
    /** 波段权重值，数值越大对可视化效果影响越强 */
    weight: number;
    /** 波段对应渲染颜色（可选） */
    color?: string;
}

/**
 * 圆形音频可视化遮罩配置项
 * 控制音频可视化的外观、行为、音频分析参数
 */
interface CircularAudioMaskOptions {
    /** 音频源URL */
    audioUrl?: string;
    /** 音量 */
    volume?: number;
    /** 渲染容器：支持DOM元素或CSS选择器 */
    container?: HTMLElement | string;
    /** 画布宽度，支持数值或CSS尺寸 */
    width?: number | string;
    /** 画布高度，支持数值或CSS尺寸 */
    height?: number | string;
    /** 是否启用全屏覆盖模式 */
    fullScreen?: boolean;
    /** 圆形遮罩基础半径（静止状态半径） */
    baseRadius?: number;
    /** 音频响应最大扩张幅度 */
    maxExpansion?: number;
    /** 圆形分段数量，值越高曲线越平滑，性能消耗越高 */
    segments?: number;
    /** 遮罩层填充颜色 */
    maskColor?: string;
    /** 遮罩层不透明度 0~1 */
    maskOpacity?: number;
    /** 边缘发光颜色 */
    glowColor?: string;
    /** 发光效果模糊半径 */
    glowBlur?: number;
    /** 发光边缘宽度 */
    glowWidth?: number;
    /** 是否显示发光轮廓效果 */
    showGlow?: boolean;
    /** FFT大小，必须是2的幂，决定音频分析精度 */
    fftSize?: number;
    /** 音频平滑时间常数，值越大动画越平滑延迟越高 */
    smoothingTimeConstant?: number;
    /** 最小分贝值，低于此值将被视为静音 */
    minDecibels?: number;
    /** 最大分贝值，用于归一化音频数据 */
    maxDecibels?: number;
    /** 自定义频率波段配置数组 */
    frequencyBands?: FrequencyBand[];
    /** 实例初始化完成回调 */
    onReady?: () => void;
    /** 错误捕获回调 */
    onError?: (error: Error) => void;
    /** 节拍检测回调，返回节拍强度 0~1 */
    onBeat?: (intensity: number) => void;
    /** 画布CSS层级z-index */
    zIndex?: number;
    /** 圆形旋转速度 */
    rotateSpeed?: number;
}

interface AudioSource {
    type: 'url' | 'file' | 'blob' | 'stream' | 'element';
    data: string | File | Blob | MediaStream | HTMLAudioElement;
}
