// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import './reall3d/assets/style/style.less';
import 'virtual:svg-icons-register';

import { Reall3dViewer } from './reall3d/viewer/Reall3dViewer';
import { Reall3dViewerOptions } from './reall3d/viewer/Reall3dViewerOptions';
import { Reall3dMapViewer } from './reall3d/mapviewer/Reall3dMapViewer';
import { globalEv } from './reall3d/events/GlobalEV';
import { StopBgAudio } from './reall3d/events/EventConstants';
import { TransitionEffects } from './reall3d/meshs/splatmesh/SplatMeshOptions';
import { isMobile } from './reall3d/utils/GlobalConstants';

const params: URLSearchParams = new URLSearchParams(location.search);
let url = params.get('url');
const debugMode = !!params.get('debug');

const shDegree = 3;

let viewer: Reall3dViewer;
let mapViewer: Reall3dMapViewer;
if (url) {
    viewer = new Reall3dViewer({ debugMode, shDegree });
    url.endsWith('.scene.json') ? viewer.addScene(url) : viewer.addModel(url);
    debugMode && initDevMode(true);
} else {
    viewer = new Reall3dViewer({ debugMode: true, shDegree });
    // viewer.addModel(`https://reall3d.com/demo-models/hornedlizard.v3.spx`);
    viewer.addModel(`https://reall3d.com/demo-models/hornedlizard.v3.glb`); // KHR_gaussian_splatting_compression_spz_2
    // viewer.addModel(`https://reall3d.com/demo-models/yz.spx`);
    // viewer.addModel(`https://reall3d.com/demo-models/yz.glb`); // KHR_gaussian_splatting

    // viewer.addScene(`https://reall3d.com/demo-models/lod-v1/hgd/hgd-lod.scene.json`);
    // viewer.addScene(`https://reall3d.com/demo-models/lod-v1/hgd/hgd-lod-fpv.scene.json`);
    // viewer.addScene(`https://reall3d.com/demo-models/lod-v1/hgd/hgd-lod-tpv.scene.json`);
    // viewer.addScene(`https://reall3d.com/demo-models/lod-metas/hgd/hgd-lod-meta-tpv.scene.json`);

    initDevMode();
}

// 以下仅开发模式使用
function initDevMode(infoOnly = false) {
    let spans: NodeListOf<HTMLSpanElement> = document.querySelectorAll('#gsviewer .operation span');
    let jsHeapSizeLimit = (performance['memory'] || { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 }).jsHeapSizeLimit;
    !jsHeapSizeLimit && document.querySelectorAll('.tr-memory').forEach(dom => dom.classList.toggle('hidden'));
    isMobile && document.querySelectorAll('.tr-pc-only').forEach(dom => dom.classList.toggle('hidden'));
    document.querySelectorAll('.dev-panel').forEach(dom => dom['style'].removeProperty('display'));
    !infoOnly &&
        Array.from(spans).forEach(span => {
            span.addEventListener('click', function (e: MouseEvent) {
                let target: HTMLSpanElement = e.target as HTMLSpanElement;
                fnClick(target.className);
            });
        });
    infoOnly && document.querySelectorAll('.operation').forEach(dom => (dom['style'].display = 'none'));

    const gstext: HTMLInputElement = document.querySelector('.gstext');
    if (gstext) {
        gstext.addEventListener('keyup', function (e: Event) {
            viewer && window['$api']?.setWaterMark(gstext.value, false);
        });
    }
}

let lightFactor = 1.0;
function fnClick(className: string) {
    if (className == 'switch-debug') {
        let txt = document.querySelector('#gsviewer .debug').classList.toggle('hidden') ? '＋' : '－';
        document.querySelector('#gsviewer .switch-debug').innerHTML = txt;
    } else if (className == 'op-show') {
        let txt = document.querySelector('#gsviewer .operation table').classList.toggle('plus') ? '＋' : '－';
        document.querySelector('#gsviewer .op-show').innerHTML = txt;
    } else if (className == 'demo1') {
        viewer?.dispose();
        mapViewer?.dispose();
        viewer = viewer || new Reall3dViewer();
        viewer.reset({ debugMode: true });
        setTimeout(() => viewer.addModel(`https://reall3d.com/demo-models/yz.spx`), 50); // Let it GC
    } else if (className == 'demo3') {
        viewer?.dispose();
        mapViewer?.dispose();
        viewer = viewer || new Reall3dViewer();
        viewer.reset({ debugMode: true });
        setTimeout(() => viewer.addModel(`https://reall3d.com/demo-models/djj.spx`), 50); // Let it GC
    } else if (className == 'lod') {
        viewer?.dispose();
        mapViewer?.dispose();
        viewer = viewer || new Reall3dViewer();
        viewer.reset({ debugMode: true });
        setTimeout(() => viewer.addScene(`https://reall3d.com/demo-models/lod-metas/hgd/hgd-lod-meta.scene.json`), 50); // Let it GC
    } else if (className == 'lff-house') {
        viewer?.dispose();
        mapViewer?.dispose();
        viewer = viewer || new Reall3dViewer();
        viewer.reset({ debugMode: true, transitionEffect: TransitionEffects.ScreenCenterCircle });
        setTimeout(() => viewer.addModel(`https://reall3d.com/demo-models/tijerin-hobbit-2.5m.spx`), 50); // Let it GC
    } else if (className == 'switch-rotate') {
        let opts: Reall3dViewerOptions = viewer?.options();
        viewer?.options({ autoRotate: !opts.autoRotate });
    } else if (className == 'switch-pointcloudMode') {
        viewer?.options({ pointcloudMode: !viewer?.options().pointcloudMode });
    } else if (className == 'switch-deiplay-mode') {
        viewer?.switchDeiplayMode();
    } else if (className == 'add-lightFactor') {
        lightFactor += 0.1;
        viewer?.options({ lightFactor });
    } else if (className == 'default-lightFactor') {
        viewer?.options({ lightFactor: 1 });
    } else if (className == 'sub-lightFactor') {
        lightFactor -= 0.1;
        viewer?.options({ lightFactor });
    } else if (className == 'show-watermark') {
        viewer?.fire(1, 1);
    } else if (className == 'hide-watermark') {
        viewer?.fire(1, 0);
    } else if (className == 'mark-show') {
        viewer?.options({ markVisible: true });
    } else if (className == 'mark-hide') {
        viewer?.options({ markVisible: false });
    } else if (className == 'mark-save') {
        viewer?.fire(6);
    } else if (className == 'mark-del') {
        viewer?.fire(7);
    } else if (className == 'mark-point') {
        viewer?.options({ markMode: true, markType: 'point' });
    } else if (className == 'mark-lines') {
        viewer?.options({ markMode: true, markType: 'lines' });
    } else if (className == 'mark-plans') {
        viewer?.options({ markMode: true, markType: 'plans' });
    } else if (className == 'mark-distance') {
        viewer?.options({ markMode: true, markType: 'distance' });
    } else if (className == 'mark-circle') {
        viewer?.options({ markMode: true, markType: 'circle' });
    } else if (className.includes('add-pos')) {
        viewer?.fire(2);
        mapViewer?.fire(2);
    } else if (className.includes('flying')) {
        viewer?.fire(3);
        mapViewer?.fire(3);
    } else if (className.includes('clear-pos')) {
        viewer?.fire(4);
        mapViewer?.fire(4);
    } else if (className.includes('fly-save')) {
        viewer?.fire(5);
        mapViewer?.fire(5);
    } else if (className == 'add-sh') {
        viewer?.fire(8, 1);
    } else if (className == 'default-sh') {
        viewer?.fire(8);
    } else if (className == 'sub-sh') {
        viewer?.fire(8, -1);
    } else if (className == 'add-quality') {
        viewer?.fire(9, 1);
    } else if (className == 'default-quality') {
        viewer?.fire(9);
    } else if (className == 'sub-quality') {
        viewer?.fire(9, -1);
    } else if (className == 'add-sorttype') {
        viewer?.fire(10, 1);
    } else if (className == 'default-sorttype') {
        viewer?.fire(10);
    } else if (className == 'sub-sorttype') {
        viewer?.fire(10, -1);
    } else if (className == 'map') {
        viewer?.dispose();
        mapViewer?.dispose();
        viewer = null;
        document.querySelector('.debug.dev-panel')?.classList?.add('map');
        document.querySelector('#map')?.classList?.remove('hidden');
        mapViewer = new Reall3dMapViewer({ debugMode: true });
        mapViewer.addScenes('https://reall3d.com/demo-models/map/00.scenes.json');
    }
}
