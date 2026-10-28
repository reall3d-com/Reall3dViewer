// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Vector3 } from 'three';
import { isMobile, MaxProcessCnt } from '../../utils/GlobalConstants';
import { ModelStatus, SplatModel } from '../ModelData';
import { parseSplatToTexdata } from '../wasm/WasmParser';

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
        model.rowLength = 32;
        model.fileSize = contentLength;
        const maxVertexCount = (contentLength / model.rowLength) | 0;
        if (maxVertexCount < 1) {
            console.warn('data empty', model.opts.url);
            model.status === ModelStatus.Fetching && (model.status = ModelStatus.Invalid);
            return;
        }

        model.CompressionRatio = '7.75x';
        model.modelSplatCount = maxVertexCount;
        model.downloadSplatCount = 0;
        model.splatData = new Uint8Array(Math.min(model.modelSplatCount, model.fetchLimit) * 32);
        model.watermarkData = new Uint8Array(0);

        let perValue = new Uint8Array(32);
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
                perByteLen && perValue.set(value.subarray(value.byteLength - perByteLen), 0);
            }

            // 超过限制时终止下载
            model.downloadSplatCount >= model.fetchLimit && model.abortController.abort();
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            console.log('Fetch Abort', model.opts.url);
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
                value.set(perValue.subarray(0, perByteLen), 0);
                value.set(newValue.subarray(0, newValue.byteLength - leave), perByteLen);
            } else {
                value = newValue.slice(0, cntSplat * model.rowLength);
            }

            // 丢弃超出限制范围外的数据
            if (model.downloadSplatCount + cntSplat > model.fetchLimit) {
                cntSplat = model.fetchLimit - model.downloadSplatCount;
                leave = 0;
            }

            const fnParseSplat = async () => {
                if (cntSplat > MaxProcessCnt) {
                    const data: Uint8Array = await parseSplatToTexdata(value, MaxProcessCnt);
                    setSplatData(model, data);
                    model.downloadSplatCount += MaxProcessCnt;
                    bytesRead += MaxProcessCnt * model.rowLength;
                    model.downloadSize = bytesRead;

                    cntSplat -= MaxProcessCnt;
                    value = value.slice(MaxProcessCnt * model.rowLength);
                    setTimeout(fnParseSplat);
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

function setSplatData(model: SplatModel, data: Uint8Array) {
    let dataCnt = data.byteLength / 32;
    const maxSplatDataCnt = Math.min(model.fetchLimit, model.modelSplatCount);
    if (model.dataSplatCount + dataCnt > maxSplatDataCnt) {
        dataCnt = maxSplatDataCnt - model.dataSplatCount; // 丢弃超出限制的部分
        model.splatData.set(data.subarray(0, dataCnt * 32), model.dataSplatCount * 32);
    } else {
        model.splatData.set(data, model.dataSplatCount * 32);
    }

    const f32s: Float32Array = new Float32Array(data.buffer);
    for (let i = 0, x = 0, y = 0, z = 0; i < dataCnt; i++) {
        x = f32s[i * 8];
        y = f32s[i * 8 + 1];
        z = f32s[i * 8 + 2];
        model.minX = Math.min(model.minX, x);
        model.maxX = Math.max(model.maxX, x);
        model.minY = Math.min(model.minY, y);
        model.maxY = Math.max(model.maxY, y);
        model.minZ = Math.min(model.minZ, z);
        model.maxZ = Math.max(model.maxZ, z);
    }
    model.dataSplatCount += dataCnt;

    const topY = model.header?.MinTopY || 0;
    model.currentRadius = Math.sqrt(model.maxX * model.maxX + topY * topY + model.maxZ * model.maxZ);
    model.aabbCenter = new Vector3((model.minX + model.maxX) / 2, (model.minY + model.maxY) / 2, (model.minZ + model.maxZ) / 2);
    model.maxRadius = 0.5 * Math.sqrt(Math.pow(model.maxX - model.minX, 2) + Math.pow(model.maxY - model.minY, 2) + Math.pow(model.maxZ - model.minZ, 2));
    model.metaMatrix && model.aabbCenter.applyMatrix4(model.metaMatrix);
}
