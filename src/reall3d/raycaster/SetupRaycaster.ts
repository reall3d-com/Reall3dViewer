// ================================
// Copyright (c) 2025 reall3d.com
// ================================
import { Object3D, PerspectiveCamera, Raycaster, Scene, Sphere, Vector2, Vector3 } from 'three';
import { Events } from '../events/Events';
import {
    GetCamera,
    GetCanvasSize,
    GetScene,
    GetSplatActivePoints,
    RaycasterRayDistanceToPoint,
    RaycasterRayIntersectPoints,
} from '../events/EventConstants';
import { SplatMesh } from '../meshs/splatmesh/SplatMesh';

export function setupRaycaster(events: Events) {
    const raycaster: Raycaster = new Raycaster();
    const MinDistance: number = 0.03;

    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    on(RaycasterRayIntersectPoints, async (mouseClientX: number, mouseClientY: number): Promise<Vector3[]> => {
        const { width, height, left, top } = fire(GetCanvasSize);
        const mouse = new Vector2();
        mouse.x = ((mouseClientX - left) / width) * 2 - 1;
        mouse.y = ((top - mouseClientY) / height) * 2 + 1;

        const camera: PerspectiveCamera = fire(GetCamera);
        raycaster.setFromCamera(mouse, camera);

        const spheres: Sphere[] = [];
        const scene: Scene = fire(GetScene);
        const objectMeshs = [];
        const objectSplats: SplatMesh[] = [];
        scene.traverse(function (child: Object3D) {
            if (child instanceof SplatMesh) {
                objectSplats.push(child);
            } else {
                child['isMesh'] && !child['ignoreIntersect'] && !child['isMark'] && objectMeshs.push(child);
            }
        });

        const intersectMeshs = raycaster.intersectObjects(objectMeshs, true);
        for (let i = 0; i < intersectMeshs.length; i++) {
            spheres.push(new Sphere(intersectMeshs[i].point, raycaster.ray.origin.distanceTo(intersectMeshs[i].point)));
        }

        // const intersectSplats = raycaster.intersectObjects(objectSplats, true); // 不准确的样子
        // if (intersectSplats.length) {
        //     for (let i = 0; i < intersectSplats.length; i++) {
        //         const activePoints: Float32Array = (intersectSplats[i].object as SplatMesh).fire(GetSplatActivePoints);
        //         const cnt = activePoints.length / 3;
        //         for (let j = 0; j < cnt; j++) {
        //             const point: Vector3 = new Vector3(activePoints[3 * j + 0], activePoints[3 * j + 1], activePoints[3 * j + 2]);
        //             if (raycaster.ray.distanceToPoint(point) <= MinDistance) {
        //                 spheres.push(new Sphere(point, raycaster.ray.origin.distanceTo(point)));
        //             }
        //         }
        //     }
        // }

        // console.time('raycaster');
        for (let i = 0; i < objectSplats.length; i++) {
            const rs: any = objectSplats[i].fire(GetSplatActivePoints);
            if (!rs) continue;

            if (rs.length !== undefined) {
                // 坐标数组计算
                const activePoints: Float32Array = rs;
                const cnt = activePoints.length / 3;
                for (let j = 0; j < cnt; j++) {
                    const point: Vector3 = new Vector3(activePoints[3 * j + 0], activePoints[3 * j + 1], activePoints[3 * j + 2]);
                    if (raycaster.ray.distanceToPoint(point) <= MinDistance) {
                        spheres.push(new Sphere(point, raycaster.ray.origin.distanceTo(point)));
                    }
                }
            } else {
                // 分块计算
                for (let key of Object.keys(rs)) {
                    const xyzs: string[] = key.split(',');
                    const center: Vector3 = new Vector3(Number(xyzs[0]), Number(xyzs[1]), Number(xyzs[2]));
                    if (raycaster.ray.distanceToPoint(center) <= 1.01) {
                        const points: number[] = rs[key];
                        for (let j = 0, cnt = points.length / 3; j < cnt; j++) {
                            const point: Vector3 = new Vector3(points[3 * j + 0], points[3 * j + 1], points[3 * j + 2]);
                            if (raycaster.ray.distanceToPoint(point) <= MinDistance) {
                                spheres.push(new Sphere(point, raycaster.ray.origin.distanceTo(point)));
                            }
                        }
                    }
                }
            }
        }
        // console.timeEnd('raycaster');

        spheres.sort((a: Sphere, b: Sphere) => a.radius - b.radius);

        const rs: Vector3[] = [];
        for (let i = 0; i < spheres.length; i++) {
            rs.push(spheres[i].center);
        }
        return rs;
    });

    on(RaycasterRayDistanceToPoint, (mouseClientX: number, mouseClientY: number, point: Vector3): number => {
        const { width, height, left, top } = fire(GetCanvasSize);
        const mouse = new Vector2();
        mouse.x = ((mouseClientX - left) / width) * 2 - 1;
        mouse.y = ((top - mouseClientY) / height) * 2 + 1;

        const camera: PerspectiveCamera = fire(GetCamera);
        raycaster.setFromCamera(mouse, camera);
        return raycaster.ray.distanceToPoint(point);
    });
}
