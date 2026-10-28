// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { extractSplatXYZ } from '../../utils/CommonUtils';
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
import { loadSog } from '../loaders/SogLoader';
import { loadSpx } from '../loaders/SpxLoader';
import { ModelStatus, SplatModel } from '../ModelData';

const worker: Worker = self as any;
const mapUrlModel = new Map<string, SplatModel>();

async function downloadAndParse(url: string) {
    const warpModel = new SplatModel({ url });
    warpModel.fetchLimit = 300_0000;
    warpModel.abortController = new AbortController();
    mapUrlModel.set(url, warpModel);
    if (url.endsWith('.spx')) {
        await loadSpx(warpModel);
    } else if (url.endsWith('.sog') || url.endsWith('meta.json')) {
        await loadSog(warpModel);
    }
    mapUrlModel.delete(url);

    if (warpModel.status == ModelStatus.FetchDone) {
        const downloadData = warpModel.splatData.subarray(0, warpModel.downloadSplatCount * 32);
        warpModel.xyz = extractSplatXYZ(downloadData);

        worker.postMessage(
            {
                [WkA90FetcherDone]: true,
                [WkUrl]: url,
                [WkFetcherStatus]: warpModel.status,
                [WkFetcherSplatData]: warpModel.splatData,
                [WkXyz]: warpModel.xyz,
                [WkFetcherDownloadSplatCount]: warpModel.downloadSplatCount,
                [WkFetcherDataShDegree]: warpModel.dataShDegree,
                [WkFetcherPalettes]: warpModel.palettes,
            },
            [warpModel.splatData.buffer, warpModel.xyz.buffer],
        );
    } else {
        worker.postMessage({
            [WkA90FetcherDone]: true,
            [WkUrl]: url,
            [WkFetcherStatus]: ModelStatus.FetchFailed,
        });
    }
}

worker.onmessage = (e: any) => {
    const data: any = e.data;
    if (data[WkA02FetcherUrl]) {
        // 下载解析
        downloadAndParse(data[WkUrl]);
    } else if (data[WkA02Dispose]) {
        // 取消下载
        const splatModels = [...mapUrlModel.values()];
        for (const model of splatModels) {
            model.abortController.abort();
        }
    }
};
