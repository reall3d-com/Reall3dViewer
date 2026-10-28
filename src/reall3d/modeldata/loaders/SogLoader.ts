// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Vector3 } from 'three';
import { clipUint8, computeCompressionRatio, uint8ArrayToString, unzipToMap, webpToRgba } from '../../utils/CommonUtils';
import { isMobile, MaxProcessCnt, SH_C0, SpxBlockFormatSH2, SpxBlockFormatSH3 } from '../../utils/GlobalConstants';
import { ModelStatus, SplatModel } from '../ModelData';
import { parseSplatToTexdata, parseSpxBlockData } from '../wasm/WasmParser';
import { loadFile } from './FileLoader';

const SQRT2 = Math.sqrt(2.0);

export async function loadSog(model: SplatModel) {
    try {
        model.status = ModelStatus.Fetching;
        if (model.opts.url.startsWith('blob:') || model.opts.url.endsWith('.sog')) {
            // 必须完全下载后，才能得知模型点数等基本信息
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
            model.fileSize = contentLength;
            model.downloadSize = 0;
            model.downloadSplatCount = 0;
            model.watermarkData = new Uint8Array(0);

            const datas = new Uint8Array(contentLength);
            while (true) {
                let { done, value } = await reader.read();
                if (done) break;
                datas.set(value, model.downloadSize);
                model.downloadSize += value.length;
            }

            const mapFile: Map<string, Uint8Array> = unzipToMap(datas);
            const meta = JSON.parse(uint8ArrayToString(mapFile.get('meta.json')));
            const modelSplatCount: number = meta.count || meta.means.shape[0];
            model.modelSplatCount = modelSplatCount;
            model.CompressionRatio = computeCompressionRatio(modelSplatCount, contentLength);
            model.sogVersion = meta.version ? meta.version : 1;

            await parseSog(model, mapFile, meta);
        } else {
            // 先下载meta.json，解析后再下载关联文件，都成功完成后再继续处理。（多文件，挺讨厌，下载必须完全成功，如何设定.meta.json?）
            const response = await fetch(model.opts.url, { mode: 'cors', credentials: 'omit', cache: 'reload' });
            if (response.status != 200) return console.error(`fetch error: ${response.status}`);
            const meta: any = await response.json();

            const ary = model.opts.url.split('/');
            const mapFile: Map<string, Uint8Array> = new Map();
            const modelSplatCount: number = meta.count || meta.means.shape[0];
            model.modelSplatCount = modelSplatCount;

            const meansuName = meta.means.files[0];
            ary[ary.length - 1] = meansuName;
            const meansuUrl = ary.join('/');
            const meanslName = meta.means.files[1];
            ary[ary.length - 1] = meanslName;
            const meanslUrl = ary.join('/');
            const scalesName = meta.scales.files[0];
            ary[ary.length - 1] = scalesName;
            const scalesUrl = ary.join('/');
            const quatsName = meta.quats.files[0];
            ary[ary.length - 1] = quatsName;
            const quatsUrl = ary.join('/');
            const sh0Name = meta.sh0.files[0];
            ary[ary.length - 1] = sh0Name;
            const sh0Url = ary.join('/');
            const centroidsName = meta.shN ? meta.shN.files[0] : 'shN_centroids.webp';
            ary[ary.length - 1] = centroidsName;
            const centroidsUrl = ary.join('/');
            const labelsName = meta.shN ? meta.shN.files[1] : 'shN_labels.webp';
            ary[ary.length - 1] = labelsName;
            const labelsUrl = ary.join('/');

            const [meansu, meansl, scales, quats, sh0, centroids, labels] = await Promise.all([
                loadFile(meansuUrl),
                loadFile(meanslUrl),
                loadFile(scalesUrl),
                loadFile(quatsUrl),
                loadFile(sh0Url),
                loadFile(meta.shN ? centroidsUrl : ''),
                loadFile(meta.shN ? labelsUrl : ''),
            ]);

            mapFile.set(meansuName, meansu);
            mapFile.set(meanslName, meansl);
            mapFile.set(scalesName, scales);
            mapFile.set(quatsName, quats);
            mapFile.set(sh0Name, sh0);
            mapFile.set(centroidsName, centroids);
            mapFile.set(labelsName, labels);
            const totalSize =
                JSON.stringify(meta).length + meansu.length + meansl.length + scales.length + quats.length + sh0.length + centroids.length + labels.length;

            model.fileSize = totalSize;
            model.downloadSize = totalSize;
            model.watermarkData = new Uint8Array(0);

            model.CompressionRatio = computeCompressionRatio(modelSplatCount, totalSize);
            model.sogVersion = meta.version ? meta.version : 1;

            await parseSog(model, mapFile, meta);
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
}

async function parseSog(model: SplatModel, mapFile: Map<string, Uint8Array>, meta: any) {
    const isV1 = !meta.version || meta.version === 1;
    const cntSplat: number = isV1 ? meta.means.shape[0] : meta.count;
    const limitCnt = Math.min(cntSplat, model.fetchLimit);
    const shDegree = meta.shN ? meta.shN.bands || 3 : 0;
    const splatData = new Uint8Array(limitCnt * 32);
    model.modelSplatCount = cntSplat;
    model.dataShDegree = shDegree;
    model.splatData = splatData;

    const { rgba: meansl } = await webpToRgba(mapFile.get(meta.means.files[0]));
    const { rgba: meansu } = await webpToRgba(mapFile.get(meta.means.files[1]));
    const { rgba: scales } = await webpToRgba(mapFile.get(meta.scales.files[0]));
    const { rgba: quats } = await webpToRgba(mapFile.get(meta.quats.files[0]));
    const { rgba: sh0 } = await webpToRgba(mapFile.get(meta.sh0.files[0]));
    const { rgba: centroids, width } = meta.shN ? await webpToRgba(mapFile.get(meta.shN.files[0])) : { rgba: null, width: 0 };
    const { rgba: labels } = meta.shN ? await webpToRgba(mapFile.get(meta.shN.files[1])) : { rgba: null };

    if (shDegree > 0 && centroids?.byteLength && !isV1) {
        if (width == 960) {
            const palettes = new Uint8Array(centroids.length);
            for (let i = 0; i < centroids.length; i++) {
                i % 4 < 3 && (palettes[i] = clipUint8(Math.round(meta.shN.codebook[centroids[i]] * 128.0) + 128.0));
            }
            model.palettes = palettes;
        } else {
            const dim = width == 96 ? 3 : 8;
            const cnt = meta.shN.count || centroids.length / 4 / dim;
            const palettes = new Uint8Array(cnt * 15 * 4);
            palettes.fill(128);
            for (let i = 0, n = 0; i < cnt; i++) {
                const offset = i * dim;
                for (let j = 0; j < dim; j++) {
                    palettes[n * 4 + 0] = clipUint8(Math.round(meta.shN.codebook[centroids[(offset + j) * 4 + 0]] * 128.0) + 128.0);
                    palettes[n * 4 + 1] = clipUint8(Math.round(meta.shN.codebook[centroids[(offset + j) * 4 + 1]] * 128.0) + 128.0);
                    palettes[n * 4 + 2] = clipUint8(Math.round(meta.shN.codebook[centroids[(offset + j) * 4 + 2]] * 128.0) + 128.0);
                    n++;
                }
                n += 15 - dim;
            }
            model.palettes = palettes;
        }
    }

    while (limitCnt > model.dataSplatCount) {
        const data: Uint8Array = isV1 ? await parseSogV1(model.dataSplatCount) : await parseSogV2(model.dataSplatCount);
        model.splatData.set(data.subarray(0), model.dataSplatCount * 32);
        updateModelMinMax(model, data);
        model.dataSplatCount += data.byteLength / 32;
        model.downloadSplatCount = model.dataSplatCount;
    }

    async function parseSogV2(startCnt: number): Promise<Uint8Array> {
        const maxCnt = Math.min(startCnt + MaxProcessCnt, limitCnt);
        const processCnt = maxCnt - startCnt;

        const ui8sData = new Uint8Array(processCnt * 32);
        const f32sData = new Float32Array(ui8sData.buffer);

        for (let i = startCnt, n = 0; i < maxCnt; i++) {
            let fx = ((meansu[i * 4 + 0] << 8) | meansl[i * 4 + 0]) / 65535;
            let fy = ((meansu[i * 4 + 1] << 8) | meansl[i * 4 + 1]) / 65535;
            let fz = ((meansu[i * 4 + 2] << 8) | meansl[i * 4 + 2]) / 65535;
            let x = meta.means.mins[0] + (meta.means.maxs[0] - meta.means.mins[0]) * fx;
            let y = meta.means.mins[1] + (meta.means.maxs[1] - meta.means.mins[1]) * fy;
            let z = meta.means.mins[2] + (meta.means.maxs[2] - meta.means.mins[2]) * fz;
            x = Math.sign(x) * (Math.exp(Math.abs(x)) - 1);
            y = Math.sign(y) * (Math.exp(Math.abs(y)) - 1);
            z = Math.sign(z) * (Math.exp(Math.abs(z)) - 1);

            let sx = Math.exp(meta.scales.codebook[scales[i * 4 + 0]]);
            let sy = Math.exp(meta.scales.codebook[scales[i * 4 + 1]]);
            let sz = Math.exp(meta.scales.codebook[scales[i * 4 + 2]]);

            const { rw, rx, ry, rz } = decodeSogRotations(quats[i * 4], quats[i * 4 + 1], quats[i * 4 + 2], quats[i * 4 + 3]);

            let r = meta.sh0.codebook[sh0[i * 4 + 0]];
            let g = meta.sh0.codebook[sh0[i * 4 + 1]];
            let b = meta.sh0.codebook[sh0[i * 4 + 2]];
            let a = sh0[i * 4 + 3];

            f32sData[n * 8 + 0] = x;
            f32sData[n * 8 + 1] = y;
            f32sData[n * 8 + 2] = z;
            f32sData[n * 8 + 3] = sx;
            f32sData[n * 8 + 4] = sy;
            f32sData[n * 8 + 5] = sz;
            ui8sData[n * 32 + 24] = clipUint8((0.5 + SH_C0 * r) * 255);
            ui8sData[n * 32 + 25] = clipUint8((0.5 + SH_C0 * g) * 255);
            ui8sData[n * 32 + 26] = clipUint8((0.5 + SH_C0 * b) * 255);
            ui8sData[n * 32 + 27] = a;
            ui8sData[n * 32 + 28] = clipUint8(rw * 128.0 + 128.0);
            ui8sData[n * 32 + 29] = clipUint8(rx * 128.0 + 128.0);
            ui8sData[n * 32 + 30] = clipUint8(ry * 128.0 + 128.0);
            ui8sData[n * 32 + 31] = clipUint8(rz * 128.0 + 128.0);
            n++;
        }

        const rs = await parseSplatToTexdata(ui8sData, processCnt);
        if (shDegree > 0 && labels?.byteLength) {
            for (let i = 0; i < processCnt; i++) {
                rs[i * 32 + 12] = labels[(i + startCnt) * 4];
                rs[i * 32 + 13] = labels[(i + startCnt) * 4 + 1];
            }
        }
        return rs;
    }

    function updateModelMinMax(model: SplatModel, data: Uint8Array) {
        // 计算当前半径，增量数据中继续计算即可
        const dataCnt = data.byteLength / 32;
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

        const topY = 0;
        model.currentRadius = Math.sqrt(model.maxX * model.maxX + topY * topY + model.maxZ * model.maxZ); // 当前模型数据范围离高点的最大半径
        model.aabbCenter = new Vector3((model.minX + model.maxX) / 2, (model.minY + model.maxY) / 2, (model.minZ + model.maxZ) / 2);
        model.maxRadius = 0.5 * Math.sqrt(Math.pow(model.maxX - model.minX, 2) + Math.pow(model.maxY - model.minY, 2) + Math.pow(model.maxZ - model.minZ, 2));
        model.metaMatrix && model.aabbCenter.applyMatrix4(model.metaMatrix);
    }

    function decodeSogRotations(b0: number, b1: number, b2: number, bi: number) {
        let r0 = (b0 / 255 - 0.5) * SQRT2;
        let r1 = (b1 / 255 - 0.5) * SQRT2;
        let r2 = (b2 / 255 - 0.5) * SQRT2;
        let ri = Math.sqrt(Math.max(0, 1.0 - r0 * r0 - r1 * r1 - r2 * r2));
        let idx = bi - 252;
        let rw: number, rx: number, ry: number, rz: number;
        if (idx == 0) {
            rw = ri;
            rx = r0;
            ry = r1;
            rz = r2;
        } else if (idx == 1) {
            rw = r0;
            rx = ri;
            ry = r1;
            rz = r2;
        } else if (idx == 2) {
            rw = r0;
            rx = r1;
            ry = ri;
            rz = r2;
        } else {
            rw = r0;
            rx = r1;
            ry = r2;
            rz = ri;
        }

        return { rw, rx, ry, rz };
    }

    // 此版本已淘汰，不再维护
    async function parseSogV1(startCnt: number): Promise<Uint8Array> {
        const maxCnt = Math.min(startCnt + MaxProcessCnt, limitCnt);
        const processCnt = maxCnt - startCnt;

        const ui8sData = new Uint8Array(processCnt * 32);
        const f32sData = new Float32Array(ui8sData.buffer);

        for (let i = startCnt, n = 0; i < maxCnt; i++) {
            let fx = ((meansu[i * 4 + 0] << 8) | meansl[i * 4 + 0]) / 65535;
            let fy = ((meansu[i * 4 + 1] << 8) | meansl[i * 4 + 1]) / 65535;
            let fz = ((meansu[i * 4 + 2] << 8) | meansl[i * 4 + 2]) / 65535;
            let x = meta.means.mins[0] + (meta.means.maxs[0] - meta.means.mins[0]) * fx;
            let y = meta.means.mins[1] + (meta.means.maxs[1] - meta.means.mins[1]) * fy;
            let z = meta.means.mins[2] + (meta.means.maxs[2] - meta.means.mins[2]) * fz;
            x = Math.sign(x) * (Math.exp(Math.abs(x)) - 1);
            y = Math.sign(y) * (Math.exp(Math.abs(y)) - 1);
            z = Math.sign(z) * (Math.exp(Math.abs(z)) - 1);

            let sx = scales[i * 4 + 0] / 255;
            let sy = scales[i * 4 + 1] / 255;
            let sz = scales[i * 4 + 2] / 255;
            sx = Math.exp(meta.scales.mins[0] + (meta.scales.maxs[0] - meta.scales.mins[0]) * sx);
            sy = Math.exp(meta.scales.mins[1] + (meta.scales.maxs[1] - meta.scales.mins[1]) * sy);
            sz = Math.exp(meta.scales.mins[2] + (meta.scales.maxs[2] - meta.scales.mins[2]) * sz);

            let r0 = (quats[i * 4 + 0] / 255 - 0.5) * SQRT2;
            let r1 = (quats[i * 4 + 1] / 255 - 0.5) * SQRT2;
            let r2 = (quats[i * 4 + 2] / 255 - 0.5) * SQRT2;
            let ri = Math.sqrt(Math.max(0, 1.0 - r0 * r0 - r1 * r1 - r2 * r2));
            let idx = quats[i * 4 + 3] - 252;
            let rw: number, rx: number, ry: number, rz: number;
            if (idx == 0) {
                rw = ri;
                rx = r0;
                ry = r1;
                rz = r2;
            } else if (idx == 1) {
                rw = r0;
                rx = ri;
                ry = r1;
                rz = r2;
            } else if (idx == 2) {
                rw = r0;
                rx = r1;
                ry = ri;
                rz = r2;
            } else {
                rw = r0;
                rx = r1;
                ry = r2;
                rz = ri;
            }
            let r = meta.sh0.mins[0] + (meta.sh0.maxs[0] - meta.sh0.mins[0]) * (sh0[i * 4 + 0] / 255);
            let g = meta.sh0.mins[1] + (meta.sh0.maxs[1] - meta.sh0.mins[1]) * (sh0[i * 4 + 1] / 255);
            let b = meta.sh0.mins[2] + (meta.sh0.maxs[2] - meta.sh0.mins[2]) * (sh0[i * 4 + 2] / 255);
            let a = meta.sh0.mins[3] + (meta.sh0.maxs[3] - meta.sh0.mins[3]) * (sh0[i * 4 + 3] / 255);

            f32sData[n * 8 + 0] = x;
            f32sData[n * 8 + 1] = y;
            f32sData[n * 8 + 2] = z;
            f32sData[n * 8 + 3] = sx;
            f32sData[n * 8 + 4] = sy;
            f32sData[n * 8 + 5] = sz;
            ui8sData[n * 32 + 24] = clipUint8((0.5 + SH_C0 * r) * 255);
            ui8sData[n * 32 + 25] = clipUint8((0.5 + SH_C0 * g) * 255);
            ui8sData[n * 32 + 26] = clipUint8((0.5 + SH_C0 * b) * 255);
            ui8sData[n * 32 + 27] = clipUint8((1.0 / (1.0 + Math.exp(-a))) * 255);
            ui8sData[n * 32 + 28] = clipUint8(rw * 128.0 + 128.0);
            ui8sData[n * 32 + 29] = clipUint8(rx * 128.0 + 128.0);
            ui8sData[n * 32 + 30] = clipUint8(ry * 128.0 + 128.0);
            ui8sData[n * 32 + 31] = clipUint8(rz * 128.0 + 128.0);
            n++;
        }

        if (shDegree > 0) {
            const u2s = new Uint32Array(2);
            u2s[0] = processCnt;
            u2s[1] = SpxBlockFormatSH2;
            const ui8sSH2 = new Uint8Array(8 + processCnt * 24);
            ui8sSH2.set(new Uint8Array(u2s.buffer), 0);

            const u3s = new Uint32Array(2);
            u3s[0] = processCnt;
            u3s[1] = SpxBlockFormatSH3;
            const ui8sSH3 = new Uint8Array(8 + processCnt * 21);
            ui8sSH3.set(new Uint8Array(u3s.buffer), 0);

            for (let i = startCnt, n = 0; i < maxCnt; i++) {
                const label = labels[i * 4 + 0] + (labels[i * 4 + 1] << 8);
                const col = (label & 63) * 15;
                const row = label >> 6;
                const offset = row * width + col;

                const sh1 = new Uint8Array(9);
                const sh2 = new Uint8Array(15);
                const sh3 = new Uint8Array(21);
                let shValue: number;
                for (let d = 0; d < 3; d++) {
                    for (let k = 0; k < 3; k++) {
                        shValue = ((meta.shN.maxs - meta.shN.mins) * centroids[(offset + k) * 4 + d]) / 255.0 + meta.shN.mins;
                        sh1[k * 3 + d] = clipUint8(Math.round(shValue * 128.0) + 128.0);
                    }
                    for (let k = 0; k < 5; k++) {
                        shValue = ((meta.shN.maxs - meta.shN.mins) * centroids[(offset + 3 + k) * 4 + d]) / 255.0 + meta.shN.mins;
                        sh2[k * 3 + d] = clipUint8(Math.round(shValue * 128.0) + 128.0);
                    }
                    for (let k = 0; k < 7; k++) {
                        shValue = ((meta.shN.maxs - meta.shN.mins) * centroids[(offset + 8 + k) * 4 + d]) / 255.0 + meta.shN.mins;
                        sh3[k * 3 + d] = clipUint8(Math.round(shValue * 128.0) + 128.0);
                    }
                }
                ui8sSH2.set(sh1, 8 + n * 24);
                ui8sSH2.set(sh2, 8 + n * 24 + 9);
                ui8sSH3.set(sh3, 8 + n * 21);
                n++;
            }

            const sh2Block = await parseSpxBlockData(ui8sSH2);
            model.sh12Data.push(sh2Block.datas);
            const sh3Block = await parseSpxBlockData(ui8sSH3);
            model.sh3Data.push(sh3Block.datas);
        }

        return await parseSplatToTexdata(ui8sData, processCnt);
    }
}
