// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Events } from '../../events/Events';
import { ModelStatus, SplatModel } from '../ModelData';
import {
    WorkerDispose,
    SplatDataFetcher,
    SplatUpdateShPalettesTexture,
    SplatUpdateShDegree,
    GetModelShDegree,
    GetLodModelShDegree,
} from '../../events/EventConstants';
import {
    WkFetcherDataShDegree,
    WkA90FetcherDone,
    WkFetcherDownloadSplatCount,
    WkFetcherPalettes,
    WkFetcherSplatData,
    WkFetcherStatus,
    WkA02FetcherUrl,
    WkA02Dispose,
    WkXyz,
    WkUrl,
} from './WkConstants';

export function setupWorkerFetch(events: Events) {
    let disposed = false;
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    const mapUrlFn = new Map<string, Function>();
    const mapUrlModel = new Map<string, SplatModel>();

    let palettesUpdated = false;
    let lodModelShDegree = 0;

    const worker = new Worker(new URL('./WorkerFetch.ts', import.meta.url), { type: 'module' });

    on(SplatDataFetcher, (warpModel: SplatModel): Promise<any> => {
        if (disposed) {
            warpModel.status = ModelStatus.FetchFailed;
            return;
        }

        return new Promise(fnResolve => {
            mapUrlModel.set(warpModel.opts.url, warpModel);
            mapUrlFn.set(warpModel.opts.url, fnResolve);
            worker.postMessage({ [WkA02FetcherUrl]: true, [WkUrl]: warpModel.opts.url });
        });
    });

    on(GetLodModelShDegree, (): number => lodModelShDegree);

    on(
        WorkerDispose,
        () => {
            disposed = true;
            worker.postMessage({ [WkA02Dispose]: true });
            worker.terminate();
            mapUrlFn.clear();
            mapUrlModel.clear();
        },
        true,
    );

    worker.onmessage = (e: any) => {
        const data: any = e.data;
        if (!data[WkA90FetcherDone] || disposed) return;

        const url: string = data[WkUrl];
        const fnResolve = mapUrlFn.get(url);
        const warpModel = mapUrlModel.get(url);
        const status = data[WkFetcherStatus];
        if (status == ModelStatus.FetchDone) {
            warpModel.status = ModelStatus.FetchDone;
            warpModel.splatData = data[WkFetcherSplatData];
            warpModel.xyz = data[WkXyz];
            warpModel.downloadSplatCount = data[WkFetcherDownloadSplatCount];
            warpModel.dataShDegree = data[WkFetcherDataShDegree];
            warpModel.palettes = data[WkFetcherPalettes];

            if (warpModel.palettes && !palettesUpdated) {
                lodModelShDegree = Math.max(lodModelShDegree, warpModel.dataShDegree);
                fire(SplatUpdateShPalettesTexture, warpModel.palettes);
                fire(SplatUpdateShDegree, warpModel.dataShDegree);
                palettesUpdated = true;
            }
        } else {
            warpModel.status = ModelStatus.FetchFailed;
        }

        mapUrlFn.delete(url);
        mapUrlModel.delete(url);
        fnResolve();
    };
}
