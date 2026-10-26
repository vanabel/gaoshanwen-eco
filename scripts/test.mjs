import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker,{getData,getReports,reportText,parseAnnual,validateImport} from '../worker/index.js';
const seed=JSON.parse(readFileSync(new URL('../data/archive.json',import.meta.url)));
class Bucket {constructor(){this.items=new Map()}async get(k){const s=this.items.get(k);return s?{json:async()=>JSON.parse(s)}:null}async put(k,v){this.items.set(k,v)}async list({prefix}){return {objects:[...this.items.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key})),truncated:false}}}
const bucket=new Bucket(),env={BUCKET:bucket}, originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw Error('simulated_source_outage')};
// First-ever visitor still gets a truthful verified archive with an unavailable upstream.
let r=await worker.fetch(new Request('https://test.invalid/api/data?refresh=1'),env);assert.equal(r.status,200);let d=await r.json();assert.equal(d.status,'archived');assert.equal(d.published,seed.latest.published);assert.equal(d.fetchedAt,seed.latest.fetchedAt);assert(d.warning);assert.equal(d.metrics.length,8);
// Annual reports remain readable and distinguish the current partial year.
r=await worker.fetch(new Request('https://test.invalid/api/reports'),env);let list=(await r.json()).reports;assert.deepEqual(list.map(x=>[x.year,x.kind]),[...Array.from({length:14},(_,i)=>[2012+i,'annual']),[2026,'progress']]);
let text=reportText(list.find(r=>r.year===2025),list.find(r=>r.year===2024));assert(text.includes('减少6.6 个百分点'));assert(text.includes('增加0.2 个百分点'));assert(text.includes('全年平均值'));assert(!reportText(list.find(r=>r.year===2026),list.find(r=>r.year===2025)).includes('## 与上年比较'));
r=await worker.fetch(new Request('https://test.invalid/api/reports/2025.md'),env);assert.equal(r.status,200);assert((await r.text()).includes('年度经济观察报告'));
// Import and readback work without an upstream connection and across in-memory cache resets.
r=await worker.fetch(new Request('https://test.invalid/api/update',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(seed)}),env);assert.equal(r.status,200);assert((await r.json()).ok);assert(bucket.items.has('annual/2012.json'));assert(bucket.items.has('annual/2024.json'));assert(bucket.items.has('annual/2025.json'));assert([...bucket.items.keys()].some(k=>k.startsWith('revisions/')));
list=(await getReports(env,seed.latest)).reports;assert.equal(list.find(x=>x.year===2025).metrics.find(m=>m.id==='cpi').value,0);
assert.throws(()=>validateImport({...seed,latest:{...seed.latest,source:'https://example.com/fake'}}));assert.throws(()=>validateImport({...seed,annual:[{...seed.annual[0],year:2025}]}));
r=await worker.fetch(new Request('https://test.invalid/api/update',{method:'POST',headers:{'content-type':'application/json',origin:'https://evil.invalid'},body:JSON.stringify(seed)}),env);assert.equal(r.status,403);
// A failed optional platform cache cannot disable the data route: this release does not depend on caches.default.
Object.defineProperty(globalThis,'caches',{get(){throw Error('cache_api_unavailable')},configurable:true});d=await getData(env,true);assert.equal(d.status,'archived');delete globalThis.caches;
globalThis.fetch=originalFetch;
console.log('PASS: first-visit outage fallback, report availability and periods, annual comparison, Markdown export, archive/import/readback, origin/validation, cache API independence');

const r2012=seed.annual.find(r=>r.year===2012),r2013=seed.annual.find(r=>r.year===2013),r2020=seed.annual.find(r=>r.year===2020),r2021=seed.annual.find(r=>r.year===2021);
const v=(r,id)=>r.metrics.find(m=>m.id===id).value;
assert.equal(r2012.published,'2013-02-22');assert.equal(v(r2012,'gdp'),7.8);assert.equal(v(r2012,'income'),null);assert.equal(v(r2013,'income'),8.1);assert.equal(v(r2013,'spending'),null);assert.equal(v(r2020,'retail'),-3.9);assert.equal(v(r2020,'spending'),-4);assert.equal(v(r2020,'unemployment'),null);assert.equal(v(r2021,'gdp'),8.1);assert.equal(v(r2021,'industry'),9.6);assert(!reportText(r2012).includes('—（未列同口径数据）%'));assert(reportText(r2012).includes('城乡分组指标不替代全国指标'));console.log('PASS: 2012–2025 range, original publication date, national/urban and average/year-end boundaries, deflation signs, 2021 one-year growth');
