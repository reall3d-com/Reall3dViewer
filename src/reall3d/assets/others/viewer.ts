// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import '../style/style.less';
import 'virtual:svg-icons-register';

import { Reall3dViewer } from '../../viewer/Reall3dViewer';

// 接收url参数并打开，无参数不处理
// 适用于纯净方式渲染指定链接的模型场景
document.addEventListener('DOMContentLoaded', async () => {
    window.focus();

    const params: URLSearchParams = new URLSearchParams(location.search);
    let url = params.get('url');
    let viewer = new Reall3dViewer({ shDegree: 3 });
    if (url?.indexOf('.scene.json') > 0 || url?.indexOf('lod-meta.json') >= 0 || url?.indexOf('.lod.json') > 0) {
        await viewer.addScene(url);
    } else if (url) {
        await viewer.addModel(url);
    }

    window['NotifyDisose'] = () => {
        viewer?.dispose();
        viewer = null;
    };
});
