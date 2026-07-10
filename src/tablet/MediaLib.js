import IO from './IO';
import Localization from '../utils/Localization';

let path;
let samples;
let backgrounds;
let sprites;
let sounds;
let keys = {};

export default class MediaLib {
    static get path () {
        return path;
    }

    static get samples () {
        return samples;
    }

    static get sprites () {
        return sprites;
    }

    static get backgrounds () {
        return backgrounds;
    }

    static get sounds () {
        return sounds;
    }

    static get keys () {
        return keys;
    }

    static loadMediaLib (root, whenDone) {
        IO.requestFromServer(root + 'media.json', (result) => {
            let parsedResult = JSON.parse(result);
            path = parsedResult.path;
            samples = parsedResult.samples;
            sprites = parsedResult.sprites;
            backgrounds = parsedResult.backgrounds;
            sounds = parsedResult.sounds;

            MediaLib.localizeMediaNames();
            MediaLib.generateKeys();

            whenDone();
        });
    }

    static localizeMediaNames () {
        // Localize names of sprites
        for (let i = 0; i < sprites.length; i++) {
            MediaLib.localizeMediaName(sprites[i], 'CHARACTER_');
        }

        // Localize names of backgrounds
        for (let i = 0; i < backgrounds.length; i++) {
            MediaLib.localizeMediaName(backgrounds[i], 'BACKGROUND_');
        }
    }

    static localizeMediaName (media, legacyPrefix) {
        const fallback = media.name || media.md5;
        const key = media.nameKey || (legacyPrefix + media.md5);
        media.name = Localization.hasKey(key) ? Localization.localize(key) : fallback;
    }

    static generateKeys () {
        for (let i = 0; i < backgrounds.length; i++) {
            var bg = backgrounds[i];
            keys[bg.md5] = {width: bg.width, height: bg.height, name: bg.name};
        }

        for (let i = 0; i < sprites.length; i++) {
            var spr = sprites[i];
            keys[spr.md5] = {width: spr.width, height: spr.height, name: spr.name};
        }
    }
}
