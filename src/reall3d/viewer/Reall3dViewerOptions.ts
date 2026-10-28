// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { PerspectiveCamera, Renderer, Scene } from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { Events } from '../events/Events';
import { TransitionEffects } from '../meshs/splatmesh/SplatMeshOptions';

/**
 * Configuration options for Reall3dViewer
 */
export interface Reall3dViewerOptions {
    /**
     * Specify a custom renderer instance. If undefined, one will be created automatically.
     */
    renderer?: Renderer | undefined;

    /**
     * Specify a custom scene instance. If undefined, one will be created automatically.
     */
    scene?: Scene | undefined;

    /**
     * Specify a custom camera instance. If undefined, one will be created automatically.
     */
    camera?: PerspectiveCamera | undefined;

    /**
     * Orbit controls instance
     */
    controls?: OrbitControls;

    /**
     * Renderer event manager
     */
    viewerEvents?: Events | undefined;

    /**
     * Debug mode flag. Defaults to false in production.
     */
    debugMode?: boolean | undefined;

    /**
     * Large scene mode flag. Cannot be modified after initialization.
     */
    bigSceneMode?: boolean;

    /**
     * Point cloud rendering mode. Defaults to true.
     * Can be dynamically updated via viewer.options()
     */
    pointcloudMode?: boolean | undefined;

    /**
     * Color brightness factor. Defaults to 1.1.
     */
    lightFactor?: number | undefined;

    /**
     * Container element or its selector. Defaults to '#gsviewer'.
     * If no container is found when creating canvas, one will be automatically created under body.
     */
    root?: HTMLElement | string | undefined;

    /**
     * Camera field of view. Defaults to 45.
     */
    fov?: number | undefined;

    /**
     * Camera near clipping plane. Defaults to 0.1.
     */
    near?: number | undefined;

    /**
     * Camera far clipping plane. Defaults to 1000.
     */
    far?: number | undefined;

    /**
     * Camera position. Defaults to [0, -5, 15].
     */
    position?: number[] | undefined;

    /**
     * Camera look-at target. Defaults to [0, 0, 0].
     */
    lookAt?: number[] | undefined;

    /**
     * Camera up vector. Defaults to [0, -1, 0].
     */
    lookUp?: number[] | undefined;

    /**
     * Auto-rotation flag. Defaults to true.
     * Can be dynamically updated via viewer.options()
     */
    autoRotate?: boolean | undefined;

    /**
     * Damping effect flag. Defaults to true.
     */
    enableDamping?: boolean | undefined;

    /**
     * Zoom control flag. Defaults to true.
     */
    enableZoom?: boolean | undefined;

    /**
     * Rotation control flag. Defaults to true.
     */
    enableRotate?: boolean | undefined;

    /**
     * Pan control flag. Defaults to true.
     */
    enablePan?: boolean | undefined;

    /**
     * Minimum camera distance
     */
    minDistance?: number | undefined;

    /**
     * Maximum camera distance
     */
    maxDistance?: number | undefined;

    /**
     * Minimum polar angle (vertical rotation limit)
     */
    minPolarAngle?: number | undefined;

    /**
     * Maximum polar angle (vertical rotation limit)
     */
    maxPolarAngle?: number | undefined;

    /**
     * Keyboard controls flag. Defaults to true.
     */
    enableKeyboard?: boolean | undefined;

    /**
     * Annotation mode flag. Defaults to false.
     */
    markMode?: boolean | undefined;

    /**
     * Annotation type
     */
    markType?: 'point' | 'lines' | 'plans' | 'distance' | 'area' | 'circle' | 'tag3d' | undefined;

    /**
     * Annotation visibility flag. Defaults to true.
     */
    markVisible?: boolean | undefined;

    /**
     * Meter scale (how many meters per unit length). Defaults to 1.
     */
    meterScale?: number | undefined;

    /**
     * Disable local file drag-and-drop flag. Defaults to false.
     */
    disableDropLocalFile?: boolean | undefined;

    /**
     * Spherical harmonics rendering level. Defaults to the maximum renderable level of model data.
     */
    shDegree?: number | undefined;

    /**
     * Background color (defaults to '#000000')
     */
    background?: string;

    /**
     * Render quality level (1~9, default to QualityLevels.Default5)
     */
    qualityLevel?: number;

    /**
     * Sort type (default to SortTypes.Default1)
     */
    sortType?: number;

    /**
     * disable transition effect on load; defaults to false
     */
    disableTransitionEffectOnLoad?: boolean;

    /**
     * disable right click focus effect; defaults to false
     */
    disableRightClickFocus?: boolean;

    /**
     * transition effect type; defaults to ModelCenterCirccle
     */
    transitionEffect?: TransitionEffects;

    /**
     * Auto play background audio (defaults to false)
     */
    autoPlayBgAudio?: boolean;

    /**
     * View mode. 1:First-Person View, 3:Third-Person View.
     */
    viewMode?: number;
}
