// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import {
    BufferAttribute,
    BufferGeometry,
    Color,
    DoubleSide,
    MathUtils,
    Mesh,
    MeshBasicMaterial,
    OrthographicCamera,
    PlaneGeometry,
    RingGeometry,
    Scene,
    Shape,
    ShapeGeometry,
    SRGBColorSpace,
    TextureLoader,
    Vector3,
    WebGLRenderer,
} from 'three';
import { Events } from '../events/Events';
import { GetCanvasSize, GetRenderer, OnViewerDispose, TraverseDisposeAndClear, RenderMinimap, GetCamera, IsDefaultPipeline } from '../events/EventConstants';

export function setupMinimap(events: Events) {
    let disposed = false;
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    let miniMapScene: Scene = null;
    let miniMapCamera: OrthographicCamera = null;
    let miniMapIndicator: Mesh = null;
    let frustumMesh: Mesh = null;
    let miniMapViewport: { x: number; y: number; size: number; canvasWidth: number; canvasHeight: number } = null;
    let minimapOpts: MinimapOptions = null;
    const _camDir = new Vector3();

    on(RenderMinimap, (options?: MinimapOptions) => {
        if (disposed || fire(IsDefaultPipeline)) return;
        !miniMapScene && initMiniMap(options);
        if (!miniMapCamera) return;

        const renderer: WebGLRenderer = fire(GetRenderer);

        const oldAutoClear = renderer.autoClear;
        const oldScissorTest = renderer.getScissorTest();

        renderer.autoClear = false;
        renderer.setViewport(miniMapViewport.x, miniMapViewport.y, miniMapViewport.size, miniMapViewport.size);
        renderer.setScissor(miniMapViewport.x, miniMapViewport.y, miniMapViewport.size, miniMapViewport.size);
        renderer.setScissorTest(true);

        renderer.render(miniMapScene, miniMapCamera);

        renderer.setScissorTest(oldScissorTest);
        renderer.setScissor(0, 0, miniMapViewport.canvasWidth, miniMapViewport.canvasHeight);
        renderer.setViewport(0, 0, miniMapViewport.canvasWidth, miniMapViewport.canvasHeight);
        renderer.autoClear = oldAutoClear;
    });

    function initOptions(options: MinimapOptions) {
        const ringOuterRadius = options.ringOuterRadius ?? 10;
        const opt1 = { ringInnerRadius: 5, ringOuterRadius: 10, ringColor: '#eeeeee', ringOpacity: 1, frustumMinHFov: 40, frustumMaxFov: 100 };
        const opt2 = { arrowLength: 12, arrowWidth: 14, arrowOffset: ringOuterRadius, arrowColor: '#eeeeee', arrowOpacity: 1 };
        const opt3 = { frustumOffset: 0, frustumNear: 10, frustumFar: 30, frustumColor: '#eeeeee', frustumNearOpacity: 0.9, frustumFarOpacity: 0.1 };
        const opt4 = { size: 300, corner: 'bottom-right', marginY: -45, bgOpacity: 0.5, minX: -20, maxX: 20, minY: -20, maxY: 20 };
        minimapOpts = Object.assign(opt1, opt2, opt3, opt4, options);
    }

    function initMiniMap(options: MinimapOptions) {
        initOptions(options);
        const { size, url, bgOpacity } = minimapOpts;
        miniMapScene = new Scene();

        new TextureLoader().load(
            url,
            loadedTexture => {
                if (disposed) return;
                loadedTexture.colorSpace = SRGBColorSpace;

                const imgW = loadedTexture.image.width;
                const imgH = loadedTexture.image.height;
                const imageAspect = imgW / imgH;

                // 自适应：保持比例，最大化填满视口
                let planeWidth, planeHeight;
                if (imageAspect > 1) {
                    // 图片更宽，以宽度为准（左右顶满，上下留白或裁剪）
                    planeWidth = size;
                    planeHeight = size / imageAspect;
                } else {
                    // 图片更高，以高度为准（上下顶满，左右留白或裁剪）
                    planeHeight = size;
                    planeWidth = size * imageAspect;
                }

                const bgGeo = new PlaneGeometry(planeWidth, planeHeight);
                const bgMat = new MeshBasicMaterial({
                    map: loadedTexture,
                    side: DoubleSide,
                    transparent: true,
                    opacity: bgOpacity,
                });

                const miniMapBackground = new Mesh(bgGeo, bgMat);
                miniMapBackground.position.set(size / 2, size / 2, 0);

                // 底图
                // miniMapScene.background = new Color(0xff0000);
                miniMapScene.add(miniMapBackground);

                // 位置提示器
                miniMapIndicator = createFrustumIndicatorMesh();
                const scale = miniMapViewport.size / 300;
                miniMapIndicator.scale.set(scale, scale, scale);
                miniMapIndicator.frustumCulled = false;
                miniMapIndicator.onBeforeRender = updateMiniMapIndicator;
                miniMapScene.add(miniMapIndicator);

                // 相机
                miniMapCamera = new OrthographicCamera(0, size, size, 0, -10, 10);
            },
            undefined,
            err => {
                console.warn('MiniMap texture load failed:', err);
            },
        );

        // 计算小地图视口
        caclMiniMapViewport();
    }

    function caclMiniMapViewport() {
        const { width, height } = fire(GetCanvasSize, true);
        const { size, marginX, marginY, corner } = Object.assign({ marginX: 20, marginY: 20 }, minimapOpts);

        // 计算小地图视口
        if (corner == 'top-left') {
            miniMapViewport = { x: marginX, y: height - size - marginY, size, canvasWidth: width, canvasHeight: height };
        } else if (corner == 'top-right') {
            miniMapViewport = { x: width - size - marginX, y: height - size - marginY, size, canvasWidth: width, canvasHeight: height };
        } else if (corner == 'bottom-left') {
            miniMapViewport = { x: marginX, y: marginY, size, canvasWidth: width, canvasHeight: height };
        } else {
            miniMapViewport = { x: width - size - marginX, y: marginY, size, canvasWidth: width, canvasHeight: height };
        }
    }

    function worldToMiniMap(x: number, z: number) {
        const u = (z - minimapOpts.minZ) / (minimapOpts.maxZ - minimapOpts.minZ); // 0-1，对应 X（横向）
        const v = (x - minimapOpts.minX) / (minimapOpts.maxX - minimapOpts.minX); // 0-1，对应 Y（纵向）
        return { x: u * minimapOpts.size, y: (1 - v) * minimapOpts.size };
    }

    function updateMiniMapIndicator() {
        const mainCamera = fire(GetCamera);
        if (!mainCamera || !miniMapIndicator) return;

        const p = worldToMiniMap(mainCamera.position.x, mainCamera.position.z);
        miniMapIndicator.position.set(p.x, p.y, 0.1);
        mainCamera.getWorldDirection(_camDir);
        const mapDirX = -_camDir.z;
        const mapDirY = -_camDir.x;

        miniMapIndicator.rotation.z = Math.atan2(mapDirX, mapDirY);
    }

    /** 创建位置朝向提示器（圆环+三角+视锥） */
    function createFrustumIndicatorMesh(): Mesh {
        const warp = new Mesh();
        // 圆环
        const { ringInnerRadius, ringOuterRadius, ringColor, ringOpacity } = minimapOpts;
        const ringGeo = new RingGeometry(ringInnerRadius, ringOuterRadius, 32);
        const ringMat = new MeshBasicMaterial({
            color: ringColor,
            transparent: true,
            opacity: ringOpacity,
            depthTest: false,
            depthWrite: false,
            side: DoubleSide,
        });
        const ringMesh = new Mesh(ringGeo, ringMat);
        warp.add(ringMesh);

        // 朝向三角
        const { arrowLength, arrowWidth, arrowOffset, arrowColor, arrowOpacity } = minimapOpts;
        const shape = new Shape();
        const tipY = ringInnerRadius + arrowLength;
        const baseY = ringInnerRadius + arrowOffset;
        const halfW = arrowWidth * 0.5;
        shape.moveTo(0, tipY); // 默认朝上（局部 +Y）
        shape.lineTo(-halfW, baseY);
        shape.lineTo(halfW, baseY);
        shape.closePath();
        const geo = new ShapeGeometry(shape);
        const mat = new MeshBasicMaterial({
            color: arrowColor,
            transparent: true,
            opacity: arrowOpacity,
            depthTest: false,
            depthWrite: false,
            side: DoubleSide,
        });
        const arrowMesh = new Mesh(geo, mat);
        warp.add(arrowMesh);

        // 视锥
        frustumMesh = createFrustumMesh();
        warp.add(frustumMesh);

        // frustumMesh.position.set(0, 0, 0.001);
        // arrowMesh.position.set(0, 0, 0.002);
        // ringMesh.position.set(0, 0, 0.003);
        // frustumMesh.renderOrder = 1;
        // arrowMesh.renderOrder = 2;
        // ringMesh.renderOrder = 3;

        return warp;
    }

    /** 创建梯形Mesh模拟视锥外观 */
    function createFrustumMesh(): Mesh {
        const { frustumOffset, frustumNear, frustumFar, frustumColor, frustumNearOpacity, frustumFarOpacity } = minimapOpts;

        const mainCamera = fire(GetCamera);
        const halfAngle = MathUtils.degToRad(mainCamera.fov);
        const nearY = frustumOffset + frustumNear;
        const farY = frustumOffset + frustumFar;
        const nearHalfW = Math.tan(halfAngle) * frustumNear;
        const farHalfW = Math.tan(halfAngle) * frustumFar;

        const vertices = new Float32Array([-nearHalfW, nearY, 0, nearHalfW, nearY, 0, farHalfW, farY, 0, -farHalfW, farY, 0]);
        const indices = [0, 1, 2, 0, 2, 3];
        const c = new Color(frustumColor);
        const colors = new Float32Array([c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b]);

        const geo = new BufferGeometry();
        geo.setAttribute('position', new BufferAttribute(vertices, 3));
        geo.setAttribute('color', new BufferAttribute(colors, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        const mat = new MeshBasicMaterial({ transparent: true, opacity: 1, depthTest: false, depthWrite: false, side: DoubleSide, vertexColors: true });

        // 近实远淡 alpha 渐变
        mat.onBeforeCompile = shader => {
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `
                #include <common>
                varying float vFade;
                `,
            );
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                vFade = smoothstep(${nearY.toFixed(4)}, ${farY.toFixed(4)}, position.y);
                `,
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `
                #include <common>
                varying float vFade;
                `,
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                'vec4 diffuseColor = vec4( diffuse, opacity );',
                `
                float alpha = mix(${frustumNearOpacity.toFixed(4)}, ${frustumFarOpacity.toFixed(4)}, vFade);
                vec4 diffuseColor = vec4(diffuse, alpha);
                `,
            );
        };

        const mesh = new Mesh(geo, mat);
        mesh.onBeforeRender = updateFrustumGeometry;
        return mesh;
    }

    // 根据主相机实时更新视锥宽度（同步 FOV）
    let lastFov = 0;
    function updateFrustumGeometry() {
        if (!frustumMesh) return;

        const mainCamera = fire(GetCamera);
        if (lastFov == mainCamera.fov) return;
        lastFov = mainCamera.fov;

        const geo = frustumMesh.geometry as BufferGeometry;
        const pos = geo.getAttribute('position') as BufferAttribute;

        const { frustumOffset, frustumNear, frustumFar, frustumMinHFov, frustumMaxFov } = minimapOpts;

        const vFovRad = MathUtils.degToRad(lastFov);
        const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * mainCamera.aspect);
        let hFov = MathUtils.radToDeg(hFovRad);
        hFov = MathUtils.clamp(hFov, frustumMinHFov, frustumMaxFov);

        const halfAngle = MathUtils.degToRad(hFov * 0.5);

        const nearY = frustumOffset + frustumNear;
        const farY = frustumOffset + frustumFar;

        const nearHalfW = Math.tan(halfAngle) * frustumNear;
        const farHalfW = Math.tan(halfAngle) * frustumFar;

        pos.setXYZ(0, -nearHalfW, nearY, 0);
        pos.setXYZ(1, nearHalfW, nearY, 0);
        pos.setXYZ(2, farHalfW, farY, 0);
        pos.setXYZ(3, -farHalfW, farY, 0);

        pos.needsUpdate = true;
        geo.computeBoundingSphere();
    }

    window.addEventListener('resize', caclMiniMapViewport);

    on(
        OnViewerDispose,
        () => {
            if (disposed) return;
            disposed = true;
            fire(TraverseDisposeAndClear, miniMapScene);
            miniMapScene = null;
            miniMapCamera = null;
            miniMapIndicator = null;
            frustumMesh = null;
            miniMapViewport = null;
            minimapOpts = null;
            window.removeEventListener('resize', caclMiniMapViewport);
        },
        true,
    );
}

export interface MinimapOptions {
    /** 小地图边长 */
    size?: number;
    /** 小地图位置 */
    corner?: string;
    /** 小地图边距X */
    marginX?: number;
    /** 小地图边距Y */
    marginY?: number;
    /** 小地图视口坐标范围minX */
    minX?: number;
    /** 小地图视口坐标范围maxX */
    maxX?: number;
    /** 小地图视口坐标范围minZ */
    minZ?: number;
    /** 小地图视口坐标范围maxZ */
    maxZ?: number;
    /** 小地图底图链接 */
    url?: string;
    /** 小地图底图透明度 */
    bgOpacity?: number;

    /** 小地图边长(手机) */
    mobileSize?: number;
    /** 小地图位置(手机) */
    mobileCorner?: string;
    /** 小地图边距X(手机) */
    mobileMarginX?: number;
    /** 小地图边距Y(手机) */
    mobileMarginY?: number;

    /** 圆环内径，默认6像素 */
    ringInnerRadius?: number;
    /** 圆环外径，默认10像素 */
    ringOuterRadius?: number;
    /** 圆环颜色，默认'#eeeeee' */
    ringColor?: number | string;
    /** 圆环透明度，默认0.9  */
    ringOpacity?: number;

    /** 朝向三角的长，默认18像素  */
    arrowLength?: number;
    /** 朝向三角的宽，默认14像素  */
    arrowWidth?: number;
    /** 朝向三角的偏移量，默认圆环外径+0.01  */
    arrowOffset?: number;
    /** 朝向三角颜色，默认'#eeeeee' */
    arrowColor?: number | string;
    /** 朝向三角透明度，默认0.9  */
    arrowOpacity?: number;

    /** 视锥整体向前的偏移量，默认0 */
    frustumOffset?: number;
    /** 视锥近端的纵向距离，默认10像素 */
    frustumNear?: number;
    /** 视锥远端的纵向距离，默认50像素 */
    frustumFar?: number;
    /** 视锥颜色，默认'#666666'  */
    frustumColor?: number | string;
    /** 视锥近端颜色透明度，用于近实远淡渐变，默认0.9 */
    frustumNearOpacity?: number;
    /** 视锥远端颜色透明度，用于近实远淡渐变，默认0.1 */
    frustumFarOpacity?: number;
    /** 最小FOV，限制范围调优指示器外观用 */
    frustumMinHFov?: number;
    /** 最大FOV，限制范围调优指示器外观用 */
    frustumMaxFov?: number;
}
