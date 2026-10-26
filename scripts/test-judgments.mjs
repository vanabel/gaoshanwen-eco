import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {judgmentsForYear,judgmentPhase,judgmentMetricRows,judgmentYearText} from '../src/judgments.mjs';
import worker,{reportText} from '../worker/index.js';
const db=JSON.parse(readFileSync(new URL('../data/judgments.json',import.meta.url))),seed=JSON.parse(readFileSync(new URL('../data/archive.json',import.meta.url)));
assert.equal(db.theses.length,6);assert.equal(db.records.length,12);
assert.equal(judgmentsForYear(db,2013).length,0);assert.equal(judgmentsForYear(db,2025).length,0);
assert.equal(judgmentsForYear(db,2016)[0].spokenAt,'2016-01-20');assert.equal(judgmentsForYear(db,2024)[0].sourcePublishedAt,'2025-05-17');
assert.equal(judgmentPhase(2023,'2024-12-03'),'判断前背景');assert.equal(judgmentPhase(2024,'2024-12-03'),'形成当年（含判断前月份）');assert.equal(judgmentPhase(2025,'2024-12-03'),'判断后全年');
const rows=judgmentMetricRows([...seed.annual,{year:2026,kind:'progress',metrics:[{id:'gdp',value:99}]}],['unemployment']);
assert.equal(rows.length,14);assert.equal(rows[0].values[0].value,null);assert(!rows.some(r=>r.year===2026));
for(const r of [...db.records,...db.theses]){assert(r.source.startsWith('https://'));assert(r.summary&&r.limit&&r.horizon);for(const id of r.metrics)assert(seed.annual.at(-1).metrics.some(m=>m.id===id));}
let text=judgmentYearText(db,{year:2012});assert(text.includes('短期环比'));assert(!text.includes('持续追踪：2024'));assert(text.includes('历史背景'));
text=reportText(seed.annual.find(r=>r.year===2024));assert(text.includes('含演讲前月份'));assert(text.includes('第三方听打稿'));
text=reportText(seed.annual.find(r=>r.year===2025));assert(text.includes('并非讲者在本年发表的新观点'));assert(text.includes('本次来源集中尚无该年'));
let res=await worker.fetch(new Request('https://test.invalid/api/judgments'));assert.equal(res.status,200);assert.equal((await res.json()).records.length,12);
res=await worker.fetch(new Request('https://test.invalid/'));const html=await res.text();assert(html.includes('id="annual-judgments"'));assert(html.includes('id="judgments"'));assert(!/__JUDGMENTS_\w+__/.test(html));
console.log('PASS: source coverage and date provenance, pre/post judgement boundary, missing years and data, full-year-only trends, annual Markdown and API');
