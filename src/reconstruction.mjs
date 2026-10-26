// Shared deterministic calculations used by the browser and verification scripts.
export function speechOLS(points){
 const a=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));if(a.length<3)throw Error('至少需要3个有效观测');const n=a.length,mx=a.reduce((s,p)=>s+p.x,0)/n,my=a.reduce((s,p)=>s+p.y,0)/n;
 const xx=a.reduce((s,p)=>s+(p.x-mx)**2,0),xy=a.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0),yy=a.reduce((s,p)=>s+(p.y-my)**2,0);if(xx<1e-12)throw Error('横轴没有变化');const slope=xy/xx,intercept=my-slope*mx,sse=a.reduce((s,p)=>s+(p.y-slope*p.x-intercept)**2,0);return {n,slope,intercept,r2:yy?1-sse/yy:0,residualSD:Math.sqrt(sse/(n-2))};
}
export function sampleAggregation(input){
 if(!Array.isArray(input)||!input.length)throw Error('没有公司记录');if(input.length>100000)throw Error('最多100000条记录');
 const seen=new Set(),groups=new Map(),periodMembers=new Map(),byPeriod=new Map();
 for(const r of input){const {company_id,period,group}=r;if(!company_id||!/^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/.test(period)||!['支持','中性','限制'].includes(group))throw Error('需要company_id、YYYY或YYYY-MM格式period与明确group');
  const key=company_id+'|'+period;if(seen.has(key))throw Error('同一公司同期重复：'+key+'。请先处理A/H/ADR交叉上市，不能重复计算合并营收。');seen.add(key);
  if(groups.has(company_id)&&groups.get(company_id)!==group)throw Error('固定样本公司的分类跨期改变：'+company_id);groups.set(company_id,group);
  for(const k of ['revenue_cny','market_cap_cny','employees'])if(r[k]===''||r[k]===null||!Number.isFinite(Number(r[k]))||Number(r[k])<0)throw Error('数值缺失或无效：'+company_id+' / '+k);
  if(!Number.isInteger(Number(r.employees)))throw Error('员工人数必须是整数');
  if(!periodMembers.has(period))periodMembers.set(period,new Set());periodMembers.get(period).add(company_id);
  if(!byPeriod.has(period))byPeriod.set(period,Object.fromEntries(['支持','中性','限制'].map(g=>[g,{revenue:0,cap:0,employees:0}])));
  const target=byPeriod.get(period)[group];target.revenue+=Number(r.revenue_cny);target.cap+=Number(r.market_cap_cny);target.employees+=Number(r.employees);
 }
 for(const [p,members]of periodMembers)if(members.size!==groups.size)throw Error(p+'不是相同固定样本，缺失公司不能按零补齐。');
 const rows=[];for(const [period,groupData]of [...byPeriod].sort((a,b)=>a[0].localeCompare(b[0]))){const totalRev=Object.values(groupData).reduce((s,g)=>s+g.revenue,0),totalCap=Object.values(groupData).reduce((s,g)=>s+g.cap,0);if(!totalRev||!totalCap)throw Error('全样本营收或市值为零');const priorPeriod=String(Number(period.slice(0,4))-1)+period.slice(4),prior=byPeriod.get(priorPeriod);
  for(const [group,g]of Object.entries(groupData))rows.push({period,group,revenue:g.revenue,marketCap:g.cap,employees:g.employees,revenueShare:g.revenue/totalRev*100,capShare:g.cap/totalCap*100,revenueYoY:prior?.[group].revenue?100*(g.revenue/prior[group].revenue-1):null,employeeYoY:prior?.[group].employees?100*(g.employees/prior[group].employees-1):null});
 }
 return {scope:'自定义固定样本；未与原作者证券名单核对',companies:groups.size,periods:[...byPeriod.keys()].sort(),rows,groupCounts:Object.fromEntries(['支持','中性','限制'].map(g=>[g,[...groups.values()].filter(v=>v===g).length])),notes:['所有金额必须预先统一成人民币；合并报表按公司去重。','只比较同一月份或年度格式的同比，不把年度和季度累计混算。','本工具不构造作者未披露权重和复权规则的股价指数。']};
}
export function parseCompanyCSV(text){
 const lines=text.trim().replace(/^\uFEFF/,'').split(/\r?\n/),head=lines.shift().split(',').map(s=>s.trim());if(head.some(s=>s.includes('"')))throw Error('模板使用不带引号的简单CSV');return lines.filter(s=>s.trim()).map((line,i)=>{const a=line.split(',').map(s=>s.trim());if(a.length!==head.length)throw Error('第'+(i+2)+'行列数不匹配');return Object.fromEntries(head.map((k,j)=>[k,a[j]]));});
}
export function worldbankEvents(dataset,windowMode='exclude0'){
 const get=(country,year)=>{const v=dataset.observations.find(r=>r.country===country&&r.year===year)?.value;return typeof v==='number'?v:null};
 const definitions=[['CHN',2021,'中国2021'],['ESP',1978,'西班牙1978'],['SWE',1991,'瑞典1991'],['USA',2008,'美国2008'],['DNK',2008,'丹麦2008'],['JPN',1991,'日本1991'],['ESP',2008,'西班牙2008'],['FIN',1991,'芬兰1991']];
 const adjusted=(country,year)=>country==='CHN'&&year===2021?(get(country,2020)===null||get(country,2021)===null?null:100*(Math.sqrt((1+get(country,2020)/100)*(1+get(country,2021)/100))-1)):get(country,year);
 const avg=a=>a.some(x=>x===null)?null:a.reduce((s,v)=>s+v,0)/a.length;
 const events=definitions.map(([country,year,label])=>{const preYears=windowMode==='include0'?[year-2,year-1,year]:[year-3,year-2,year-1],postYears=windowMode==='postIncludes0'?[year,year+1,year+2]:[year+1,year+2,year+3],before=avg(preYears.map(y=>adjusted(country,y))),after=avg(postYears.map(y=>adjusted(country,y)));return {country,year,label,preYears,postYears,before,after,difference:before===null||after===null?null:after-before,path:Array.from({length:21},(_,i)=>({x:i,label:String(i-10),y:adjusted(country,year+i-10)}))};});
 return {events,averagePath:Array.from({length:21},(_,i)=>({x:i,label:String(i-10),y:avg(events.slice(1).map(e=>e.path[i].y))})),windowMode};
}
export function speechChartSVG(chart,{width=960,height=430,showFit=true,computedFit=null}={}){
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const pad={l:75,r:chart.axis?.right?80:30,t:64,b:100},w=width-pad.l-pad.r,h=height-pad.t-pad.b;
 const scatter=chart.kind==='scatter',bar=chart.kind==='bar',all=chart.series.flatMap(s=>s.points.filter(p=>Number.isFinite(p.y)));
 const xr=scatter?chart.axis.x:[0,Math.max(...all.map(p=>p.x),1)];
 const left=chart.axis.left||[Math.min(0,...all.map(p=>p.y)),Math.max(...all.map(p=>p.y))];
 // Extend to show observations outside labelled tick extents, but preserve right-axis units.
 const lr=[Math.min(left[0],...chart.series.filter(s=>s.axis!=='right').flatMap(s=>s.points.filter(p=>Number.isFinite(p.y)).map(p=>p.y))),Math.max(left[1],...chart.series.filter(s=>s.axis!=='right').flatMap(s=>s.points.filter(p=>Number.isFinite(p.y)).map(p=>p.y)))];
 const x=v=>pad.l+(bar?(v+.5)/(xr[1]+1):(v-xr[0])/(xr[1]-xr[0]||1))*w;
 const y=(v,axis)=>{const range=axis==='right'?chart.axis.right:lr;return pad.t+h-(v-range[0])/(range[1]-range[0]||1)*h};
 const f=v=>Math.abs(v)>=1000?Math.round(v).toLocaleString('en-US'):Math.abs(v)<2?Number(v.toFixed(2)):Number(v.toFixed(1));
 const clipId='clip-'+Array.from(chart.id||chart.title).map(c=>c.codePointAt(0).toString(16)).join('-');
 let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+esc(chart.title)+'" style="font-family:system-ui,sans-serif;background:#fffef9"><title>'+esc(chart.title)+'</title><defs><clipPath id="'+clipId+'"><rect x="'+pad.l+'" y="'+pad.t+'" width="'+w+'" height="'+h+'"/></clipPath></defs>';
 svg+='<text x="'+pad.l+'" y="23" fill="#173c35" font-size="17" font-weight="600">'+esc(chart.title)+'</text>';
 const ticks=chart.axis.yTicks||Array.from({length:6},(_,i)=>lr[0]+(lr[1]-lr[0])*i/5);
 for(const v of ticks){const yy=y(v);svg+='<line x1="'+pad.l+'" y1="'+yy+'" x2="'+(pad.l+w)+'" y2="'+yy+'" stroke="#e1e7da"/><text x="'+(pad.l-10)+'" y="'+(yy+4)+'" text-anchor="end" fill="#697469" font-size="12">'+f(v)+'</text>';}
 if(chart.axis.right){const range=chart.axis.right,rt=chart.axis.rightTicks||Array.from({length:6},(_,i)=>range[0]+(range[1]-range[0])*i/5);for(const v of rt)svg+='<text x="'+(pad.l+w+10)+'" y="'+(y(v,'right')+4)+'" fill="#697469" font-size="12">'+f(v)+'</text>';}
 if(lr[0]<0&&lr[1]>0)svg+='<line x1="'+pad.l+'" y1="'+y(0)+'" x2="'+(pad.l+w)+'" y2="'+y(0)+'" stroke="#abb7a5"/>';
 const labels=scatter?(chart.axis.xTicks||Array.from({length:6},(_,i)=>xr[0]+(xr[1]-xr[0])*i/5)).map(v=>({x:v,text:f(v)})):(chart.labels||[]).map((text,i)=>({x:i,text})).filter((p,i,a)=>i===0||i===a.length-1||p.text==='0'||(a.length<=21&&String(p.text).length<=5)||i%Math.max(1,Math.ceil(a.length/(bar?8:7)))===0);
 for(const p of labels)svg+='<text x="'+x(p.x)+'" y="'+(pad.t+h+23)+'" text-anchor="middle" font-size="11" fill="#697469">'+esc(p.text)+'</text>';
 svg+='<text x="'+pad.l+'" y="47" font-size="12" fill="#697469">'+esc(chart.yLabel||chart.unit||'%')+'</text>';
 if(chart.axis.right)svg+='<text x="'+(pad.l+w)+'" y="47" text-anchor="end" font-size="12" fill="#697469">右轴 '+esc(chart.unit)+'</text>';
 if(chart.xLabel)svg+='<text x="'+(pad.l+w/2)+'" y="'+(height-59)+'" text-anchor="middle" font-size="12" fill="#697469">'+esc(chart.xLabel)+'</text>';
 svg+='<g clip-path="url(#'+clipId+')">';
 if(scatter&&showFit){const fit=computedFit?xr.map(xx=>({x:xx,y:computedFit.slope*xx+computedFit.intercept})):chart.drawnFit;if(fit?.length)svg+='<polyline points="'+fit.map(p=>x(p.x)+','+y(p.y)).join(' ')+'" fill="none" stroke="#627363" stroke-dasharray="5 4" stroke-width="1.8"/>';}
 chart.series.forEach((series,si)=>{const color=series.color||'#4f81bd';if(bar){const bw=w/(xr[1]+1)*.7/chart.series.length;for(const p of series.points){if(!Number.isFinite(p.y))continue;const zero=y(Math.max(lr[0],Math.min(lr[1],0))),yy=y(p.y);svg+='<rect x="'+(x(p.x)-bw*chart.series.length/2+si*bw)+'" y="'+Math.min(zero,yy)+'" width="'+(bw-2)+'" height="'+Math.max(1,Math.abs(zero-yy))+'" fill="'+(p.color||color)+'"><title>'+esc(series.name+' · '+p.label+'：'+p.y)+'</title></rect>';}}
 else if(scatter){for(const p of series.points)svg+='<circle cx="'+x(p.x)+'" cy="'+y(p.y)+'" r="4" fill="'+(p.color||color)+'" opacity=".86"><title>'+esc(p.label+'：x='+p.x+'，y='+p.y)+'</title></circle>';}
 else{let seg=[];const flush=()=>{if(seg.length)svg+='<polyline points="'+seg.map(p=>x(p.x)+','+y(p.y,series.axis)).join(' ')+'" fill="none" stroke="'+color+'" stroke-width="'+(series.dashed?1.6:2.1)+'" '+(series.dashed?'stroke-dasharray="5 4"':'')+'/>';seg=[];};for(const p of series.points){if(Number.isFinite(p.y))seg.push(p);else flush();}flush();if(!series.dashed)for(const p of series.points)if(Number.isFinite(p.y))svg+='<circle cx="'+x(p.x)+'" cy="'+y(p.y,series.axis)+'" r="'+(series.points.length<25?3:2)+'" fill="'+(p.color||color)+'"><title>'+esc(series.name+' · '+p.label+'：'+p.y+(series.axis==='right'?'（右轴）':''))+'</title></circle>';}});
 svg+='</g>';
 let legends=chart.series.map(s=>({name:s.name,color:s.color||'#4f81bd',dashed:s.dashed}));
 if(scatter&&chart.page===24)legends=[{name:'2013—2019',color:'#4f81bd'},{name:'2023',color:'#ff0000'},{name:'2024（当时估计）',color:'#9bbb59'}];
 if(scatter&&chart.page===25)legends=[{name:'2000—2021',color:'#4f81bd'},{name:'2022—2023',color:'#ff0000'}];
 let lx=pad.l,ly=height-37;for(const item of legends){const name=item.name.replace(' · 原图趋势线','（趋势）');const tw=Array.from(name).reduce((s,c)=>s+(c.charCodeAt(0)>255?10:6),0)+30;if(lx+tw>width-pad.r){lx=pad.l;ly+=16;}
 svg+='<line x1="'+lx+'" y1="'+(ly-4)+'" x2="'+(lx+16)+'" y2="'+(ly-4)+'" stroke="'+item.color+'" stroke-width="2" '+(item.dashed?'stroke-dasharray="4 3"':'')+'/><text x="'+(lx+21)+'" y="'+ly+'" fill="#697469" font-size="11">'+esc(name)+'</text>';lx+=tw;}
 svg+='<text x="'+pad.l+'" y="'+(height-7)+'" font-size="10" fill="#87917f">'+esc(chart.page?'原稿 P'+chart.page+' · 图中数值恢复 / 标注值 · 非原始底表复算':chart.provenance||'公开数据独立计算；来源与版本见网页说明')+'</text>';
 return svg+'</svg>';
}
