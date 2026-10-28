// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { Audio, AudioListener, AudioLoader } from 'three';
import { globalEv } from '../../events/GlobalEV';
import { SetBgAudioVolumeDown, SetBgAudioVolumeUp } from '../../events/EventConstants';
import { Events } from '../../events/Events';

export class AudioText {
    private audio: Audio;
    public opts: AudioTextOptions;
    private disposed = false;

    public constructor(options: AudioTextOptions = {}) {
        const opts = { ...options };
        const copyTextDurations = [];
        const textDurations = options.textDurations || [];
        for (const textDuration of textDurations) {
            copyTextDurations.push([...textDuration]);
        }
        opts.textDurations = copyTextDurations;
        this.opts = opts;
    }

    public play(force: boolean = false): void {
        const that = this;
        if (!force && !this.opts.autoPlay) return;
        if (that.disposed || that.audio) return;

        const audio = new Audio(new AudioListener());
        that.audio = audio;
        const audioLoader = new AudioLoader();
        audioLoader.load(that.opts.mp3, (buf: AudioBuffer) => {
            globalEv.fire(SetBgAudioVolumeDown);
            setTimeout(async () => {
                if (that.disposed) return;
                audio.setBuffer(buf);
                audio.setLoop(false);
                audio.setVolume(1.0);
                audio.play();

                for (const textDuration of that.opts.textDurations) {
                    const text: string = textDuration[0];
                    const duration: number = textDuration[1];
                    const rs = await that.showAudioText(text, duration);
                    if (!rs) break;
                }
                globalEv.fire(SetBgAudioVolumeUp);
                setTimeout(() => (that.audio = null), that.opts?.position ? 60_000 : 0);
            }, 500);
        });
    }

    private showAudioText(txt: string, duration: number): Promise<boolean> {
        let div: HTMLDivElement = document.querySelector('.tv-text');
        if (!div) {
            const divContainer = document.createElement('div');
            divContainer.style.cssText = `position:fixed;bottom:30px;left:0;right:0;display:flex;justify-content:center;z-index:99;pointer-events:none;`;
            div = document.createElement('div');
            div.classList.add('tv-text');
            div.style.cssText = `background-color:#333;opacity:0.8;color:white;font-size:32px;padding:2px 10px;border-radius:4px;max-width:90%;text-align:center;user-select:none;`;
            divContainer.append(div);
            document.body.append(divContainer);
        }

        return new Promise(res => {
            if (div) {
                div.innerText = txt;
                div.style.display = 'block';
                div.classList.remove('hide');
            }
            setTimeout(() => {
                div.style.display = 'none';
                div.innerText = '';
                if (this.audio?.isPlaying) {
                    setTimeout(() => res(true), 200);
                } else {
                    res(false);
                }
            }, duration);
        });
    }

    public dispose(): void {
        const that = this;
        if (that.disposed) return;
        that.disposed = true;

        that.audio?.stop();
        that.audio = null;
        that.opts = null;
    }
}

export interface AudioTextOptions {
    autoPlay?: boolean;
    mp3?: string;
    textDurations?: any[];
    event?: Events;
    position?: number[];
    distance?: number;
}
