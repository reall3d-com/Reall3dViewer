// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Events } from '../events/Events';
import { setupApi } from './SetupApi';
import { setupCameraControls } from './SetupCameraControls';
import { setupFlying } from './SetupFlying';
import { setupViewerEventListener } from './SetupViewerEventListener';
import { setupMark } from '../meshs/mark/SetupMark';
import { setupCommonUtils } from './SetupCommonUtils';
import { setupViewerUtils } from './SetupViewerUtils';
import { setupFocusMarker } from './SetupFocusMarker';
import { setupRaycaster } from './SetupRaycaster';
import { setupMapUtils } from './SetupMapUtils';
import { setupMapEventListener } from './SetupMapEventListener';
import { setupControlPlane } from './SetupControlPlane';
import { setupWorkerSort } from '../modeldata/worker/SetupWorkerSort';
import { setupSplatMesh } from '../meshs/splatmesh/SetupSplatMesh';
import { setupGaussianText } from './SetupGaussianText';
import { setupWorkerFetch } from '../modeldata/worker/SetupWorkerFetch';
import { setupCustomUtils } from '../utils/CustomUtils';
import { setupDataManager } from '../modeldata/SetupDataManager';
import { setupWorkerLod } from '../modeldata/worker/SetupWorkerLod';

export function setupAllEventsVerwer(events: Events) {
    setupCommonUtils(events);
    setupCustomUtils(events);
    setupViewerUtils(events);
    setupApi(events);
    setupCameraControls(events);
    setupMark(events);
    setupViewerEventListener(events);
    setupRaycaster(events);
    setupFocusMarker(events);
    setupFlying(events);
    setupControlPlane(events);
}

export function setupAllEventsMapVerwer(events: Events) {
    setupCommonUtils(events);
    setupCustomUtils(events);
    setupApi(events);
    setupMapUtils(events);
    setupRaycaster(events);
    setupFlying(events);
    setupMark(events);
    setupMapEventListener(events);
}

export function setupAllEventsSplatMesh(events: Events) {
    setupCommonUtils(events);
    setupApi(events);
    setupDataManager(events);
    setupWorkerLod(events);
    setupWorkerFetch(events);
    setupWorkerSort(events);
    setupSplatMesh(events);
    setupGaussianText(events);
}
