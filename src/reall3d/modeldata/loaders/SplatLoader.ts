// ================================
// Copyright (c) 2025 reall3d.com
// ================================
import { isMobile, MobileDownloadLimitSplatCount, PcDownloadLimitSplatCount, SplatDataSize32 } from '../../utils/consts/GlobalConstants';
import { ModelStatus, SplatModel } from '../ModelData';
import { parseSplatToTexdata } from '../wasm/WasmBinParser';
import { setSplatData } from './BinLoader';

const maxProcessCnt = isMobile ? 20000 : 50000;

export async function loadSplat(model: SplatModel) {
    let bytesRead = 0;

    try {
        model.status = ModelStatus.Fetching;
        const signal: AbortSignal = model.abortController.signal;
        const cache = model.opts.fetchReload ? 'reload' : 'default';
        const req = await fetch(model.opts.url, { mode: 'cors', credentials: 'omit', cache, signal });
        if (req.status != 200) {
            console.warn(`fetch error: ${req.status}`);
            model.status === ModelStatus.Fetching && (model.status = ModelStatus.FetchFailed);
            return;
        }
        const reader = req.body.getReader();
        const contentLength = parseInt(req.headers.get('content-length') || '0');
        model.rowLength = SplatDataSize32;
        model.fileSize = contentLength;
        const maxVertexCount = (contentLength / model.rowLength) | 0;
        if (maxVertexCount < 1) {
            console.warn('data empty', model.opts.url);
            model.status === ModelStatus.Fetching && (model.status = ModelStatus.Invalid);
            return;
        }

        model.modelSplatCount = maxVertexCount;
        model.downloadSplatCount = 0;
        model.splatData = new Uint8Array(Math.min(model.modelSplatCount, model.opts.limitSplatCount) * SplatDataSize32);

        let perValue = new Uint8Array(SplatDataSize32);
        let perByteLen: number = 0;

        while (true) {
            let { done, value } = await reader.read();
            if (done) break;

            if (perByteLen + value.byteLength < model.rowLength) {
                // 不足1点不必解析
                perValue.set(value, perByteLen);
                perByteLen += value.byteLength;

                bytesRead += value.length;
                model.downloadSize = bytesRead;
            } else {
                // 解析并设定数据
                perByteLen = await parseSplatAndSetSplatData(model, perByteLen, perValue, value);
                perByteLen && perValue.set(value.slice(value.byteLength - perByteLen), 0);
            }

            // 超过限制时终止下载
            const downloadLimitSplatCount = isMobile ? MobileDownloadLimitSplatCount : PcDownloadLimitSplatCount;
            const isSingleLimit: boolean = !model.meta?.autoCut && model.downloadSplatCount >= model.opts.limitSplatCount;
            const isCutLimit = model.meta?.autoCut && model.downloadSplatCount >= downloadLimitSplatCount;
            (isSingleLimit || isCutLimit) && model.abortController.abort();
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            console.warn('Fetch Abort', model.opts.url);
            model.status === ModelStatus.Fetching && (model.status = ModelStatus.FetchAborted);
        } else {
            console.error(e);
            model.status === ModelStatus.Fetching && (model.status = ModelStatus.FetchFailed);
        }
    } finally {
        model.status === ModelStatus.Fetching && (model.status = ModelStatus.FetchDone);
    }

    async function parseSplatAndSetSplatData(model: SplatModel, perByteLen: number, perValue: Uint8Array, newValue: Uint8Array): Promise<number> {
        return new Promise(async resolve => {
            let cntSplat = ((perByteLen + newValue.byteLength) / model.rowLength) | 0;
            let leave: number = (perByteLen + newValue.byteLength) % model.rowLength;
            let value: Uint8Array;
            if (perByteLen) {
                value = new Uint8Array(cntSplat * model.rowLength);
                value.set(perValue.slice(0, perByteLen), 0);
                value.set(newValue.slice(0, newValue.byteLength - leave), perByteLen);
            } else {
                value = newValue.slice(0, cntSplat * model.rowLength);
            }

            if (!model.meta?.autoCut && model.downloadSplatCount + cntSplat > model.opts.limitSplatCount) {
                cntSplat = model.opts.limitSplatCount - model.downloadSplatCount;
                leave = 0;
            }
            const downloadLimitSplatCount = isMobile ? MobileDownloadLimitSplatCount : PcDownloadLimitSplatCount;
            if (model.meta?.autoCut && model.downloadSplatCount + cntSplat > downloadLimitSplatCount) {
                cntSplat = downloadLimitSplatCount - model.downloadSplatCount;
                leave = 0;
            }

            const fnParseSplat = async () => {
                if (cntSplat > maxProcessCnt) {
                    const data: Uint8Array = await parseSplatToTexdata(value, maxProcessCnt);
                    setSplatData(model, data);
                    model.downloadSplatCount += maxProcessCnt;
                    bytesRead += maxProcessCnt * model.rowLength;
                    model.downloadSize = bytesRead;

                    cntSplat -= maxProcessCnt;
                    value = value.slice(maxProcessCnt * model.rowLength);
                    setTimeout(fnParseSplat, 100);
                } else {
                    const data: Uint8Array = await parseSplatToTexdata(value, cntSplat);
                    setSplatData(model, data);
                    model.downloadSplatCount += cntSplat;
                    bytesRead += cntSplat * model.rowLength;
                    model.downloadSize = bytesRead;

                    resolve(leave);
                }
            };

            await fnParseSplat();
        });
    }
}
