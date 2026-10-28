// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import {
    DoubleSide,
    Euler,
    Group,
    Intersection,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    Object3D,
    PerspectiveCamera,
    PlaneGeometry,
    Raycaster,
    RingGeometry,
    Scene,
    SphereGeometry,
    Vector2,
    Vector3,
} from 'three';
import { Events } from '../events/Events';
import {
    GetCamera,
    GetCameraPosition,
    GetCanvasSize,
    GetMeta,
    GetOptions,
    GetPlayer,
    GetScene,
    IntersectsPhysicsObjects,
    OnViewerDispose,
    PhysicsGetEnvCollision,
    PhysicsGetGroundCollision,
    UpdateIndicatorTargetStatus,
    UpdateVirtualGroundPosition,
} from '../events/EventConstants';
import { MetaData } from '../modeldata/MetaData';
import { Reall3dViewerOptions } from '../viewer/Reall3dViewerOptions';

export function setupVirtualGround(events: Events) {
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    let indicator: Mesh = null;
    let indicatorTarget: Mesh = null;
    let virtualGround: Mesh = null;
    const meta: MetaData = fire(GetMeta);

    on(UpdateVirtualGroundPosition, () => meta.autuUpdateVirtualGroundPosition !== false && virtualGround?.position.copy((fire(GetPlayer) as Group).position));

    on(UpdateIndicatorTargetStatus, (point: Vector3, hide = false) => {
        if (!indicatorTarget) return;
        if (hide) {
            indicatorTarget.visible = false;
        } else {
            indicatorTarget.position.copy(point);
            const { height } = fire(GetCanvasSize);
            const newScale = ((fire(GetCameraPosition) as Vector3).distanceTo(indicatorTarget.position) * 3.2) / height;
            indicatorTarget.scale.set(newScale, newScale, newScale);
            indicatorTarget.visible = true;
            indicator.visible = false;
        }
    });

    on(PhysicsGetGroundCollision, () => {
        const obj3ds: Object3D[] = [];
        virtualGround && obj3ds.push(virtualGround);
        const collision = fire(PhysicsGetEnvCollision);
        collision && obj3ds.push(collision);
        return obj3ds;
    });

    initVirtualGround();

    function initVirtualGround() {
        const scene: Scene = fire(GetScene);

        // 虚拟地面
        if (meta.addVirtualGround !== false) {
            const gridGeometry = new PlaneGeometry(300, 300);
            const gridMaterial = new MeshStandardMaterial({ color: 0x00ff00, side: DoubleSide });
            virtualGround = new Mesh(gridGeometry, gridMaterial);
            virtualGround.rotation.x = -Math.PI / 2;
            virtualGround.receiveShadow = true;
            virtualGround.visible = false;
            scene.add(virtualGround);
        }

        // 鼠标移动提示圈
        const indicatorGeometry = new RingGeometry(2, 4, 16);
        const indicatorMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: DoubleSide });
        indicator = new Mesh(indicatorGeometry, indicatorMaterial);
        indicator.visible = false;
        indicator.renderOrder = 99999;
        indicator.onBeforeRender = () => {
            if (indicator.visible) {
                const { height } = fire(GetCanvasSize);
                const newScale = ((fire(GetCameraPosition) as Vector3).distanceTo(indicator.position) * 3.2) / height;
                indicator.scale.set(newScale, newScale, newScale);
            }
        };
        scene.add(indicator);

        // 目标点提示球
        const indicatorTargetGeometry = new SphereGeometry(4, 16, 16); // 球体几何体
        const indicatorTargetMaterial = new MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.3, side: DoubleSide });
        indicatorTarget = new Mesh(indicatorTargetGeometry, indicatorTargetMaterial);
        indicatorTarget.visible = false;
        indicatorTarget.renderOrder = 99999;
        indicatorTarget.onBeforeRender = () => {
            if (indicatorTarget.visible) {
                const { height } = fire(GetCanvasSize);
                const newScale = ((fire(GetCameraPosition) as Vector3).distanceTo(indicatorTarget.position) * 3.2) / height;
                indicatorTarget.scale.set(newScale, newScale, newScale);
            }
        };
        scene.add(indicatorTarget);

        // 鼠标移动显示提示圈
        const mouse = new Vector2();
        const raycaster: Raycaster = new Raycaster();
        const normal = new Vector3();
        const rotationEuler = new Euler();
        function onMouseMove(event: MouseEvent) {
            if ((fire(GetOptions) as Reall3dViewerOptions).markMode) return;

            const intersect: Intersection<any> = fire(IntersectsPhysicsObjects, event.clientX, event.clientY);
            if (intersect) {
                indicator.position.copy(intersect.point);

                // 调整提示圈使其与相交面平行
                if (intersect.face) {
                    normal.copy(intersect.face.normal).transformDirection(intersect.object.matrixWorld).normalize();
                    const dummy = new Object3D();
                    dummy.position.copy(indicator.position);
                    dummy.lookAt(dummy.position.clone().add(normal));
                    indicator.quaternion.copy(dummy.quaternion);
                }

                indicator.visible = true;
                const { height } = fire(GetCanvasSize);
                const newScale = ((fire(GetCameraPosition) as Vector3).distanceTo(indicator.position) * 3.2) / height;
                indicator.scale.set(newScale, newScale, newScale);
            } else {
                indicator.visible = false;
            }
        }

        on(IntersectsPhysicsObjects, (clientX: number, clientY: number): Intersection<any> => {
            mouse.x = (clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(clientY / window.innerHeight) * 2 + 1;

            const camera: PerspectiveCamera = fire(GetCamera);
            if (!camera) return;
            raycaster.setFromCamera(mouse, camera);

            const obj3ds: Object3D[] = fire(PhysicsGetGroundCollision);
            const intersects = raycaster.intersectObjects(obj3ds, true); // 检测地面或静态碰撞体交点

            if (!intersects.length) return null;

            // 取最近的相交面
            const closestIntersect = intersects.reduce((closest, curr) => (curr.distance < closest.distance ? curr : closest), intersects[0]);
            return closestIntersect;
        });

        window.addEventListener('mousemove', onMouseMove, false);
        on(OnViewerDispose, () => window.removeEventListener('mousemove', onMouseMove), true);
    }
}
