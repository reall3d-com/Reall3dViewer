// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { CameraInfo } from '../scene/SetupCameraControls';
import { CircularAudioMaskOptions } from '../meshs/media/CircularAudioMask';
import { MinimapOptions } from '../scene/SetupMinimap';

/**
 * Metadata
 */
export interface MetaData {
    /** Name */
    name?: string;
    /** Version */
    version?: string;
    /** Update date (YYYYMMDD) */
    updateDate?: number;

    /** Enable auto-rotation */
    autoRotate?: boolean;
    /** Enable debug mode */
    debugMode?: boolean;
    /** Enable point-cloud rendering */
    pointcloudMode?: boolean;
    /** Maximum render count for mobile */
    maxRenderCountOfMobile?: number;
    /** Maximum render count for PC */
    maxRenderCountOfPc?: number;
    /** Maximum download count for mobile splats */
    mobileDownloadLimitSplatCount?: number;
    /** Maximum download count for PC splats */
    pcDownloadLimitSplatCount?: number;
    /** disable transition effect on load; defaults to false */
    disableTransitionEffectOnLoad?: boolean;

    /** Meter scale factor */
    meterScale?: number;
    /** Text watermark */
    watermark?: string;
    /** Display watermark (default false) */
    showWatermark?: boolean;
    /** Display marks (default true) */
    showMark?: boolean;
    /** Display bounding box */
    showBoundBox?: boolean;
    /** Camera parameters */
    cameraInfo?: CameraInfo;
    /** Annotations */
    marks?: any[];
    /** Fly-through camera positions */
    flyPositions?: number[];
    /** Fly-through camera look-at points */
    flyTargets?: number[];
    /** Fly duration */
    flyDuration?: number;
    /** Enable joystick, default to false */
    pcEnableJoystick?: boolean;
    /** Enable joystick, default to false */
    mobileEnableJoystick?: boolean;
    /** disable right click focus effect; defaults to false  */
    disableRightClickFocus?: boolean;

    /** Audio */
    audio?: any;
    /** bg Audio */
    bgAudio?: string;

    /** render quality level */
    qualityLevel?: number;
    /** sort type */
    sortType?: number;
    /** depth near rate */
    depthNearRate?: number;
    /** depth near value */
    depthNearValue?: number;
    /** 最小可渲染直径像素 */
    minPixelDiameter?: number;
    /** 最大直径像素 */
    maxPixelDiameter?: number;
    /** 最小可渲染透明度 */
    minAlpha?: number;

    /** Enable particle loading effect (small scenes) */
    particleMode?: boolean;

    /** Transformation matrix */
    transform?: number[];
    /** Geolocation (EPSG:4326 WGS 84) */
    WGS84?: number[];

    /** Model URL | lod-meta.json | *.lod.json */
    url?: string;

    /**
     * Target LOD levels to select from available data levels.
     * For example, if data contains levels 0~6, you may select only three levels [0,1,6] for actual use.
     * Defaults to all available levels in the data.
     */
    pcLodTargets?: number[];
    mobileLodTargets?: number[];

    /**
     * Distance thresholds to switch between LOD levels.
     * Different camera distances determine which LOD level to render.
     * For three LOD levels, define two split points [100,50],
     * meaning: beyond 100 units uses lowest detail, within 50 units uses highest detail.
     */
    pcLodDistances?: number[];
    mobileLodDistances?: number[];

    /**
     * View mode. 1:First-Person View, 3:Third-Person View.
     */
    viewMode?: number;

    /**
     * Player
     */
    player?: Player;
    /**
     * collision (glb)
     */
    collisionUrl?: string;

    /** default to true */
    addVirtualGround?: boolean;
    /** default to true */
    autuUpdateVirtualGroundPosition?: boolean;

    // 小地图
    minimap?: MinimapOptions;
    // 音频遮罩
    audioMask?: CircularAudioMaskOptions;

    /**
     * 是否使用GPU缓存，默认false（true:使用GPU缓存，false:使用内存缓存）
     * 较高端设备可尝试GPU缓存调优性能，应按实际调配
     */
    useGpuCache?: boolean;
    /**
     * PC端大场景时文件缓存数量，默认 DefaultLodCacheFileCount
     * 设定值太小可能达不到缓存效果反而产生影响；设定值太大可能引起浏览器内存限制，或者引起内存分配失败等运行期异常
     * 应结合目标设备能力以及切割的数据文件大小，综合判断设定
     */
    pcLodCacheFileCount?: number;
    /**
     * 移动端大场景时文件缓存数量，默认 DefaultLodCacheFileCount
     * 设定值太小可能达不到缓存效果反而产生影响；设定值太大可能引起浏览器内存限制，或者引起内存分配失败等运行期异常
     * 应结合目标设备能力以及切割的数据文件大小，综合判断设定
     */
    mobileLodCacheFileCount?: number;

    /** Color brightness factor. Defaults to DefaultLightFactor */
    lightFactor?: number | undefined;

    /** Background color (defaults to '#000000') */
    background?: string;
}

/**
 * Player
 */
export interface Player {
    /** Character model URL */
    url?: string;
    /** Character movement speed */
    speed?: number;
    /** Character height */
    height?: number;
    /** Character scale factor */
    scale?: number;
    /** Rotation (degrees) */
    rotation?: number[];
    /** Initial position of the character */
    position?: number[];
    /** Animation name for idle state */
    idle?: string;
    /** Animation name for walk state */
    walk?: string;
    /** Animation name for run state */
    run?: string;

    colliderTranslation?: number[];
    trigerRunMp3?: string;
}
