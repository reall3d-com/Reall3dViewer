// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import {
    CaptureScreenshot,
    Flying,
    GetOptions,
    MarkUpdateVisible,
    SetViewerApi,
    SplatSetPointcloudMode,
    SplatSwitchDisplayMode,
    StartAutoRotate,
    StopAutoRotate,
} from '../events/EventConstants';
import { Events } from '../events/Events';
import { Reall3dViewerOptions } from '../viewer/Reall3dViewerOptions';
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
        $api.fly = () => fire(Flying, true);

        $api.captureScreenshot = () => fire(CaptureScreenshot);

        window['$api'] = $api;
    });
}
