// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Matrix4, Mesh, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { FlyingPause, GetOptions, SetGaussianText } from '../../events/EventConstants';
import { CSS3DSprite } from 'three/examples/jsm/Addons.js';
import { Easing, Tween } from '@tweenjs/tween.js';
import { SplatMesh } from '../../meshs/splatmesh/SplatMesh';
import { SplatMeshOptions } from '../../meshs/splatmesh/SplatMeshOptions';
import { MetaData } from '../../modeldata/MetaData';
import { Reall3dMapViewer } from '../Reall3dMapViewer';
import { Reall3dMapViewerOptions } from '../Reall3dMapViewerOptions';
import { isMobile } from '../../utils/GlobalConstants';

export class WarpSplatMesh extends Mesh {
    public readonly isWarpSplatMesh: boolean = true;
    public meta: MetaData;
    public lastActiveTime: number = Date.now();
    public splatMesh: SplatMesh;
    public active: boolean = false;
    private opts: SplatMeshOptions;
    private css3dTag: CSS3DSprite;
    private mapViewer: Reall3dMapViewer;
    private metaMatrix: Matrix4;
    private disposed: boolean = false;

    constructor(sceneUrl: string, mapViewer: Reall3dMapViewer) {
        super();
        const that = this;
        that.mapViewer = mapViewer;
        that.addScene(sceneUrl);
        that.frustumCulled = false;
    }

    private async addScene(sceneUrl: string) {
        const that = this;
        const { renderer, scene, controls, tileMap } = that.mapViewer;
        fetch(sceneUrl, { mode: 'cors', credentials: 'omit', cache: 'reload' })
            .then(response => (!response.ok ? {} : response.json()))
            .then((meta: MetaData) => {
                const matrix = new Matrix4();
                if (meta.transform) {
                    matrix.fromArray(meta.transform);
                } else if (meta.WGS84) {
                    const pos = tileMap.geo2world(new Vector3().fromArray(meta.WGS84));
                    matrix.makeTranslation(pos.x, pos.y, pos.z);
                    meta.transform = matrix.toArray();
                }
                that.metaMatrix = matrix;
                const bigSceneMode = meta.url?.endsWith('.json');
                const pointcloudMode = false;
                const depthTest = false;
                const showWatermark = !!meta.showWatermark;
                const opts: SplatMeshOptions = { renderer, scene, controls, pointcloudMode, bigSceneMode, showWatermark, depthTest, mapMode: true };
                opts.debugMode = (that.mapViewer.events.fire(GetOptions) as Reall3dMapViewerOptions).debugMode;
                that.opts = opts;
                that.meta = meta;
                scene.add(that);
                that.initCSS3DSprite(opts);
                that.applyMatrix4(matrix);
            })
            .catch(e => {
                console.error(e.message);
            });
    }

    private async initCSS3DSprite(opts: SplatMeshOptions) {
        const that = this;
        const controls: MapControls = opts.controls;
        const tagWarp: HTMLDivElement = document.createElement('div');
        tagWarp.innerHTML = `<div title="${that.meta.name}" style='flex-direction: column;align-items: center;display: flex;pointer-events: auto;margin-bottom: 20px;'>
                               <svg height="20" width="20" style="color:#eeee00;opacity:0.9;"><use href="#svgicon-point3" fill="currentColor" /></svg>
                            </div>`;
        tagWarp.classList.add('splatmesh-point');
        tagWarp.style.position = 'absolute';
        tagWarp.style.borderRadius = '4px';
        tagWarp.style.cursor = 'pointer';
        let tween: Tween = null;
        tagWarp.onclick = () => {
            that.mapViewer.events.fire(FlyingPause);
            if (tween) return;

            const oldTarget = controls.target.clone(); // 原始视点
            const oldPos = controls.object.position.clone(); // 原始位置
            const newTarget = that.position.clone(); // 新视点
            const distance = isMobile ? 6 : 2; // 相机与新视点的距离
            const oldDir = oldTarget.clone().sub(oldPos).normalize(); // 计算原视线向量
            const newDir = oldDir.clone(); // 计算新视线向量（与原视线向量平行）
            const newPos = newTarget.clone().sub(newDir.multiplyScalar(distance)); // 计算相机的新位置

            const pt = { x: oldPos.x, y: oldPos.y, z: oldPos.z, tx: oldTarget.x, ty: oldTarget.y, tz: oldTarget.z };
            const to = { x: newPos.x, y: newPos.y, z: newPos.z, tx: newTarget.x, ty: newTarget.y, tz: newTarget.z };
            tween = new Tween(pt).to(to, 3500);
            tween
                .easing(Easing.Sinusoidal.InOut)
                .start()
                .onUpdate(() => {
                    controls.object.position.set(pt.x, pt.y, pt.z);
                    controls.target.set(pt.tx, pt.ty, pt.tz);
                })
                .onComplete(() => {
                    tween = null;
                });
        };
        tagWarp.oncontextmenu = (e: MouseEvent) => e.preventDefault();
        const css3dTag = new CSS3DSprite(tagWarp);
        css3dTag.element.style.pointerEvents = 'none';
        css3dTag.visible = false;
        css3dTag.applyMatrix4(that.metaMatrix);
        that.css3dTag = css3dTag;
        opts.scene.add(css3dTag);

        // @ts-ignore
        const onMouseWheel = (e: WheelEvent) => that.mapViewer.controls._onMouseWheel(e);
        tagWarp.addEventListener('wheel', onMouseWheel, { passive: false });
        // @ts-ignore
        css3dTag.dispose = () => tagWarp.removeEventListener('wheel', onMouseWheel);

        that.onBeforeRender = () => {
            tween?.update();

            const MinDistance = isMobile ? 60 : 30;
            const MaxDistance = 100;
            const distance = that.position.distanceTo(that.mapViewer.controls.object.position);
            if (distance > MinDistance) {
                that.css3dTag.visible = that.opts.controls.object.position.y > 2;
                let scale = 0.002 * distance;
                css3dTag.scale.set(scale, scale, scale);
                that.css3dTag.visible = controls.object.position.y < 10 ? distance < MaxDistance : true; // 相机太低时，太远的不显示
                that.splatMesh && (that.splatMesh.visible = false);
            } else {
                if (!that.active) {
                    that.splatMesh && (that.splatMesh.visible = false);
                    let scale = 0.002 * distance;
                    css3dTag.scale.set(scale, scale, scale);
                    that.css3dTag.visible = true;
                    that.splatMesh?.boundBox && (that.splatMesh.boundBox.visible = false); // 包围盒
                    return;
                }

                that.lastActiveTime = Date.now();
                that.css3dTag.visible = false;

                if (that.splatMesh) {
                    that.splatMesh.visible = true;
                } else {
                    const meta = that.meta;
                    const opts: SplatMeshOptions = { ...that.opts };
                    opts.bigSceneMode = !!meta.url?.endsWith('.json');
                    const splatMesh = new SplatMesh(opts);
                    that.splatMesh = splatMesh;
                    that.opts.scene.add(splatMesh);
                    splatMesh.meta = meta;
                    const watermark = meta.watermark || meta.name || ''; // 水印文字
                    meta.showWatermark = !!meta.showWatermark; // 是否显示水印文字
                    splatMesh.fire(SetGaussianText, watermark, true, false);
                    splatMesh.addModel({ url: meta.url }, meta);
                }
                that.splatMesh.meta.showBoundBox && (that.splatMesh.boundBox.visible = true); // 包围盒
            }
        };

        that.onAfterRender = () => {
            if (that.splatMesh && (!that.active || Date.now() - that.lastActiveTime > 1 * 60 * 1000)) {
                setTimeout(() => {
                    that.splatMesh?.dispose();
                    that.splatMesh = null;
                }, 5);
            }
        };
    }

    /**
     * 销毁
     */
    public dispose(): void {
        const that = this;
        if (that.disposed) return;
        that.disposed = true;

        that.css3dTag.removeFromParent();
        that.splatMesh?.dispose();

        that.meta = null;
        that.splatMesh = null;
        that.opts = null;
        that.css3dTag = null;
        that.mapViewer = null;
        that.metaMatrix = null;
    }
}
