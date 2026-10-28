// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { DataArrayTexture } from 'three';
import { GetDataArrayTexture, OnSplatLodFullUploaded } from '../../events/EventConstants';
import { Events } from '../../events/Events';
import { SplatFile } from '../../modeldata/SplatTiles';
import { calcPartDepthRange, extractSplatXYZ, sleep } from '../../utils/CommonUtils';

export class SplatGpuCache {
    protected disposed = false;
    protected events: Events;
    private layerWidth: number;
    private layerHeight: number;
    private fullCache: boolean;
    private texture: DataArrayTexture;
    private offset: number = 0;
    private dataCount: number = 0;

    constructor(events: Events, width: number, height: number, depth: number, dataCount: number, fullCache: boolean) {
        const that = this;
        that.events = events;
        that.layerWidth = width;
        that.layerHeight = height;
        that.dataCount = dataCount;
        that.fullCache = fullCache;
        that.texture = events.fire(GetDataArrayTexture);
        events.on(OnSplatLodFullUploaded, () => (that.texture.image.data = null));
    }

    public async uploadSplatFile(file: SplatFile) {
        const that = this;
        that.fullCache ? await that.uploadSplatFileFull(file) : await that.uploadSplatFilePart(file);
    }

    protected async uploadSplatFileFull(file: SplatFile) {
        const that = this;
        if (that.disposed || file.textureReady) return; // 需要检查避免已就绪又重新上传

        file.textureReady = false;
        const { startDepth, endDepth } = calcPartDepthRange(that.layerWidth, that.layerHeight, that.offset, file.downloadCount);
        const dataArrayTexture = that.texture;
        const downloadData = file.downloadData.subarray(0, file.downloadCount * 32);
        const ui8sTex = new Uint8Array(dataArrayTexture.image.data.buffer);
        ui8sTex.set(downloadData, that.offset * 32);

        await new Promise<void>(resolve => {
            for (let i = startDepth; i <= endDepth; i++) dataArrayTexture.addLayerUpdate(i);
            dataArrayTexture.onUpdate = () => resolve();
            dataArrayTexture.needsUpdate = true;
        });

        file.xyz = extractSplatXYZ(downloadData);
        file.downloadData = null;

        file.lastTime = Math.max(Date.now(), file.lastTime);
        file.offset = that.offset;
        file.textureReady = true;
        that.offset += file.downloadCount;
        that.offset >= that.dataCount && that.events.tryFire(OnSplatLodFullUploaded);
    }

    protected async uploadSplatFilePart(file: SplatFile) {
        const that = this;
        if (that.disposed || file.textureReady) return; // 避免就绪重新上传

        file.textureReady = false;
        await that.updateLayer(file);
        file.lastTime = Math.max(Date.now(), file.lastTime);
        file.textureReady = true;
    }

    protected async updateLayer(file: SplatFile) {
        const that = this;
        file.offset = (that.layerWidth * that.layerHeight * file.targetLayer) / 2;

        const dataArrayTexture = that.texture;
        const downloadData = file.downloadData.subarray(0, file.downloadCount * 32);
        const ui8sTex = new Uint8Array(dataArrayTexture.image.data.buffer);
        ui8sTex.set(downloadData, file.offset * 32);

        await new Promise<void>(resolve => {
            dataArrayTexture.addLayerUpdate(file.targetLayer);
            dataArrayTexture.onUpdate = () => resolve();
            dataArrayTexture.needsUpdate = true;
        });

        file.downloadData = null;
    }

    public dispose() {
        const that = this;
        if (that.disposed) return;
        that.disposed = true;
        that.texture = null;
    }
}
