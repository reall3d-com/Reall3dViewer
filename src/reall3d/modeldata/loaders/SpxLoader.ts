// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Vector3 } from 'three';
import { SplatDataSize20, SpxOpenFormat0, SpxExclusiveFormatReall3d } from '../../utils/GlobalConstants';
import { parseSpxBlockData, parseSpxHeader } from '../wasm/WasmParser';
import { ModelStatus, SplatModel, SpxHeader } from '../ModelData';
import { computeCompressionRatio, DecompressGzip, DecompressXZ } from '../../utils/CommonUtils';

/** Specify the Recognizable Formats Here */
const ExclusiveFormats: number[] = [SpxOpenFormat0, SpxExclusiveFormatReall3d];
const SpxHeaderSize = 128;

export async function loadSpx(model: SplatModel) {
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
        const dataSize = contentLength - SpxHeaderSize;
        if (dataSize < SplatDataSize20) {
            console.warn('data empty', model.opts.url);
            model.status === ModelStatus.Fetching && (model.status = ModelStatus.Invalid);
            return;
        }

        model.fileSize = contentLength;

        // let rowLength: number;
        let headChunks: Uint8Array[] = [];
        let headChunk = new Uint8Array(SpxHeaderSize);
        let perValue = new Uint8Array(32);
        let perByteLen: number = 0;
        let readBlockSize = false;
        let blockSize: number = 0;
        let fetchedBlockSize: number = 0;
        let blockValues: Uint8Array[];
        let isCompress = false;
        let compressType: number = 0; // 0:gzip, 1:xz

        while (true) {
            let { done, value } = await reader.read();
            if (done) break;

            model.downloadSize += value.byteLength;

            if (headChunks) {
                headChunks.push(value);
                let size = 0;
                for (let i = 0; i < headChunks.length; i++) {
                    size += headChunks[i].byteLength;
                }
                if (size < SpxHeaderSize) {
                    continue;
                }

                let cnt = 0;
                for (let i = 0; i < headChunks.length; i++) {
                    if (cnt + headChunks[i].byteLength < SpxHeaderSize) {
                        headChunk.set(headChunks[i], cnt);
                        cnt += headChunks[i].byteLength;
                    } else {
                        headChunk.set(headChunks[i].subarray(0, SpxHeaderSize - cnt), cnt);
                        value = new Uint8Array(headChunks[i].slice(SpxHeaderSize - cnt));
                    }
                }

                // 解析头数据
                const h: SpxHeader = await parseSpxHeader(headChunk);
                if (!h) {
                    model.abortController.abort();
                    model.status === ModelStatus.Fetching && (model.status = ModelStatus.Invalid);
                    console.error(`invalid spx format`);
                    continue;
                }

                model.header = h;
                model.CompressionRatio = computeCompressionRatio(h.SplatCount, contentLength);
                model.modelSplatCount = h.SplatCount;
                model.dataShDegree = h.ShDegree;
                model.aabbCenter = new Vector3((h.MinX + h.MaxX) / 2, (h.MinY + h.MaxY) / 2, (h.MinZ + h.MaxZ) / 2);
                model.maxRadius = 0.5 * Math.sqrt(Math.pow(h.MaxX - h.MinX, 2) + Math.pow(h.MaxY - h.MinY, 2) + Math.pow(h.MaxZ - h.MinZ, 2));
                model.metaMatrix && model.aabbCenter.applyMatrix4(model.metaMatrix);
                headChunks = null;
                headChunk = null;

                // 文件头检查校验
                if (!ExclusiveFormats.includes(h.ExclusiveId)) {
                    // 属于无法识别的格式时停止处理，或者进一步结合CreaterId判断是否能识别，避免后续出现数据解析错误
                    model.abortController.abort();
                    model.status = ModelStatus.Invalid;
                    console.error(`Unrecognized format, creater id =`, h.CreaterId, ', exclusive id =', h.ExclusiveId, h.Comment);
                    continue;
                }
            }

            // 读取块大小
            if (!readBlockSize) {
                if (perByteLen + value.byteLength < 4) {
                    perValue.set(value, perByteLen);
                    perByteLen += value.byteLength;
                    continue;
                }

                const ui8s = new Uint8Array(perByteLen + value.byteLength);
                ui8s.set(perValue.subarray(0, perByteLen), 0);
                ui8s.set(value, perByteLen);
                value = ui8s.slice(4);

                perByteLen = 0;
                readBlockSize = true;
                blockValues = [];
                fetchedBlockSize = 0;

                const i32 = new Int32Array(ui8s.slice(0, 4).buffer)[0];
                isCompress = i32 < 0; // 负数代表压缩
                compressType = (Math.abs(i32) >> 28) >>> 0; // 高位2~4位代表压缩方式
                blockSize = (Math.abs(i32) << 4) >>> 4; // 低位供28位代表块数据长度
            }

            // 块数据不足时，暂存
            let totalSize = fetchedBlockSize + value.byteLength;
            blockValues.push(value);
            if (totalSize < blockSize) {
                fetchedBlockSize += value.byteLength;
                continue;
            }

            // 解析块数据
            while (totalSize >= blockSize) {
                let ui8sBlock: Uint8Array = new Uint8Array(blockSize);
                let offset = 0;
                for (let i = 0; i < blockValues.length; i++) {
                    if (offset + blockValues[i].byteLength < blockSize) {
                        ui8sBlock.set(blockValues[i], offset);
                        offset += blockValues[i].byteLength;
                    } else {
                        ui8sBlock.set(blockValues[i].subarray(0, blockSize - offset), offset);
                        value = new Uint8Array(blockValues[i].slice(blockSize - offset)); // 剩余部分，可能足够长包含多块
                    }
                }

                if (isCompress) {
                    if (compressType === 0) {
                        ui8sBlock = await DecompressGzip(ui8sBlock);
                    } else if (compressType === 1) {
                        ui8sBlock = await DecompressXZ(ui8sBlock);
                    } else {
                        console.error('unsuported compress type:', compressType);
                    }
                }
                const spxBlock = await parseSpxBlockData(ui8sBlock, model.header);
                if (!spxBlock.success) {
                    console.error('spx block data parser failed. block format:', spxBlock.blockFormat);
                    model.abortController.abort();
                    model.status = ModelStatus.Invalid;
                    break;
                }

                if (spxBlock.isSplat) {
                    model.downloadSplatCount += spxBlock.splatCount;
                    setBlockSplatData(model, spxBlock.datas);
                } else if (spxBlock.palettes) {
                    model.palettes = spxBlock.palettes; // 调色板
                } else {
                    const maxSplatDataCnt = Math.min(model.fetchLimit, model.modelSplatCount);
                    if (spxBlock.isSh23) {
                        if (model.sh12Count + spxBlock.splatCount > maxSplatDataCnt) {
                            const cnt = maxSplatDataCnt - model.sh12Count;
                            model.sh12Data.push(spxBlock.datas.slice(0, cnt * 16));
                            model.sh12Count += cnt;
                        } else {
                            model.sh12Data.push(spxBlock.datas);
                            model.sh12Count += spxBlock.splatCount;
                        }

                        if (model.sh3Count + spxBlock.splatCount > maxSplatDataCnt) {
                            const cnt = maxSplatDataCnt - model.sh3Count;
                            model.sh3Data.push(spxBlock.dataSh3.slice(0, cnt * 16));
                            model.sh3Count += cnt;
                        } else {
                            model.sh3Data.push(spxBlock.dataSh3);
                            model.sh3Count += spxBlock.splatCount;
                        }
                    } else if (spxBlock.isSh3) {
                        if (model.sh3Count + spxBlock.splatCount > maxSplatDataCnt) {
                            const cnt = maxSplatDataCnt - model.sh3Count;
                            model.sh3Data.push(spxBlock.datas.slice(0, cnt * 16));
                            model.sh3Count += cnt;
                        } else {
                            model.sh3Data.push(spxBlock.datas);
                            model.sh3Count += spxBlock.splatCount;
                        }
                    } else {
                        if (model.sh12Count + spxBlock.splatCount > maxSplatDataCnt) {
                            const cnt = maxSplatDataCnt - model.sh12Count;
                            model.sh12Data.push(spxBlock.datas.slice(0, cnt * 16));
                            model.sh12Count += cnt;
                        } else {
                            model.sh12Data.push(spxBlock.datas);
                            model.sh12Count += spxBlock.splatCount;
                        }
                    }
                }

                if (value.byteLength < 4) {
                    // 剩余不足以读取下一个块长度，缓存起来待继续下载
                    perValue.set(value, 0);
                    perByteLen = value.byteLength;
                    readBlockSize = false; // 下回应读取块大小
                    break;
                } else {
                    // 读取块大小，并整理供继续解析（剩余数据要么还足够多个块，要么不足得继续下载）
                    const i32 = new Int32Array(value.slice(0, 4).buffer)[0];
                    isCompress = i32 < 0; // 负数代表压缩
                    compressType = (Math.abs(i32) >> 28) >>> 0; // 高位2~4位代表压缩方式
                    blockSize = (Math.abs(i32) << 4) >>> 4; // 低位供28位代表块数据长度

                    value = value.slice(4);
                    totalSize = value.byteLength;
                    blockValues = [value];
                    fetchedBlockSize = value.byteLength;
                }
            }

            // 超过限制时终止下载
            const limitCnt = model.fetchLimit;
            if (model.header.Version < 3 && model.header.ShDegree === 3) {
                model.downloadSplatCount >= limitCnt && model.sh12Count >= limitCnt && model.sh3Count >= limitCnt && model.abortController.abort();
            } else if (model.header.Version < 3 && model.header.ShDegree) {
                model.downloadSplatCount >= limitCnt && model.sh12Count >= limitCnt && model.abortController.abort();
            } else {
                model.downloadSplatCount >= limitCnt && model.abortController.abort();
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            console.log('Fetch Abort', model.opts.url);
            model.status === ModelStatus.Fetching && (model.status = ModelStatus.FetchAborted);
        } else {
            console.error(e);
            model.status === ModelStatus.Fetching && (model.status = ModelStatus.FetchFailed);
            model.abortController.abort();
        }
    } finally {
        model.status === ModelStatus.Fetching && (model.status = ModelStatus.FetchDone);
    }
}

function setBlockSplatData(model: SplatModel, data: Uint8Array) {
    let dataCnt = data.byteLength / 32;
    const stepCnt = 4096;
    const maxSplatDataCnt = Math.min(model.fetchLimit, model.modelSplatCount);
    !model.splatData && (model.splatData = new Uint8Array(maxSplatDataCnt * 32));
    !model.watermarkData && (model.watermarkData = new Uint8Array(0));
    if (model.dataSplatCount + dataCnt > maxSplatDataCnt) {
        dataCnt = maxSplatDataCnt - model.dataSplatCount; // 丢弃超出限制的部分
        if (!dataCnt) return;
    }

    // 计算当前半径
    const f32s: Float32Array = new Float32Array(data.buffer);
    const ui32s: Uint32Array = new Uint32Array(data.buffer);
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

        if (ui32s[i * 8 + 3] & 65536) {
            if (model.watermarkCount * 32 === model.watermarkData.byteLength) {
                const watermarkData = new Uint8Array((model.watermarkCount + stepCnt) * 32);
                watermarkData.set(model.watermarkData, 0);
                model.watermarkData = watermarkData;
            }
            model.watermarkData.set(data.subarray(i * 32, i * 32 + 32), model.watermarkCount++ * 32);
        } else {
            model.splatData.set(data.subarray(i * 32, i * 32 + 32), model.dataSplatCount++ * 32);
        }
    }

    const topY = model.header.MinTopY || 0;
    model.currentRadius = Math.sqrt(model.maxX * model.maxX + topY * topY + model.maxZ * model.maxZ); // 当前模型数据范围离高点的最大半径
}
