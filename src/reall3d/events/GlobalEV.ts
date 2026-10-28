// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { AudioLoader, AudioListener, Audio } from 'three';
import { DisableBgAudio, GetBgAudio, PlaytBgAudio, SetBgAudioVolumeDown, SetBgAudioVolumeUp, StopBgAudio } from './EventConstants';
import { loadFile } from '../modeldata/loaders/FileLoader';
import { loopByTime } from '../utils/CommonUtils';
import { Events } from './Events';

/**
 * 全局性的单例事件对象，在此写全局性的通用控制，可在 UI、Viewer、SplatMesh 之间自由穿梭畅通无阻，简洁高效的实现各种功能。
 */
export const globalEv: Events = (() => {
    const ev = new Events();
    let disableBgAudio = false;
    let bgAudioStartTime = 0;
    let bgAudioStopTime = 0;

    ev.on(PlaytBgAudio, async (mp3: string = '', isLoop: boolean = false, volume: number = 0.3): Promise<boolean> => {
        bgAudioStartTime = performance.now();
        const audioBg = getBackgroundAudio();

        let reslove: Function = null;
        new Promise(rs => (reslove = rs));

        if (audioBg?.isPlaying) {
            if (disableBgAudio) {
                audioBg?.stop();
                reslove(false);
            } else {
                reslove(true);
            }
            return;
        }

        const mp3Bytes: any = await loadFile(mp3 || 'https://reall3d.com/demo-models/demo/background1.mp3');
        const mp3Url = URL.createObjectURL(new Blob([mp3Bytes], { type: 'application/octet-stream' }));
        new AudioLoader().load(
            mp3Url,
            buf => {
                const play = !disableBgAudio && bgAudioStartTime > bgAudioStopTime;
                if (play) {
                    audioBg.setBuffer(buf);
                    audioBg.setLoop(isLoop);
                    audioBg.setVolume(volume);
                    audioBg.play();
                }
                reslove(play);
            },
            () => reslove(false),
        );
    });

    ev.on(StopBgAudio, () => {
        bgAudioStopTime = performance.now();
        const audioBg = getBackgroundAudio(false);
        if (!audioBg?.isPlaying) return;
        audioBg.stop();
    });

    ev.on(DisableBgAudio, (disable = true) => {
        if (disable === true || disable === false) {
            disableBgAudio = disable;
        }
        return disableBgAudio;
    });

    ev.on(SetBgAudioVolumeDown, (autoCreate = false) => {
        const audioBg = getBackgroundAudio(autoCreate);
        if (!audioBg?.isPlaying) return;

        let vol = audioBg.getVolume();
        loopByTime(
            () => {
                if (!audioBg) return;

                if (disableBgAudio) {
                    audioBg.stop();
                } else {
                    audioBg.setVolume((vol = Math.max(vol * 0.99, 0.15)));
                }
            },
            () => vol > 0.15,
        );
    });
    ev.on(SetBgAudioVolumeUp, (autoCreate = false) => {
        const audioBg = getBackgroundAudio(autoCreate);
        if (!audioBg?.isPlaying) return;

        let vol = audioBg.getVolume();
        loopByTime(
            () => {
                if (!audioBg) return;

                if (disableBgAudio) {
                    audioBg.stop();
                } else {
                    audioBg.setVolume((vol = Math.min(vol * 1.01, 0.5)));
                }
            },
            () => vol < 0.5,
        );
    });

    function getBackgroundAudio(autoCreate = true): Audio {
        if (disableBgAudio) return null;

        let audioBg: Audio = ev.tryFire(GetBgAudio);
        if (!audioBg && autoCreate) {
            audioBg = new Audio(new AudioListener());
            ev.on(GetBgAudio, () => audioBg);
        }
        return audioBg;
    }

    return ev;
})();
