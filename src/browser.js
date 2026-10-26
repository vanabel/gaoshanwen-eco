const $=id=>document.getElementById(id);
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function storageGet(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function storageSet(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
let data=JSON.parse($('initial-data').textContent).latest, reports=JSON.parse($('initial-data').textContent).annual;
let mode='all',saved=new Set(Array.isArray(storageGet('watch',[]))?storageGet('watch',[]):[]),selectedYear=null;
const number=x=>x===null||x===undefined?'—':Number(x).toFixed(1);
function render(){if(!data?.metrics)return;
 $('cards').innerHTML=data.metrics.filter(m=>mode==='all'||saved.has(m.id)).map(m=>'<article class="card"><button class="star" data-id="'+escapeHTML(m.id)+'" aria-label="关注'+escapeHTML(m.label)+'" aria-pressed="'+saved.has(m.id)+'">'+(saved.has(m.id)?'★':'☆')+'</button><div class="label">'+escapeHTML(m.label)+'</div><div class="value">'+number(m.value)+'<small>'+(m.value===null?'':m.id==='pmi'?'':'%')+'</small></div><div class="meta">'+escapeHTML(m.period)+' · '+escapeHTML(m.basis)+'</div><div class="meta">'+(m.value===null?'待核验':'官方公布值')+'</div><a class="source" href="'+escapeHTML(data.source)+'" target="_blank" rel="noopener">国家统计局原文 ↗</a></article>').join('')||'<p>点击全部指标中的 ☆ 添加关注。</p>';
 $('chart').innerHTML=(data.quarters||[]).length?data.quarters.map(q=>'<div class="barrow"><span>'+escapeHTML(q.label)+'</span><div class="bar" style="width:'+Math.min(100,Math.max(0,q.value)*15)+'%"></div><strong>'+number(q.value)+'%</strong></div>').join(''):'本篇发布未提供可解析的当年季度序列';
 document.querySelectorAll('.star').forEach(b=>b.onclick=()=>{saved.has(b.dataset.id)?saved.delete(b.dataset.id):saved.add(b.dataset.id);storageSet('watch',[...saved]);render()});
}
function showStatus(status='archived',failed=false){
 const live=status==='live'||status==='stored';
 $('error').style.display=live&&!failed?'none':'block';
 $('error').textContent=failed?'在线检查未完成，已保留可阅读的核验存档；不是实时确认的最新数据。':'当前展示已核验存档；在线更新暂未成功。数据仍可查看、导出，统计期与存档时间如下。';
 $('stamp').textContent=(live?'在线核验':'核验存档')+' · 来源发布 '+data.published+' · '+(live?'核验':'存档')+' '+new Date(data.fetchedAt).toLocaleString('zh-CN',{timeZone:'Asia/Singapore'});
}
function progressRecord(){const year=Number(data.metrics.find(m=>m.id==='gdp')?.period.match(/\d{4}/)?.[0]||data.published.slice(0,4));return {...data,year,kind:'progress',title:year+'年度经济观察 · 进展版',period:data.metrics.find(m=>m.id==='gdp')?.period||'截至最新发布',sourceTitle:'国家统计局综合经济运行报告'};}
function currentReports(){const p=progressRecord();return (reports.some(r=>r.year===p.year)?reports:[...reports,p]).sort((a,b)=>a.year-b.year);}
function reportSummary(r){const v=id=>r.metrics.find(m=>m.id===id)?.value;const f=id=>v(id)===null||v(id)===undefined?'公报未列同口径数据':number(v(id))+'%';if(r.kind!=='annual')return [{title:'本年进展，保留原统计期',body:'本页数据截至 '+r.period+'。当月值、累计值和季度值分别保留，尚不构成完整年度判断。'},{title:'继续观察，而非提前定论',body:'以消费、就业、物价与房地产的后续发布交叉检验。完整年报待次年官方年度公报发布后形成。'}];return [{title:'消费与收入',body:v('spending')===null||v('income')===null?'全年社零名义增长 '+f('retail')+'。该公报未同时列出全国居民收支的同口径实际同比；本页保留缺项，不用城乡分组指标补齐。':'全年社零名义增长 '+f('retail')+'；人均消费支出实际增长 '+f('spending')+'，可支配收入实际增长 '+f('income')+'。这组数据提供需求线索，不能直接替代省际人口消费模型。'},{title:'就业',body:v('unemployment')===null?'该公报未列全国城镇调查失业率全年均值。本页不以登记失业率或年末调查失业率代替。':'全年城镇调查失业率平均为 '+f('unemployment')+'。该比率不能直接换算成流失就业人数，也不能代表青年分组失业率。'},{title:'房地产调整',body:'全年开发投资同比 '+f('property')+'，'+r.metrics.find(m=>m.id==='sales').label+'同比 '+f('sales')+'。投资与销售分别观察，不能凭单项变化宣布整个调整周期结束。'},{title:'供给与总量',body:'规模以上工业实际增长 '+f('industry')+'，实际 GDP 增长 '+f('gdp')+'。这是官方统计的交叉观察，未独立验证演讲中对增长数据的质疑。'}];}
function renderReports(){
 const list=currentReports();if(!list.length)return;renderHistory(list);
 if(!list.some(r=>r.year===Number(selectedYear)))selectedYear=(list.filter(r=>r.kind==='annual').at(-1)||list.at(-1)).year;
 $('report-year').innerHTML=[...list].reverse().map(r=>'<option value="'+r.year+'" '+(r.year===Number(selectedYear)?'selected':'')+'>'+r.year+' · '+(r.kind==='annual'?'完整年度':'进展版')+'</option>').join('');
 const r=list.find(r=>r.year===Number(selectedYear)),previous=list.find(x=>x.year===r.year-1&&x.kind==='annual');
 $('report-title').textContent=r.title;
 $('report-period').textContent=(r.kind==='annual'?'完整年度 · ':'进展版 · ')+r.period+' · 来源发布 '+r.published+' · 核验存档 '+new Date(r.fetchedAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Singapore'});
 $('report-note').textContent=r.kind==='annual'?'按官方年度公报组织的历史复盘，保留各版公报公布值，不是统一修订后的历史序列。'+(r.notes||[]).join(' '):'本年尚未形成完整年度结果。以下保留当月、累计或季度口径，不与上年全年结果计算差值。';
 const canCompare=r.kind==='annual'&&previous;
 $('report-head').innerHTML='<tr><th>指标</th><th>'+r.year+'年</th>'+(canCompare?'<th>'+previous.year+'年</th><th>公布值变化</th>':'')+'<th>统计口径</th></tr>';
 $('report-table').innerHTML=r.metrics.map(m=>{const p=previous?.metrics.find(x=>x.id===m.id&&x.basis===m.basis);let diff='—';if(canCompare&&m.value!==null&&p?.value!==undefined&&p.value!==null){const d=Number((m.value-p.value).toFixed(1));diff=d===0?'持平':(d>0?'+':'')+d.toFixed(1)+' 个百分点';}return '<tr><td>'+escapeHTML(m.label)+'</td><td>'+number(m.value)+(m.value===null||m.id==='pmi'?'':'%')+'</td>'+(canCompare?'<td>'+number(p?.value)+(p?.value===null||p?.value===undefined?'':'%')+'</td><td>'+diff+'</td>':'')+'<td>'+escapeHTML(m.period)+' · '+escapeHTML(m.basis)+(m.missingReason?'<br><small>'+escapeHTML(m.missingReason)+'</small>':'')+'</td></tr>';}).join('');
 $('report-findings').innerHTML=reportSummary(r).map(x=>'<div class="report-finding"><h3>'+escapeHTML(x.title)+'</h3><p>'+escapeHTML(x.body)+'</p></div>').join('');
 $('report-source').href=r.source;$('report-source').textContent=r.sourceTitle+' ↗';
 $('report-previous').innerHTML=canCompare?'比较来源：<a href="'+escapeHTML(previous.source)+'" target="_blank" rel="noopener">'+escapeHTML(previous.sourceTitle)+' ↗</a>':'';
 $('download-report').href='/api/reports/'+r.year+'.md';
 renderAnnualJudgments(r);if(window.judgmentsReady)renderJudgments();
}
async function load(force=false){$('refresh').disabled=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);try{
 const r=await fetch('/api/data'+(force?'?refresh=1':''),{signal:controller.signal,cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const incoming=await r.json();if(!Array.isArray(incoming.metrics)||!incoming.source)throw Error('invalid response');data=incoming;storageSet('snapshot',data);showStatus(data.status);render();renderReports();
 }catch{showStatus('archived',true);render();}finally{clearTimeout(timer);$('refresh').disabled=false;}}
async function loadReports(){try{const r=await fetch('/api/reports',{cache:'no-store'});if(!r.ok)return;const d=await r.json();if(Array.isArray(d.reports))reports=d.reports;renderReports();}catch{/* The bundled, verified annual archive remains available. */}}
$('refresh').onclick=()=>load(true).then(loadReports);$('all').onclick=()=>{mode='all';$('all').classList.add('active');$('watch').classList.remove('active');render()};$('watch').onclick=()=>{mode='watch';$('watch').classList.add('active');$('all').classList.remove('active');render()};
$('export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='economy-'+data.published+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$('report-year').onchange=()=>{selectedYear=Number($('report-year').value);renderReports()};$('print-report').onclick=()=>window.print();
render();showStatus();renderReports();load().then(loadReports);setInterval(()=>load().then(loadReports),1800000);

function renderHistory(list){
 const annual=list.filter(r=>r.kind==='annual');const selector=$('history-metric');const id=selector.value||'gdp';
 if(!selector.innerHTML){selector.innerHTML=annual.at(-1).metrics.map(m=>'<option value="'+escapeHTML(m.id)+'">'+escapeHTML(m.label)+'</option>').join('');selector.value=id;selector.onchange=()=>renderHistory(currentReports());}
 const points=annual.map(r=>({year:r.year,source:r.source,m:r.metrics.find(m=>m.id===id)}));
 const values=points.map(p=>p.m?.value).filter(v=>typeof v==='number');if(!values.length){$('history-chart').textContent='没有同口径数据';return;}
 const width=960,height=240,pad=35,min=Math.min(0,...values),max=Math.max(...values)+1,span=max-min||1;
 const x=y=>pad+(y-annual[0].year)/(annual.at(-1).year-annual[0].year||1)*(width-pad*2),yp=v=>height-pad-(v-min)/span*(height-pad*2);
 let segments=[],line=[];for(const p of points){if(p.m?.value===null||p.m?.value===undefined){if(line.length)segments.push(line);line=[];}else line.push(p);}if(line.length)segments.push(line);
 let svg='<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="2012年以来'+escapeHTML(selector.options?.[selector.selectedIndex]?.text||id)+'年度公布值趋势" style="width:100%;height:auto;max-height:300px"><line x1="'+pad+'" y1="'+yp(0)+'" x2="'+(width-pad)+'" y2="'+yp(0)+'" stroke="#cad3c1"/>';
 for(const level of [min,max])svg+='<text x="0" y="'+yp(level)+'" font-size="12" fill="#737d73">'+level.toFixed(1)+'</text>';
 for(const seg of segments)svg+='<polyline fill="none" stroke="#406b4f" stroke-width="2.5" points="'+seg.map(p=>x(p.year)+','+yp(p.m.value)).join(' ')+'"/>';
 for(const p of points){if(p.m?.value!==null&&p.m?.value!==undefined)svg+='<circle cx="'+x(p.year)+'" cy="'+yp(p.m.value)+'" r="4" fill="#406b4f"><title>'+p.year+'：'+number(p.m.value)+'% · '+escapeHTML(p.m.basis)+'</title></circle>';if(p.year%2===0||p.year===annual.at(-1).year)svg+='<text x="'+x(p.year)+'" y="'+(height-7)+'" text-anchor="middle" font-size="12" fill="#737d73">'+p.year+'</text>';}
 $('history-chart').innerHTML=svg+'</svg>';
 $('history-note').textContent='单位：%。'+(id==='unemployment'?'仅展示各年公报列出的全年调查失业率均值；不以年末调查值或登记失业率补齐缺口。':id==='income'||id==='spending'?'全国居民实际同比；早期公报未列的项目留空，不用城乡分组数据替代。':id==='sales'?'早年为“商品房销售面积”，近年名称为“新建商品房销售面积”；按各版公报原口径列出。':'按当年公报公布值观察；经济普查、基期与样本修订可能影响可比性。');
 $('history-table').innerHTML=points.map(p=>'<tr><td>'+p.year+'</td><td>'+number(p.m?.value)+(p.m?.value===null||p.m?.value===undefined?'':'%')+'</td><td>'+escapeHTML(p.m?.missingReason||p.m?.basis)+'</td><td><a href="'+escapeHTML(p.source)+'" target="_blank" rel="noopener">原文 ↗</a></td></tr>').join('');
}
