import { browser } from '$app/environment';
import { Howl } from 'howler';
import { localConfig } from '../dataAPI/api-localstore';

import camera from './camera';
import changebanner from './changebanner';
import click from './click';
import click2 from './click2';
import close from './close';
import exchange from './exchange';
import inventory from './inventory';
import history from './history';
import obtain from './obtain';
import modal from './modal';
import roll from './roll';
import shopopen from './shopopen';
import shopnav from './shopnav';
import shopsubnav from './shopsubnav';
import collectionitem from './collectionitem';
import prevbanner from './prevbanner';
import bookflip from './bookflip';

const source = {
	bookflip,
	changebanner,
	close,
	click,
	click2,
	collectionitem,
	exchange,
	modal,
	obtain,
	roll,
	inventory,
	history,
	camera,
	shopopen,
	shopnav,
	shopsubnav,
	prevbanner,
	wishBacksound: '/sfx/wish-backsound.ogg',
	resultList: '/sfx/result-list.ogg',
	reveal3Star: '/sfx/reveal-3star.ogg',
	reveal4Star: '/sfx/reveal-4star.ogg',
	reveal5Star: '/sfx/reveal-5star.ogg'
};

const sounds = {};
const soundInit = () => {
	if (!browser) return;
	Object.keys(source).forEach((key) => {
		sounds[key] = new Howl({
			src: [source[key]],
			loop: key === 'wishBacksound'
		});
	});
	// 页面加载期（无用户手势）创建的 AudioContext 被挂起，howler 在桌面/WebView 不自动解锁：
	// 首次交互 resume 一次，否则异步回调里的音效（抽卡揭示音等）永远静音
	const unlock = () => {
		if (Howler.ctx && Howler.ctx.state === 'suspended') Howler.ctx.resume();
	};
	['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
		window.addEventListener(ev, unlock, true)
	);
};
soundInit();

export const playSfx = (sfxName = 'click') => {
	if (localConfig.get('muted')) return;
	try {
		if (!sounds[sfxName]) throw new Error('No Sound effect for ' + sfxName);
		if (sfxName === 'wishBacksound' && sounds[sfxName].playing()) return;
		return sounds[sfxName].play();
	} catch (e) {
		console.error('Unable to Play Sfx : ', e.message);
	}
};

export const pauseSfx = (sfxName) => {
	if (localConfig.get('muted')) return;
	try {
		if (sfxName.includes('reveal')) return sounds[sfxName].stop();
		sounds[sfxName].pause();
		return;
	} catch (e) {
		console.log('error to pause sfx');
	}
};
