// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Events } from '../../events/Events';
import {
    GetSortWorker,
    NotifyWkA09Sort,
    WorkerDispose,
    GetViewProjectionMatrixArray,
    GetMaxRenderCount,
    IsBigSceneMode,
    GetRenderQualityLevel,
    WorkerUpdateParams,
    GetCameraPosition,
    GetCameraDirection,
    GetSortType,
    GetSplatMesh,
    NotifyWkA09DblTextureReady,
    NotifyWkA09SglTextureReady,
    NotifyWkA09SortPart,
} from '../../events/EventConstants';
import {
    WkCameraDirection,
    WkCameraPosition,
    WkDepthNearRate,
    WkDepthNearValue,
    WkA09Init,
    WkMaxRenderCount,
    WkQualityLevel,
    WkSortType,
    WkA09UpdateParams,
    WkViewProjection,
    WkA09DblTextureReady,
    WkXyz,
    WkWatermarkCount,
    WkIndex,
    WkVersion,
    WkRenderSplatCount,
    WkVisibleSplatCount,
    WkModelSplatCount,
    WkMinX,
    WkMaxX,
    WkMinY,
    WkMaxY,
    WkMinZ,
    WkMaxZ,
    WkA09SglTextureReady,
    WkA09SortPart,
    WkXyzIndex,
    WkA09Sort,
} from './WkConstants';
import { Vector3 } from 'three';
import { SplatMesh } from '../../meshs/splatmesh/SplatMesh';

export function setupWorkerSort(events: Events) {
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);
    const worker = new Worker(new URL('./WorkerSort.ts', import.meta.url), { type: 'module' });

    on(GetSortWorker, () => worker);

    on(NotifyWkA09SglTextureReady, (texture: SplatTexdata) => {
        const xyz = texture.xyz.slice(0);
        worker.postMessage(
            {
                [WkA09SglTextureReady]: true,
                [WkXyz]: xyz,
                [WkWatermarkCount]: texture.watermarkCount,
                [WkIndex]: texture.index,
                [WkVersion]: texture.version,
                [WkRenderSplatCount]: texture.renderSplatCount,
                [WkVisibleSplatCount]: texture.visibleSplatCount,
                [WkModelSplatCount]: texture.modelSplatCount,
                [WkMinX]: texture.minX,
                [WkMaxX]: texture.maxX,
                [WkMinY]: texture.minY,
                [WkMaxY]: texture.maxY,
                [WkMinZ]: texture.minZ,
                [WkMaxZ]: texture.maxZ,
            },
            [xyz.buffer],
        );
    });

    on(NotifyWkA09DblTextureReady, (texture: SplatTexdata) => {
        const xyz = texture.xyz;
        texture.xyz = null;
        worker.postMessage(
            {
                [WkA09DblTextureReady]: true,
                [WkXyz]: xyz,
                [WkWatermarkCount]: texture.watermarkCount,
                [WkIndex]: texture.index,
                [WkVersion]: texture.version,
                [WkRenderSplatCount]: texture.renderSplatCount,
                [WkVisibleSplatCount]: texture.visibleSplatCount,
                [WkModelSplatCount]: texture.modelSplatCount,
                [WkMinX]: texture.minX,
                [WkMaxX]: texture.maxX,
                [WkMinY]: texture.minY,
                [WkMaxY]: texture.maxY,
                [WkMinZ]: texture.minZ,
                [WkMaxZ]: texture.maxZ,
            },
            [xyz.buffer],
        );
    });

    on(NotifyWkA09SortPart, (texture: SplatTexdata) => {
        worker.postMessage(
            {
                [WkA09SortPart]: true,
                [WkIndex]: texture.index,
                [WkVersion]: texture.version,
                [WkWatermarkCount]: texture.watermarkCount,
                [WkRenderSplatCount]: texture.renderSplatCount,
                [WkVisibleSplatCount]: texture.visibleSplatCount,
                [WkModelSplatCount]: texture.modelSplatCount,
                [WkXyz]: texture.xyz,
                [WkXyzIndex]: texture.xyzIndex,
                [WkMinX]: texture.minX,
                [WkMaxX]: texture.maxX,
                [WkMinY]: texture.minY,
                [WkMaxY]: texture.maxY,
                [WkMinZ]: texture.minZ,
                [WkMaxZ]: texture.maxZ,
            },
            [texture.xyz.buffer, texture.xyzIndex.buffer],
        );
    });

    on(NotifyWkA09Sort, () =>
        worker.postMessage({
            [WkA09Sort]: true,
            [WkViewProjection]: fire(GetViewProjectionMatrixArray),
            [WkCameraDirection]: fire(GetCameraDirection),
            [WkCameraPosition]: (fire(GetCameraPosition) as Vector3).toArray(),
        }),
    );
    on(WorkerDispose, () => worker.terminate(), true);
    on(WorkerUpdateParams, async () => {
        await fire(GetMaxRenderCount);
        worker.postMessage({
            [WkA09UpdateParams]: true,
            [WkQualityLevel]: fire(GetRenderQualityLevel),
            [WkSortType]: fire(GetSortType),
            [WkDepthNearRate]: (fire(GetSplatMesh) as SplatMesh)?.meta?.depthNearRate,
            [WkDepthNearValue]: (fire(GetSplatMesh) as SplatMesh)?.meta?.depthNearValue,
        });
    });

    (async () => {
        const maxRenderCount = await fire(GetMaxRenderCount);
        worker.postMessage({
            [WkA09Init]: true,
            [WkMaxRenderCount]: maxRenderCount,
            [WkQualityLevel]: fire(GetRenderQualityLevel),
            [WkSortType]: fire(GetSortType),
            [WkDepthNearRate]: (fire(GetSplatMesh) as SplatMesh)?.meta?.depthNearRate,
            [WkDepthNearValue]: (fire(GetSplatMesh) as SplatMesh)?.meta?.depthNearValue,
        });
    })();
}
