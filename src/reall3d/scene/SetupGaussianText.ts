// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { GetGaussianText, HttpQueryGaussianText } from '../events/EventConstants';
import { Events } from '../events/Events';
import { HalfChars } from '../utils/GlobalConstants';
import { parseWordToTexdata } from '../modeldata/wasm/WasmParser';

export function setupGaussianText(events: Events) {
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const halfSet = new Set(HalfChars.split(''));

    on(GetGaussianText, async (text: string = '', isY: boolean = true, isNgativeY: boolean = true, fmt = ''): Promise<Uint8Array> => {
        const words = text.trim().substring(0, 100);
        let dataJson: number[][] = await fire(HttpQueryGaussianText, words, fmt); // 限制最多100字

        let wordsJson: number[][][] = [];
        for (let i = 0; i < dataJson.length; i++) {
            let wnums: number[][] = [];
            let nums: number[] = dataJson[i];
            for (let j = 0; j < nums.length; j++) {
                wnums.push([((nums[j] % 20) - 10) * 0.02, (((nums[j] / 20) | 0) - 10) * 0.02]);
            }
            wordsJson.push(wnums);
        }

        let wsize: number[] = [];
        let ary = words.split('');
        for (let i = 0; i < ary.length; i++) {
            wsize[i] = halfSet.has(ary[i]) ? 0.22 : 0.4;
        }

        let cnt = (ary.length / 2) | 0;
        let offset = wsize[cnt] / 2;
        let isEven = !(ary.length % 2); // 是否偶数个
        let wOffset = isEven ? 0 : -offset;
        for (let i = cnt - 1; i >= 0; i--) {
            wOffset -= wsize[i] / 2;
            for (let nums of wordsJson[i]) nums[0] += wOffset;
            wOffset -= wsize[i] / 2;
        }
        offset = wsize[cnt] / 2;
        wOffset = isEven ? 0 : offset;
        for (let i = wordsJson.length - cnt; i < wordsJson.length; i++) {
            wOffset += wsize[i] / 2;
            for (let nums of wordsJson[i]) nums[0] += wOffset;
            wOffset += wsize[i] / 2;
        }

        let gsCount = 0;
        for (let wordJson of wordsJson) {
            gsCount += wordJson.length;
        }

        const data = new Uint8Array(gsCount * 32);
        let i = 0;
        for (let wordJson of wordsJson) {
            for (let nums of wordJson) {
                data.set(await parseWordToTexdata(nums[0], nums[1], isY, isNgativeY), 32 * i++);
            }
        }
        return data;
    });
}
