const INDEX='https://www.stats.gov.cn/sj/zxfb/';
const SEED=__SEED__;
const PAGE=__PAGE__;
const SPEECH=__SPEECH__;
const WORLDBANK=__WORLDBANK__;
const JUDGMENTS=__JUDGMENTS__;
const TTL=30*60*1000;
let memory=null;
const clone=x=>JSON.parse(JSON.stringify(x));
const isSource=s=>typeof s==='string'&&/^https:\/\/www\.stats\.gov\.cn\/(sj|zwfwck)\//.test(s);
const log=(stage,error)=>console.error(JSON.stringify({stage,error:String(error?.message||error).slice(0,180)}));
export async function getText(url){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
 try{const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'},signal:controller.signal});if(!r.ok)throw Error('source_http_'+r.status);return await r.text();}finally{clearTimeout(timer);}
}
export function linksFrom(html,base){
 const links=[];for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){const href=m[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1];if(!href)continue;const title=m[1].match(/title\s*=\s*["']([^"']+)["']/i)?.[1]||plain(m[2]);try{const url=new URL(href,base).href;if(isSource(url))links.push({url,title});}catch{}}
 return [...new Map(links.map(x=>[x.url,x])).values()];
}
export async function latest(){
 const index=await getText(INDEX);const links=linksFrom(index,INDEX).filter(m=>/经济运行/.test(m.title)&&!/答记者问|解读/.test(m.title));
 if(!links.length)throw Error('release_index_changed');const source=links[0].url;return parse(await getText(source),source);
}
export async function latestAnnual(){
 const index='https://www.stats.gov.cn/sj/tjgb/ndtjgb/qgndtjgb/';const html=await getText(index);
 const link=linksFrom(html,index).filter(m=>/^\d{4}年$/.test(m.title)).sort((a,b)=>b.title.localeCompare(a.title))[0];
 if(!link)throw Error('annual_index_changed');return parseAnnual(await getText(link.url),link.url,Number(link.title.slice(0,4)));
}
function validSnapshot(d){return d&&isSource(d.source)&&/^\d{4}-\d{2}-\d{2}$/.test(d.published||'')&&Number.isFinite(Date.parse(d.fetchedAt))&&Array.isArray(d.metrics)&&d.metrics.length>=4&&d.metrics.length<=20&&d.metrics.every(m=>typeof m.id==='string'&&typeof m.label==='string'&&typeof m.period==='string'&&typeof m.basis==='string'&&(m.value===null||(typeof m.value==='number'&&Number.isFinite(m.value)&&Math.abs(m.value)<1000)));}
export function validateImport(body){
 if(!body||typeof body!=='object')throw Error('invalid_body');const records=[];
 if(body.latest){if(!validSnapshot(body.latest)||body.latest.kind==='annual')throw Error('invalid_latest');records.push(body.latest);}
 if(body.annual){if(!Array.isArray(body.annual)||body.annual.length>20)throw Error('invalid_annual');for(const a of body.annual){if(!validSnapshot(a)||a.kind!=='annual'||!Number.isInteger(a.year)||a.year<2012||a.year>new Date().getUTCFullYear()||a.metrics.some(m=>m.period!==a.year+'年全年'))throw Error('invalid_annual_record');records.push(a);}}
 if(!records.length)throw Error('empty_import');return records;
}
async function read(env,key){if(!env.BUCKET)return null;try{const object=await env.BUCKET.get(key);return object?await object.json():null;}catch(e){log('archive_read',e);return null;}}
async function persist(env,data){if(!env.BUCKET)throw Error('archive_binding_missing');
 const key=data.kind==='annual'?'annual/'+data.year+'.json':'latest.json';
 const previous=await read(env,key);
 // Never replace a newer publication with an older one.
 if(previous&&previous.published>data.published)return {key,unchanged:true};
 const text=JSON.stringify(data);await env.BUCKET.put(key,text,{httpMetadata:{contentType:'application/json'}});
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({source:data.source,published:data.published,metrics:data.metrics}))))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const revision='revisions/'+(data.kind==='annual'?data.year:'latest')+'/'+data.published+'-'+hash.slice(0,16)+'.json';
 await env.BUCKET.put(revision,text,{httpMetadata:{contentType:'application/json'}});
 return {key,revision};
}
async function annualRecords(env){
 const map=new Map(SEED.annual.map(a=>[a.year,clone(a)]));
 if(env.BUCKET){try{let cursor;do{const page=await env.BUCKET.list({prefix:'annual/',limit:100,cursor});for(const obj of page.objects||[]){const a=await read(env,obj.key);if(a&&validSnapshot(a))map.set(a.year,a);}cursor=page.truncated?page.cursor:undefined;}while(cursor);}catch(e){log('annual_list',e);}}
 return [...map.values()].sort((a,b)=>a.year-b.year);
}
export async function getData(env={},force=false){
 if(!force&&memory&&Date.now()-memory.checked< TTL)return clone(memory.data);
 let base=await read(env,'latest.json');if(!base||!validSnapshot(base)||base.published<SEED.latest.published)base=clone(SEED.latest);
 if(!force&&base.lastSuccessfulCheck&&Date.now()-Date.parse(base.lastSuccessfulCheck)<TTL){const result={...base,status:'stored',archiveAvailable:!!env.BUCKET};memory={checked:Date.now(),data:result};return result;}
 const checkedAt=new Date().toISOString();
 try{const live=await latest();live.lastSuccessfulCheck=checkedAt;live.status='live';live.checkedAt=checkedAt;live.archiveAvailable=!!env.BUCKET;
  if(live.published<base.published){const result={...base,status:'archived',checkedAt,warning:'来源返回较早发布，继续显示较新的已核验存档。'};memory={checked:Date.now(),data:result};return result;}
  try{await persist(env,live);}catch(e){log('archive_write',e);live.archiveAvailable=false;}
  memory={checked:Date.now(),data:live};return clone(live);
 }catch(e){log('live_refresh',e);const result={...base,status:'archived',checkedAt,archiveAvailable:!!env.BUCKET,warning:'在线更新暂未成功，当前展示已核验存档；请查看统计期与存档时间。'};memory={checked:Date.now(),data:result};return clone(result);}
}
function progress(latest){
 const year=Number(latest.metrics.find(m=>m.id==='gdp')?.period.match(/\d{4}/)?.[0]||latest.published.slice(0,4));
 return {...latest,year,kind:'progress',title:year+'年度经济观察 · 进展版',period:latest.metrics.find(m=>m.id==='gdp')?.period||'截至最新发布',sourceTitle:'国家统计局综合经济运行报告'};
}
export async function getReports(env={},data=null){const annual=await annualRecords(env);const p=progress(data||await getData(env));return {reports:annual.some(a=>a.year===p.year)?annual:[...annual,p],generatedAt:new Date().toISOString(),notes:'完整年度采用官方年度公报，进展版保留当期口径，不把当月值或累计值当成全年值。'};}
const value=(r,id)=>r.metrics.find(m=>m.id===id)?.value;
function fmt(n){return n===null||n===undefined?'—（未列同口径数据）':n.toFixed(1)+'%';}
export function reportText(report,prior){
 const annual=report.kind==='annual';let s='# '+report.title+'\n\n';
 s+='统计范围：'+report.period+'\n\n资料发布：'+report.published+'；核验抓取：'+report.fetchedAt+'。\n\n';
 s+=(annual?'这是基于官方年度公报的独立观察报告；数值保留公报发布时口径。':'本年尚未形成完整年度公报；以下是进展版，不能与全年结果直接比较。')+'\n\n';
 s+='## 主要数据\n\n| 指标 | 数值 | 统计期与口径 |\n| --- | ---: | --- |\n';
 for(const m of report.metrics)s+='| '+m.label+' | '+fmt(m.value)+' | '+m.period+' · '+m.basis+(m.missingReason?'；'+m.missingReason:'')+' |\n';
 if(annual&&prior?.kind==='annual'&&prior.year===report.year-1){s+='\n## 与上年比较\n\n';
 for(const m of report.metrics){const p=prior.metrics.find(x=>x.id===m.id&&x.basis===m.basis);if(m.value!==null&&p?.value!==null&&p?.value!==undefined){const diff=Number((m.value-p.value).toFixed(1));s+='- '+m.label+'：'+prior.year+'年 '+fmt(p.value)+' → '+report.year+'年 '+fmt(m.value)+'；'+(diff===0?'持平':(diff>0?'增加':'减少')+Math.abs(diff).toFixed(1)+' 个百分点')+'。\n';}}
 s+='\n以上比较采用两年公报所列增速或平均水平，不用金额相除重算同比；公报之间可能有统计范围和基期修订，百分点差只描述公布值的变化。\n';}
 s+='\n## 沿演讲框架的复盘\n\n';
 if(annual){s+='- 消费与收入：社零全年名义同比 '+fmt(value(report,'retail'))+'，居民人均消费支出实际同比 '+fmt(value(report,'spending'))+'，人均可支配收入实际同比 '+fmt(value(report,'income'))+'。名义与实际口径不同，不作直接强弱排名。\n';s+=value(report,'unemployment')===null?'- 就业：该公报未列全国城镇调查失业率全年平均值，不用登记失业率或年末调查值替代。\n':'- 就业：全年城镇调查失业率平均 '+fmt(value(report,'unemployment'))+'。这是调查比率，不能直接推导就业机会减少人数或青年群体状况。\n';s+='- 房地产：开发投资同比 '+fmt(value(report,'property'))+'，'+report.metrics.find(m=>m.id==='sales').label+'同比 '+fmt(value(report,'sales'))+'。投资与销售可能分化，不能用其中一个指标宣布整个周期结束。\n';s+='- 供给与总量：规模以上工业实际同比 '+fmt(value(report,'industry'))+'，实际 GDP 同比 '+fmt(value(report,'gdp'))+'。官方总量指标可作交叉观察，不能独立验证演讲中对官方增长统计的质疑。\n';}
 else{s+='- 当前页保留每项数据的当月、累计或季度口径；累计房地产投资与销售观察调整压力，当月社零、失业率与核心 CPI 观察需求与就业。\n- 尚不具备完整全年数据，不计算本年全年结论，也不把当前月度数据与上年全年均值作同比较差。\n';}
 if(report.notes?.length)s+='\n## 口径与历史可比性\n\n'+report.notes.map(n=>'- '+n).join('\n')+'\n';
 s+=judgmentYearText(JUDGMENTS,report);
 s+='\n## 结论边界与后续观察\n\n这份报告按年度组织可核验数据，而非高善文本人撰写的研究报告。不把单年表现作为“2025年是转折点”的充分证据。继续观察消费、就业、物价与房地产是否持续相互印证。原演讲图表已按原图恢复，并附就业假设检查和WDI独立复算；逐公司分组与省际模型的原数据库底表仍未取得。\n\n';
 s+='来源：['+report.sourceTitle+']('+report.source+')\n';if(prior)s+='\n比较来源：['+prior.sourceTitle+']('+prior.source+')\n';return s;
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
export function worldbankSource(calendarYear=new Date().getUTCFullYear()){const source=new URL(WORLDBANK.source);source.searchParams.set('date','1968:'+String(calendarYear-1));return source.href;}
export async function getWorldbank(env={},force=false){
 const stored=await read(env,'worldbank.json');const base=stored?.observations?.length?stored:WORLDBANK;
 if(!force&&base.checkedAt&&Date.now()-Date.parse(base.checkedAt)<86400000)return {...base,status:'stored'};
 try{const source=worldbankSource();const raw=JSON.parse(await getText(source));if(!Array.isArray(raw[1])||raw[0]?.pages!==1)throw Error('worldbank_schema_changed');
  const observations=raw[1].filter(r=>r.value!==null).map(r=>({country:r.countryiso3code,year:Number(r.date),value:r.value}));
  if(observations.length<300||observations.some(r=>!Number.isFinite(r.value)))throw Error('worldbank_incomplete');
  const data={source,indicator:WORLDBANK.indicator,lastUpdated:raw[0].lastupdated,retrievedAt:new Date().toISOString(),checkedAt:new Date().toISOString(),observations,status:'live'};
  if(env.BUCKET)await env.BUCKET.put('worldbank.json',JSON.stringify(data),{httpMetadata:{contentType:'application/json'}});return data;
 }catch(e){log('worldbank_refresh',e);return {...base,status:'archived',warning:'来源暂不可用，使用核验存档'};}
}
export default {async fetch(request,env={},ctx={}){const url=new URL(request.url);try{
 if(url.pathname==='/api/judgments'&&request.method==='GET')return json(JUDGMENTS);
 if(url.pathname==='/api/speech'&&request.method==='GET')return json(SPEECH);
 if(url.pathname==='/api/worldbank'&&request.method==='GET')return json(await getWorldbank(env,url.searchParams.get('refresh')==='1'));
 if(/^\/api\/speech\/charts\/\d+\.svg$/.test(url.pathname)&&request.method==='GET'){const page=Number(url.pathname.match(/(\d+)\.svg/)[1]),chart=SPEECH.charts.find(c=>c.page===page);if(!chart)return json({error:'chart_not_found'},404);return new Response(speechChartSVG(chart),{headers:{'Content-Type':'image/svg+xml; charset=utf-8','Content-Disposition':'attachment; filename="speech-chart-'+page+'.svg"'}});}
 if(url.pathname==='/api/data'&&request.method==='GET')return json(await getData(env,url.searchParams.get('refresh')==='1'));
 if(url.pathname==='/api/reports'&&request.method==='GET')return json(await getReports(env));
 if(/^\/api\/reports\/\d{4}\.md$/.test(url.pathname)&&request.method==='GET'){const year=Number(url.pathname.match(/(\d{4})\.md/)[1]);const {reports}=await getReports(env);const r=reports.find(x=>x.year===year);if(!r)return json({error:'report_not_available'},404);return new Response(reportText(r,reports.find(x=>x.year===year-1)),{headers:{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="economy-report-'+year+'.md"','Cache-Control':'no-store'}});}
 if(url.pathname==='/api/health')return json({ok:true,archiveAvailable:!!env.BUCKET,version:'annual-archive-v2'});
 if((url.pathname==='/api/refresh'||url.pathname==='/api/update')&&request.method==='POST'){
  const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'origin_not_allowed'},403);
  if(!env.BUCKET)return json({error:'archive_binding_missing'},503);
  // This shared data writer is protected by the Site's owner-private access boundary.
  if(url.pathname==='/api/update'){
   if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'json_required'},415);
   const text=await request.text();if(text.length>100000)return json({error:'too_large'},413);let body;try{body=JSON.parse(text);validateImport(body);}catch(e){return json({error:String(e.message)},400);}
   const written=[];if(body.latest)written.push(await persist(env,body.latest));for(const a of body.annual||[])written.push(await persist(env,a));memory=null;return json({ok:true,written});
  }
  const data=await getData(env,true);let annualStatus='unavailable';try{const a=await latestAnnual();await persist(env,a);annualStatus='stored:'+a.year;}catch(e){log('annual_refresh',e);}
  const wb=await getWorldbank(env,true);return json({ok:data.status==='live',latestStatus:data.status,published:data.published,annualStatus,worldbankStatus:wb.status,archiveAvailable:!!env.BUCKET});
 }
 if(url.pathname==='/'&&request.method==='GET')return new Response(PAGE,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
 if(url.pathname==='/favicon.ico')return new Response(null,{status:204});return json({error:'not_found'},404);
 }catch(e){log('request',e);return json({error:'request_failed'},500);}}};
