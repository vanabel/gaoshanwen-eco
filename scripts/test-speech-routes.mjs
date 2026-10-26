import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import worker,{getWorldbank,worldbankSource}from'../worker/index.js';
const frozen=JSON.parse(readFileSync(new URL('../data/speech.json',import.meta.url))),wb=JSON.parse(readFileSync(new URL('../data/worldbank.json',import.meta.url)));
let r=await worker.fetch(new Request('https://test.invalid/api/speech'));assert.equal(r.status,200);assert.equal((await r.json()).charts.length,23);
for(const c of frozen.charts){r=await worker.fetch(new Request('https://test.invalid/api/speech/charts/'+c.page+'.svg'));assert.equal(r.status,200);assert(r.headers.get('content-type').startsWith('image/svg+xml'));assert(r.headers.get('content-disposition').includes('speech-chart-'+c.page));const svg=await r.text();assert(svg.includes(c.title));assert(!/NaN|undefined|Infinity/.test(svg));}
r=await worker.fetch(new Request('https://test.invalid/api/speech/charts/999.svg'));assert.equal(r.status,404);
const original=globalThis.fetch,objects=new Map(),env={BUCKET:{async get(k){return objects.has(k)?{json:async()=>JSON.parse(objects.get(k))}:null},async put(k,v){objects.set(k,v)}}};
try{globalThis.fetch=async()=>{throw Error('simulated_WDI_outage')};let d=await getWorldbank(env,true);assert.equal(d.status,'archived');assert.equal(d.observations.length,wb.observations.length);
 globalThis.fetch=async()=>new Response(JSON.stringify([{pages:1,lastupdated:wb.lastUpdated},wb.observations.map(v=>({countryiso3code:v.country,date:String(v.year),value:v.value}))]),{headers:{'content-type':'application/json'}});
 d=await getWorldbank(env,true);assert.equal(d.status,'live');assert(objects.has('worldbank.json'));globalThis.fetch=async()=>{throw Error('must_not_fetch_cached')};d=await getWorldbank(env);assert.equal(d.status,'stored');assert.equal(d.lastUpdated,wb.lastUpdated);
}finally{globalThis.fetch=original;}
console.log('PASS: frozen dataset API, all 23 standalone SVG routes, missing-page 404, WDI outage fallback and persistent refresh/readback');

assert.equal(new URL(worldbankSource(2027)).searchParams.get('date'),'1968:2026');console.log('PASS: WDI request window advances with each complete calendar year');
