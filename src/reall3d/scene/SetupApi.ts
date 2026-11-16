// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import {
    CaptureScreenshot,
    FlyDisable,
    Flying,
    GetControls,
    GetFlyingParameters,
    GetMeta,
    GetOptions,
    GetOrignMetaString,
    GetSceneCameraInfo,
    GetScreenshotBase64,
    MarkUpdateVisible,
    SetViewerApi,
    SplatSetPointcloudMode,
    SplatSwitchDisplayMode,
    StartAutoRotate,
    StopAutoRotate,
} from '../events/EventConstants';
import { Events } from '../events/Events';
import { MetaData } from '../modeldata/MetaData';
import { Reall3dViewerOptions } from '../viewer/Reall3dViewerOptions';
import { CameraControls } from './SetupCameraControls';
export function setupApi(events: Events) {
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    on(SetViewerApi, () => {
        const $api = {} as any;

        $api.startRotate = () => fire(StartAutoRotate);
        $api.stopRotate = () => fire(StopAutoRotate);
        $api.showMarks = () => fire(MarkUpdateVisible, true);
        $api.hideMarks = () => fire(MarkUpdateVisible, false);
        $api.changePointCloudMode = (pointcloudMode = true) => {
            const opts: Reall3dViewerOptions = fire(GetOptions);
            if (opts.pointcloudMode === pointcloudMode) return;
            opts.bigSceneMode ? fire(SplatSetPointcloudMode, pointcloudMode) : fire(SplatSwitchDisplayMode);
        };
        $api.flying = () => fire(Flying, true);

        $api.switchAutoRotate = () => {
            setTimeout(() => window.focus());
            fire(FlyDisable);
            fire(GetControls).autoRotate = fire(GetOptions).autoRotate = !fire(GetOptions).autoRotate;
        };

        $api.resetPosition = () => {
            const opts: Reall3dViewerOptions = {};
            const meta: MetaData = fire(GetMeta);
            if (meta?.cameraInfo) {
                opts.position = [...meta.cameraInfo.position];
                opts.lookAt = [...meta.cameraInfo.lookAt];
                opts.lookUp = [...meta.cameraInfo.lookUp];
            } else {
                const options: Reall3dViewerOptions = fire(GetOptions);
                opts.position = options.position ? [...options.position] : [0, -5, 15];
                opts.lookAt = options.lookAt ? [...options.lookAt] : [0, 0, 0];
                opts.lookUp = options.lookUp ? [...options.lookUp] : [0, -1, 0];
            }
            fire(StopAutoRotate);
            const controls: CameraControls = fire(GetControls);
            controls.updateByOptions(opts);
        };

        $api.getScreenshotBase64 = () => fire(GetScreenshotBase64);
        $api.getOrignMetaString = () => fire(GetOrignMetaString);
        $api.getFlyingParameters = () => fire(GetFlyingParameters);
        $api.getSceneCameraInfo = () => fire(GetSceneCameraInfo);

        window['$api'] = $api;
    });
}
