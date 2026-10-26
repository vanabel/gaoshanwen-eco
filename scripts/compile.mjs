import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const json=p=>read(p).replace(/</g,'\\u003c');
const shared=read('src/reconstruction.mjs');
const judgmentShared=read('src/judgments.mjs');
let page=read('src/page.html');
for(const [token,value]of Object.entries({__JUDGMENTS_SECTION__:read('src/judgments-section.html'),__JUDGMENTS_CSS__:read('src/judgments.css'),__JUDGMENTS_DATA__:json('data/judgments.json'),__JUDGMENTS_SHARED__:judgmentShared.replace(/^export /gm,''),__JUDGMENTS_BROWSER__:read('src/judgments-browser.js'),__SPEECH_SECTION__:read('src/speech-section.html'),__SPEECH_CSS__:read('src/speech.css'),__SPEECH_DATA__:json('data/speech.json'),__WORLDBANK_DATA__:json('data/worldbank.json'),__SPEECH_SHARED__:shared.replace(/^export /gm,''),__SPEECH_BROWSER__:read('src/speech-browser.js'),__INITIAL_DATA__:json('data/archive.json'),__BROWSER_SCRIPT__:read('src/browser.js')}))page=page.replace(token,()=>value);
const server=read('src/server.mjs').replace('__SEED__',()=>read('data/archive.json')).replace('__SPEECH__',()=>read('data/speech.json')).replace('__WORLDBANK__',()=>read('data/worldbank.json')).replace('__JUDGMENTS__',()=>read('data/judgments.json')).replace('__PAGE__',()=>JSON.stringify(page));
writeFileSync(new URL('../worker/index.js',import.meta.url),read('src/parsers.mjs')+'\n'+shared+'\n'+judgmentShared+'\n'+server);
