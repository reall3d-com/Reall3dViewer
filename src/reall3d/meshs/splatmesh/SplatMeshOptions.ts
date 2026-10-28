// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { PerspectiveCamera, Renderer, Scene } from 'three';
import { Events } from '../../events/Events';
import { OrbitControls } from 'three/examples/jsm/Addons.js';

/**
 * Splat mesh configuration options
 */
export interface SplatMeshOptions {
    /**
     * Name
     */
    name?: string;

    /**
     * Renderer instance to be used
     */
    renderer: Renderer;

    /**
     * Scene instance to be used
     */
    scene: Scene;

    /**
     * Camera controls
     */
    controls?: OrbitControls;

    /**
     * In VR mode, when no controls is used, pass the camera instead.
     */
    camera?: PerspectiveCamera;

    /**
     * Renderer event manager
     */
    viewerEvents?: Events;

    /**
     * Debug mode flag; defaults to false in production
     */
    debugMode?: boolean;

    /**
     * Large-scene mode flag; cannot be changed after initialization
     */
    bigSceneMode?: boolean;

    /**
     * Point-cloud rendering mode; defaults to true,
     * Can be updated dynamically via viewer.options()
     */
    pointcloudMode?: boolean;

    // /**
    //  * Maximum number of Gaussians to render on mobile devices,
    //  * Can be updated dynamically via viewer.options()
    //  */
    // maxRenderCountOfMobile?: number;

    // /**
    //  * Maximum number of Gaussians to render on PC,
    //  * Can be updated dynamically via viewer.options()
    //  */
    // maxRenderCountOfPc?: number;

    /**
     * Whether to display a watermark; defaults to false
     */
    showWatermark?: boolean;

    /**
     * Spherical harmonics rendering degree; defaults to 0
     */
    shDegree?: number;

    /**
     * Enable depth testing; defaults to true
     */
    depthTest?: boolean;

    /**
     * Render quality level (1~9, default to QualityLevels.Default5)
     */
    qualityLevel?: number;

    /**
     * Sort type (default to SortTypes.Default1)
     */
    sortType?: number;

    /**
     * map mode, defaults to false
     */
    mapMode?: boolean;

    /**
     * disable transition effect on load; defaults to false
     */
    disableTransitionEffectOnLoad?: boolean;

    /**
     * transition effect type; defaults to ModelCenterCirccle
     */
    transitionEffect?: TransitionEffects;

    // /**
    //  * 最小可渲染直径像素
    //  */
    // minPixelDiameter?: number;

    // /**
    //  * 最大直径像素
    //  */
    // maxPixelDiameter?: number;

    // /**
    //  * 最小可渲染透明度
    //  */
    // minAlpha?: number;

    /**
     * View mode. 1:First-Person View, 3:Third-Person View.
     */
    viewMode?: number;
}

/** 过渡效果 */
export enum TransitionEffects {
    ModelCenterCirccle = 1,
    ScreenCenterCircle = 2,
    ScreenMiddleToLeftRight = 3,
    ScreenMiddleToTopBottom = 4,
}
