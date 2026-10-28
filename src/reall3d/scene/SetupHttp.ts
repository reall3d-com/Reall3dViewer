// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Events } from '../events/Events';
import { HttpPostMetaData } from '../events/EventConstants';
import { MetaData } from '../modeldata/MetaData';
export function setupApi(events: Events) {
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);

    on(HttpPostMetaData, (meta: MetaData) => {
        // TODO post meta data to server here
        const metaClone: MetaData = { ...meta };
        const metaJson = JSON.stringify(metaClone, null, 2);
        console.info(metaJson);
    });
}
