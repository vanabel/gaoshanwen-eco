import assert from 'node:assert/strict';
import {latest,parse} from '../worker/index.js';
const d=await latest();assert.equal(d.metrics.length,8);assert(d.metrics.every(m=>m.value!==null));assert(d.metrics.find(m=>m.id==='unemployment').value>=0);assert(d.source.startsWith('https://www.stats.gov.cn/'));assert.throws(()=>parse('<html>Blocked</html>',d.source));console.log(JSON.stringify({published:d.published,metrics:d.metrics.map(m=>[m.id,m.value,m.period]),quarters:d.quarters,checks:'8 parsed values, official source, blocked response rejected'}));
