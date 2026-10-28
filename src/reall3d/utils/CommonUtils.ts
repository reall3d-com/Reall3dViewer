// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import {
    Audio,
    BufferAttribute,
    BufferGeometry,
    Camera,
    DoubleSide,
    Frustum,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    Plane,
    ShaderChunk,
    Vector3,
    WebGLRenderer,
} from 'three';
import { XzReadableStream } from 'xz-decompress';
import { unzipSync } from 'fflate';
import { SpxHeader } from '../modeldata/ModelData';
import { SplatTileNode } from '../modeldata/SplatTiles';
import { ZstdInit } from '@oneidentity/zstd-js/wasm/decompress';

/** 是否7天内 */
export function isNeedReload(yyyymmdd: number = 0): boolean {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return yyyymmdd >= date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

export const shaderChunk = ShaderChunk;

export const decodeB64 = atob;

export function clipUint8(value: number): number {
    return value < 0 ? 0 : value > 255 ? 255 : value | 0;
}

export function encodeSplatSH(val: number): number {
    const encodeSHval = clipUint8(Math.round(val * 128) + 128);
    return clipUint8(Math.floor((encodeSHval + 4) / 8) * 8);
}

export function computeCompressionRatio(splatCount: number, bytelength: number): string {
    const plySize = 1500 + splatCount * 248;
    const compressionRatio = plySize / bytelength;
    return compressionRatio.toFixed(2) + 'x';
}

export async function DecompressGzip(data: Uint8Array): Promise<Uint8Array> {
    try {
        const stream = new ReadableStream({
            async start(controller: any) {
                controller.enqueue(data);
                controller.close();
            },
        });

        const rs = new Response(stream.pipeThrough(new DecompressionStream('gzip')));
        return new Uint8Array(await rs.arrayBuffer());
    } catch (error) {
        console.error('Decompress gzip failed:', error);
        return null;
    }
}

export async function DecompressXZ(datas: Uint8Array): Promise<Uint8Array> {
    try {
        const url = URL.createObjectURL(new Blob([datas as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }));
        const compressedResponse = await fetch(url);

        const decompressedResponse = new Response(new XzReadableStream(compressedResponse.body));
        return new Uint8Array(await decompressedResponse.arrayBuffer());
    } catch (error) {
        console.error('Decompress xz failed:', error);
        return null;
    }
}

export function showTvText(txt: string, duration: number, audio: Audio): Promise<boolean> {
    return new Promise((res, rej) => {
        const div: HTMLDivElement = document.querySelector('.tv-text');
        if (div) {
            div.innerText = txt;
            div.classList.remove('hide');
        }
        setTimeout(() => {
            clearTvText();
            if (audio.isPlaying) {
                setTimeout(() => res(true), 200);
            } else {
                rej('stop');
            }
        }, duration);
    });
}

export function clearTvText() {
    const div: HTMLDivElement = document.querySelector('.tv-text');
    if (div) {
        div.classList.add('hide');
        div.innerText = '';
    }
}

export async function data190To19(data190: Uint8Array): Promise<Uint8Array> {
    const ui32s = new Uint32Array(data190.slice(0, 12).buffer);
    const splatCount = ui32s[0];
    const size1 = ui32s[2];
    let offset = 8;
    const data1: Uint8Array = data190.subarray(offset + 4, offset + 4 + size1);
    const { rgba: rgba1 } = await webpToRgba(data1);
    offset += 4 + size1;
    const size2 = new Uint32Array(data190.slice(offset, offset + 4).buffer)[0];
    const data2: Uint8Array = data190.subarray(offset + 4, offset + 4 + size2);
    const { rgba: rgba2 } = await webpToRgba(data2);
    offset += 4 + size2;
    const size3 = new Uint32Array(data190.slice(offset, offset + 4).buffer)[0];
    const data3: Uint8Array = data190.subarray(offset + 4, offset + 4 + size3);
    const { rgba: rgba3 } = await webpToRgba(data3);
    offset += 4 + size3;
    const size4 = new Uint32Array(data190.slice(offset, offset + 4).buffer)[0];
    const data4: Uint8Array = data190.subarray(offset + 4, offset + 4 + size4);
    const { rgba: rgba4 } = await webpToRgba(data4);

    const rs = new Uint8Array(8 + splatCount * 19);
    let n = 0;
    rs[n] = data190[n++];
    rs[n] = data190[n++];
    rs[n] = data190[n++];
    rs[n] = data190[n++];
    rs[n++] = 19;
    rs[n++] = 0;
    rs[n++] = 0;
    rs[n++] = 0;

    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[i * 4 + 0]; // x0
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[i * 4 + 1]; // y0
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[i * 4 + 2]; // z0
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 4 + i * 4 + 0]; // x1
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 4 + i * 4 + 1]; // y1
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 4 + i * 4 + 2]; // z1
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 8 + i * 4 + 0]; // x2
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 8 + i * 4 + 1]; // y2
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 8 + i * 4 + 2]; // z2
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba2[i * 4 + 0]; // sx
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba2[i * 4 + 1]; // sy
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba2[i * 4 + 2]; // sz
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba3[i * 4 + 0]; // r
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba3[i * 4 + 1]; // g
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba3[i * 4 + 2]; // b
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba3[i * 4 + 3]; // a
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba4[i * 4 + 0]; // rx
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba4[i * 4 + 1]; // ry
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba4[i * 4 + 2]; // rz
    }

    return rs;
}

export async function data10190To10019(data10190: Uint8Array): Promise<Uint8Array> {
    const ui32s = new Uint32Array(data10190.slice(0, 16).buffer);
    const splatCount = ui32s[0];
    const size1 = ui32s[3];
    let offset = 12;
    const data1: Uint8Array = data10190.subarray(offset + 4, offset + 4 + size1);
    const { rgba: rgba1 } = await webpToRgba(data1);
    offset += 4 + size1;
    const size2 = new Uint32Array(data10190.slice(offset, offset + 4).buffer)[0];
    const data2: Uint8Array = data10190.subarray(offset + 4, offset + 4 + size2);
    const { rgba: rgba2 } = await webpToRgba(data2);
    offset += 4 + size2;
    const size3 = new Uint32Array(data10190.slice(offset, offset + 4).buffer)[0];
    const data3: Uint8Array = data10190.subarray(offset + 4, offset + 4 + size3);
    const { rgba: rgba3 } = await webpToRgba(data3);
    offset += 4 + size3;
    const size4 = new Uint32Array(data10190.slice(offset, offset + 4).buffer)[0];
    const data4: Uint8Array = data10190.subarray(offset + 4, offset + 4 + size4);
    const { rgba: rgba4 } = await webpToRgba(data4);

    const rs = new Uint8Array(8 + splatCount * 19);
    let n = 0;
    rs[n] = data10190[n++]; // 数量保持不变
    rs[n] = data10190[n++];
    rs[n] = data10190[n++];
    rs[n] = data10190[n++];
    rs[n++] = 35; // 格式转10019[35, 39, 0, 0]
    rs[n++] = 39;
    rs[n++] = 0;
    rs[n++] = 0;
    rs[n] = data10190[n++]; // log编码次数保持不变
    rs[n] = data10190[n++];
    rs[n] = data10190[n++];
    rs[n] = data10190[n++];

    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[i * 4 + 0]; // x0
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[i * 4 + 1]; // y0
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[i * 4 + 2]; // z0
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 4 + i * 4 + 0]; // x1
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 4 + i * 4 + 1]; // y1
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 4 + i * 4 + 2]; // z1
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 8 + i * 4 + 0]; // x2
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 8 + i * 4 + 1]; // y2
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba1[splatCount * 8 + i * 4 + 2]; // z2
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba2[i * 4 + 0]; // sx
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba2[i * 4 + 1]; // sy
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba2[i * 4 + 2]; // sz
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba3[i * 4 + 0]; // r
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba3[i * 4 + 1]; // g
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba3[i * 4 + 2]; // b
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba3[i * 4 + 3]; // a
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba4[i * 4 + 0]; // rx
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba4[i * 4 + 1]; // ry
    }
    for (let i = 0; i < splatCount; i++) {
        rs[n++] = rgba4[i * 4 + 2]; // rz
    }

    return rs;
}

export async function data220Decode(data220: Uint8Array, hasSh: boolean): Promise<Uint8Array> {
    const ui32s = new Uint32Array(data220.slice(0, 12).buffer);
    const splatCount = ui32s[0];
    const size1 = ui32s[2];
    let offset = 8;
    const data1: Uint8Array = data220.subarray(offset + 4, offset + 4 + size1);
    const { rgba: rgbaPosition } = await webpToRgba(data1);
    offset += 4 + size1;
    const size2 = new Uint32Array(data220.slice(offset, offset + 4).buffer)[0];
    const data2: Uint8Array = data220.subarray(offset + 4, offset + 4 + size2);
    const { rgba: rgbaScale } = await webpToRgba(data2);
    offset += 4 + size2;
    const size3 = new Uint32Array(data220.slice(offset, offset + 4).buffer)[0];
    const data3: Uint8Array = data220.subarray(offset + 4, offset + 4 + size3);
    const { rgba: rgbaColor } = await webpToRgba(data3);
    offset += 4 + size3;
    const size4 = new Uint32Array(data220.slice(offset, offset + 4).buffer)[0];
    const data4: Uint8Array = data220.subarray(offset + 4, offset + 4 + size4);
    const { rgba: rgbaRotation } = await webpToRgba(data4);

    const rs = new Uint8Array(8 + splatCount * (hasSh ? 28 : 24));
    rs.set(data220.subarray(0, 8)); // 数量格式保持不变
    let start = 8;
    rs.set(rgbaPosition.subarray(0, splatCount * 12), start);
    start += splatCount * 12;
    rs.set(rgbaScale.subarray(0, splatCount * 4), start);
    start += splatCount * 4;
    rs.set(rgbaColor.subarray(0, splatCount * 4), start);
    start += splatCount * 4;
    rs.set(rgbaRotation.subarray(0, splatCount * 4), start);
    if (hasSh) {
        offset += 4 + size4;
        const size5 = new Uint32Array(data220.slice(offset, offset + 4).buffer)[0];
        const data5: Uint8Array = data220.subarray(offset + 4, offset + 4 + size5);
        const { rgba } = await webpToRgba(data5);

        start += splatCount * 4;
        rs.set(rgba.subarray(0, splatCount * 4), start);
    }
    return rs;
}

export async function decodeWebpBlockDatas(webpBlockDatas: Uint8Array): Promise<Uint8Array> {
    const ui32s = new Uint32Array(webpBlockDatas.slice(0, 4).buffer);
    const splatCount = ui32s[0];
    let offset = 8;

    const rgbas: Uint8Array[] = [];
    while (offset < webpBlockDatas.length) {
        const size = new Uint32Array(webpBlockDatas.slice(offset, offset + 4).buffer)[0];
        const webpBytes: Uint8Array = webpBlockDatas.subarray(offset + 4, offset + 4 + size);
        const { rgba } = await webpToRgba(webpBytes);
        rgbas.push(rgba);
        offset += 4 + size;
    }

    const rs = new Uint8Array(8 + splatCount * 4 * rgbas.length);
    rs.set(webpBlockDatas.subarray(0, 8)); // 数量格式保持不变
    for (let i = 0, start = 8; i < rgbas.length; i++) {
        rs.set(rgbas[i].subarray(0, splatCount * 4), start);
        start += splatCount * 4;
    }
    return rs;
}

export async function sh123To1(data123: Uint8Array): Promise<Uint8Array> {
    const ui32s = new Uint32Array(data123.slice(0, 8).buffer);
    const splatCount = ui32s[0];
    const data1: Uint8Array = data123.subarray(8);
    const { rgba } = await webpToRgba(data1);

    const rs = new Uint8Array(8 + splatCount * 9);
    let n = 0;
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n++] = 1;
    rs[n++] = 0;
    rs[n++] = 0;
    rs[n++] = 0;

    for (let i = 0; i < splatCount; i++) {
        for (let j = 0; j < 3; j++) {
            rs[n++] = rgba[i * 60 + j * 4 + 0];
            rs[n++] = rgba[i * 60 + j * 4 + 1];
            rs[n++] = rgba[i * 60 + j * 4 + 2];
        }
    }
    return rs;
}

export async function sh123To2(data123: Uint8Array): Promise<Uint8Array> {
    const ui32s = new Uint32Array(data123.slice(0, 8).buffer);
    const splatCount = ui32s[0];
    const data1: Uint8Array = data123.subarray(8);
    const { rgba } = await webpToRgba(data1);

    const rs = new Uint8Array(8 + splatCount * 24);
    let n = 0;
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n++] = 2;
    rs[n++] = 0;
    rs[n++] = 0;
    rs[n++] = 0;

    for (let i = 0; i < splatCount; i++) {
        for (let j = 0; j < 8; j++) {
            rs[n++] = rgba[i * 60 + j * 4 + 0];
            rs[n++] = rgba[i * 60 + j * 4 + 1];
            rs[n++] = rgba[i * 60 + j * 4 + 2];
        }
    }
    return rs;
}

export async function sh123To3(data123: Uint8Array): Promise<Uint8Array> {
    const ui32s = new Uint32Array(data123.slice(0, 8).buffer);
    const splatCount = ui32s[0];
    const data1: Uint8Array = data123.subarray(8);
    const { rgba } = await webpToRgba(data1);

    const rs = new Uint8Array(8 + splatCount * 21);
    let n = 0;
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n] = data123[n++];
    rs[n++] = 3;
    rs[n++] = 0;
    rs[n++] = 0;
    rs[n++] = 0;

    for (let i = 0; i < splatCount; i++) {
        for (let j = 8; j < 15; j++) {
            rs[n++] = rgba[i * 60 + j * 4 + 0];
            rs[n++] = rgba[i * 60 + j * 4 + 1];
            rs[n++] = rgba[i * 60 + j * 4 + 2];
        }
    }
    return rs;
}

export async function webpToRgba(webps: Uint8Array): Promise<{ width: number; height: number; rgba: Uint8Array }> {
    if (!webps) return { width: 0, height: 0, rgba: new Uint8Array(0) };
    const blob = new Blob([webps as any], { type: 'image/webp' });
    const url = URL.createObjectURL(blob);
    const bmp = await createImageBitmap(await fetch(url).then(r => r.blob()));
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const imData = ctx.getImageData(0, 0, bmp.width, bmp.height);
    const width = bmp.width;
    const height = bmp.height;
    bmp.close();
    URL.revokeObjectURL(url);
    return { width, height, rgba: imData.data as any };
}

export function unzipToMap(zipBytes: Uint8Array): Map<string, Uint8Array> {
    const map = new Map<string, Uint8Array>();

    try {
        const entries = unzipSync(zipBytes);
        for (const [filename, file] of Object.entries(entries)) {
            if (file) {
                const content = new Uint8Array(file);
                map.set(filename, content);
            }
        }
    } catch (error) {
        console.error('解压失败:', error);
    }

    return map;
}

export function uint8ArrayToString(uint8Array: Uint8Array): string {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(uint8Array);
}

export function logEncode(v: number): number {
    return Math.sign(v) * Math.log(Math.abs(v) + 1);
}

export function logDecode(v: number): number {
    return Math.sign(v) * (Math.exp(v) - 1);
}

export function loopByTime(fnRun: Function, fnIsContinue: Function = null, delay: number = 20) {
    const run = () => {
        fnRun();
        fnIsContinue?.() && setTimeout(run, delay);
    };
    run();
}

const frustum = new Frustum();
const projScreenMatrix = new Matrix4();
const viewMatrix = new Matrix4();
export function isInFrustum(camera: Camera, point: Vector3) {
    viewMatrix.copy(camera.matrixWorld).invert();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, viewMatrix);
    frustum.setFromProjectionMatrix(projScreenMatrix);
    return frustum.containsPoint(point);
}

export function isInverted(header: SpxHeader) {
    return ((header?.Flags || 0) & 0b10000000) > 0;
}

// 工具：从 viewProjMatrix 提取6个视锥体平面
export function extractFrustumPlanes(matrix: Matrix4, planes: Plane[]): void {
    const m = matrix.elements;
    let i = 0;
    // 近平面 (z = -w)
    planes[i++].set(new Vector3(m[3] + m[2], m[7] + m[6], m[11] + m[10]), m[15] + m[14]).normalize();
    // 左平面 (x = -w)
    planes[i++].set(new Vector3(m[3] + m[0], m[7] + m[4], m[11] + m[8]), m[15] + m[12]).normalize();
    // 右平面 (x = w)
    planes[i++].set(new Vector3(m[3] - m[0], m[7] - m[4], m[11] - m[8]), m[15] - m[12]).normalize();
    // 底平面 (y = -w)
    planes[i++].set(new Vector3(m[3] + m[1], m[7] + m[5], m[11] + m[9]), m[15] + m[13]).normalize();
    // 顶平面 (y = w)
    planes[i++].set(new Vector3(m[3] - m[1], m[7] - m[5], m[11] - m[9]), m[15] - m[13]).normalize();
    // 远平面 (z = w)
    planes[i++].set(new Vector3(m[3] - m[2], m[7] - m[6], m[11] - m[10]), m[15] - m[14]).normalize();
}

const v3Tmp = new Vector3();
export function computeSplatNodeDistance(planes: Plane[], node: SplatTileNode) {
    const v3Center = v3Tmp.fromArray(node.center);
    const distance = planes[0].distanceToPoint(v3Center); // 按近截面计算距离
    return distance >= 0 ? Math.max(0, distance - node.radius) : Math.min(0, distance + node.radius);
}
export function computeSplatNodeCameraDistance(cameraPosition: Vector3, node: SplatTileNode) {
    const distance = v3Tmp.fromArray(node.center).distanceTo(cameraPosition);
    return distance >= 0 ? Math.max(0, distance - node.radius) : Math.min(0, distance + node.radius);
}

export function getUrl(url: string, baseUrl: string): string {
    try {
        return url?.startsWith('blob:') ? baseUrl : baseUrl ? new URL(url, baseUrl).href : url;
    } catch (e) {
        return url;
    }
}

export function addDynamicStyles(css: string) {
    const id = 'reall3dviewer-joystick-styles';
    if (!css || document.getElementById(id)) return;
    const styleElement = document.createElement('style');
    styleElement.id = id;
    styleElement.appendChild(document.createTextNode(css));
    document.head.appendChild(styleElement);
}

export function sleep(msTime: number = 0) {
    return new Promise<number>(resolve => setTimeout(() => resolve(msTime), msTime));
}

export function saveUint8ArrayAsFile(uint8Array: Uint8Array, fileName: string) {
    const blob = new Blob([uint8Array as any], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function saveJsonAsFile(json: object | string, fileName: string = 'jsonfile.json') {
    const jsonStr = typeof json === 'string' ? JSON.stringify(JSON.parse(json), null, 2) : JSON.stringify(json, null, 2);

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// 当前扩充标准为候选阶段，无压缩，实际应用可能不合适，仅简单试验支持，忽略SH
export function glbKhrGs2Splat(glbBytes: Uint8Array): Uint8Array {
    const jsonLength = new Uint32Array(glbBytes.slice(0, 32).buffer)[3];
    const oJson = JSON.parse(new TextDecoder().decode(glbBytes.slice(20, 20 + jsonLength)));
    const positionIdx: number = oJson.meshes[0].primitives[0].attributes['POSITION'];
    const scaleIdx: number = oJson.meshes[0].primitives[0].attributes['KHR_gaussian_splatting:SCALE'];
    const sh0Idx: number = oJson.meshes[0].primitives[0].attributes['KHR_gaussian_splatting:SH_DEGREE_0_COEF_0'];
    const opacityIdx: number = oJson.meshes[0].primitives[0].attributes['KHR_gaussian_splatting:OPACITY'];
    const rotationIdx: number = oJson.meshes[0].primitives[0].attributes['KHR_gaussian_splatting:ROTATION'];

    const f32sGlb = new Float32Array(glbBytes.buffer);
    const byteLength1 = 20 + jsonLength + 8;
    const offsetPosition = (byteLength1 + oJson.bufferViews[positionIdx].byteOffset) / 4;
    const offsetScale = (byteLength1 + oJson.bufferViews[scaleIdx].byteOffset) / 4;
    const offsetRGB = (byteLength1 + oJson.bufferViews[sh0Idx].byteOffset) / 4;
    const offsetA = (byteLength1 + oJson.bufferViews[opacityIdx].byteOffset) / 4;
    const offsetRotation = (byteLength1 + oJson.bufferViews[rotationIdx].byteOffset) / 4;

    const splatCount: number = oJson.accessors[0].count;
    const ui8sResult = new Uint8Array(splatCount * 32);
    const f32s = new Float32Array(ui8sResult.buffer);

    for (let i = 0; i < splatCount; i++) {
        f32s[8 * i + 0] = f32sGlb[offsetPosition + 3 * i + 0];
        f32s[8 * i + 1] = f32sGlb[offsetPosition + 3 * i + 1];
        f32s[8 * i + 2] = f32sGlb[offsetPosition + 3 * i + 2];
        f32s[8 * i + 3] = Math.exp(f32sGlb[offsetScale + 3 * i + 0]);
        f32s[8 * i + 4] = Math.exp(f32sGlb[offsetScale + 3 * i + 1]);
        f32s[8 * i + 5] = Math.exp(f32sGlb[offsetScale + 3 * i + 2]);
        ui8sResult[32 * i + 24] = encodeSplatColor(f32sGlb[offsetRGB + 3 * i + 0]);
        ui8sResult[32 * i + 25] = encodeSplatColor(f32sGlb[offsetRGB + 3 * i + 1]);
        ui8sResult[32 * i + 26] = encodeSplatColor(f32sGlb[offsetRGB + 3 * i + 2]);
        ui8sResult[32 * i + 27] = encodeSplatOpacity(f32sGlb[offsetA + i]);
        ui8sResult[32 * i + 28] = encodeSplatRotation(f32sGlb[offsetRotation + 4 * i + 3]);
        ui8sResult[32 * i + 29] = encodeSplatRotation(f32sGlb[offsetRotation + 4 * i + 0]);
        ui8sResult[32 * i + 30] = encodeSplatRotation(f32sGlb[offsetRotation + 4 * i + 1]);
        ui8sResult[32 * i + 31] = encodeSplatRotation(f32sGlb[offsetRotation + 4 * i + 2]);
    }
    return ui8sResult;
}

const SH_C0 = 0.28209479177387814;
function encodeSplatColor(f: number): number {
    return Math.max(0, Math.min(255, Math.floor((0.5 + SH_C0 * f) * 255.0)));
}
function encodeSplatOpacity(f: number): number {
    return Math.max(0, Math.min(255, Math.floor((1.0 / (1.0 + Math.exp(-f))) * 255.0)));
}
function encodeSplatRotation(f: number): number {
    return Math.max(0, Math.min(255, Math.floor(f * 128.0 + 128.0)));
}

export function calcPartDepthRange(width: number, height: number, splatOffset: number, splatCount: number) {
    const bytesPerPixel = 16; // RGBA32UI 每个像素固定 16 字节
    const pixelsPerDepthLayer = width * height; // 单个深度层的像素数量
    const startPixel = (splatOffset * 32) / bytesPerPixel; // 起始像素索引
    const endPixel = startPixel + (splatCount * 32) / bytesPerPixel - 1; // 结束像素索引
    const startDepth = Math.floor(startPixel / pixelsPerDepthLayer); // 起始深度层
    const endDepth = Math.floor(endPixel / pixelsPerDepthLayer); // 结束深度层
    return { startDepth, endDepth };
}

// 创建扇形三角面网格
export function createTriangleMesh(points: number[], options = {}): Mesh {
    const config = Object.assign(
        {
            color: 0xff0000,
            side: DoubleSide,
            depthTest: true,
            depthWrite: true,
            transparent: false,
            opacity: 1.0,
        },
        options,
    );

    const geometry = new BufferGeometry();

    geometry.setAttribute('position', new BufferAttribute(new Float32Array(points), 3));

    const vertexCount = Math.floor(points.length / 3);
    const faceCount = vertexCount - 2;

    const indexArray = new Uint16Array(faceCount * 3);
    for (let i = 0; i < faceCount; i++) {
        indexArray[i * 3] = 0;
        indexArray[i * 3 + 1] = i + 1;
        indexArray[i * 3 + 2] = i + 2;
    }

    geometry.setIndex(new BufferAttribute(indexArray, 1));
    geometry.computeBoundingSphere();

    const material = new MeshBasicMaterial(config);
    const mesh = new Mesh(geometry, material);

    return mesh;
}

export function extractSplatXYZ(downloadData: Uint8Array): Float32Array {
    const pointCount = downloadData.length / 32;
    const xyz = new Float32Array(pointCount * 3);
    const f32Source = new Float32Array(downloadData.buffer, downloadData.byteOffset, pointCount * 8);

    for (let i = 0; i < pointCount; i++) {
        const srcIdx = i * 8;
        const tgtIdx = i * 3;
        xyz[tgtIdx] = f32Source[srcIdx]; // x
        xyz[tgtIdx + 1] = f32Source[srcIdx + 1]; // y
        xyz[tgtIdx + 2] = f32Source[srcIdx + 2]; // z
    }
    return xyz;
}

let zstdSimple: any;
let initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
    if (zstdSimple) return Promise.resolve();
    if (initPromise) return initPromise;

    initPromise = ZstdInit().then(({ ZstdSimple }) => {
        zstdSimple = ZstdSimple;
    });
    return initPromise;
}

export async function decompressZstd(zstdBytes: Uint8Array): Promise<Uint8Array> {
    await ensureInit();
    return zstdSimple.decompress(zstdBytes);
}

export function allocTest(renderer: WebGLRenderer, width: number, height: number, layers: number) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA32UI, width, height, layers, 0, gl.RGBA_INTEGER, gl.UNSIGNED_INT, null);
    return gl.getError() === gl.NO_ERROR;
}

// 不含header_end
export function isPointCloudPly(header: string) {
    const oSet = new Set<string>(['x', 'y', 'z', 'red', 'green', 'blue']);
    for (let prop of header.split('\n').filter(k => k.startsWith('property '))) {
        oSet.delete(prop.split(' ')[2]);
    }
    return !oSet.size;
}

export interface RgbPly {
    count: number;
    plyBytes: Uint8Array;
    xyzs: Float32Array;
    minY: number;
    maxY: number;
}

export async function parseRgbPly(webpBts: Uint8Array): Promise<RgbPly> {
    const { rgba } = await webpToRgba(webpBts);
    const count = new Uint32Array(rgba.slice(0, 4).buffer)[0] & 0xffffff;
    const xyzrgbBts = rgba.subarray(4);

    const head = [
        'ply',
        'format binary_little_endian 1.0',
        `element vertex ${count}`,
        'property float x',
        'property float y',
        'property float z',
        'property uchar red',
        'property uchar green',
        'property uchar blue',
        'end_header\n',
    ];
    const ui8sHead = new TextEncoder().encode(head.join('\n'));
    const headLen = ui8sHead.length;

    const totalLen = headLen + count * 15;
    const plyBytes = new Uint8Array(totalLen);
    plyBytes.set(ui8sHead, 0);

    const tempBuf = new ArrayBuffer(4);
    const tempF32 = new Float32Array(tempBuf);
    const tempU8 = new Uint8Array(tempBuf);

    const c4 = count * 4;
    const c8 = count * 8;
    const c12 = count * 12;

    let minY: number = Number.MAX_VALUE;
    let maxY: number = -Number.MAX_VALUE;
    const xyzs = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const i4 = i * 4;
        const base = headLen + i * 15;

        const x0 = xyzrgbBts[i4];
        const x1 = xyzrgbBts[c4 + i4];
        const x2 = xyzrgbBts[c8 + i4];
        const y0 = xyzrgbBts[i4 + 1];
        const y1 = xyzrgbBts[c4 + i4 + 1];
        const y2 = xyzrgbBts[c8 + i4 + 1];
        const z0 = xyzrgbBts[i4 + 2];
        const z1 = xyzrgbBts[c4 + i4 + 2];
        const z2 = xyzrgbBts[c8 + i4 + 2];

        let fx = x0 | (x1 << 8) | (x2 << 16);
        let fy = y0 | (y1 << 8) | (y2 << 16);
        let fz = z0 | (z1 << 8) | (z2 << 16);
        fx = fx & 0x800000 ? fx | 0xff000000 : fx;
        fy = fy & 0x800000 ? fy | 0xff000000 : fy;
        fz = fz & 0x800000 ? fz | 0xff000000 : fz;

        // XYZ
        tempF32[0] = fx / 4096;
        xyzs[i * 3] = tempF32[0];
        plyBytes.set(tempU8, base);
        tempF32[0] = fy / 4096;
        minY = Math.min(minY, tempF32[0]);
        maxY = Math.max(maxY, tempF32[0]);
        xyzs[i * 3 + 1] = tempF32[0];
        plyBytes.set(tempU8, base + 4);
        tempF32[0] = fz / 4096;
        xyzs[i * 3 + 2] = tempF32[0];
        plyBytes.set(tempU8, base + 8);
        // RGB
        plyBytes[base + 12] = xyzrgbBts[c12 + i4];
        plyBytes[base + 13] = xyzrgbBts[c12 + i4 + 1];
        plyBytes[base + 14] = xyzrgbBts[c12 + i4 + 2];
    }

    return { count, plyBytes, xyzs, minY, maxY };
}

export function downloadUint8ArrayFile(uint8Array, fileName = 'data.bin') {
    const blob = new Blob([uint8Array], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

export class Queue<T> {
    private readonly ary: T[]; // 队列存储数组
    private inIdx = 0; // 入队下标
    private outIdx = 0; // 出队下标
    private maxSize: number; // 队列最大容量
    private cnt = 0; // 当前元素数量

    constructor(size = 32) {
        this.maxSize = Math.max(32, Math.min(size | 0, 10240));
        this.ary = new Array(this.maxSize); // 必须预先分配固定长度数组
    }

    /** 入队 */
    public add(item: T): boolean {
        if (item === undefined) return false;

        // 队列满了，不能添加！防止覆盖
        if (this.isFull()) {
            return false;
        }

        this.ary[this.inIdx] = item;
        this.inIdx = (this.inIdx + 1) % this.maxSize; // 环形进位
        this.cnt++; // 记录元素数量
        return true;
    }

    /** 出队 */
    public get(): T | undefined {
        // 队列空，直接返回
        if (this.isEmpty()) {
            return undefined;
        }

        const rs = this.ary[this.outIdx];

        this.ary[this.outIdx] = undefined; // 清空释放引用
        this.outIdx = (this.outIdx + 1) % this.maxSize;
        this.cnt--;

        return rs;
    }

    /** 查看队首元素 */
    public peek(): T | undefined {
        if (this.isEmpty()) return undefined;
        return this.ary[this.outIdx];
    }

    /** 队列是否已满 */
    public isFull(): boolean {
        return this.cnt === this.maxSize;
    }

    /** 队列是否为空 */
    public isEmpty(): boolean {
        return this.cnt === 0;
    }

    /** 当前元素数量 */
    public get count(): number {
        return this.cnt;
    }

    /** 最大容量 */
    public get capacity(): number {
        return this.maxSize;
    }
}

let hdlSpeedTimeout: any;
export function showSpeedText(txt: string) {
    hdlSpeedTimeout && clearInterval(hdlSpeedTimeout);
    const div: HTMLDivElement = document.querySelector('.speed-text');
    if (div) {
        div.innerText = txt;
        div.classList.remove('hide');
    }
    hdlSpeedTimeout = setTimeout(() => {
        div?.classList.add('hide');
    }, 1000);
}

export function isString(val: any): boolean {
    return Object.prototype.toString.call(val) === '[object String]';
}
