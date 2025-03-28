// ================================
// Copyright (c) 2025 reall3d.com
// ================================
import {
    SplatDataSize20,
    BinHeaderSize,
    SplatDataSize32,
    MobileDownloadLimitSplatCount,
    PcDownloadLimitSplatCount,
    isMobile,
    SplatDataSize16,
} from '../../utils/consts/GlobalConstants';
import { parseBinToTexdata, parseBinHeader, parseSplatToTexdata } from '../wasm/WasmBinParser';
import { BinHeader } from '../formats/BinFormat';
import { ModelStatus, SplatModel } from '../ModelData';
import { ModelOptions } from '../ModelOptions';

const maxProcessCnt = isMobile ? 20000 : 50000;

export async function loadBin(model: SplatModel) {
    if (model.status === ModelStatus.CancelFetch) return;

    let bytesRead: number = 0;

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
        const dataSize = contentLength - BinHeaderSize;
        if (dataSize < SplatDataSize16) {
            console.warn('data empty', model.opts.url);
            model.status === ModelStatus.Fetching && (model.status = ModelStatus.Invalid);
            return;
        }

        model.fileSize = contentLength;
        model.downloadStartTime = Date.now();

        let rowLength: number;
        let headChunks = [];
        let headChunk = new Uint8Array(BinHeaderSize);
        let perValue = new Uint8Array(SplatDataSize32);
        let perByteLen: number = 0;

        while (true) {
            let { done, value } = await reader.read();
            if (done) break;

            if (headChunks) {
                headChunks.push(value);
                let size = 0;
                for (let i = 0; i < headChunks.length; i++) {
                    size += headChunks[i].byteLength;
                }
                if (size < BinHeaderSize + SplatDataSize20) {
                    continue;
                }
                let cnt = 0;
                for (let i = 0; i < headChunks.length; i++) {
                    if (cnt + headChunks[i].length < BinHeaderSize) {
                        headChunk.set(headChunks[i], cnt);
                        cnt += headChunks[i].length;
                    } else {
                        headChunk.set(headChunks[i].slice(0, BinHeaderSize - cnt), cnt);
                        value = new Uint8Array(headChunks[i].slice(BinHeaderSize - cnt));
                    }
                }

                const rs: any = await parseBinHeader(headChunk);
                if (!rs) {
                    model.abortController.abort();
                    model.status === ModelStatus.Fetching && (model.status = ModelStatus.Invalid);
                    console.error(`invalid bin format`);
                    break;
                }

                const header = model.parseBinHeaderData(rs);
                rowLength = header.Version === 1 ? SplatDataSize32 : header.Version === 2 ? SplatDataSize20 : SplatDataSize16;
                model.rowLength = rowLength;
                model.modelSplatCount = (dataSize / rowLength) | 0;
                !model.meta?.autoCut &&
                    (model.splatData = new Uint8Array(Math.min(model.modelSplatCount, model.opts.limitSplatCount) * SplatDataSize32));
                headChunks = null;
                headChunk = null;
            }

            if (model.binHeader.Version === 3) {
                if (perByteLen + value.byteLength < rowLength) {
                    // 不足1点不必解析
                    perValue.set(value, perByteLen);
                    perByteLen += value.byteLength;

                    bytesRead += value.length;
                    model.downloadSize = bytesRead;
                } else {
                    // 解析并设定数据
                    perByteLen = await parseBin3AndSetSplatData(model, perByteLen, perValue, value);
                    perByteLen && perValue.set(value.slice(value.byteLength - perByteLen), 0);
                }
            } else if (model.binHeader.Version === 2) {
                if (perByteLen + value.byteLength < rowLength) {
                    // 不足1点不必解析
                    perValue.set(value, perByteLen);
                    perByteLen += value.byteLength;

                    bytesRead += value.length;
                    model.downloadSize = bytesRead;
                    // model.downloadSplatCount = (bytesRead / model.rowLength) | 0;
                } else {
                    // 解析并设定数据
                    perByteLen = await parseBin2AndSetSplatData(model, perByteLen, perValue, value);
                    perByteLen && perValue.set(value.slice(value.byteLength - perByteLen), 0);
                }
            } else if (model.binHeader.Version === 1) {
                if (perByteLen + value.byteLength < rowLength) {
                    // 不足1点不必解析
                    perValue.set(value, perByteLen);
                    perByteLen += value.byteLength;

                    bytesRead += value.length;
                    model.downloadSize = bytesRead;
                    // model.downloadSplatCount = (bytesRead / model.rowLength) | 0;
                } else {
                    // 解析并设定数据
                    perByteLen = await parseSplatAndSetSplatData(model, perByteLen, perValue, value);
                    perByteLen && perValue.set(value.slice(value.byteLength - perByteLen), 0);
                }
            } else {
                model.abortController.abort();
                model.status === ModelStatus.Fetching && (model.status = ModelStatus.Invalid);
                console.error(`unsuppost bin version:`, model.binHeader.Version);
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
            model.abortController.abort();
        }
    } finally {
        model.status === ModelStatus.Fetching && (model.status = ModelStatus.FetchDone);
    }

    async function parseBin3AndSetSplatData(model: SplatModel, perByteLen: number, perValue: Uint8Array, newValue: Uint8Array): Promise<number> {
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

            const fnParseBin3 = async () => {
                if (cntSplat > maxProcessCnt) {
                    const data: Uint8Array = await parseBinToTexdata(value, maxProcessCnt, model.binHeader);
                    setSplatData(model, data);
                    model.downloadSplatCount += maxProcessCnt;
                    bytesRead += maxProcessCnt * model.rowLength;
                    model.downloadSize = bytesRead;

                    cntSplat -= maxProcessCnt;
                    value = value.slice(maxProcessCnt * model.rowLength);
                    setTimeout(fnParseBin3, 100);
                } else {
                    const data: Uint8Array = await parseBinToTexdata(value, cntSplat, model.binHeader);
                    setSplatData(model, data);
                    model.downloadSplatCount += cntSplat;
                    bytesRead += cntSplat * model.rowLength;
                    model.downloadSize = bytesRead;

                    resolve(leave);
                }
            };

            await fnParseBin3();
        });
    }

    async function parseBin2AndSetSplatData(model: SplatModel, perByteLen: number, perValue: Uint8Array, newValue: Uint8Array): Promise<number> {
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

            const fnParseBin2 = async () => {
                if (cntSplat > maxProcessCnt) {
                    const data: Uint8Array = await parseBinToTexdata(value, maxProcessCnt, model.binHeader);
                    setSplatData(model, data);
                    model.downloadSplatCount += maxProcessCnt;
                    bytesRead += maxProcessCnt * model.rowLength;
                    model.downloadSize = bytesRead;

                    cntSplat -= maxProcessCnt;
                    value = value.slice(maxProcessCnt * model.rowLength);
                    setTimeout(fnParseBin2, 100);
                } else {
                    const data: Uint8Array = await parseBinToTexdata(value, cntSplat, model.binHeader);
                    setSplatData(model, data);
                    model.downloadSplatCount += cntSplat;
                    bytesRead += cntSplat * model.rowLength;
                    model.downloadSize = bytesRead;

                    resolve(leave);
                }
            };

            await fnParseBin2();
        });
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

export function setSplatData(model: SplatModel, data: Uint8Array) {
    let isCut: boolean = !!model.meta?.autoCut;
    if (isCut && (model.opts.format === 'splat' || model.opts.format === 'sp20' || model.meta?.models?.length > 1) && !model.meta?.box) {
        isCut = false;
        model.meta.autoCut = 0; // 硬改纠正自动裁剪
        console.warn('box is not set, ignore cut');
    }
    if (!isCut) {
        !model.splatData && (model.splatData = new Uint8Array(model.opts.limitSplatCount * SplatDataSize32));
        return model.splatData.set(data, model.downloadSplatCount * SplatDataSize32);
    }

    let minX = model.binHeader?.MinX;
    let maxX = model.binHeader?.MaxX;
    let minY = model.binHeader?.MinY;
    let maxY = model.binHeader?.MaxY;
    let minZ = model.binHeader?.MinZ;
    let maxZ = model.binHeader?.MaxZ;
    if (model.meta.box) {
        minX = model.meta.box.minX;
        maxX = model.meta.box.maxX;
        minY = model.meta.box.minY;
        maxY = model.meta.box.maxY;
        minZ = model.meta.box.minZ;
        maxZ = model.meta.box.maxZ;
    }
    if (minY > maxY) {
        let t = minY;
        minY = maxY;
        maxY = t;
    }

    let autoCut: number = model.meta.autoCut; // 按推荐参数切
    autoCut = Math.max(autoCut, 2); // 至少切 4 块
    autoCut = Math.min(autoCut, 50); // 最多切 2500 块

    const f32s: Float32Array = new Float32Array(data.buffer);
    for (let i = 0, count = Math.floor(data.byteLength / SplatDataSize32), x = 0, y = 0, z = 0, key = ''; i < count; i++) {
        x = f32s[i * 8];
        y = f32s[i * 8 + 1];
        z = f32s[i * 8 + 2];
        let kx = Math.min(autoCut - 1, Math.floor((Math.max(0, x - minX) / (maxX - minX)) * autoCut));
        let kz = Math.min(autoCut - 1, Math.floor((Math.max(0, z - minZ) / (maxZ - minZ)) * autoCut));

        key = `${kx}-${kz}`;
        let cutModel = model.map.get(key);
        if (!cutModel) {
            const opts: ModelOptions = { ...model.opts };
            opts.url = key;
            opts.format = 'splat';
            opts.dataOnly = true;
            cutModel = new SplatModel(opts);
            const header = new BinHeader();
            cutModel.binHeader = header;
            header.CenterX = x;
            header.CenterY = y;
            header.CenterZ = z;
            header.MinX = x;
            header.MaxX = x;
            header.MinY = y;
            header.MaxY = y;
            header.MinZ = z;
            header.MaxZ = z;
            header.MaxRadius = 0;

            cutModel.splatData = new Uint8Array(maxProcessCnt * SplatDataSize32);
            cutModel.splatData.set(data.slice(i * SplatDataSize32, (i + 1) * SplatDataSize32), 0);
            cutModel.downloadSplatCount = 1;
            cutModel.modelSplatCount = cutModel.downloadSplatCount;
            cutModel.status = ModelStatus.FetchDone;
            model.map.set(key, cutModel);
        } else {
            if (cutModel.downloadSplatCount < model.opts.limitSplatCount - 1) {
                if (cutModel.downloadSplatCount === cutModel.splatData.byteLength / SplatDataSize32) {
                    const splatData = new Uint8Array(cutModel.splatData.byteLength + maxProcessCnt * SplatDataSize32);
                    splatData.set(cutModel.splatData, 0);
                    cutModel.splatData = splatData;
                }

                cutModel.splatData.set(data.slice(i * SplatDataSize32, (i + 1) * SplatDataSize32), cutModel.downloadSplatCount * SplatDataSize32);

                const header = cutModel.binHeader;
                header.MinX = Math.min(header.MinX, x);
                header.MaxX = Math.max(header.MaxX, x);
                header.MinY = Math.max(header.MinY, y);
                header.MaxY = Math.min(header.MaxY, y);
                header.MinZ = Math.min(header.MinZ, z);
                header.MaxZ = Math.max(header.MinZ, z);
                header.CenterX = (header.MaxX + header.MinX) / 2;
                header.CenterY = (header.MaxY + header.MinY) / 2;
                header.CenterZ = (header.MaxZ + header.MinZ) / 2;

                const sizeX = header.MaxX - header.MinX;
                const sizeY = header.MaxY - header.MinY;
                const sizeZ = header.MaxZ - header.MinZ;
                header.MaxRadius = Math.sqrt(sizeX * sizeX + sizeY * sizeY + sizeZ * sizeZ) / 2;

                cutModel.downloadSplatCount++;
                cutModel.modelSplatCount = cutModel.downloadSplatCount;
            }
        }
        model.set.add(cutModel);
    }
}
