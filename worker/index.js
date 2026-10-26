export function plain(s){return s.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;|&ensp;|&emsp;/g,'').replace(/\s+/g,'');}
export function parse(html,source){
 const t=plain(html), published=source.match(/t(\d{4})(\d{2})(\d{2})_/)?.slice(1).join('-')||'未知';
 const publicationYear=Number(source.match(/t(\d{4})/)?.[1]);
 const publicationMonth=Number(source.match(/t\d{4}(\d{2})/)?.[1]);
 const year=String(publicationMonth<=2&&/全年[，,]?社会消费品零售总额/.test(t)?publicationYear-1:publicationYear);
 const pm=t.match(/(\d{1,2})月份，全国城镇调查失业率为/);const month=pm?.[1];
 const monthPeriod=month?year+'年'+month+'月':'统计期待核验';
 const cumulative=t.match(/(前三季度|上半年|一季度|全年|1[—－-]\d{1,2}月份)，?社会消费品零售总额/)?.[1]||'本报告累计期';
 function v(re){const m=[...t.matchAll(re)].at(-1);if(!m)return null;let n=Number(m[2]);return /下降/.test(m[1])?-n:n;}
 const specs=[
 ['retail','社会消费品零售',new RegExp((month?month:'\\d{1,2}')+'月份，社会消费品零售总额[^。]{0,45}?同比(增长|下降)([\\d.]+)%','g'),monthPeriod,'当月同比'],
 ['unemployment','城镇调查失业率',/全国城镇调查失业率(为)([\d.]+)%/g,monthPeriod,'当月水平'],
 ['core','核心 CPI',/\d{1,2}月份核心CPI同比(上涨|下降)([\d.]+)%/g,monthPeriod,'当月同比'],
 ['property','房地产开发投资',/房地产开发投资(?:同比)?(增长|下降)([\d.]+)%/g,year+'年'+cumulative,'累计同比'],
 ['sales','新建商品房销售面积',/新建商品房销售面积[^。]{0,30}?同比(增长|下降)([\d.]+)%/g,year+'年'+cumulative,'累计同比'],
 ['pmi','制造业 PMI',/制造业采购经理指数(为)([\d.]+)%/g,monthPeriod,'当月指数 · 50为荣枯线'],
 ['industry','规模以上工业增加值',new RegExp((month?month:'\\d{1,2}')+'月份，(?:全国)?规模以上工业增加值同比(增长|下降)([\\d.]+)%','g'),monthPeriod,'当月实际同比'],
 ['gdp','实际 GDP',/国内生产总值\d+亿元，按不变价格计算，同比(增长|下降)([\d.]+)%/g,year+'年'+cumulative,'累计实际同比']];
 const metrics=specs.map(([id,label,re,period,basis])=>({id,label,value:v(re),period,basis}));
 const block=t.match(/分季度看，([\s\S]{0,170}?)从环比看/)?.[1]||'';
 const quarters=[...block.matchAll(/([一二三四])季度(?:国内生产总值同比)?增长([\d.]+)%/g)].map(m=>({label:year+' Q'+({'一':1,'二':2,'三':3,'四':4}[m[1]]),value:Number(m[2])}));
 if(metrics.filter(m=>m.value!==null).length<4)throw Error('Official release schema changed');
 return {source,published,fetchedAt:new Date().toISOString(),metrics,quarters,updatePolicy:'On request, cached 30 minutes; browser checks every 30 minutes'};
}

export function parseAnnual(html,source,expectedYear){
 const t=plain(html).replace(/\[\d+\]/g,'');
 const y=t.match(/中华人民共和国(\d{4})年国民经济和社会发展统计公报/)?.[1];
 if(!y || (expectedYear && Number(y)!==Number(expectedYear)))throw Error('annual_year_mismatch');
 const year=Number(y);
 const signed=t.match(new RegExp('('+String(year+1)+')年(\\d{1,2})月(\\d{1,2})日'));
 const published=signed?signed.slice(1).map((v,i)=>i? v.padStart(2,'0'):v).join('-'):source.match(/t(\d{4})(\d{2})(\d{2})_/)?.slice(1).join('-');
 function v(re){const m=t.match(re);if(!m)return null;return /下降/.test(m[1])?-Number(m[2]):Number(m[2]);}
 const specs=[
 ['gdp','实际 GDP',/全年国内生产总值\d+亿元，比上年(增长|下降)([\d.]+)%/,'全年实际同比'],
 ['retail','社会消费品零售',/全年社会消费品零售总额\d+亿元，比上年(增长|下降)([\d.]+)%/,'全年名义同比'],
 ['unemployment','城镇调查失业率',/全年全国城镇调查失业率平均值(为)([\d.]+)%/,'全年平均值'],
 ['cpi','居民消费价格 CPI',/全年居民消费价格比上年(上涨|下降)([\d.]+)%/,'全年同比'],
 ['property','房地产开发投资',/全年房地产开发投资\d+亿元，比上年(增长|下降)([\d.]+)%/,'全年同比'],
 ['sales','新建商品房销售面积',/不可能自动匹配(增长)(0)%/,'全年同比'],
 ['industry','规模以上工业增加值',/规模以上工业增加值(增长|下降)([\d.]+)%/,'全年实际同比'],
 ['income','居民人均可支配收入',/(?:全年)?全国居民人均可支配收入\d+元，比上年(?:增长|下降)[\d.]+%，扣除价格因素，实际(增长|下降)([\d.]+)%/,'全年实际同比'],
 ['spending','居民人均消费支出',/(?:全年)?全国居民人均消费支出\d+元，比上年(?:增长|下降)[\d.]+%，扣除价格因素，实际(增长|下降)([\d.]+)%/,'全年实际同比']
 ];
 const metrics=specs.map(([id,label,re,basis])=>({id,label,value:v(re),basis,period:year+'年全年'}));
 const sales=metrics.find(m=>m.id==='sales');
 for(const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>plain(m[1]).replace(/\[\d+\]/g,''));
  if(/^(新建)?商品房销售面积$/.test(cells[0])&&/^-?\d+(?:\.\d+)?$/.test(cells.at(-1)||'')){sales.value=Number(cells.at(-1));break;}
 }
 if(t.includes('全年居民消费价格与上年持平'))metrics.find(m=>m.id==='cpi').value=0;
 if(year<2023)sales.label='商品房销售面积';
 for(const m of metrics){if(m.value===null){m.missingReason=m.id==='unemployment'?'该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。':m.id==='income'||m.id==='spending'?'该公报未列同口径全国居民实际同比；城乡分组指标不替代全国指标。':'未能从该公报可靠取得该口径数据。';}}
 const notes=['采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。','调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。','全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。'];
 if(year===2021)notes.push('2021年含低基数影响；本页列一年同比，不以两年平均增速替代。');
 if(metrics.filter(m=>m.value!==null).length<6)throw Error('annual_schema_changed');
 return {year,kind:'annual',title:year+'年度经济观察报告',period:year+'年全年',published,fetchedAt:new Date().toISOString(),source,sourceTitle:'中华人民共和国'+year+'年国民经济和社会发展统计公报',notes,metrics};
}

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

export function judgmentsForYear(db,year){return db.records.filter(r=>Number(r.publishedAt.slice(0,4))===Number(year));}
export function judgmentPhase(year,date){const y=Number(date.slice(0,4));return year<y?'判断前背景':year===y?'形成当年（含判断前月份）':'判断后全年';}
export function judgmentMetricRows(reports,ids){return reports.filter(r=>r.kind==='annual').sort((a,b)=>a.year-b.year).map(r=>({year:r.year,source:r.source,values:ids.map(id=>({id,...r.metrics.find(m=>m.id===id)}))}));}
export function judgmentYearText(db,report){
 const records=judgmentsForYear(db,report.year);let s='\n## 高善文当时的判断（来源摘要）\n\n';
 s+='以下为本站对公开资料的转述，并非本人撰写的年度报告，也不代表当年全部观点。按资料公开年份归档，演讲日与公开日分别保留。\n\n';
 if(!records.length)s+='本次来源集中尚无该年已核实的观点条目；留空不表示当年没有发表观点。\n\n';
 for(const r of records){s+='### '+r.title+'\n\n公开：'+r.publishedAt+'；演讲：'+(r.spokenAt||'未核实到具体日期')+'；来源类型：'+r.sourceType+(r.sourcePublishedAt?'；本存档刊载：'+r.sourcePublishedAt:'')+'。\n\n'+r.summary+'\n\n适用时间与条件：'+r.horizon+'；'+r.condition+'\n\n核对边界：'+r.limit+'\n\n来源：['+r.sourceTitle+']('+r.source+')\n\n';}
 if(report.year>=2024){s+='### 持续追踪：2024-12-03 演讲的判断\n\n'+(report.year===2024?'2024全年含演讲前月份，属于判断形成背景，不能当作事后预测验证。':'以下与后来数据对照，属于本站复盘，并非讲者在本年发表的新观点。')+'\n\n';for(const t of db.theses)s+='- '+t.title+'：'+t.summary+' 观察：'+t.watch+'；边界：'+t.limit+'\n';s+='\n来源：['+db.speechSource.title+']('+db.speechSource.url+')；第三方听打稿，不是审定稿。\n';}
 else s+='2024年的判断尚未提出；本年数据仅可作为后来研究的历史背景，不将后来的观点写成当年的预测。\n';
 return s;
}

const INDEX='https://www.stats.gov.cn/sj/zxfb/';
const SEED={
  "annual": [
    {
      "year": 2012,
      "kind": "annual",
      "title": "2012年度经济观察报告",
      "period": "2012年全年",
      "published": "2013-02-22",
      "fetchedAt": "2026-10-25T21:32:36.556Z",
      "source": "https://www.stats.gov.cn/sj/tjgb/ndtjgb/qgndtjgb/202302/t20230206_1901956.html",
      "sourceTitle": "中华人民共和国2012年国民经济和社会发展统计公报",
      "notes": [
        "采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。",
        "调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。",
        "全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。"
      ],
      "metrics": [
        {
          "id": "gdp",
          "label": "实际 GDP",
          "value": 7.8,
          "basis": "全年实际同比",
          "period": "2012年全年"
        },
        {
          "id": "retail",
          "label": "社会消费品零售",
          "value": 14.3,
          "basis": "全年名义同比",
          "period": "2012年全年"
        },
        {
          "id": "unemployment",
          "label": "城镇调查失业率",
          "value": null,
          "basis": "全年平均值",
          "period": "2012年全年",
          "missingReason": "该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。"
        },
        {
          "id": "cpi",
          "label": "居民消费价格 CPI",
          "value": 2.6,
          "basis": "全年同比",
          "period": "2012年全年"
        },
        {
          "id": "property",
          "label": "房地产开发投资",
          "value": 16.2,
          "basis": "全年同比",
          "period": "2012年全年"
        },
        {
          "id": "sales",
          "label": "商品房销售面积",
          "value": 1.8,
          "basis": "全年同比",
          "period": "2012年全年"
        },
        {
          "id": "industry",
          "label": "规模以上工业增加值",
          "value": 10,
          "basis": "全年实际同比",
          "period": "2012年全年"
        },
        {
          "id": "income",
          "label": "居民人均可支配收入",
          "value": null,
          "basis": "全年实际同比",
          "period": "2012年全年",
          "missingReason": "该公报未列同口径全国居民实际同比；城乡分组指标不替代全国指标。"
        },
        {
          "id": "spending",
          "label": "居民人均消费支出",
          "value": null,
          "basis": "全年实际同比",
          "period": "2012年全年",
          "missingReason": "该公报未列同口径全国居民实际同比；城乡分组指标不替代全国指标。"
        }
      ]
    },
    {
      "year": 2013,
      "kind": "annual",
      "title": "2013年度经济观察报告",
      "period": "2013年全年",
      "published": "2014-02-24",
      "fetchedAt": "2026-10-25T21:32:36.566Z",
      "source": "https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1898455.html",
      "sourceTitle": "中华人民共和国2013年国民经济和社会发展统计公报",
      "notes": [
        "采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。",
        "调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。",
        "全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。"
      ],
      "metrics": [
        {
          "id": "gdp",
          "label": "实际 GDP",
          "value": 7.7,
          "basis": "全年实际同比",
          "period": "2013年全年"
        },
        {
          "id": "retail",
          "label": "社会消费品零售",
          "value": 13.1,
          "basis": "全年名义同比",
          "period": "2013年全年"
        },
        {
          "id": "unemployment",
          "label": "城镇调查失业率",
          "value": null,
          "basis": "全年平均值",
          "period": "2013年全年",
          "missingReason": "该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。"
        },
        {
          "id": "cpi",
          "label": "居民消费价格 CPI",
          "value": 2.6,
          "basis": "全年同比",
          "period": "2013年全年"
        },
        {
          "id": "property",
          "label": "房地产开发投资",
          "value": 19.8,
          "basis": "全年同比",
          "period": "2013年全年"
        },
        {
          "id": "sales",
          "label": "商品房销售面积",
          "value": 17.3,
          "basis": "全年同比",
          "period": "2013年全年"
        },
        {
          "id": "industry",
          "label": "规模以上工业增加值",
          "value": 9.7,
          "basis": "全年实际同比",
          "period": "2013年全年"
        },
        {
          "id": "income",
          "label": "居民人均可支配收入",
          "value": 8.1,
          "basis": "全年实际同比",
          "period": "2013年全年"
        },
        {
          "id": "spending",
          "label": "居民人均消费支出",
          "value": null,
          "basis": "全年实际同比",
          "period": "2013年全年",
          "missingReason": "该公报未列同口径全国居民实际同比；城乡分组指标不替代全国指标。"
        }
      ]
    },
    {
      "year": 2014,
      "kind": "annual",
      "title": "2014年度经济观察报告",
      "period": "2014年全年",
      "published": "2015-02-26",
      "fetchedAt": "2026-10-25T21:32:36.574Z",
      "source": "https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1898704.html",
      "sourceTitle": "中华人民共和国2014年国民经济和社会发展统计公报",
      "notes": [
        "采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。",
        "调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。",
        "全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。"
      ],
      "metrics": [
        {
          "id": "gdp",
          "label": "实际 GDP",
          "value": 7.4,
          "basis": "全年实际同比",
          "period": "2014年全年"
        },
        {
          "id": "retail",
          "label": "社会消费品零售",
          "value": 12,
          "basis": "全年名义同比",
          "period": "2014年全年"
        },
        {
          "id": "unemployment",
          "label": "城镇调查失业率",
          "value": null,
          "basis": "全年平均值",
          "period": "2014年全年",
          "missingReason": "该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。"
        },
        {
          "id": "cpi",
          "label": "居民消费价格 CPI",
          "value": 2,
          "basis": "全年同比",
          "period": "2014年全年"
        },
        {
          "id": "property",
          "label": "房地产开发投资",
          "value": 10.5,
          "basis": "全年同比",
          "period": "2014年全年"
        },
        {
          "id": "sales",
          "label": "商品房销售面积",
          "value": -7.6,
          "basis": "全年同比",
          "period": "2014年全年"
        },
        {
          "id": "industry",
          "label": "规模以上工业增加值",
          "value": 8.3,
          "basis": "全年实际同比",
          "period": "2014年全年"
        },
        {
          "id": "income",
          "label": "居民人均可支配收入",
          "value": 8,
          "basis": "全年实际同比",
          "period": "2014年全年"
        },
        {
          "id": "spending",
          "label": "居民人均消费支出",
          "value": 7.5,
          "basis": "全年实际同比",
          "period": "2014年全年"
        }
      ]
    },
    {
      "year": 2015,
      "kind": "annual",
      "title": "2015年度经济观察报告",
      "period": "2015年全年",
      "published": "2016-02-29",
      "fetchedAt": "2026-10-25T21:32:36.583Z",
      "source": "https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1899041.html",
      "sourceTitle": "中华人民共和国2015年国民经济和社会发展统计公报",
      "notes": [
        "采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。",
        "调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。",
        "全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。"
      ],
      "metrics": [
        {
          "id": "gdp",
          "label": "实际 GDP",
          "value": 6.9,
          "basis": "全年实际同比",
          "period": "2015年全年"
        },
        {
          "id": "retail",
          "label": "社会消费品零售",
          "value": 10.7,
          "basis": "全年名义同比",
          "period": "2015年全年"
        },
        {
          "id": "unemployment",
          "label": "城镇调查失业率",
          "value": null,
          "basis": "全年平均值",
          "period": "2015年全年",
          "missingReason": "该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。"
        },
        {
          "id": "cpi",
          "label": "居民消费价格 CPI",
          "value": 1.4,
          "basis": "全年同比",
          "period": "2015年全年"
        },
        {
          "id": "property",
          "label": "房地产开发投资",
          "value": 1,
          "basis": "全年同比",
          "period": "2015年全年"
        },
        {
          "id": "sales",
          "label": "商品房销售面积",
          "value": 6.5,
          "basis": "全年同比",
          "period": "2015年全年"
        },
        {
          "id": "industry",
          "label": "规模以上工业增加值",
          "value": 6.1,
          "basis": "全年实际同比",
          "period": "2015年全年"
        },
        {
          "id": "income",
          "label": "居民人均可支配收入",
          "value": 7.4,
          "basis": "全年实际同比",
          "period": "2015年全年"
        },
        {
          "id": "spending",
          "label": "居民人均消费支出",
          "value": 6.9,
          "basis": "全年实际同比",
          "period": "2015年全年"
        }
      ]
    },
    {
      "year": 2016,
      "kind": "annual",
      "title": "2016年度经济观察报告",
      "period": "2016年全年",
      "published": "2017-02-28",
      "fetchedAt": "2026-10-25T21:32:36.591Z",
      "source": "https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1899428.html",
      "sourceTitle": "中华人民共和国2016年国民经济和社会发展统计公报",
      "notes": [
        "采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。",
        "调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。",
        "全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。"
      ],
      "metrics": [
        {
          "id": "gdp",
          "label": "实际 GDP",
          "value": 6.7,
          "basis": "全年实际同比",
          "period": "2016年全年"
        },
        {
          "id": "retail",
          "label": "社会消费品零售",
          "value": 10.4,
          "basis": "全年名义同比",
          "period": "2016年全年"
        },
        {
          "id": "unemployment",
          "label": "城镇调查失业率",
          "value": null,
          "basis": "全年平均值",
          "period": "2016年全年",
          "missingReason": "该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。"
        },
        {
          "id": "cpi",
          "label": "居民消费价格 CPI",
          "value": 2,
          "basis": "全年同比",
          "period": "2016年全年"
        },
        {
          "id": "property",
          "label": "房地产开发投资",
          "value": 6.9,
          "basis": "全年同比",
          "period": "2016年全年"
        },
        {
          "id": "sales",
          "label": "商品房销售面积",
          "value": 22.5,
          "basis": "全年同比",
          "period": "2016年全年"
        },
        {
          "id": "industry",
          "label": "规模以上工业增加值",
          "value": 6,
          "basis": "全年实际同比",
          "period": "2016年全年"
        },
        {
          "id": "income",
          "label": "居民人均可支配收入",
          "value": 6.3,
          "basis": "全年实际同比",
          "period": "2016年全年"
        },
        {
          "id": "spending",
          "label": "居民人均消费支出",
          "value": 6.8,
          "basis": "全年实际同比",
          "period": "2016年全年"
        }
      ]
    },
    {
      "year": 2017,
      "kind": "annual",
      "title": "2017年度经济观察报告",
      "period": "2017年全年",
      "published": "2018-02-28",
      "fetchedAt": "2026-10-25T21:32:36.599Z",
      "source": "https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1899855.html",
      "sourceTitle": "中华人民共和国2017年国民经济和社会发展统计公报",
      "notes": [
        "采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。",
        "调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。",
        "全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。"
      ],
      "metrics": [
        {
          "id": "gdp",
          "label": "实际 GDP",
          "value": 6.9,
          "basis": "全年实际同比",
          "period": "2017年全年"
        },
        {
          "id": "retail",
          "label": "社会消费品零售",
          "value": 10.2,
          "basis": "全年名义同比",
          "period": "2017年全年"
        },
        {
          "id": "unemployment",
          "label": "城镇调查失业率",
          "value": null,
          "basis": "全年平均值",
          "period": "2017年全年",
          "missingReason": "该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。"
        },
        {
          "id": "cpi",
          "label": "居民消费价格 CPI",
          "value": 1.6,
          "basis": "全年同比",
          "period": "2017年全年"
        },
        {
          "id": "property",
          "label": "房地产开发投资",
          "value": 7,
          "basis": "全年同比",
          "period": "2017年全年"
        },
        {
          "id": "sales",
          "label": "商品房销售面积",
          "value": 7.7,
          "basis": "全年同比",
          "period": "2017年全年"
        },
        {
          "id": "industry",
          "label": "规模以上工业增加值",
          "value": 6.6,
          "basis": "全年实际同比",
          "period": "2017年全年"
        },
        {
          "id": "income",
          "label": "居民人均可支配收入",
          "value": 7.3,
          "basis": "全年实际同比",
          "period": "2017年全年"
        },
        {
          "id": "spending",
          "label": "居民人均消费支出",
          "value": 5.4,
          "basis": "全年实际同比",
          "period": "2017年全年"
        }
      ]
    },
    {
      "year": 2018,
      "kind": "annual",
      "title": "2018年度经济观察报告",
      "period": "2018年全年",
      "published": "2019-02-28",
      "fetchedAt": "2026-10-25T21:32:36.608Z",
      "source": "https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1900241.html",
      "sourceTitle": "中华人民共和国2018年国民经济和社会发展统计公报",
      "notes": [
        "采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。",
        "调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。",
        "全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。"
      ],
      "metrics": [
        {
          "id": "gdp",
          "label": "实际 GDP",
          "value": 6.6,
          "basis": "全年实际同比",
          "period": "2018年全年"
        },
        {
          "id": "retail",
          "label": "社会消费品零售",
          "value": 9,
          "basis": "全年名义同比",
          "period": "2018年全年"
        },
        {
          "id": "unemployment",
          "label": "城镇调查失业率",
          "value": null,
          "basis": "全年平均值",
          "period": "2018年全年",
          "missingReason": "该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。"
        },
        {
          "id": "cpi",
          "label": "居民消费价格 CPI",
          "value": 2.1,
          "basis": "全年同比",
          "period": "2018年全年"
        },
        {
          "id": "property",
          "label": "房地产开发投资",
          "value": 9.5,
          "basis": "全年同比",
          "period": "2018年全年"
        },
        {
          "id": "sales",
          "label": "商品房销售面积",
          "value": 1.3,
          "basis": "全年同比",
          "period": "2018年全年"
        },
        {
          "id": "industry",
          "label": "规模以上工业增加值",
          "value": 6.2,
          "basis": "全年实际同比",
          "period": "2018年全年"
        },
        {
          "id": "income",
          "label": "居民人均可支配收入",
          "value": 6.5,
          "basis": "全年实际同比",
          "period": "2018年全年"
        },
        {
          "id": "spending",
          "label": "居民人均消费支出",
          "value": 6.2,
          "basis": "全年实际同比",
          "period": "2018年全年"
        }
      ]
    },
    {
      "year": 2019,
      "kind": "annual",
      "title": "2019年度经济观察报告",
      "period": "2019年全年",
      "published": "2020-02-28",
      "fetchedAt": "2026-10-25T21:32:36.617Z",
      "source": "https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1900640.html",
      "sourceTitle": "中华人民共和国2019年国民经济和社会发展统计公报",
      "notes": [
        "采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。",
        "调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。",
        "全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。"
      ],
      "metrics": [
        {
          "id": "gdp",
          "label": "实际 GDP",
          "value": 6.1,
          "basis": "全年实际同比",
          "period": "2019年全年"
        },
        {
          "id": "retail",
          "label": "社会消费品零售",
          "value": 8,
          "basis": "全年名义同比",
          "period": "2019年全年"
        },
        {
          "id": "unemployment",
          "label": "城镇调查失业率",
          "value": null,
          "basis": "全年平均值",
          "period": "2019年全年",
          "missingReason": "该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。"
        },
        {
          "id": "cpi",
          "label": "居民消费价格 CPI",
          "value": 2.9,
          "basis": "全年同比",
          "period": "2019年全年"
        },
        {
          "id": "property",
          "label": "房地产开发投资",
          "value": 9.9,
          "basis": "全年同比",
          "period": "2019年全年"
        },
        {
          "id": "sales",
          "label": "商品房销售面积",
          "value": -0.1,
          "basis": "全年同比",
          "period": "2019年全年"
        },
        {
          "id": "industry",
          "label": "规模以上工业增加值",
          "value": 5.7,
          "basis": "全年实际同比",
          "period": "2019年全年"
        },
        {
          "id": "income",
          "label": "居民人均可支配收入",
          "value": 5.8,
          "basis": "全年实际同比",
          "period": "2019年全年"
        },
        {
          "id": "spending",
          "label": "居民人均消费支出",
          "value": 5.5,
          "basis": "全年实际同比",
          "period": "2019年全年"
        }
      ]
    },
    {
      "year": 2020,
      "kind": "annual",
      "title": "2020年度经济观察报告",
      "period": "2020年全年",
      "published": "2021-02-28",
      "fetchedAt": "2026-10-25T21:32:36.626Z",
      "source": "https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1901004.html",
      "sourceTitle": "中华人民共和国2020年国民经济和社会发展统计公报",
      "notes": [
        "采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。",
        "调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。",
        "全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。"
      ],
      "metrics": [
        {
          "id": "gdp",
          "label": "实际 GDP",
          "value": 2.3,
          "basis": "全年实际同比",
          "period": "2020年全年"
        },
        {
          "id": "retail",
          "label": "社会消费品零售",
          "value": -3.9,
          "basis": "全年名义同比",
          "period": "2020年全年"
        },
        {
          "id": "unemployment",
          "label": "城镇调查失业率",
          "value": null,
          "basis": "全年平均值",
          "period": "2020年全年",
          "missingReason": "该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。"
        },
        {
          "id": "cpi",
          "label": "居民消费价格 CPI",
          "value": 2.5,
          "basis": "全年同比",
          "period": "2020年全年"
        },
        {
          "id": "property",
          "label": "房地产开发投资",
          "value": 7,
          "basis": "全年同比",
          "period": "2020年全年"
        },
        {
          "id": "sales",
          "label": "商品房销售面积",
          "value": 2.6,
          "basis": "全年同比",
          "period": "2020年全年"
        },
        {
          "id": "industry",
          "label": "规模以上工业增加值",
          "value": 2.8,
          "basis": "全年实际同比",
          "period": "2020年全年"
        },
        {
          "id": "income",
          "label": "居民人均可支配收入",
          "value": 2.1,
          "basis": "全年实际同比",
          "period": "2020年全年"
        },
        {
          "id": "spending",
          "label": "居民人均消费支出",
          "value": -4,
          "basis": "全年实际同比",
          "period": "2020年全年"
        }
      ]
    },
    {
      "year": 2021,
      "kind": "annual",
      "title": "2021年度经济观察报告",
      "period": "2021年全年",
      "published": "2022-02-28",
      "fetchedAt": "2026-10-25T21:32:36.634Z",
      "source": "https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1901393.html",
      "sourceTitle": "中华人民共和国2021年国民经济和社会发展统计公报",
      "notes": [
        "采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。",
        "调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。",
        "全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。",
        "2021年含低基数影响；本页列一年同比，不以两年平均增速替代。"
      ],
      "metrics": [
        {
          "id": "gdp",
          "label": "实际 GDP",
          "value": 8.1,
          "basis": "全年实际同比",
          "period": "2021年全年"
        },
        {
          "id": "retail",
          "label": "社会消费品零售",
          "value": 12.5,
          "basis": "全年名义同比",
          "period": "2021年全年"
        },
        {
          "id": "unemployment",
          "label": "城镇调查失业率",
          "value": 5.1,
          "basis": "全年平均值",
          "period": "2021年全年"
        },
        {
          "id": "cpi",
          "label": "居民消费价格 CPI",
          "value": 0.9,
          "basis": "全年同比",
          "period": "2021年全年"
        },
        {
          "id": "property",
          "label": "房地产开发投资",
          "value": 4.4,
          "basis": "全年同比",
          "period": "2021年全年"
        },
        {
          "id": "sales",
          "label": "商品房销售面积",
          "value": 1.9,
          "basis": "全年同比",
          "period": "2021年全年"
        },
        {
          "id": "industry",
          "label": "规模以上工业增加值",
          "value": 9.6,
          "basis": "全年实际同比",
          "period": "2021年全年"
        },
        {
          "id": "income",
          "label": "居民人均可支配收入",
          "value": 8.1,
          "basis": "全年实际同比",
          "period": "2021年全年"
        },
        {
          "id": "spending",
          "label": "居民人均消费支出",
          "value": 12.6,
          "basis": "全年实际同比",
          "period": "2021年全年"
        }
      ]
    },
    {
      "year": 2022,
      "kind": "annual",
      "title": "2022年度经济观察报告",
      "period": "2022年全年",
      "published": "2023-02-28",
      "fetchedAt": "2026-10-25T21:32:36.645Z",
      "source": "https://www.stats.gov.cn/sj/zxfb/202302/t20230228_1919011.html",
      "sourceTitle": "中华人民共和国2022年国民经济和社会发展统计公报",
      "notes": [
        "采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。",
        "调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。",
        "全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。"
      ],
      "metrics": [
        {
          "id": "gdp",
          "label": "实际 GDP",
          "value": 3,
          "basis": "全年实际同比",
          "period": "2022年全年"
        },
        {
          "id": "retail",
          "label": "社会消费品零售",
          "value": -0.2,
          "basis": "全年名义同比",
          "period": "2022年全年"
        },
        {
          "id": "unemployment",
          "label": "城镇调查失业率",
          "value": 5.6,
          "basis": "全年平均值",
          "period": "2022年全年"
        },
        {
          "id": "cpi",
          "label": "居民消费价格 CPI",
          "value": 2,
          "basis": "全年同比",
          "period": "2022年全年"
        },
        {
          "id": "property",
          "label": "房地产开发投资",
          "value": -10,
          "basis": "全年同比",
          "period": "2022年全年"
        },
        {
          "id": "sales",
          "label": "商品房销售面积",
          "value": -24.3,
          "basis": "全年同比",
          "period": "2022年全年"
        },
        {
          "id": "industry",
          "label": "规模以上工业增加值",
          "value": 3.6,
          "basis": "全年实际同比",
          "period": "2022年全年"
        },
        {
          "id": "income",
          "label": "居民人均可支配收入",
          "value": 2.9,
          "basis": "全年实际同比",
          "period": "2022年全年"
        },
        {
          "id": "spending",
          "label": "居民人均消费支出",
          "value": -0.2,
          "basis": "全年实际同比",
          "period": "2022年全年"
        }
      ]
    },
    {
      "year": 2023,
      "kind": "annual",
      "title": "2023年度经济观察报告",
      "period": "2023年全年",
      "published": "2024-02-29",
      "fetchedAt": "2026-10-25T21:32:36.652Z",
      "source": "https://www.stats.gov.cn/sj/zxfb/202402/t20240228_1947915.html",
      "sourceTitle": "中华人民共和国2023年国民经济和社会发展统计公报",
      "notes": [
        "采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。",
        "调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。",
        "全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。"
      ],
      "metrics": [
        {
          "id": "gdp",
          "label": "实际 GDP",
          "value": 5.2,
          "basis": "全年实际同比",
          "period": "2023年全年"
        },
        {
          "id": "retail",
          "label": "社会消费品零售",
          "value": 7.2,
          "basis": "全年名义同比",
          "period": "2023年全年"
        },
        {
          "id": "unemployment",
          "label": "城镇调查失业率",
          "value": 5.2,
          "basis": "全年平均值",
          "period": "2023年全年"
        },
        {
          "id": "cpi",
          "label": "居民消费价格 CPI",
          "value": 0.2,
          "basis": "全年同比",
          "period": "2023年全年"
        },
        {
          "id": "property",
          "label": "房地产开发投资",
          "value": -9.6,
          "basis": "全年同比",
          "period": "2023年全年"
        },
        {
          "id": "sales",
          "label": "新建商品房销售面积",
          "value": -8.5,
          "basis": "全年同比",
          "period": "2023年全年"
        },
        {
          "id": "industry",
          "label": "规模以上工业增加值",
          "value": 4.6,
          "basis": "全年实际同比",
          "period": "2023年全年"
        },
        {
          "id": "income",
          "label": "居民人均可支配收入",
          "value": 6.1,
          "basis": "全年实际同比",
          "period": "2023年全年"
        },
        {
          "id": "spending",
          "label": "居民人均消费支出",
          "value": 9,
          "basis": "全年实际同比",
          "period": "2023年全年"
        }
      ]
    },
    {
      "year": 2024,
      "kind": "annual",
      "title": "2024年度经济观察报告",
      "period": "2024年全年",
      "published": "2025-02-28",
      "fetchedAt": "2026-10-25T21:32:36.659Z",
      "source": "https://www.stats.gov.cn/sj/zxfb/202502/t20250228_1958817.html",
      "sourceTitle": "中华人民共和国2024年国民经济和社会发展统计公报",
      "notes": [
        "采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。",
        "调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。",
        "全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。"
      ],
      "metrics": [
        {
          "id": "gdp",
          "label": "实际 GDP",
          "value": 5,
          "basis": "全年实际同比",
          "period": "2024年全年"
        },
        {
          "id": "retail",
          "label": "社会消费品零售",
          "value": 3.5,
          "basis": "全年名义同比",
          "period": "2024年全年"
        },
        {
          "id": "unemployment",
          "label": "城镇调查失业率",
          "value": 5.1,
          "basis": "全年平均值",
          "period": "2024年全年"
        },
        {
          "id": "cpi",
          "label": "居民消费价格 CPI",
          "value": 0.2,
          "basis": "全年同比",
          "period": "2024年全年"
        },
        {
          "id": "property",
          "label": "房地产开发投资",
          "value": -10.6,
          "basis": "全年同比",
          "period": "2024年全年"
        },
        {
          "id": "sales",
          "label": "新建商品房销售面积",
          "value": -12.9,
          "basis": "全年同比",
          "period": "2024年全年"
        },
        {
          "id": "industry",
          "label": "规模以上工业增加值",
          "value": 5.8,
          "basis": "全年实际同比",
          "period": "2024年全年"
        },
        {
          "id": "income",
          "label": "居民人均可支配收入",
          "value": 5.1,
          "basis": "全年实际同比",
          "period": "2024年全年"
        },
        {
          "id": "spending",
          "label": "居民人均消费支出",
          "value": 5.1,
          "basis": "全年实际同比",
          "period": "2024年全年"
        }
      ]
    },
    {
      "year": 2025,
      "kind": "annual",
      "title": "2025年度经济观察报告",
      "period": "2025年全年",
      "published": "2026-02-28",
      "fetchedAt": "2026-10-25T21:32:36.665Z",
      "source": "https://www.stats.gov.cn/sj/zxfb/202602/t20260228_1962662.html",
      "sourceTitle": "中华人民共和国2025年国民经济和社会发展统计公报",
      "notes": [
        "采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。",
        "调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。",
        "全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。"
      ],
      "metrics": [
        {
          "id": "gdp",
          "label": "实际 GDP",
          "value": 5,
          "basis": "全年实际同比",
          "period": "2025年全年"
        },
        {
          "id": "retail",
          "label": "社会消费品零售",
          "value": 3.7,
          "basis": "全年名义同比",
          "period": "2025年全年"
        },
        {
          "id": "unemployment",
          "label": "城镇调查失业率",
          "value": 5.2,
          "basis": "全年平均值",
          "period": "2025年全年"
        },
        {
          "id": "cpi",
          "label": "居民消费价格 CPI",
          "value": 0,
          "basis": "全年同比",
          "period": "2025年全年"
        },
        {
          "id": "property",
          "label": "房地产开发投资",
          "value": -17.2,
          "basis": "全年同比",
          "period": "2025年全年"
        },
        {
          "id": "sales",
          "label": "新建商品房销售面积",
          "value": -8.7,
          "basis": "全年同比",
          "period": "2025年全年"
        },
        {
          "id": "industry",
          "label": "规模以上工业增加值",
          "value": 5.9,
          "basis": "全年实际同比",
          "period": "2025年全年"
        },
        {
          "id": "income",
          "label": "居民人均可支配收入",
          "value": 5,
          "basis": "全年实际同比",
          "period": "2025年全年"
        },
        {
          "id": "spending",
          "label": "居民人均消费支出",
          "value": 4.4,
          "basis": "全年实际同比",
          "period": "2025年全年"
        }
      ]
    }
  ],
  "latest": {
    "source": "https://www.stats.gov.cn/sj/zxfb/202610/t20261019_1965618.html",
    "published": "2026-10-19",
    "fetchedAt": "2026-10-25T21:18:27.257Z",
    "metrics": [
      {
        "id": "retail",
        "label": "社会消费品零售",
        "value": 1.1,
        "period": "2026年9月",
        "basis": "当月同比"
      },
      {
        "id": "unemployment",
        "label": "城镇调查失业率",
        "value": 5.2,
        "period": "2026年9月",
        "basis": "当月水平"
      },
      {
        "id": "core",
        "label": "核心 CPI",
        "value": 1,
        "period": "2026年9月",
        "basis": "当月同比"
      },
      {
        "id": "property",
        "label": "房地产开发投资",
        "value": -20.6,
        "period": "2026年前三季度",
        "basis": "累计同比"
      },
      {
        "id": "sales",
        "label": "新建商品房销售面积",
        "value": -13.2,
        "period": "2026年前三季度",
        "basis": "累计同比"
      },
      {
        "id": "pmi",
        "label": "制造业 PMI",
        "value": 50.1,
        "period": "2026年9月",
        "basis": "当月指数 · 50为荣枯线"
      },
      {
        "id": "industry",
        "label": "规模以上工业增加值",
        "value": 5.5,
        "period": "2026年9月",
        "basis": "当月实际同比"
      },
      {
        "id": "gdp",
        "label": "实际 GDP",
        "value": 4.6,
        "period": "2026年前三季度",
        "basis": "累计实际同比"
      }
    ],
    "quarters": [
      {
        "label": "2026 Q1",
        "value": 5
      },
      {
        "label": "2026 Q2",
        "value": 4.3
      },
      {
        "label": "2026 Q3",
        "value": 4.5
      }
    ],
    "updatePolicy": "On request, cached 30 minutes; browser checks every 30 minutes"
  }
}
;
const PAGE="<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>观势 · 中国经济观察</title><style>\n:root{--bg:#f3f3ed;--ink:#173c35;--muted:#737d73;--line:#d8ded3;--accent:#d0e47a}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 system-ui,-apple-system,sans-serif}a{color:inherit;text-underline-offset:4px}button,select{font:inherit;border:1px solid var(--line);border-radius:30px;padding:9px 18px;background:transparent;color:var(--ink);cursor:pointer}button:hover,button.active{background:var(--ink);color:white}header{padding:22px 5%;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}.brand{font-size:24px;font-weight:700;letter-spacing:3px}.brand small{font-size:10px;letter-spacing:2px;display:block;color:var(--muted)}nav{display:flex;gap:25px}nav a{text-decoration:none}main{max-width:1320px;margin:auto;padding:50px 5%}h1{font:500 clamp(36px,5vw,64px)/1.18 Georgia,'Songti SC',serif;letter-spacing:-2px;margin:14px 0 24px}h2{font:500 28px Georgia,'Songti SC',serif;margin:0}h3{font-size:18px;margin:0 0 12px}.eyebrow{font-size:11px;letter-spacing:3px;color:var(--muted)}hero{display:grid;grid-template-columns:1.4fr 1fr;gap:50px;align-items:center}.hero-note{border-left:1px solid var(--line);padding-left:28px;color:var(--muted)}.status{font-size:12px;background:#e5ebdc;border-radius:20px;padding:6px 12px;display:inline-block}.toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:25px 0;margin-top:30px;border-top:1px solid var(--line)}#stamp{margin-left:auto;font-size:12px;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.card{background:#fffef9;border:1px solid var(--line);border-radius:9px;padding:23px;position:relative}.card:first-child{background:var(--ink);color:white}.card .label{font-size:13px}.value{font-size:43px;line-height:1.5;font-variant-numeric:tabular-nums;letter-spacing:-2px}.value small{font-size:18px}.meta{font-size:11px;color:var(--muted)}.card:first-child .meta{color:#bbcec2}.star{position:absolute;right:15px;top:17px;padding:0 7px;border:0;font-size:20px}.card:first-child .star{color:var(--accent)}.source{font-size:11px}.section{margin-top:60px}.sectionhead{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:20px}.twocol{display:grid;grid-template-columns:1fr 1fr;gap:20px}.panel{padding:28px;border:1px solid var(--line);border-radius:9px;background:#fafbf5}.tag{display:inline-block;font-size:11px;border-radius:4px;background:#e8eddf;padding:2px 8px;margin:0 6px 8px 0}.missing{background:#f0e4cf}.row{border-top:1px solid var(--line);padding:18px 0;display:grid;grid-template-columns:40px 1fr 140px;gap:15px}.row p{margin:4px 0;color:var(--muted);font-size:13px}.row>span{font-family:Georgia;font-size:24px;color:#a1ad93}.doc{display:block;text-decoration:none;border-top:1px solid var(--line);padding:17px 0}.doc strong{display:block}.doc small{color:var(--muted)}#error{padding:15px;background:#f3e9cf;display:none}.bar{height:20px;background:#d0e47a;border-radius:3px}.barrow{display:grid;grid-template-columns:80px 1fr 60px;gap:12px;align-items:center;margin:18px 0}footer{padding:30px 5%;border-top:1px solid var(--line);color:var(--muted);font-size:12px}.fine{font-size:12px;color:var(--muted)}@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}hero,.twocol{grid-template-columns:1fr}.hero-note{padding-left:0;border:0}nav{gap:12px;font-size:12px}.row{grid-template-columns:30px 1fr}.row>div:last-child{grid-column:2}#stamp{width:100%;margin:0}}@media(max-width:480px){main{padding:30px 5%}.card{padding:17px}.value{font-size:34px}nav a:last-child{display:none}}\n.button{display:inline-block;border:1px solid var(--line);border-radius:30px;padding:9px 18px;text-decoration:none;font-size:14px}.report-actions{display:flex;gap:8px;flex-wrap:wrap}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:13px 10px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}th{font-weight:500;color:var(--muted)}td:nth-child(2){font-size:18px;font-weight:600;font-variant-numeric:tabular-nums}.report-finding p{font-size:13px;color:var(--muted)}.report-limit{border-left:3px solid #bacd84;padding-left:18px;margin:25px 0;font-size:13px}.report-limit p{margin-top:5px;color:var(--muted)}#annual{scroll-margin-top:20px}#error{border-radius:6px;margin-bottom:18px;font-size:13px}@media(max-width:700px){.sectionhead{align-items:flex-start;flex-direction:column}.report-paper{padding:18px}nav{gap:9px}nav a{font-size:11px}}@media print{body{background:white;color:black}header,hero,#dashboard,#research,#archive,footer,main>.twocol,.report-actions,#annual>.sectionhead{display:none!important}main{padding:0;max-width:none}#annual{margin:0}.report-paper{border:0;padding:0}.panel{background:white}a{color:black;text-decoration:none}.table-wrap{overflow:visible}table{font-size:10pt}td,th{white-space:normal;padding:7px}.twocol{display:block}.report-finding{break-inside:avoid}#report-title{font-size:25px}#annual>.panel:not(.report-paper){display:none!important}}#speech{scroll-margin-top:20px}.speech-intro{background:#e9eedc}.speech-intro p{margin:5px 0 15px}.speech-flow{display:flex;gap:8px;flex-wrap:wrap;margin:15px 0}.speech-flow span{padding:6px 11px;border:1px solid #c8d2ba;border-radius:5px;font-size:12px}.speech-layout{display:grid;grid-template-columns:250px minmax(0,1fr);gap:18px}.speech-sidebar{padding:18px;align-self:start}.speech-sidebar select{width:100%;margin:8px 0 15px}.speech-step{display:block;width:100%;text-align:left;border:0;border-radius:5px;margin:3px 0;padding:9px 8px;font-size:12px;line-height:1.6}.speech-step span{display:inline-block;width:30px;color:#859273;font-size:10px}.speech-step.active span{color:#d0e47a}.speech-main{min-width:0;padding:22px}.speech-main .sectionhead{margin-bottom:0}.speech-pager{display:flex;align-items:center;gap:8px;font-size:11px;white-space:nowrap}.speech-pager button{padding:5px 12px}#speech-chart svg,#international-chart svg,#international-path svg{width:100%;height:auto;display:block}.speech-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;margin:10px 0 16px}.speech-legend i{display:inline-block;width:16px;height:3px;margin-right:5px;vertical-align:middle}.speech-controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:12px;margin:12px 0}.speech-controls button{font-size:12px;padding:6px 12px}#speech-ols-controls{display:flex;gap:12px;flex-wrap:wrap}.speech-caveat{border-left:3px solid #c4b58a;background:#f2efdf;padding:12px 16px;font-size:12px;margin:15px 0}.speech-caveat ul{padding-left:20px}.speech-values{max-height:340px;overflow:auto}#speech details summary{cursor:pointer;padding:5px 0}#speech input[type=range]{accent-color:#315f48}#speech h3{line-height:1.5}#speech .eyebrow{line-height:1.8;letter-spacing:1px}#speech small{white-space:normal}.speech-sidebar #speech-nav{max-height:900px;overflow:auto}@media(max-width:1000px){.speech-layout{grid-template-columns:1fr}.speech-sidebar #speech-nav{display:flex;gap:5px;max-height:200px;flex-wrap:wrap}.speech-step{width:auto;border:1px solid var(--line)}.speech-sidebar select{width:auto;margin-left:10px}.speech-main{padding:15px}}@media print{#speech{display:none!important}}\n.speech-main{align-self:start}.twocol>*{min-width:0}.panel{min-width:0;max-width:100%}.table-wrap{max-width:100%}#speech input[type=file]{max-width:100%}\n#company-result-chart svg{width:100%;height:auto}.speech-scroll-hint{display:none}@media(max-width:700px){#speech-chart,#international-chart,#international-path,#company-result-chart{overflow-x:auto;max-width:100%}#speech-chart svg,#international-chart svg,#international-path svg,#company-result-chart svg{min-width:840px}.speech-scroll-hint{display:block}}\n\n#judgments{scroll-margin-top:24px}.judgment-tabs{display:flex;gap:10px;flex-wrap:wrap}.judgment-layout{display:grid;grid-template-columns:230px minmax(0,1fr);gap:32px;margin-top:25px}.judgment-layout aside label{display:block;font-size:12px;margin-bottom:8px}.judgment-years{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:18px}.judgment-years button{padding:6px;font-size:12px;border-radius:5px}.judgment-years button[data-empty=\"true\"]{border-style:dashed;color:#737d73}.judgment-card h3{font:500 25px/1.4 Georgia,'Songti SC',serif}.judgment-card p{margin:10px 0}.judgment-card blockquote{font-size:20px;border-left:3px solid #b7cd77;margin:18px 0;padding:4px 18px}.judgment-facts{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:18px}.judgment-facts>div{border-top:1px solid var(--line);padding-top:12px}.judgment-facts strong{font-size:12px}.judgment-facts p{font-size:13px}.judgment-observation{background:#edf1e3;border-radius:5px;padding:15px;font-size:13px}.judgment-chart{overflow-x:auto}.judgment-chart svg{display:block;width:100%;min-width:780px}.judgment-chart button{font-size:12px}.annual-judgments{border-top:1px solid var(--line);margin-top:25px;padding-top:22px}.annual-judgments .judgment-card h3{font:600 17px system-ui}.annual-judgments .judgment-facts{display:none}.annual-judgments p{font-size:13px}.annual-judgments .judgment-card{margin:18px 0}#judgment-detail a{overflow-wrap:anywhere}#judgments td:nth-child(2){font-size:14px}.judgment-empty{padding:18px;border:1px dashed var(--line);border-radius:7px}@media(max-width:750px){.judgment-layout{grid-template-columns:1fr;gap:20px}.judgment-years{grid-template-columns:repeat(5,1fr)}.judgment-facts{grid-template-columns:1fr}.judgment-card h3{font-size:22px}}@media print{#judgments{display:none}.annual-judgments{break-inside:avoid}}\n</style><header><div class=\"brand\">观势<span style=\"color:#9aab7c\">.</span><small>CHINA ECONOMIC OBSERVATORY</small></div><nav><a href=\"#speech\">演讲复现</a><a href=\"#dashboard\">经济仪表盘</a><a href=\"#judgments\">判断追踪</a><a href=\"#annual\">年度报告</a><a href=\"#research\">研究线索</a><a href=\"#archive\">演讲资料 ↗</a></nav></header><main><hero><div><div class=\"eyebrow\">从研究判断，到持续观察</div><h1>沿着数据，<br>看清经济的变化。</h1><p style=\"color:var(--muted)\">从高善文演讲的固定公司样本出发，逐图重绘、复算与检查。<br>保留每一个中间步骤，再用2012年起的数据持续检验。</p></div><div class=\"hero-note\"><span class=\"status\">● 综合运行报告 · 自动检查</span><p>真正需要关注的，是变化本身。</p><p>这里呈现官方统计指标，并明确保留与演讲自建样本之间的边界。月度与季度数据随官方发布更新，不是盘中行情。</p><small>自动检查：访问时 / 页面打开期间每 30 分钟<br>无需 API 密钥 · 来源：国家统计局<br>年度报告：2012—2025 / 本年进展</small></div></hero><section id=\"speech\" class=\"section\">\n <div class=\"sectionhead\"><div><div class=\"eyebrow\">RESEARCH RECONSTRUCTION / 研究过程复现</div><h2>从上市公司样本，走到宏观判断。</h2><p id=\"speech-count\" class=\"fine\"></p></div><button id=\"speech-all-download\">↓ 全部图中数据 JSON</button></div>\n <div class=\"panel speech-intro\"><p><strong>这里新增了原演讲的完整图表链。</strong>按 30 页幻灯片顺序恢复分类表及全部 23 张统计图，不再用八个宏观指标代替原研究。点值从原 PDF 的矢量路径和坐标刻度恢复；悬停看数值，展开表格可逐点检查。</p><div class=\"speech-flow\"><span>01 固定样本与行业分类</span><span>02 营收 / 市值 / 相对股价</span><span>03 消费、房价与就业交叉检查</span><span>04 增长、通胀与国际地产事件</span></div><p class=\"fine\">灰绿标签“图中数值恢复”意味着重绘原图，尚非取得 Wind 底表后的逐公司复算。原稿的 2024 年预测值固定保留为当时估计，未用后来统计数偷偷替换。公开 WDI 数据的独立复算与自定义公司样本工具放在下方。</p><div class=\"twocol\" style=\"margin-top:16px\"><div><strong>企业与消费：原研究的推理</strong><p class=\"fine\">先用分类占比和相对价格观察产业转型，再把中性行业作为周期对照；接着以年龄、消费、房价与信心检查收入预期。将中性行业视作对照是一项研究假设，横截面相关也不等于因果识别。</p></div><div><strong>就业与总量：如何交叉核对</strong><p class=\"fine\">对照调查失业率、在岗工资、就业人数及参保覆盖率，再比较就业、价格与增长关系，最后引入地产危机的国际事件路径。多个异常可形成研究线索，但不足以单独识别官方GDP的真实误差。</p></div></div></div>\n <p><a class=\"button\" href=\"#judgments\">新增：高善文当时的判断与逐年趋势对照 →</a></p>\n <details class=\"panel\" style=\"margin:16px 0\"><summary><strong>起点：原稿第 3 页的固定样本分类表（截至 2024 年 7 月）</strong></summary><div class=\"table-wrap\"><table><thead><tr><th>类别</th><th>原表股票数</th><th>行业规则</th><th>覆盖说明</th></tr></thead><tbody id=\"speech-classification\"></tbody></table></div><p class=\"fine\">这张表将支持、中性和限制类列为 2341、2638 和 342+131，共5452。演讲口述的约数与原表不同，此处保留原表。演讲提到港股，但该表没有列出港股数量；未取得证券名单前，不能声称已核实所有 A/H/ADR 覆盖和去重。表中未列行业不默认归为中性。<a href=\"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=3\" target=\"_blank\" rel=\"noopener\">核对原表 ↗</a></p></details>\n <div class=\"speech-layout\"><aside class=\"panel speech-sidebar\"><label>按章节查看 <select id=\"speech-section\" aria-label=\"演讲章节\"><option>全部</option><option>企业与转型</option><option>消费与信心</option><option>就业与统计</option><option>总量与地产</option></select></label><div id=\"speech-nav\"></div></aside>\n <article class=\"panel speech-main\"><div class=\"sectionhead\"><div><div id=\"speech-category\" class=\"eyebrow\"></div><h3 id=\"speech-title\" style=\"margin-top:10px\"></h3></div><div class=\"speech-pager\"><button id=\"speech-prev\" aria-label=\"上一张图\">←</button><span id=\"speech-position\"></span><button id=\"speech-next\" aria-label=\"下一张图\">→</button></div></div><p class=\"fine speech-scroll-hint\">窄屏可左右滑动图表，也可下载 SVG 放大查看。</p><div id=\"speech-chart\" aria-live=\"polite\"></div><div id=\"speech-legend\" class=\"speech-legend\"></div><div class=\"speech-controls\"><label><input type=\"checkbox\" id=\"speech-fit\" checked> 显示原图趋势 / 拟合线</label><span id=\"speech-ols-controls\"><label><input type=\"checkbox\" id=\"speech-ols\"> 改看恢复点复算 OLS</label><label id=\"speech-2020-control\"><input type=\"checkbox\" id=\"speech-exclude-2020\"> 再排除2020年做敏感性检查</label></span></div><p id=\"speech-regression\" class=\"fine\"></p><p id=\"speech-method\"></p><details class=\"speech-caveat\" open><summary>这一步能说明什么，还缺什么？</summary><ul id=\"speech-limits\"></ul></details><div class=\"speech-controls\"><a id=\"speech-source\" href=\"#\" target=\"_blank\" rel=\"noopener\">原稿本页 ↗</a><a id=\"speech-svg-download\" href=\"#\" target=\"_blank\" rel=\"noopener\">下载 SVG 图表</a><button id=\"speech-csv\">↓ 本图数值 CSV</button></div><details><summary>查看本图恢复数值</summary><div class=\"table-wrap speech-values\"><table><thead><tr><th>系列</th><th>观察期 / 标识</th><th>x / 序号</th><th>y</th><th>坐标轴</th></tr></thead><tbody id=\"speech-values\"></tbody></table></div></details></article></div>\n <div class=\"sectionhead\" style=\"margin-top:32px\"><div><div class=\"eyebrow\">SENSITIVITY CHECKS</div><h3>让关键推算可以动手检查</h3></div></div>\n <div class=\"twocol\"><div class=\"panel\"><h3>4709 万：改变就业趋势假设会怎样？</h3><label>2020 年后假定年增长率 <strong id=\"employment-growth-value\"></strong><input id=\"employment-growth\" type=\"range\" min=\"0\" max=\"4\" step=\"0.1\" value=\"1.8\" style=\"width:100%\"></label><div id=\"employment-result\"></div><div class=\"table-wrap\"><table><thead><tr><th>年份</th><th>原图实际（万人）</th><th>假设路径</th><th>该年存量差</th></tr></thead><tbody id=\"employment-details\"></tbody></table></div></div><div class=\"panel\"><h3>“下修 3 个百分点”：回归与假设</h3><label>原图观测年份 <select id=\"inflation-year\"><option value=\"2024\">2024（当时估计）</option><option value=\"2023\">2023</option></select></label><p><label>假设对增长调整 <strong id=\"growth-adjustment-value\"></strong><input id=\"growth-adjustment\" type=\"range\" min=\"0\" max=\"4\" step=\"0.1\" value=\"0\" style=\"width:100%\"></label></p><div id=\"inflation-result\"></div></div></div>\n <div class=\"panel\" style=\"margin-top:22px\"><div class=\"sectionhead\"><div><div class=\"eyebrow\">INDEPENDENT RECALCULATION / 公开原始数据复算</div><h3>地产危机国际比较：用世界银行数据重新计算</h3><span id=\"international-status\" class=\"fine\"></span></div><div class=\"speech-controls\"><button id=\"worldbank-refresh\">↻ 更新 WDI</button><button id=\"worldbank-download\">↓ 数据与计算结果</button></div></div><label>窗口规则 <select id=\"event-window\"><option value=\"exclude0\">前3年与后3年，均排除事件年0</option><option value=\"include0\">前3年包含事件年0，后3年排除0</option><option value=\"postIncludes0\">前3年排除事件年0，后3年包含0</option></select></label><p class=\"fine\">事件定义沿用原稿，统计源换成公开 WDI（含后续修订）。中国2021年按2020—2021两年复合增长处理。下图灰色为原图恢复值，绿色为当前WDI版本复算，不能要求两者强行一致。窗口选择和当年估计 / 事后数据版本的差异会改变结果。</p><p id=\"event-window-audit\" class=\"speech-caveat\"></p><div id=\"international-chart\"></div><div class=\"speech-legend\"><span><i style=\"background:#9bada0\"></i>原图恢复值</span><span><i style=\"background:#315f48\"></i>WDI 独立复算</span></div><details><summary>检查每个事件的年份、均值和差值</summary><div class=\"table-wrap\"><table><thead><tr><th>事件</th><th>前窗年份</th><th>前窗均值%</th><th>后窗年份</th><th>后窗均值%</th><th>差值（百分点）</th></tr></thead><tbody id=\"international-values\"></tbody></table></div></details><details><summary>查看事件时间路径</summary><div id=\"international-path\"></div><p class=\"fine\">七次历史事件按等权平均；缺失项不填零。事件路径不构成中国未来预测。</p></details><p><a id=\"worldbank-source\" href=\"#\" target=\"_blank\" rel=\"noopener\">WDI 原始接口与本次年份范围 ↗</a></p></div>\n <details class=\"panel\" style=\"margin-top:22px\"><summary><strong>公司数据复算入口：接入固定 A/H/ADR 样本</strong></summary><p>已有行业规则，但仍缺原作者逐公司名单、跨市场去重与价格权重。拿到有权使用的底表后，可在本浏览器内导入 CSV 计算营收 / 市值占比、营收与员工同比。公司同期重复、样本跨期缺失会直接拒绝，不自动补零或重复计算。</p><div class=\"speech-controls\"><button id=\"company-template\">↓ CSV 空模板</button><label>选择公司数据 CSV <input id=\"company-file\" type=\"file\" accept=\".csv,text/csv\"></label></div><p class=\"fine\">字段：company_id、security_id、market、group（支持/中性/限制）、period（YYYY或YYYY-MM）、revenue_cny、market_cap_cny、employees。金额统一人民币，合并报表一家公司一期只保留一条；员工需整数。数据只在当前浏览器计算。空模板没有伪造的公司数据。</p><p id=\"company-output\">尚未导入。即使公司数量相同，也不能据此证明与原作者是同一证券名单。</p><select id=\"company-result-metric\" style=\"display:none\" aria-label=\"自定义公司样本图表\"><option value=\"revenueShare\">营业收入占比</option><option value=\"capShare\">市值占比</option><option value=\"revenueYoY\">营收同比</option><option value=\"employeeYoY\">员工同比</option></select><div id=\"company-result-chart\"></div><div id=\"company-result-table\" class=\"table-wrap\"></div></details>\n <p class=\"fine\">复现范围：全部原图的图中数据恢复、公开统计值的独立重算、关键假设的敏感性工具。尚未声称完成 Wind 原始公司样本和省际控制变量数据库的重建。原稿与复算之间的差异逐图保留。</p>\n</section>\n<section id=\"judgments\" class=\"section\">\n <div class=\"sectionhead\"><div><div class=\"eyebrow\">JUDGMENTS THROUGH TIME / 判断与时间</div><h2>当时怎么看，后来怎样走。</h2><p class=\"fine\">沿2012年以来的年度趋势，回到观点公开的那个时点。</p></div><a class=\"button\" href=\"/api/judgments\" download=\"gaoshanwen-judgments.json\">↓ 观点与来源 JSON</a></div>\n <div class=\"panel\"><div class=\"judgment-tabs\"><button id=\"judgment-mode-speech\" class=\"active\" aria-pressed=\"true\">追踪2024年演讲</button><button id=\"judgment-mode-history\" aria-pressed=\"false\">各年当时的观点</button></div><p class=\"fine\">观点固定保留当时的条件与时间范围，年度数据随现有公报更新。下面的指标关联与复盘说明由本站整理；不自动打“预测正确率”，也不把相关性当作因果证明。</p>\n <div class=\"judgment-layout\"><aside><label id=\"judgment-select-label\" for=\"judgment-select\">选择一项判断</label><select id=\"judgment-select\" style=\"width:100%\"></select><div id=\"judgment-year-strip\" class=\"judgment-years\"></div><p id=\"judgment-coverage\" class=\"fine\"></p></aside><article id=\"judgment-detail\" aria-live=\"polite\"></article></div>\n <div class=\"sectionhead\" style=\"margin-top:28px\"><div><h3 id=\"judgment-trend-title\">沿年度数据追踪</h3><p id=\"judgment-trend-note\" class=\"fine\"></p></div><select id=\"judgment-metric\" aria-label=\"关联趋势指标\"></select></div><div id=\"judgment-trend\" class=\"judgment-chart\"></div><p id=\"judgment-observation\" class=\"judgment-observation\"></p>\n <details><summary>逐年数据、与判断的时间关系及来源</summary><div class=\"table-wrap\"><table><thead><tr><th>年份</th><th>指标公布值</th><th>与判断的时间关系</th><th>统计口径 / 来源</th></tr></thead><tbody id=\"judgment-trend-table\"></tbody></table></div></details>\n </div>\n</section>\n<section id=\"annual\" class=\"section\"><div class=\"sectionhead\"><div><div class=\"eyebrow\">ANNUAL REVIEW / 年度复盘</div><h2>从 2012 年开始，逐年观察。</h2></div><label>选择年份 <select id=\"report-year\" aria-label=\"报告年份\"></select></label></div><div class=\"panel\" style=\"margin-bottom:20px\"><div class=\"sectionhead\"><div><h3>2012 年以来的变化</h3><p class=\"fine\">各年公报当时公布值，非统一修订序列。缺失项不连线；当年进展不混入全年图。</p></div><label>趋势指标 <select id=\"history-metric\" aria-label=\"跨年趋势指标\"></select></label></div><div id=\"history-chart\"></div><p id=\"history-note\" class=\"fine\"></p><details><summary>查看逐年数值与来源</summary><div class=\"table-wrap\"><table><thead><tr><th>年份</th><th>数值</th><th>口径</th><th>年度公报</th></tr></thead><tbody id=\"history-table\"></tbody></table></div></details></div><article class=\"panel report-paper\"><div class=\"sectionhead\"><div><h2 id=\"report-title\"></h2><div id=\"report-period\" class=\"fine\"></div></div><div class=\"report-actions\"><a id=\"download-report\" class=\"button\" href=\"#\">↓ 下载报告 Markdown</a><button id=\"print-report\">打印 / 存为 PDF</button></div></div><p id=\"report-note\" class=\"fine\"></p><div class=\"table-wrap\"><table><thead id=\"report-head\"></thead><tbody id=\"report-table\"></tbody></table></div><h3 style=\"margin-top:30px\">沿演讲框架的复盘</h3><div class=\"annual-judgments\" id=\"annual-judgments\"></div><div id=\"report-findings\" class=\"twocol\"></div><div class=\"report-limit\"><strong>哪些结论还不能下？</strong><p>单年数据不足以证明“2025 年就是转折点”。此报告不是高善文本人撰写的研究；上市公司分类、省际人口消费面板、就业人数推算与跨国泡沫修复模型仍未复现。</p></div><a id=\"report-source\" href=\"#\" target=\"_blank\" rel=\"noopener\"></a><div id=\"report-previous\" class=\"fine\"></div><p class=\"fine\">完整年度报告取自年度公报；本年保持进展版。报告与修订保存在服务器，数据源暂时不可用时仍可阅读。在线更新状态见下方仪表盘。</p></article></section><section id=\"dashboard\" class=\"section\"><h2>最新经济仪表盘</h2><div class=\"toolbar\"><button id=\"all\" class=\"active\">全部指标</button><button id=\"watch\">我的关注</button><button id=\"refresh\">↻ 检查更新</button><button id=\"export\">↓ 导出数据</button><span id=\"stamp\">正在连接国家统计局…</span></div><div id=\"error\" role=\"alert\"></div><div class=\"grid\" id=\"cards\" aria-live=\"polite\"></div></section><section class=\"section twocol\"><div class=\"panel\"><div class=\"eyebrow\">QUARTERLY CONTEXT</div><h3>实际 GDP：当年季度同比</h3><div id=\"chart\">等待官方数据</div><p class=\"fine\">同一篇发布稿中的季度同比，单位 %；不与累计同比或环比混用。该图仅展示官方公布值，不能据此验证演讲对增长统计的质疑。</p></div><div class=\"panel\"><div class=\"eyebrow\">HOW TO READ</div><h3>把观点变成可检验的问题</h3><p>消费和核心物价是否同步改善？房地产投资的收缩是否放缓？就业指标与居民消费是否相互印证？</p><p class=\"fine\">社零主要衡量商品零售与餐饮，不能代替居民全部消费；调查失业率不等于就业总量。不同统计期的指标不能直接横向比较。点击 ☆ 可在本浏览器保存关注。</p><a href=\"https://www.stats.gov.cn/sj/zxfb/\" target=\"_blank\" rel=\"noopener\">查阅官方发布日历与数据 →</a></div></section><section id=\"research\" class=\"section\"><div class=\"sectionhead\"><div><div class=\"eyebrow\">RESEARCH MAP</div><h2>原演讲，如何持续追踪？</h2></div><span class=\"fine\">研究框架 ≠ 已复现的原始模型</span></div><div class=\"row\"><span>01</span><div><h3>转型与周期压力</h3><p>跟踪工业、PMI 与需求指标。演讲中支持／限制／中性行业的分类需要公司名单、权重与退市处理规则，当前没有可验证的完整底表。</p></div><div><span class=\"tag\">官方辅助指标</span><span class=\"tag missing\">原样本待取得</span></div></div><div class=\"row\"><span>02</span><div><h3>消费、人口与收入预期</h3><p>当前追踪全国社零。原演讲省际散点图已按原图恢复；继续更新其模型仍需统一口径的省际底表，不能用全国社零替代。</p></div><div><span class=\"tag\">消费已接入</span><span class=\"tag missing\">省际面板待取得</span></div></div><div class=\"row\"><span>03</span><div><h3>就业与总量统计的交叉核对</h3><p>当前展示城镇调查失业率。原图就业人数与趋势假设已可检查；继续更新仍需年鉴和人口修订数据。演讲中的推算与官方公布值须分别保留。</p></div><div><span class=\"tag\">失业率已接入</span><span class=\"tag missing\">就业推算可检查</span></div></div><div class=\"row\"><span>04</span><div><h3>房地产调整、物价与增长</h3><p>跟踪开发投资、销售面积与核心 CPI。国际泡沫后修复年限属于历史比较，不能当作中国未来增长路径的确定预测。</p></div><div><span class=\"tag\">官方指标已接入</span><span class=\"tag missing\">跨国路径已复算</span></div></div></section><section id=\"archive\" class=\"section twocol\"><div><div class=\"eyebrow\">SOURCE ARCHIVE</div><h2>演讲与全文入口</h2><a class=\"doc\" target=\"_blank\" rel=\"noopener\" href=\"https://youtu.be/shm3gE2BAQE\"><strong>你提供的视频 ↗</strong><small>《时隔一年再看｜高善文最后一次分析中国经济》· 老王来了精选频道。转载标题不能证明“最后一次”。</small></a><a class=\"doc\" target=\"_blank\" rel=\"noopener\" href=\"https://www.jenniferzengblog.com/home/2025/5/17/gdp3\"><strong>完整中文听打稿 + 中英字幕视频入口 ↗</strong><small>第三方整理，标注演讲时间 2024-12-03、深圳；并非已核验的讲者审定稿。本站提供链接，不转载全文。</small></a><a class=\"doc\" target=\"_blank\" rel=\"noopener\" href=\"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf\"><strong>《云开雾散曙光现》30页幻灯片 ↗</strong><small>已逐页核对的第三方留存版，本次23张图的重绘依据。原图数据库来源为 Wind、国投证券。</small></a><a class=\"doc\" target=\"_blank\" rel=\"noopener\" href=\"https://podwise.ai/episodes/2456458\"><strong>约 77 分钟演讲的章节索引 ↗</strong><small>第三方音频索引；可辅助定位消费、就业与房地产段落，非官方逐字稿。</small></a></div><div class=\"panel\"><div class=\"eyebrow\">DATA TRANSPARENCY</div><h3>更新、缺失与修订都应可见</h3><p>服务器按访问请求检查最新综合经济运行报告，缓存 30 分钟。个别专题数据可能已先于综合报告发布，请以原文统计期为准。解析失败的项目显示“待核验”，不会自动填入猜测值。</p><p>来源不可用时，仍展示服务器上已核验的数据存档，并显示原统计期和存档时间。成功更新会保存到服务器并留存修订版本。完整年度采用年度统计公报，本年仅展示进展版。</p><p>关注列表保存在当前浏览器；年度报告与更新数据在服务器归档，可跨设备查看。报告支持 Markdown 下载及打印为 PDF。后续官方修订可能改变历史数值。</p><p class=\"fine\">独立经济观察工具，与高善文及其任职机构无隶属关系。当前只接入可核验的官方辅助指标。</p></div></section></main><footer>观势 · 用持续的数据，检验一时的判断。<span style=\"float:right\">SOURCE FIRST / UPDATED WITH RELEASES</span></footer><script type=\"application/json\" id=\"speech-initial\">{\n  \"version\": 1,\n  \"asOf\": \"2024-12-03\",\n  \"retrievedAt\": \"2026-10-25T22:09:34.716759+00:00\",\n  \"source\": {\n    \"url\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf\",\n    \"mirror\": \"https://statics.biogeeker.com/obsidian/202412100302794.pdf\",\n    \"sha256\": \"76544e0149ff4409577f079c4707609de837c1f24229a470fbeaa35ac394346c\",\n    \"pages\": 30,\n    \"provenance\": \"第三方保存的演讲幻灯片；与公开听打稿逐项核对。\"\n  },\n  \"classification\": [\n    {\n      \"name\": \"支持\",\n      \"count\": 2341,\n      \"industries\": [\n        \"电力设备\",\n        \"电子\",\n        \"机械设备\",\n        \"国防军工\",\n        \"汽车\",\n        \"计算机\",\n        \"通信\"\n      ]\n    },\n    {\n      \"name\": \"中性\",\n      \"count\": 2638,\n      \"industries\": [\n        \"商贸零售\",\n        \"社会服务（不包括教育）\",\n        \"基础化工\",\n        \"钢铁\",\n        \"有色金属\",\n        \"建筑材料\",\n        \"家用电器\",\n        \"纺织服饰\",\n        \"轻工制造\",\n        \"农林牧渔\",\n        \"食品饮料\",\n        \"医药生物\",\n        \"公用事业\",\n        \"交通运输\",\n        \"煤炭\",\n        \"石油石化\",\n        \"环保\",\n        \"美容护理\"\n      ]\n    },\n    {\n      \"name\": \"限制\",\n      \"count\": 473,\n      \"countDetail\": \"A股342；中概股131（原表备注：没有国企）\",\n      \"industries\": [\n        \"房地产\",\n        \"非银金融\",\n        \"传媒\",\n        \"教育（二级）\",\n        \"中概股中的房地产、保险、媒体、软件与服务\"\n      ]\n    }\n  ],\n  \"classificationPage\": 3,\n  \"charts\": [\n    {\n      \"id\": \"slide-04\",\n      \"page\": 4,\n      \"title\": \"三类公司的营业收入占比\",\n      \"section\": \"企业与转型\",\n      \"kind\": \"line\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=4\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"支持类\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2016\",\n              \"y\": 20.55\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2017\",\n              \"y\": 20.59\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2018\",\n              \"y\": 20.16\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2019\",\n              \"y\": 19.95\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2020\",\n              \"y\": 20.92\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2021\",\n              \"y\": 20.31\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2022\",\n              \"y\": 21.55\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2023\",\n              \"y\": 24.11\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2024-09\",\n              \"y\": 25.0\n            }\n          ]\n        },\n        {\n          \"name\": \"限制类\",\n          \"color\": \"#0070c0\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2016\",\n              \"y\": 14.61\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2017\",\n              \"y\": 13.78\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2018\",\n              \"y\": 13.33\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2019\",\n              \"y\": 15.39\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2020\",\n              \"y\": 16.05\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2021\",\n              \"y\": 14.4\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2022\",\n              \"y\": 12.26\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2023\",\n              \"y\": 11.01\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2024-09\",\n              \"y\": 9.63\n            }\n          ]\n        },\n        {\n          \"name\": \"中性类\",\n          \"color\": \"#70ad47\",\n          \"axis\": \"right\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2016\",\n              \"y\": 64.85\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2017\",\n              \"y\": 65.66\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2018\",\n              \"y\": 66.52\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2019\",\n              \"y\": 64.65\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2020\",\n              \"y\": 63.04\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2021\",\n              \"y\": 65.29\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2022\",\n              \"y\": 66.18\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2023\",\n              \"y\": 64.87\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2024-09\",\n              \"y\": 65.37\n            }\n          ]\n        }\n      ],\n      \"method\": \"固定公司样本；组内营业总收入之和 / 全样本营业总收入。中性类使用右轴。\",\n      \"limits\": [\n        \"固定样本和行业规则已知；逐公司证券名单、汇率和跨市场去重规则仍未取得。\"\n      ],\n      \"labels\": [\n        \"2016\",\n        \"2017\",\n        \"2018\",\n        \"2019\",\n        \"2020\",\n        \"2021\",\n        \"2022\",\n        \"2023\",\n        \"2024-09\"\n      ],\n      \"axis\": {\n        \"left\": [\n          9,\n          30\n        ],\n        \"right\": [\n          40,\n          70\n        ],\n        \"yTicks\": [\n          9,\n          14,\n          19,\n          24,\n          29\n        ],\n        \"rightTicks\": [\n          40,\n          45,\n          50,\n          55,\n          60,\n          65,\n          70\n        ]\n      },\n      \"digitizationError\": 0.018\n    },\n    {\n      \"id\": \"slide-05\",\n      \"page\": 5,\n      \"title\": \"三类公司的总市值占比\",\n      \"section\": \"企业与转型\",\n      \"kind\": \"line\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=5\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"支持类\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2016\",\n              \"y\": 27.28\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2017\",\n              \"y\": 25.8\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2018\",\n              \"y\": 24.93\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2019\",\n              \"y\": 27.18\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2020\",\n              \"y\": 30.98\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2021\",\n              \"y\": 35.72\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2022\",\n              \"y\": 33.5\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2023\",\n              \"y\": 36.79\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2024-09\",\n              \"y\": 36.41\n            }\n          ]\n        },\n        {\n          \"name\": \"中性类\",\n          \"color\": \"#70ad47\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2016\",\n              \"y\": 52.51\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2017\",\n              \"y\": 53.35\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2018\",\n              \"y\": 54.58\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2019\",\n              \"y\": 51.13\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2020\",\n              \"y\": 51.08\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2021\",\n              \"y\": 51.08\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2022\",\n              \"y\": 53.3\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2023\",\n              \"y\": 50.73\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2024-09\",\n              \"y\": 49.84\n            }\n          ]\n        },\n        {\n          \"name\": \"限制类\",\n          \"color\": \"#0070c0\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2016\",\n              \"y\": 20.22\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2017\",\n              \"y\": 20.86\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2018\",\n              \"y\": 20.52\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2019\",\n              \"y\": 21.7\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2020\",\n              \"y\": 17.95\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2021\",\n              \"y\": 13.21\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2022\",\n              \"y\": 13.21\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2023\",\n              \"y\": 12.5\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2024-09\",\n              \"y\": 13.75\n            }\n          ]\n        }\n      ],\n      \"method\": \"同一固定样本，各组总市值除以全部样本总市值。\",\n      \"limits\": [\n        \"金融企业、A/H 双重上市及 ADR 的市值口径需要原始样本表核对。\"\n      ],\n      \"labels\": [\n        \"2016\",\n        \"2017\",\n        \"2018\",\n        \"2019\",\n        \"2020\",\n        \"2021\",\n        \"2022\",\n        \"2023\",\n        \"2024-09\"\n      ],\n      \"axis\": {\n        \"left\": [\n          0,\n          60\n        ],\n        \"yTicks\": [\n          0,\n          10,\n          20,\n          30,\n          40,\n          50,\n          60\n        ]\n      },\n      \"digitizationError\": 0.051\n    },\n    {\n      \"id\": \"slide-06\",\n      \"page\": 6,\n      \"title\": \"相对中性行业的股价表现\",\n      \"section\": \"企业与转型\",\n      \"kind\": \"line\",\n      \"unit\": \"2018=1\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=6\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"支持类 / 中性类\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2009\",\n              \"y\": 1.02\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2010\",\n              \"y\": 1.15\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2011\",\n              \"y\": 0.95\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2012\",\n              \"y\": 0.9\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2013\",\n              \"y\": 1.17\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2014\",\n              \"y\": 1.12\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2015\",\n              \"y\": 1.36\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2016\",\n              \"y\": 1.21\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2017\",\n              \"y\": 1.12\n            },\n            {\n              \"x\": 9,\n              \"label\": \"2018\",\n              \"y\": 1.0\n            },\n            {\n              \"x\": 10,\n              \"label\": \"2019\",\n              \"y\": 1.17\n            },\n            {\n              \"x\": 11,\n              \"label\": \"2020\",\n              \"y\": 1.35\n            },\n            {\n              \"x\": 12,\n              \"label\": \"2021\",\n              \"y\": 1.41\n            },\n            {\n              \"x\": 13,\n              \"label\": \"2022\",\n              \"y\": 1.21\n            },\n            {\n              \"x\": 14,\n              \"label\": \"2023\",\n              \"y\": 1.33\n            },\n            {\n              \"x\": 15,\n              \"label\": \"2024-11-22\",\n              \"y\": 1.29\n            }\n          ]\n        },\n        {\n          \"name\": \"限制类 / 中性类\",\n          \"color\": \"#0070c0\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2009\",\n              \"y\": 0.57\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2010\",\n              \"y\": 0.52\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2011\",\n              \"y\": 0.58\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2012\",\n              \"y\": 0.71\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2013\",\n              \"y\": 0.8\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2014\",\n              \"y\": 1.0\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2015\",\n              \"y\": 1.02\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2016\",\n              \"y\": 0.95\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2017\",\n              \"y\": 1.03\n            },\n            {\n              \"x\": 9,\n              \"label\": \"2018\",\n              \"y\": 1.0\n            },\n            {\n              \"x\": 10,\n              \"label\": \"2019\",\n              \"y\": 1.05\n            },\n            {\n              \"x\": 11,\n              \"label\": \"2020\",\n              \"y\": 0.82\n            },\n            {\n              \"x\": 12,\n              \"label\": \"2021\",\n              \"y\": 0.59\n            },\n            {\n              \"x\": 13,\n              \"label\": \"2022\",\n              \"y\": 0.58\n            },\n            {\n              \"x\": 14,\n              \"label\": \"2023\",\n              \"y\": 0.6\n            },\n            {\n              \"x\": 15,\n              \"label\": \"2024-11-22\",\n              \"y\": 0.64\n            }\n          ]\n        }\n      ],\n      \"method\": \"先取类别组合股价相对中性类别的比值，再按 2018 年归一化。不是上证指数或未除以中性行业的绝对收益。\",\n      \"limits\": [\n        \"原稿没有给出完整的价格调整、分红和组合权重规则；此处恢复图中比值，不用行业指数冒充。\"\n      ],\n      \"labels\": [\n        \"2009\",\n        \"2010\",\n        \"2011\",\n        \"2012\",\n        \"2013\",\n        \"2014\",\n        \"2015\",\n        \"2016\",\n        \"2017\",\n        \"2018\",\n        \"2019\",\n        \"2020\",\n        \"2021\",\n        \"2022\",\n        \"2023\",\n        \"2024-11-22\"\n      ],\n      \"axis\": {\n        \"left\": [\n          0.4,\n          1.6\n        ],\n        \"yTicks\": [\n          0.4,\n          0.6,\n          0.8,\n          1,\n          1.2,\n          1.4,\n          1.6\n        ]\n      },\n      \"digitizationError\": 0.001\n    },\n    {\n      \"id\": \"slide-07\",\n      \"page\": 7,\n      \"title\": \"中性行业营业总收入增速\",\n      \"section\": \"企业与转型\",\n      \"kind\": \"line\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=7\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"中性行业\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2017\",\n              \"y\": 22.81\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2018\",\n              \"y\": 17.19\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2019\",\n              \"y\": 10.34\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2020\",\n              \"y\": 2.19\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2021\",\n              \"y\": 28.03\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2022\",\n              \"y\": 12.21\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2023\",\n              \"y\": 2.48\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2024-09\",\n              \"y\": -2.28\n            }\n          ]\n        }\n      ],\n      \"method\": \"同一固定中性公司样本的组内营收合计同比。2024 点是截至三季度口径。\",\n      \"limits\": [\n        \"季度累计与完整年度不同；原稿样本内公司名单仍缺失。\"\n      ],\n      \"labels\": [\n        \"2017\",\n        \"2018\",\n        \"2019\",\n        \"2020\",\n        \"2021\",\n        \"2022\",\n        \"2023\",\n        \"2024-09\"\n      ],\n      \"axis\": {\n        \"left\": [\n          -5,\n          30\n        ],\n        \"yTicks\": [\n          -5,\n          0,\n          5,\n          10,\n          15,\n          20,\n          25,\n          30\n        ]\n      },\n      \"digitizationError\": 0.03\n    },\n    {\n      \"id\": \"slide-08\",\n      \"page\": 8,\n      \"title\": \"中性行业员工总数增速\",\n      \"section\": \"企业与转型\",\n      \"kind\": \"line\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=8\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"中性行业\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2017\",\n              \"y\": 3.43\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2018\",\n              \"y\": 8.05\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2019\",\n              \"y\": 4.23\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2020\",\n              \"y\": 4.67\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2021\",\n              \"y\": 7.0\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2022\",\n              \"y\": 5.6\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2023\",\n              \"y\": 2.84\n            }\n          ]\n        }\n      ],\n      \"method\": \"固定样本公司披露的员工人数合计同比；原图截至 2023 年。\",\n      \"limits\": [\n        \"员工披露口径和合并范围变化可影响增长。\"\n      ],\n      \"labels\": [\n        \"2017\",\n        \"2018\",\n        \"2019\",\n        \"2020\",\n        \"2021\",\n        \"2022\",\n        \"2023\"\n      ],\n      \"axis\": {\n        \"left\": [\n          2,\n          9\n        ],\n        \"yTicks\": [\n          2,\n          3,\n          4,\n          5,\n          6,\n          7,\n          8,\n          9\n        ]\n      },\n      \"digitizationError\": 0.006\n    },\n    {\n      \"id\": \"slide-10\",\n      \"page\": 10,\n      \"title\": \"人口年龄结构与消费：疫情前\",\n      \"section\": \"消费与信心\",\n      \"kind\": \"scatter\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=10\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"原图散点\",\n          \"points\": [\n            {\n              \"x\": 84.989,\n              \"y\": 10.997,\n              \"label\": \"安徽\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 86.699,\n              \"y\": 4.223,\n              \"label\": \"北京\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 88.902,\n              \"y\": 10.709,\n              \"label\": \"福建\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 87.418,\n              \"y\": 7.414,\n              \"label\": \"甘肃\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 91.418,\n              \"y\": 7.84,\n              \"label\": \"广东\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 87.798,\n              \"y\": 7.299,\n              \"label\": \"广西\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 88.44,\n              \"y\": 5.099,\n              \"label\": \"贵州\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 89.569,\n              \"y\": 5.179,\n              \"label\": \"海南\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 86.078,\n              \"y\": 8.624,\n              \"label\": \"河北\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 86.509,\n              \"y\": 10.444,\n              \"label\": \"河南\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 84.389,\n              \"y\": 6.297,\n              \"label\": \"黑龙江\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 85.41,\n              \"y\": 10.467,\n              \"label\": \"湖北\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 85.19,\n              \"y\": 9.902,\n              \"label\": \"湖南\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 84.389,\n              \"y\": 3.855,\n              \"label\": \"吉林\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 83.798,\n              \"y\": 6.873,\n              \"label\": \"江苏\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 88.111,\n              \"y\": 11.158,\n              \"label\": \"江西\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 82.581,\n              \"y\": 6.078,\n              \"label\": \"辽宁\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 86.951,\n              \"y\": 4.661,\n              \"label\": \"内蒙古\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 90.38,\n              \"y\": 4.799,\n              \"label\": \"宁夏\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 91.32,\n              \"y\": 6.158,\n              \"label\": \"青海\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 84.871,\n              \"y\": 7.138,\n              \"label\": \"山东\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 87.1,\n              \"y\": 8.059,\n              \"label\": \"山西\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 86.679,\n              \"y\": 8.002,\n              \"label\": \"陕西\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 83.721,\n              \"y\": 7.253,\n              \"label\": \"上海\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 83.069,\n              \"y\": 10.444,\n              \"label\": \"四川\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 85.251,\n              \"y\": -0.638,\n              \"label\": \"天津\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 94.329,\n              \"y\": 8.877,\n              \"label\": \"西藏\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 92.239,\n              \"y\": 5.237,\n              \"label\": \"新疆\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 89.251,\n              \"y\": 10.743,\n              \"label\": \"云南\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 86.73,\n              \"y\": 8.635,\n              \"label\": \"浙江\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 82.92,\n              \"y\": 8.601,\n              \"label\": \"重庆\",\n              \"color\": \"#4f81bd\"\n            }\n          ]\n        }\n      ],\n      \"xLabel\": \"65岁以下人口占比，%\",\n      \"yLabel\": \"2018—2019 社零同比平均，%\",\n      \"method\": \"省级横截面：65岁以下人口占比与 2018—2019 社零平均同比。\",\n      \"limits\": [\n        \"恢复了图中的省份点值；人口年龄结构基准年的原稿说明仍不充分。\",\n        \"从恢复散点复算OLS斜率约−0.018，原图却标注+0.02、截距7.20，与图中散点不一致；不把原图方程当作已通过核验的拟合结果。\"\n      ],\n      \"axis\": {\n        \"x\": [\n          80,\n          96\n        ],\n        \"left\": [\n          -2,\n          12\n        ],\n        \"yTicks\": [\n          -2,\n          0,\n          2,\n          4,\n          6,\n          8,\n          10,\n          12\n        ],\n        \"xTicks\": [\n          80,\n          82,\n          84,\n          86,\n          88,\n          90,\n          92,\n          94,\n          96\n        ]\n      },\n      \"regression\": {\n        \"slope\": 0.02,\n        \"intercept\": 7.2,\n        \"r2\": 0.0,\n        \"p\": 0.92\n      },\n      \"drawnFit\": [\n        {\n          \"x\": 82.5801,\n          \"y\": 7.5117\n        },\n        {\n          \"x\": 94.33,\n          \"y\": 7.3034\n        }\n      ],\n      \"recoveredOLS\": {\n        \"n\": 31,\n        \"slope\": -0.01778,\n        \"intercept\": 8.97963,\n        \"r2\": 0.00038\n      }\n    },\n    {\n      \"id\": \"slide-11\",\n      \"page\": 11,\n      \"title\": \"人口年龄结构与消费：疫情后\",\n      \"section\": \"消费与信心\",\n      \"kind\": \"scatter\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=11\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"原图散点\",\n          \"points\": [\n            {\n              \"x\": 84.989,\n              \"y\": 4.102,\n              \"label\": \"安徽\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 86.699,\n              \"y\": 0.995,\n              \"label\": \"北京\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 88.902,\n              \"y\": 5.392,\n              \"label\": \"福建\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 87.418,\n              \"y\": 3.404,\n              \"label\": \"甘肃\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 91.418,\n              \"y\": 2.101,\n              \"label\": \"广东\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 87.798,\n              \"y\": 1.1,\n              \"label\": \"广西\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 89.569,\n              \"y\": -5.798,\n              \"label\": \"海南\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 86.078,\n              \"y\": 4.484,\n              \"label\": \"河北\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 86.509,\n              \"y\": 5.603,\n              \"label\": \"河南\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 84.389,\n              \"y\": 1.6,\n              \"label\": \"黑龙江\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 85.41,\n              \"y\": 5.629,\n              \"label\": \"湖北\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 85.19,\n              \"y\": 5.892,\n              \"label\": \"湖南\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 84.389,\n              \"y\": 3.904,\n              \"label\": \"吉林\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 83.798,\n              \"y\": 5.497,\n              \"label\": \"江苏\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 88.111,\n              \"y\": 4.8,\n              \"label\": \"江西\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 82.581,\n              \"y\": 5.194,\n              \"label\": \"辽宁\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 86.951,\n              \"y\": 2.496,\n              \"label\": \"内蒙古\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 90.38,\n              \"y\": 1.403,\n              \"label\": \"宁夏\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 91.32,\n              \"y\": -4.508,\n              \"label\": \"青海\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 84.871,\n              \"y\": 5.497,\n              \"label\": \"山东\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 87.1,\n              \"y\": 2.403,\n              \"label\": \"山西\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 86.679,\n              \"y\": 2.496,\n              \"label\": \"陕西\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 83.721,\n              \"y\": -0.704,\n              \"label\": \"上海\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 83.069,\n              \"y\": 4.997,\n              \"label\": \"四川\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 85.251,\n              \"y\": -1.006,\n              \"label\": \"天津\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 94.329,\n              \"y\": 1.403,\n              \"label\": \"西藏\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 92.239,\n              \"y\": 0.1,\n              \"label\": \"新疆\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 89.251,\n              \"y\": 2.996,\n              \"label\": \"云南\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 86.73,\n              \"y\": 5.3,\n              \"label\": \"浙江\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 82.92,\n              \"y\": 4.602,\n              \"label\": \"重庆\",\n              \"color\": \"#4f81bd\"\n            }\n          ]\n        }\n      ],\n      \"xLabel\": \"65岁以下人口占比，%\",\n      \"yLabel\": \"2024 年 1—5 月社零累计同比，%\",\n      \"method\": \"30 个省份的图中观测；23省用2024年1—5月，其余用最近进度，最早为1—3月。\",\n      \"limits\": [\n        \"不是同一观察窗口的严格可比面板；与疫情前图的样本量也不同。横截面相关不能直接识别年龄的因果影响。\"\n      ],\n      \"axis\": {\n        \"x\": [\n          80,\n          96\n        ],\n        \"left\": [\n          -8,\n          8\n        ],\n        \"yTicks\": [\n          -8,\n          -6,\n          -4,\n          -2,\n          0,\n          2,\n          4,\n          6,\n          8\n        ],\n        \"xTicks\": [\n          80,\n          82,\n          84,\n          86,\n          88,\n          90,\n          92,\n          94,\n          96\n        ]\n      },\n      \"regression\": {\n        \"slope\": -0.47,\n        \"intercept\": 43.19,\n        \"r2\": 0.22,\n        \"p\": 0.01\n      },\n      \"drawnFit\": [\n        {\n          \"x\": 82.5801,\n          \"y\": 4.7418\n        },\n        {\n          \"x\": 94.33,\n          \"y\": -0.7295\n        }\n      ],\n      \"recoveredOLS\": {\n        \"n\": 30,\n        \"slope\": -0.46546,\n        \"intercept\": 43.17712,\n        \"r2\": 0.21896\n      }\n    },\n    {\n      \"id\": \"slide-12\",\n      \"page\": 12,\n      \"title\": \"房价与调整后消费：疫情前\",\n      \"section\": \"消费与信心\",\n      \"kind\": \"scatter\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=12\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"原图散点\",\n          \"points\": [\n            {\n              \"x\": 3.805,\n              \"y\": 28.975,\n              \"label\": \"观测 1\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 4.801,\n              \"y\": 0.374,\n              \"label\": \"观测 2\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 3.856,\n              \"y\": -2.704,\n              \"label\": \"观测 3\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.972,\n              \"y\": 1.279,\n              \"label\": \"观测 4\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.643,\n              \"y\": 1.279,\n              \"label\": \"观测 5\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.157,\n              \"y\": 6.709,\n              \"label\": \"观测 6\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.233,\n              \"y\": 14.403,\n              \"label\": \"观测 7\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.492,\n              \"y\": 6.302,\n              \"label\": \"观测 8\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.226,\n              \"y\": -1.21,\n              \"label\": \"观测 9\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.233,\n              \"y\": 2.772,\n              \"label\": \"观测 10\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.254,\n              \"y\": 16.711,\n              \"label\": \"观测 11\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.823,\n              \"y\": 10.285,\n              \"label\": \"观测 12\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.249,\n              \"y\": 31.871,\n              \"label\": \"观测 13\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.885,\n              \"y\": -1.391,\n              \"label\": \"观测 14\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.621,\n              \"y\": -1.798,\n              \"label\": \"观测 15\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.319,\n              \"y\": -0.486,\n              \"label\": \"观测 16\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.243,\n              \"y\": 0.283,\n              \"label\": \"观测 17\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.955,\n              \"y\": 5.578,\n              \"label\": \"观测 18\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -3.45,\n              \"y\": 9.606,\n              \"label\": \"观测 19\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.336,\n              \"y\": 7.207,\n              \"label\": \"观测 20\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.282,\n              \"y\": 5.488,\n              \"label\": \"观测 21\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.504,\n              \"y\": 4.583,\n              \"label\": \"观测 22\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -6.818,\n              \"y\": 5.714,\n              \"label\": \"观测 23\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.657,\n              \"y\": 0.51,\n              \"label\": \"观测 24\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.645,\n              \"y\": 21.915,\n              \"label\": \"观测 25\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.289,\n              \"y\": -0.215,\n              \"label\": \"观测 26\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -4.359,\n              \"y\": 5.895,\n              \"label\": \"观测 27\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -4.543,\n              \"y\": 0.012,\n              \"label\": \"观测 28\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.688,\n              \"y\": 0.193,\n              \"label\": \"观测 29\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.931,\n              \"y\": 0.872,\n              \"label\": \"观测 30\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.53,\n              \"y\": 5.307,\n              \"label\": \"观测 31\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.669,\n              \"y\": 7.479,\n              \"label\": \"观测 32\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.51,\n              \"y\": -0.712,\n              \"label\": \"观测 33\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.064,\n              \"y\": 3.089,\n              \"label\": \"观测 34\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.541,\n              \"y\": 14.584,\n              \"label\": \"观测 35\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.858,\n              \"y\": 2.591,\n              \"label\": \"观测 36\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.613,\n              \"y\": 9.696,\n              \"label\": \"观测 37\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -3.553,\n              \"y\": -2.115,\n              \"label\": \"观测 38\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.976,\n              \"y\": 3.904,\n              \"label\": \"观测 39\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.207,\n              \"y\": 7.615,\n              \"label\": \"观测 40\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.539,\n              \"y\": 9.606,\n              \"label\": \"观测 41\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.431,\n              \"y\": 3.994,\n              \"label\": \"观测 42\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.453,\n              \"y\": 23.273,\n              \"label\": \"观测 43\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.334,\n              \"y\": 9.606,\n              \"label\": \"观测 44\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.069,\n              \"y\": 2.274,\n              \"label\": \"观测 45\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.745,\n              \"y\": -1.889,\n              \"label\": \"观测 46\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.658,\n              \"y\": 4.99,\n              \"label\": \"观测 47\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.852,\n              \"y\": 8.384,\n              \"label\": \"观测 48\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.351,\n              \"y\": 6.483,\n              \"label\": \"观测 49\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -3.979,\n              \"y\": 9.289,\n              \"label\": \"观测 50\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -3.994,\n              \"y\": -3.79,\n              \"label\": \"观测 51\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -4.785,\n              \"y\": 9.199,\n              \"label\": \"观测 52\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -6.325,\n              \"y\": 12.774,\n              \"label\": \"观测 53\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -6.099,\n              \"y\": 2.093,\n              \"label\": \"观测 54\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.402,\n              \"y\": 29.473,\n              \"label\": \"观测 55\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.946,\n              \"y\": -1.301,\n              \"label\": \"观测 56\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.333,\n              \"y\": 1.007,\n              \"label\": \"观测 57\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.094,\n              \"y\": 5.307,\n              \"label\": \"观测 58\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.948,\n              \"y\": 11.28,\n              \"label\": \"观测 59\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 3.215,\n              \"y\": 3.587,\n              \"label\": \"观测 60\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -6.91,\n              \"y\": 10.013,\n              \"label\": \"观测 61\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.229,\n              \"y\": 1.415,\n              \"label\": \"观测 62\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.097,\n              \"y\": 16.485,\n              \"label\": \"观测 63\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.139,\n              \"y\": 0.872,\n              \"label\": \"观测 64\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -6.125,\n              \"y\": 4.583,\n              \"label\": \"观测 65\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.545,\n              \"y\": 1.279,\n              \"label\": \"观测 66\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.78,\n              \"y\": 24.495,\n              \"label\": \"观测 67\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.133,\n              \"y\": 1.098,\n              \"label\": \"观测 68\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.129,\n              \"y\": 1.007,\n              \"label\": \"观测 69\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.852,\n              \"y\": -3.111,\n              \"label\": \"观测 70\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.37,\n              \"y\": 19.879,\n              \"label\": \"观测 71\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.119,\n              \"y\": 6.891,\n              \"label\": \"观测 72\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.601,\n              \"y\": 4.492,\n              \"label\": \"观测 73\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.53,\n              \"y\": 3.315,\n              \"label\": \"观测 74\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.504,\n              \"y\": 3.587,\n              \"label\": \"观测 75\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.157,\n              \"y\": 0.691,\n              \"label\": \"观测 76\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.535,\n              \"y\": 11.28,\n              \"label\": \"观测 77\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -3.912,\n              \"y\": -1.391,\n              \"label\": \"观测 78\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.474,\n              \"y\": 20.196,\n              \"label\": \"观测 79\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.798,\n              \"y\": 8.474,\n              \"label\": \"观测 80\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.736,\n              \"y\": 7.615,\n              \"label\": \"观测 81\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.997,\n              \"y\": -1.391,\n              \"label\": \"观测 82\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.601,\n              \"y\": 11.688,\n              \"label\": \"观测 83\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.0,\n              \"y\": 10.873,\n              \"label\": \"观测 84\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.354,\n              \"y\": 7.705,\n              \"label\": \"观测 85\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.226,\n              \"y\": -1.301,\n              \"label\": \"观测 86\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.256,\n              \"y\": 1.505,\n              \"label\": \"观测 87\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.325,\n              \"y\": 3.813,\n              \"label\": \"观测 88\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -8.985,\n              \"y\": 10.104,\n              \"label\": \"观测 89\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.591,\n              \"y\": 7.388,\n              \"label\": \"观测 90\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.573,\n              \"y\": 15.489,\n              \"label\": \"观测 91\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.727,\n              \"y\": 5.985,\n              \"label\": \"观测 92\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.511,\n              \"y\": -0.215,\n              \"label\": \"观测 93\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.243,\n              \"y\": 3.677,\n              \"label\": \"观测 94\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.226,\n              \"y\": 2.003,\n              \"label\": \"观测 95\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.318,\n              \"y\": 5.397,\n              \"label\": \"观测 96\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -5.991,\n              \"y\": -2.025,\n              \"label\": \"观测 97\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -4.497,\n              \"y\": 0.6,\n              \"label\": \"观测 98\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -5.94,\n              \"y\": 7.072,\n              \"label\": \"观测 99\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.028,\n              \"y\": 7.615,\n              \"label\": \"观测 100\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.826,\n              \"y\": 9.787,\n              \"label\": \"观测 101\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 3.702,\n              \"y\": 5.307,\n              \"label\": \"观测 102\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.28,\n              \"y\": 8.61,\n              \"label\": \"观测 103\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.878,\n              \"y\": 8.701,\n              \"label\": \"观测 104\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.184,\n              \"y\": 1.686,\n              \"label\": \"观测 105\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.649,\n              \"y\": -1.527,\n              \"label\": \"观测 106\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.864,\n              \"y\": 8.61,\n              \"label\": \"观测 107\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.488,\n              \"y\": 14.312,\n              \"label\": \"观测 108\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.807,\n              \"y\": 0.374,\n              \"label\": \"观测 109\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.962,\n              \"y\": -1.301,\n              \"label\": \"观测 110\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.048,\n              \"y\": 2.908,\n              \"label\": \"观测 111\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.605,\n              \"y\": 6.981,\n              \"label\": \"观测 112\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.372,\n              \"y\": 12.185,\n              \"label\": \"观测 113\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.803,\n              \"y\": 0.012,\n              \"label\": \"观测 114\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.457,\n              \"y\": 7.207,\n              \"label\": \"观测 115\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.944,\n              \"y\": 10.511,\n              \"label\": \"观测 116\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.577,\n              \"y\": 11.19,\n              \"label\": \"观测 117\",\n              \"color\": \"#4f81bd\"\n            }\n          ]\n        }\n      ],\n      \"xLabel\": \"二手住宅价格同比，%\",\n      \"yLabel\": \"剔除人口等因素后的社零，%\",\n      \"method\": \"将社零对常住人口增速、城镇化率及病床数对数回归，使用残差与房价增速比较。\",\n      \"limits\": [\n        \"残差化不等于消费原始增速；完整回归窗口、样本配对及控制变量底表未取得。\"\n      ],\n      \"axis\": {\n        \"x\": [\n          -10,\n          6\n        ],\n        \"left\": [\n          -10,\n          45\n        ],\n        \"yTicks\": [\n          -10,\n          -5,\n          0,\n          5,\n          10,\n          15,\n          20,\n          25,\n          30,\n          35,\n          40,\n          45\n        ],\n        \"xTicks\": [\n          -10,\n          -8,\n          -6,\n          -4,\n          -2,\n          0,\n          2,\n          4,\n          6\n        ]\n      },\n      \"regression\": {\n        \"slope\": 0.16,\n        \"intercept\": 6.29,\n        \"r2\": 0.0,\n        \"p\": 0.54\n      },\n      \"drawnFit\": [\n        {\n          \"x\": -8.9849,\n          \"y\": 4.8891\n        },\n        {\n          \"x\": 4.8003,\n          \"y\": 7.0316\n        }\n      ],\n      \"recoveredOLS\": {\n        \"n\": 117,\n        \"slope\": 0.15506,\n        \"intercept\": 6.27923,\n        \"r2\": 0.00327\n      }\n    },\n    {\n      \"id\": \"slide-13\",\n      \"page\": 13,\n      \"title\": \"房价与调整后消费：疫情后\",\n      \"section\": \"消费与信心\",\n      \"kind\": \"scatter\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=13\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"原图散点\",\n          \"points\": [\n            {\n              \"x\": 10.076,\n              \"y\": 6.492,\n              \"label\": \"观测 1\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -11.253,\n              \"y\": 2.592,\n              \"label\": \"观测 2\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 8.155,\n              \"y\": -3.406,\n              \"label\": \"观测 3\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -4.177,\n              \"y\": -6.615,\n              \"label\": \"观测 4\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 4.531,\n              \"y\": 0.395,\n              \"label\": \"观测 5\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -5.708,\n              \"y\": 1.901,\n              \"label\": \"观测 6\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.036,\n              \"y\": -3.999,\n              \"label\": \"观测 7\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.791,\n              \"y\": -3.406,\n              \"label\": \"观测 8\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.047,\n              \"y\": -1.703,\n              \"label\": \"观测 9\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -6.386,\n              \"y\": -5.208,\n              \"label\": \"观测 10\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 4.054,\n              \"y\": -4.912,\n              \"label\": \"观测 11\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.794,\n              \"y\": -10.392,\n              \"label\": \"观测 12\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 5.31,\n              \"y\": 8.097,\n              \"label\": \"观测 13\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -9.866,\n              \"y\": 3.703,\n              \"label\": \"观测 14\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.527,\n              \"y\": -1.999,\n              \"label\": \"观测 15\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.097,\n              \"y\": -9.207,\n              \"label\": \"观测 16\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 7.578,\n              \"y\": -0.592,\n              \"label\": \"观测 17\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -12.047,\n              \"y\": -6.615,\n              \"label\": \"观测 18\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 4.906,\n              \"y\": -5.899,\n              \"label\": \"观测 19\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.877,\n              \"y\": -7.208,\n              \"label\": \"观测 20\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 8.588,\n              \"y\": 3.703,\n              \"label\": \"观测 21\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -7.469,\n              \"y\": 8.689,\n              \"label\": \"观测 22\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.032,\n              \"y\": 0.593,\n              \"label\": \"观测 23\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.256,\n              \"y\": -11.009,\n              \"label\": \"观测 24\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 5.209,\n              \"y\": 1.506,\n              \"label\": \"观测 25\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -5.852,\n              \"y\": -6.714,\n              \"label\": \"观测 26\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 4.646,\n              \"y\": -1.802,\n              \"label\": \"观测 27\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.968,\n              \"y\": -9.207,\n              \"label\": \"观测 28\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.087,\n              \"y\": 2.987,\n              \"label\": \"观测 29\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -3.123,\n              \"y\": -3.703,\n              \"label\": \"观测 30\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.505,\n              \"y\": -2.715,\n              \"label\": \"观测 31\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.809,\n              \"y\": -8.393,\n              \"label\": \"观测 32\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 10.394,\n              \"y\": 2.592,\n              \"label\": \"观测 33\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -6.791,\n              \"y\": -1.308,\n              \"label\": \"观测 34\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.603,\n              \"y\": -3.999,\n              \"label\": \"观测 35\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.632,\n              \"y\": -9.405,\n              \"label\": \"观测 36\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 8.199,\n              \"y\": 1.407,\n              \"label\": \"观测 37\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -8.235,\n              \"y\": -3.604,\n              \"label\": \"观测 38\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.61,\n              \"y\": -3.011,\n              \"label\": \"观测 39\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.202,\n              \"y\": -10.195,\n              \"label\": \"观测 40\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 10.177,\n              \"y\": -3.9,\n              \"label\": \"观测 41\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -7.729,\n              \"y\": -4.813,\n              \"label\": \"观测 42\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.267,\n              \"y\": -2.913,\n              \"label\": \"观测 43\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.314,\n              \"y\": -4.394,\n              \"label\": \"观测 44\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.697,\n              \"y\": 5.801,\n              \"label\": \"观测 45\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -4.162,\n              \"y\": -0.592,\n              \"label\": \"观测 46\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.274,\n              \"y\": -5.307,\n              \"label\": \"观测 47\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -4.653,\n              \"y\": -15.403,\n              \"label\": \"观测 48\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.975,\n              \"y\": -1.802,\n              \"label\": \"观测 49\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -6.776,\n              \"y\": -6.294,\n              \"label\": \"观测 50\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -4.235,\n              \"y\": -5.899,\n              \"label\": \"观测 51\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -5.52,\n              \"y\": -9.602,\n              \"label\": \"观测 52\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 11.823,\n              \"y\": -1.506,\n              \"label\": \"观测 53\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -14.646,\n              \"y\": -2.394,\n              \"label\": \"观测 54\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 12.69,\n              \"y\": -3.505,\n              \"label\": \"观测 55\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -5.245,\n              \"y\": -6.813,\n              \"label\": \"观测 56\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 8.329,\n              \"y\": 3.802,\n              \"label\": \"观测 57\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -6.242,\n              \"y\": -3.801,\n              \"label\": \"观测 58\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.141,\n              \"y\": -6.294,\n              \"label\": \"观测 59\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.043,\n              \"y\": -8.195,\n              \"label\": \"观测 60\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 11.924,\n              \"y\": -0.395,\n              \"label\": \"观测 61\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.101,\n              \"y\": -1.901,\n              \"label\": \"观测 62\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.007,\n              \"y\": -5.011,\n              \"label\": \"观测 63\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.058,\n              \"y\": -11.997,\n              \"label\": \"观测 64\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.314,\n              \"y\": -3.604,\n              \"label\": \"观测 65\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -5.751,\n              \"y\": -3.604,\n              \"label\": \"观测 66\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 5.527,\n              \"y\": -1.999,\n              \"label\": \"观测 67\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.448,\n              \"y\": -8.195,\n              \"label\": \"观测 68\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.148,\n              \"y\": 0.593,\n              \"label\": \"观测 69\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -7.166,\n              \"y\": -5.899,\n              \"label\": \"观测 70\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.256,\n              \"y\": -6.492,\n              \"label\": \"观测 71\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.072,\n              \"y\": -7.8,\n              \"label\": \"观测 72\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.715,\n              \"y\": 4.986,\n              \"label\": \"观测 73\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.487,\n              \"y\": -1.012,\n              \"label\": \"观测 74\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.394,\n              \"y\": -2.098,\n              \"label\": \"观测 75\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -2.054,\n              \"y\": -8.393,\n              \"label\": \"观测 76\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 21.383,\n              \"y\": 6.887,\n              \"label\": \"观测 77\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -14.025,\n              \"y\": -1.407,\n              \"label\": \"观测 78\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 3.968,\n              \"y\": -5.11,\n              \"label\": \"观测 79\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -11.354,\n              \"y\": -9.602,\n              \"label\": \"观测 80\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 10.379,\n              \"y\": 2.296,\n              \"label\": \"观测 81\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -4.018,\n              \"y\": -6.294,\n              \"label\": \"观测 82\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.379,\n              \"y\": -5.504,\n              \"label\": \"观测 83\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.881,\n              \"y\": -16.193,\n              \"label\": \"观测 84\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 8.314,\n              \"y\": 4.986,\n              \"label\": \"观测 85\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -3.787,\n              \"y\": 0.0,\n              \"label\": \"观测 86\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.43,\n              \"y\": -1.308,\n              \"label\": \"观测 87\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.061,\n              \"y\": -12.194,\n              \"label\": \"观测 88\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 6.61,\n              \"y\": 1.308,\n              \"label\": \"观测 89\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -8.523,\n              \"y\": -5.208,\n              \"label\": \"观测 90\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 7.202,\n              \"y\": -5.504,\n              \"label\": \"观测 91\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.101,\n              \"y\": -9.997,\n              \"label\": \"观测 92\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 3.087,\n              \"y\": 3.086,\n              \"label\": \"观测 93\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.679,\n              \"y\": -3.011,\n              \"label\": \"观测 94\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.329,\n              \"y\": -5.504,\n              \"label\": \"观测 95\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.025,\n              \"y\": -9.8,\n              \"label\": \"观测 96\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 7.809,\n              \"y\": -2.098,\n              \"label\": \"观测 97\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -10.935,\n              \"y\": -4.097,\n              \"label\": \"观测 98\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.899,\n              \"y\": -3.801,\n              \"label\": \"观测 99\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 5.195,\n              \"y\": 1.802,\n              \"label\": \"观测 100\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -6.3,\n              \"y\": -7.109,\n              \"label\": \"观测 101\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 4.227,\n              \"y\": -5.307,\n              \"label\": \"观测 102\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.123,\n              \"y\": -9.207,\n              \"label\": \"观测 103\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 13.296,\n              \"y\": 4.394,\n              \"label\": \"观测 104\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -5.419,\n              \"y\": -1.999,\n              \"label\": \"观测 105\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 5.108,\n              \"y\": -5.504,\n              \"label\": \"观测 106\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.032,\n              \"y\": -7.998,\n              \"label\": \"观测 107\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.137,\n              \"y\": 5.307,\n              \"label\": \"观测 108\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -4.264,\n              \"y\": -2.394,\n              \"label\": \"观测 109\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.982,\n              \"y\": -0.814,\n              \"label\": \"观测 110\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -3.094,\n              \"y\": -7.208,\n              \"label\": \"观测 111\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 4.892,\n              \"y\": 1.901,\n              \"label\": \"观测 112\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -14.3,\n              \"y\": -3.209,\n              \"label\": \"观测 113\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 14.899,\n              \"y\": -1.999,\n              \"label\": \"观测 114\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -7.383,\n              \"y\": -6.813,\n              \"label\": \"观测 115\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 6.668,\n              \"y\": -1.407,\n              \"label\": \"观测 116\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -9.534,\n              \"y\": -9.602,\n              \"label\": \"观测 117\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 5.368,\n              \"y\": -4.912,\n              \"label\": \"观测 118\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.217,\n              \"y\": -8.195,\n              \"label\": \"观测 119\",\n              \"color\": \"#4f81bd\"\n            }\n          ]\n        }\n      ],\n      \"xLabel\": \"二手住宅价格同比，%\",\n      \"yLabel\": \"剔除人口等因素后的社零，%\",\n      \"method\": \"沿用残差化消费与房价的横截面比较；图中每一点不擅自匹配省份。\",\n      \"limits\": [\n        \"原图显示 p=0.00 是舍入，不是概率严格为零。不能由相关关系直接推导房价下跌造成消费下降。\"\n      ],\n      \"axis\": {\n        \"x\": [\n          -20,\n          25\n        ],\n        \"left\": [\n          -20,\n          10\n        ],\n        \"yTicks\": [\n          -20,\n          -15,\n          -10,\n          -5,\n          0,\n          5,\n          10\n        ],\n        \"xTicks\": [\n          -20,\n          -15,\n          -10,\n          -5,\n          0,\n          5,\n          10,\n          15,\n          20,\n          25\n        ]\n      },\n      \"regression\": {\n        \"slope\": 0.28,\n        \"intercept\": -3.41,\n        \"r2\": 0.14,\n        \"pText\": \"原图显示 0.00（舍入）\"\n      },\n      \"drawnFit\": [\n        {\n          \"x\": -14.6475,\n          \"y\": -7.4467\n        },\n        {\n          \"x\": 21.3882,\n          \"y\": 2.4758\n        }\n      ],\n      \"recoveredOLS\": {\n        \"n\": 119,\n        \"slope\": 0.27537,\n        \"intercept\": -3.41641,\n        \"r2\": 0.13616\n      }\n    },\n    {\n      \"id\": \"slide-14\",\n      \"page\": 14,\n      \"title\": \"消费者信心指数\",\n      \"section\": \"消费与信心\",\n      \"kind\": \"line\",\n      \"unit\": \"指数\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=14\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"消费者信心\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2015-01\",\n              \"y\": 105.69\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2015-02\",\n              \"y\": 109.79\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2015-03\",\n              \"y\": 107.12\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2015-04\",\n              \"y\": 107.61\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2015-05\",\n              \"y\": 109.88\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2015-06\",\n              \"y\": 105.49\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2015-07\",\n              \"y\": 104.5\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2015-08\",\n              \"y\": 104.01\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2015-09\",\n              \"y\": 105.59\n            },\n            {\n              \"x\": 9,\n              \"label\": \"2015-10\",\n              \"y\": 103.81\n            },\n            {\n              \"x\": 10,\n              \"label\": \"2015-11\",\n              \"y\": 104.11\n            },\n            {\n              \"x\": 11,\n              \"label\": \"2015-12\",\n              \"y\": 103.71\n            },\n            {\n              \"x\": 12,\n              \"label\": \"2016-01\",\n              \"y\": 104.01\n            },\n            {\n              \"x\": 13,\n              \"label\": \"2016-02\",\n              \"y\": 104.4\n            },\n            {\n              \"x\": 14,\n              \"label\": \"2016-03\",\n              \"y\": 100.01\n            },\n            {\n              \"x\": 15,\n              \"label\": \"2016-04\",\n              \"y\": 101.0\n            },\n            {\n              \"x\": 16,\n              \"label\": \"2016-05\",\n              \"y\": 99.81\n            },\n            {\n              \"x\": 17,\n              \"label\": \"2016-06\",\n              \"y\": 102.92\n            },\n            {\n              \"x\": 18,\n              \"label\": \"2016-07\",\n              \"y\": 106.82\n            },\n            {\n              \"x\": 19,\n              \"label\": \"2016-08\",\n              \"y\": 105.59\n            },\n            {\n              \"x\": 20,\n              \"label\": \"2016-09\",\n              \"y\": 104.6\n            },\n            {\n              \"x\": 21,\n              \"label\": \"2016-10\",\n              \"y\": 107.22\n            },\n            {\n              \"x\": 22,\n              \"label\": \"2016-11\",\n              \"y\": 108.6\n            },\n            {\n              \"x\": 23,\n              \"label\": \"2016-12\",\n              \"y\": 108.4\n            },\n            {\n              \"x\": 24,\n              \"label\": \"2017-01\",\n              \"y\": 109.19\n            },\n            {\n              \"x\": 25,\n              \"label\": \"2017-02\",\n              \"y\": 112.6\n            },\n            {\n              \"x\": 26,\n              \"label\": \"2017-03\",\n              \"y\": 111.02\n            },\n            {\n              \"x\": 27,\n              \"label\": \"2017-04\",\n              \"y\": 113.39\n            },\n            {\n              \"x\": 28,\n              \"label\": \"2017-05\",\n              \"y\": 112.01\n            },\n            {\n              \"x\": 29,\n              \"label\": \"2017-06\",\n              \"y\": 113.29\n            },\n            {\n              \"x\": 30,\n              \"label\": \"2017-07\",\n              \"y\": 114.62\n            },\n            {\n              \"x\": 31,\n              \"label\": \"2017-08\",\n              \"y\": 114.72\n            },\n            {\n              \"x\": 32,\n              \"label\": \"2017-09\",\n              \"y\": 118.62\n            },\n            {\n              \"x\": 33,\n              \"label\": \"2017-10\",\n              \"y\": 123.9\n            },\n            {\n              \"x\": 34,\n              \"label\": \"2017-11\",\n              \"y\": 121.29\n            },\n            {\n              \"x\": 35,\n              \"label\": \"2017-12\",\n              \"y\": 122.62\n            },\n            {\n              \"x\": 36,\n              \"label\": \"2018-01\",\n              \"y\": 122.28\n            },\n            {\n              \"x\": 37,\n              \"label\": \"2018-02\",\n              \"y\": 124.0\n            },\n            {\n              \"x\": 38,\n              \"label\": \"2018-03\",\n              \"y\": 122.28\n            },\n            {\n              \"x\": 39,\n              \"label\": \"2018-04\",\n              \"y\": 122.92\n            },\n            {\n              \"x\": 40,\n              \"label\": \"2018-05\",\n              \"y\": 122.92\n            },\n            {\n              \"x\": 41,\n              \"label\": \"2018-06\",\n              \"y\": 118.18\n            },\n            {\n              \"x\": 42,\n              \"label\": \"2018-07\",\n              \"y\": 119.71\n            },\n            {\n              \"x\": 43,\n              \"label\": \"2018-08\",\n              \"y\": 118.62\n            },\n            {\n              \"x\": 44,\n              \"label\": \"2018-09\",\n              \"y\": 118.52\n            },\n            {\n              \"x\": 45,\n              \"label\": \"2018-10\",\n              \"y\": 119.12\n            },\n            {\n              \"x\": 46,\n              \"label\": \"2018-11\",\n              \"y\": 122.08\n            },\n            {\n              \"x\": 47,\n              \"label\": \"2018-12\",\n              \"y\": 123.02\n            },\n            {\n              \"x\": 48,\n              \"label\": \"2019-01\",\n              \"y\": 123.71\n            },\n            {\n              \"x\": 49,\n              \"label\": \"2019-02\",\n              \"y\": 125.98\n            },\n            {\n              \"x\": 50,\n              \"label\": \"2019-03\",\n              \"y\": 124.1\n            },\n            {\n              \"x\": 51,\n              \"label\": \"2019-04\",\n              \"y\": 125.29\n            },\n            {\n              \"x\": 52,\n              \"label\": \"2019-05\",\n              \"y\": 123.41\n            },\n            {\n              \"x\": 53,\n              \"label\": \"2019-06\",\n              \"y\": 125.88\n            },\n            {\n              \"x\": 54,\n              \"label\": \"2019-07\",\n              \"y\": 124.4\n            },\n            {\n              \"x\": 55,\n              \"label\": \"2019-08\",\n              \"y\": 122.42\n            },\n            {\n              \"x\": 56,\n              \"label\": \"2019-09\",\n              \"y\": 124.1\n            },\n            {\n              \"x\": 57,\n              \"label\": \"2019-10\",\n              \"y\": 124.3\n            },\n            {\n              \"x\": 58,\n              \"label\": \"2019-11\",\n              \"y\": 124.6\n            },\n            {\n              \"x\": 59,\n              \"label\": \"2019-12\",\n              \"y\": 126.62\n            },\n            {\n              \"x\": 60,\n              \"label\": \"2020-01\",\n              \"y\": 126.42\n            },\n            {\n              \"x\": 61,\n              \"label\": \"2020-02\",\n              \"y\": 118.92\n            },\n            {\n              \"x\": 62,\n              \"label\": \"2020-03\",\n              \"y\": 122.18\n            },\n            {\n              \"x\": 63,\n              \"label\": \"2020-04\",\n              \"y\": 116.4\n            },\n            {\n              \"x\": 64,\n              \"label\": \"2020-05\",\n              \"y\": 115.81\n            },\n            {\n              \"x\": 65,\n              \"label\": \"2020-06\",\n              \"y\": 112.6\n            },\n            {\n              \"x\": 66,\n              \"label\": \"2020-07\",\n              \"y\": 117.19\n            },\n            {\n              \"x\": 67,\n              \"label\": \"2020-08\",\n              \"y\": 116.4\n            },\n            {\n              \"x\": 68,\n              \"label\": \"2020-09\",\n              \"y\": 120.5\n            },\n            {\n              \"x\": 69,\n              \"label\": \"2020-10\",\n              \"y\": 121.68\n            },\n            {\n              \"x\": 70,\n              \"label\": \"2020-11\",\n              \"y\": 124.0\n            },\n            {\n              \"x\": 71,\n              \"label\": \"2020-12\",\n              \"y\": 122.08\n            },\n            {\n              \"x\": 72,\n              \"label\": \"2021-01\",\n              \"y\": 122.82\n            },\n            {\n              \"x\": 73,\n              \"label\": \"2021-02\",\n              \"y\": 127.0\n            },\n            {\n              \"x\": 74,\n              \"label\": \"2021-03\",\n              \"y\": 122.18\n            },\n            {\n              \"x\": 75,\n              \"label\": \"2021-04\",\n              \"y\": 121.49\n            },\n            {\n              \"x\": 76,\n              \"label\": \"2021-05\",\n              \"y\": 121.78\n            },\n            {\n              \"x\": 77,\n              \"label\": \"2021-06\",\n              \"y\": 122.82\n            },\n            {\n              \"x\": 78,\n              \"label\": \"2021-07\",\n              \"y\": 117.78\n            },\n            {\n              \"x\": 79,\n              \"label\": \"2021-08\",\n              \"y\": 117.49\n            },\n            {\n              \"x\": 80,\n              \"label\": \"2021-09\",\n              \"y\": 121.19\n            },\n            {\n              \"x\": 81,\n              \"label\": \"2021-10\",\n              \"y\": 120.2\n            },\n            {\n              \"x\": 82,\n              \"label\": \"2021-11\",\n              \"y\": 119.51\n            },\n            {\n              \"x\": 83,\n              \"label\": \"2021-12\",\n              \"y\": 119.81\n            },\n            {\n              \"x\": 84,\n              \"label\": \"2022-01\",\n              \"y\": 121.49\n            },\n            {\n              \"x\": 85,\n              \"label\": \"2022-02\",\n              \"y\": 120.5\n            },\n            {\n              \"x\": 86,\n              \"label\": \"2022-03\",\n              \"y\": 113.19\n            },\n            {\n              \"x\": 87,\n              \"label\": \"2022-04\",\n              \"y\": 86.68\n            },\n            {\n              \"x\": 88,\n              \"label\": \"2022-05\",\n              \"y\": 86.78\n            },\n            {\n              \"x\": 89,\n              \"label\": \"2022-06\",\n              \"y\": 88.9\n            },\n            {\n              \"x\": 90,\n              \"label\": \"2022-07\",\n              \"y\": 87.91\n            },\n            {\n              \"x\": 91,\n              \"label\": \"2022-08\",\n              \"y\": 86.98\n            },\n            {\n              \"x\": 92,\n              \"label\": \"2022-09\",\n              \"y\": 87.22\n            },\n            {\n              \"x\": 93,\n              \"label\": \"2022-10\",\n              \"y\": 86.78\n            },\n            {\n              \"x\": 94,\n              \"label\": \"2022-11\",\n              \"y\": 85.5\n            },\n            {\n              \"x\": 95,\n              \"label\": \"2022-12\",\n              \"y\": 88.31\n            },\n            {\n              \"x\": 96,\n              \"label\": \"2023-01\",\n              \"y\": 91.22\n            },\n            {\n              \"x\": 97,\n              \"label\": \"2023-02\",\n              \"y\": 94.68\n            },\n            {\n              \"x\": 98,\n              \"label\": \"2023-03\",\n              \"y\": 94.88\n            },\n            {\n              \"x\": 99,\n              \"label\": \"2023-04\",\n              \"y\": 87.08\n            },\n            {\n              \"x\": 100,\n              \"label\": \"2023-05\",\n              \"y\": 88.21\n            },\n            {\n              \"x\": 101,\n              \"label\": \"2023-06\",\n              \"y\": 86.38\n            },\n            {\n              \"x\": 102,\n              \"label\": \"2023-07\",\n              \"y\": 86.38\n            },\n            {\n              \"x\": 103,\n              \"label\": \"2023-08\",\n              \"y\": 86.48\n            },\n            {\n              \"x\": 104,\n              \"label\": \"2023-09\",\n              \"y\": 87.22\n            },\n            {\n              \"x\": 105,\n              \"label\": \"2023-10\",\n              \"y\": 87.91\n            },\n            {\n              \"x\": 106,\n              \"label\": \"2023-11\",\n              \"y\": 86.98\n            },\n            {\n              \"x\": 107,\n              \"label\": \"2023-12\",\n              \"y\": 87.62\n            },\n            {\n              \"x\": 108,\n              \"label\": \"2024-01\",\n              \"y\": 88.9\n            },\n            {\n              \"x\": 109,\n              \"label\": \"2024-02\",\n              \"y\": 89.1\n            },\n            {\n              \"x\": 110,\n              \"label\": \"2024-03\",\n              \"y\": 89.4\n            },\n            {\n              \"x\": 111,\n              \"label\": \"2024-04\",\n              \"y\": 88.21\n            },\n            {\n              \"x\": 112,\n              \"label\": \"2024-05\",\n              \"y\": 86.38\n            },\n            {\n              \"x\": 113,\n              \"label\": \"2024-06\",\n              \"y\": 86.19\n            },\n            {\n              \"x\": 114,\n              \"label\": \"2024-07\",\n              \"y\": 85.99\n            },\n            {\n              \"x\": 115,\n              \"label\": \"2024-08\",\n              \"y\": 85.79\n            },\n            {\n              \"x\": 116,\n              \"label\": \"2024-09\",\n              \"y\": 85.69\n            }\n          ]\n        }\n      ],\n      \"method\": \"月度指数，原图2015年1月至2024年9月。\",\n      \"limits\": [\n        \"此为历史图中指数，不是实时调查结果。\"\n      ],\n      \"labels\": [\n        \"2015-01\",\n        \"2015-02\",\n        \"2015-03\",\n        \"2015-04\",\n        \"2015-05\",\n        \"2015-06\",\n        \"2015-07\",\n        \"2015-08\",\n        \"2015-09\",\n        \"2015-10\",\n        \"2015-11\",\n        \"2015-12\",\n        \"2016-01\",\n        \"2016-02\",\n        \"2016-03\",\n        \"2016-04\",\n        \"2016-05\",\n        \"2016-06\",\n        \"2016-07\",\n        \"2016-08\",\n        \"2016-09\",\n        \"2016-10\",\n        \"2016-11\",\n        \"2016-12\",\n        \"2017-01\",\n        \"2017-02\",\n        \"2017-03\",\n        \"2017-04\",\n        \"2017-05\",\n        \"2017-06\",\n        \"2017-07\",\n        \"2017-08\",\n        \"2017-09\",\n        \"2017-10\",\n        \"2017-11\",\n        \"2017-12\",\n        \"2018-01\",\n        \"2018-02\",\n        \"2018-03\",\n        \"2018-04\",\n        \"2018-05\",\n        \"2018-06\",\n        \"2018-07\",\n        \"2018-08\",\n        \"2018-09\",\n        \"2018-10\",\n        \"2018-11\",\n        \"2018-12\",\n        \"2019-01\",\n        \"2019-02\",\n        \"2019-03\",\n        \"2019-04\",\n        \"2019-05\",\n        \"2019-06\",\n        \"2019-07\",\n        \"2019-08\",\n        \"2019-09\",\n        \"2019-10\",\n        \"2019-11\",\n        \"2019-12\",\n        \"2020-01\",\n        \"2020-02\",\n        \"2020-03\",\n        \"2020-04\",\n        \"2020-05\",\n        \"2020-06\",\n        \"2020-07\",\n        \"2020-08\",\n        \"2020-09\",\n        \"2020-10\",\n        \"2020-11\",\n        \"2020-12\",\n        \"2021-01\",\n        \"2021-02\",\n        \"2021-03\",\n        \"2021-04\",\n        \"2021-05\",\n        \"2021-06\",\n        \"2021-07\",\n        \"2021-08\",\n        \"2021-09\",\n        \"2021-10\",\n        \"2021-11\",\n        \"2021-12\",\n        \"2022-01\",\n        \"2022-02\",\n        \"2022-03\",\n        \"2022-04\",\n        \"2022-05\",\n        \"2022-06\",\n        \"2022-07\",\n        \"2022-08\",\n        \"2022-09\",\n        \"2022-10\",\n        \"2022-11\",\n        \"2022-12\",\n        \"2023-01\",\n        \"2023-02\",\n        \"2023-03\",\n        \"2023-04\",\n        \"2023-05\",\n        \"2023-06\",\n        \"2023-07\",\n        \"2023-08\",\n        \"2023-09\",\n        \"2023-10\",\n        \"2023-11\",\n        \"2023-12\",\n        \"2024-01\",\n        \"2024-02\",\n        \"2024-03\",\n        \"2024-04\",\n        \"2024-05\",\n        \"2024-06\",\n        \"2024-07\",\n        \"2024-08\",\n        \"2024-09\"\n      ],\n      \"axis\": {\n        \"left\": [\n          70,\n          130\n        ],\n        \"yTicks\": [\n          70,\n          80,\n          90,\n          100,\n          110,\n          120,\n          130\n        ]\n      },\n      \"digitizationError\": 0.051\n    },\n    {\n      \"id\": \"slide-16\",\n      \"page\": 16,\n      \"title\": \"全国与31城调查失业率\",\n      \"section\": \"就业与统计\",\n      \"kind\": \"line\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=16\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"全国\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2018-01\",\n              \"y\": 4.96\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2018-02\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2018-03\",\n              \"y\": 5.06\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2018-04\",\n              \"y\": 4.9\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2018-05\",\n              \"y\": 4.8\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2018-06\",\n              \"y\": 4.8\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2018-07\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2018-08\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2018-09\",\n              \"y\": 4.9\n            },\n            {\n              \"x\": 9,\n              \"label\": \"2018-10\",\n              \"y\": 4.9\n            },\n            {\n              \"x\": 10,\n              \"label\": \"2018-11\",\n              \"y\": 4.8\n            },\n            {\n              \"x\": 11,\n              \"label\": \"2018-12\",\n              \"y\": 4.9\n            },\n            {\n              \"x\": 12,\n              \"label\": \"2019-01\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 13,\n              \"label\": \"2019-02\",\n              \"y\": 5.3\n            },\n            {\n              \"x\": 14,\n              \"label\": \"2019-03\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 15,\n              \"label\": \"2019-04\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 16,\n              \"label\": \"2019-05\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 17,\n              \"label\": \"2019-06\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 18,\n              \"label\": \"2019-07\",\n              \"y\": 5.3\n            },\n            {\n              \"x\": 19,\n              \"label\": \"2019-08\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 20,\n              \"label\": \"2019-09\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 21,\n              \"label\": \"2019-10\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 22,\n              \"label\": \"2019-11\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 23,\n              \"label\": \"2019-12\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 24,\n              \"label\": \"2020-01\",\n              \"y\": 5.3\n            },\n            {\n              \"x\": 25,\n              \"label\": \"2020-02\",\n              \"y\": 6.2\n            },\n            {\n              \"x\": 26,\n              \"label\": \"2020-03\",\n              \"y\": 5.9\n            },\n            {\n              \"x\": 27,\n              \"label\": \"2020-04\",\n              \"y\": 6.0\n            },\n            {\n              \"x\": 28,\n              \"label\": \"2020-05\",\n              \"y\": 5.9\n            },\n            {\n              \"x\": 29,\n              \"label\": \"2020-06\",\n              \"y\": 5.7\n            },\n            {\n              \"x\": 30,\n              \"label\": \"2020-07\",\n              \"y\": 5.7\n            },\n            {\n              \"x\": 31,\n              \"label\": \"2020-08\",\n              \"y\": 5.6\n            },\n            {\n              \"x\": 32,\n              \"label\": \"2020-09\",\n              \"y\": 5.4\n            },\n            {\n              \"x\": 33,\n              \"label\": \"2020-10\",\n              \"y\": 5.3\n            },\n            {\n              \"x\": 34,\n              \"label\": \"2020-11\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 35,\n              \"label\": \"2020-12\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 36,\n              \"label\": \"2021-01\",\n              \"y\": 5.4\n            },\n            {\n              \"x\": 37,\n              \"label\": \"2021-02\",\n              \"y\": 5.5\n            },\n            {\n              \"x\": 38,\n              \"label\": \"2021-03\",\n              \"y\": 5.3\n            },\n            {\n              \"x\": 39,\n              \"label\": \"2021-04\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 40,\n              \"label\": \"2021-05\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 41,\n              \"label\": \"2021-06\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 42,\n              \"label\": \"2021-07\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 43,\n              \"label\": \"2021-08\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 44,\n              \"label\": \"2021-09\",\n              \"y\": 4.9\n            },\n            {\n              \"x\": 45,\n              \"label\": \"2021-10\",\n              \"y\": 4.9\n            },\n            {\n              \"x\": 46,\n              \"label\": \"2021-11\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 47,\n              \"label\": \"2021-12\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 48,\n              \"label\": \"2022-01\",\n              \"y\": 5.3\n            },\n            {\n              \"x\": 49,\n              \"label\": \"2022-02\",\n              \"y\": 5.5\n            },\n            {\n              \"x\": 50,\n              \"label\": \"2022-03\",\n              \"y\": 5.8\n            },\n            {\n              \"x\": 51,\n              \"label\": \"2022-04\",\n              \"y\": 6.1\n            },\n            {\n              \"x\": 52,\n              \"label\": \"2022-05\",\n              \"y\": 5.9\n            },\n            {\n              \"x\": 53,\n              \"label\": \"2022-06\",\n              \"y\": 5.5\n            },\n            {\n              \"x\": 54,\n              \"label\": \"2022-07\",\n              \"y\": 5.4\n            },\n            {\n              \"x\": 55,\n              \"label\": \"2022-08\",\n              \"y\": 5.3\n            },\n            {\n              \"x\": 56,\n              \"label\": \"2022-09\",\n              \"y\": 5.5\n            },\n            {\n              \"x\": 57,\n              \"label\": \"2022-10\",\n              \"y\": 5.5\n            },\n            {\n              \"x\": 58,\n              \"label\": \"2022-11\",\n              \"y\": 5.7\n            },\n            {\n              \"x\": 59,\n              \"label\": \"2022-12\",\n              \"y\": 5.5\n            },\n            {\n              \"x\": 60,\n              \"label\": \"2023-01\",\n              \"y\": 5.5\n            },\n            {\n              \"x\": 61,\n              \"label\": \"2023-02\",\n              \"y\": 5.6\n            },\n            {\n              \"x\": 62,\n              \"label\": \"2023-03\",\n              \"y\": 5.3\n            },\n            {\n              \"x\": 63,\n              \"label\": \"2023-04\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 64,\n              \"label\": \"2023-05\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 65,\n              \"label\": \"2023-06\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 66,\n              \"label\": \"2023-07\",\n              \"y\": 5.3\n            },\n            {\n              \"x\": 67,\n              \"label\": \"2023-08\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 68,\n              \"label\": \"2023-09\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 69,\n              \"label\": \"2023-10\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 70,\n              \"label\": \"2023-11\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 71,\n              \"label\": \"2023-12\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 72,\n              \"label\": \"2024-01\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 73,\n              \"label\": \"2024-02\",\n              \"y\": 5.3\n            },\n            {\n              \"x\": 74,\n              \"label\": \"2024-03\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 75,\n              \"label\": \"2024-04\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 76,\n              \"label\": \"2024-05\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 77,\n              \"label\": \"2024-06\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 78,\n              \"label\": \"2024-07\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 79,\n              \"label\": \"2024-08\",\n              \"y\": 5.3\n            },\n            {\n              \"x\": 80,\n              \"label\": \"2024-09\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 81,\n              \"label\": \"2024-10\",\n              \"y\": 5.0\n            }\n          ]\n        },\n        {\n          \"name\": \"31个大城市\",\n          \"color\": \"#0070c0\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2018-01\",\n              \"y\": 4.87\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2018-02\",\n              \"y\": 4.84\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2018-03\",\n              \"y\": 4.88\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2018-04\",\n              \"y\": 4.7\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2018-05\",\n              \"y\": 4.7\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2018-06\",\n              \"y\": 4.7\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2018-07\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2018-08\",\n              \"y\": 4.9\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2018-09\",\n              \"y\": 4.7\n            },\n            {\n              \"x\": 9,\n              \"label\": \"2018-10\",\n              \"y\": 4.7\n            },\n            {\n              \"x\": 10,\n              \"label\": \"2018-11\",\n              \"y\": 4.65\n            },\n            {\n              \"x\": 11,\n              \"label\": \"2018-12\",\n              \"y\": 4.7\n            },\n            {\n              \"x\": 12,\n              \"label\": \"2019-01\",\n              \"y\": 4.8\n            },\n            {\n              \"x\": 13,\n              \"label\": \"2019-02\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 14,\n              \"label\": \"2019-03\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 15,\n              \"label\": \"2019-04\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 16,\n              \"label\": \"2019-05\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 17,\n              \"label\": \"2019-06\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 18,\n              \"label\": \"2019-07\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 19,\n              \"label\": \"2019-08\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 20,\n              \"label\": \"2019-09\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 21,\n              \"label\": \"2019-10\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 22,\n              \"label\": \"2019-11\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 23,\n              \"label\": \"2019-12\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 24,\n              \"label\": \"2020-01\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 25,\n              \"label\": \"2020-02\",\n              \"y\": 5.7\n            },\n            {\n              \"x\": 26,\n              \"label\": \"2020-03\",\n              \"y\": 5.7\n            },\n            {\n              \"x\": 27,\n              \"label\": \"2020-04\",\n              \"y\": 5.8\n            },\n            {\n              \"x\": 28,\n              \"label\": \"2020-05\",\n              \"y\": 5.9\n            },\n            {\n              \"x\": 29,\n              \"label\": \"2020-06\",\n              \"y\": 5.8\n            },\n            {\n              \"x\": 30,\n              \"label\": \"2020-07\",\n              \"y\": 5.8\n            },\n            {\n              \"x\": 31,\n              \"label\": \"2020-08\",\n              \"y\": 5.7\n            },\n            {\n              \"x\": 32,\n              \"label\": \"2020-09\",\n              \"y\": 5.5\n            },\n            {\n              \"x\": 33,\n              \"label\": \"2020-10\",\n              \"y\": 5.3\n            },\n            {\n              \"x\": 34,\n              \"label\": \"2020-11\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 35,\n              \"label\": \"2020-12\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 36,\n              \"label\": \"2021-01\",\n              \"y\": 5.4\n            },\n            {\n              \"x\": 37,\n              \"label\": \"2021-02\",\n              \"y\": 5.5\n            },\n            {\n              \"x\": 38,\n              \"label\": \"2021-03\",\n              \"y\": 5.3\n            },\n            {\n              \"x\": 39,\n              \"label\": \"2021-04\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 40,\n              \"label\": \"2021-05\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 41,\n              \"label\": \"2021-06\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 42,\n              \"label\": \"2021-07\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 43,\n              \"label\": \"2021-08\",\n              \"y\": 5.3\n            },\n            {\n              \"x\": 44,\n              \"label\": \"2021-09\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 45,\n              \"label\": \"2021-10\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 46,\n              \"label\": \"2021-11\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 47,\n              \"label\": \"2021-12\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 48,\n              \"label\": \"2022-01\",\n              \"y\": 5.4\n            },\n            {\n              \"x\": 49,\n              \"label\": \"2022-02\",\n              \"y\": 5.4\n            },\n            {\n              \"x\": 50,\n              \"label\": \"2022-03\",\n              \"y\": 6.0\n            },\n            {\n              \"x\": 51,\n              \"label\": \"2022-04\",\n              \"y\": 6.7\n            },\n            {\n              \"x\": 52,\n              \"label\": \"2022-05\",\n              \"y\": 6.9\n            },\n            {\n              \"x\": 53,\n              \"label\": \"2022-06\",\n              \"y\": 5.8\n            },\n            {\n              \"x\": 54,\n              \"label\": \"2022-07\",\n              \"y\": 5.6\n            },\n            {\n              \"x\": 55,\n              \"label\": \"2022-08\",\n              \"y\": 5.4\n            },\n            {\n              \"x\": 56,\n              \"label\": \"2022-09\",\n              \"y\": 5.8\n            },\n            {\n              \"x\": 57,\n              \"label\": \"2022-10\",\n              \"y\": 6.0\n            },\n            {\n              \"x\": 58,\n              \"label\": \"2022-11\",\n              \"y\": 6.7\n            },\n            {\n              \"x\": 59,\n              \"label\": \"2022-12\",\n              \"y\": 6.1\n            },\n            {\n              \"x\": 60,\n              \"label\": \"2023-01\",\n              \"y\": 5.8\n            },\n            {\n              \"x\": 61,\n              \"label\": \"2023-02\",\n              \"y\": 5.7\n            },\n            {\n              \"x\": 62,\n              \"label\": \"2023-03\",\n              \"y\": 5.5\n            },\n            {\n              \"x\": 63,\n              \"label\": \"2023-04\",\n              \"y\": 5.5\n            },\n            {\n              \"x\": 64,\n              \"label\": \"2023-05\",\n              \"y\": 5.5\n            },\n            {\n              \"x\": 65,\n              \"label\": \"2023-06\",\n              \"y\": 5.5\n            },\n            {\n              \"x\": 66,\n              \"label\": \"2023-07\",\n              \"y\": 5.4\n            },\n            {\n              \"x\": 67,\n              \"label\": \"2023-08\",\n              \"y\": 5.3\n            },\n            {\n              \"x\": 68,\n              \"label\": \"2023-09\",\n              \"y\": 5.2\n            },\n            {\n              \"x\": 69,\n              \"label\": \"2023-10\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 70,\n              \"label\": \"2023-11\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 71,\n              \"label\": \"2023-12\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 72,\n              \"label\": \"2024-01\",\n              \"y\": 4.9\n            },\n            {\n              \"x\": 73,\n              \"label\": \"2024-02\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 74,\n              \"label\": \"2024-03\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 75,\n              \"label\": \"2024-04\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 76,\n              \"label\": \"2024-05\",\n              \"y\": 4.9\n            },\n            {\n              \"x\": 77,\n              \"label\": \"2024-06\",\n              \"y\": 4.9\n            },\n            {\n              \"x\": 78,\n              \"label\": \"2024-07\",\n              \"y\": 5.3\n            },\n            {\n              \"x\": 79,\n              \"label\": \"2024-08\",\n              \"y\": 5.4\n            },\n            {\n              \"x\": 80,\n              \"label\": \"2024-09\",\n              \"y\": 5.1\n            },\n            {\n              \"x\": 81,\n              \"label\": \"2024-10\",\n              \"y\": 5.0\n            }\n          ]\n        }\n      ],\n      \"method\": \"保留两条月度调查失业率。原轴以半个百分点设刻度，但文字标签重复舍入为整数。\",\n      \"limits\": [\n        \"图形实际按4—8的连续坐标恢复，不按重复整数刻度错误映射；离开劳动力市场与城乡迁移不等于被该比率完整覆盖。\"\n      ],\n      \"labels\": [\n        \"2018-01\",\n        \"2018-02\",\n        \"2018-03\",\n        \"2018-04\",\n        \"2018-05\",\n        \"2018-06\",\n        \"2018-07\",\n        \"2018-08\",\n        \"2018-09\",\n        \"2018-10\",\n        \"2018-11\",\n        \"2018-12\",\n        \"2019-01\",\n        \"2019-02\",\n        \"2019-03\",\n        \"2019-04\",\n        \"2019-05\",\n        \"2019-06\",\n        \"2019-07\",\n        \"2019-08\",\n        \"2019-09\",\n        \"2019-10\",\n        \"2019-11\",\n        \"2019-12\",\n        \"2020-01\",\n        \"2020-02\",\n        \"2020-03\",\n        \"2020-04\",\n        \"2020-05\",\n        \"2020-06\",\n        \"2020-07\",\n        \"2020-08\",\n        \"2020-09\",\n        \"2020-10\",\n        \"2020-11\",\n        \"2020-12\",\n        \"2021-01\",\n        \"2021-02\",\n        \"2021-03\",\n        \"2021-04\",\n        \"2021-05\",\n        \"2021-06\",\n        \"2021-07\",\n        \"2021-08\",\n        \"2021-09\",\n        \"2021-10\",\n        \"2021-11\",\n        \"2021-12\",\n        \"2022-01\",\n        \"2022-02\",\n        \"2022-03\",\n        \"2022-04\",\n        \"2022-05\",\n        \"2022-06\",\n        \"2022-07\",\n        \"2022-08\",\n        \"2022-09\",\n        \"2022-10\",\n        \"2022-11\",\n        \"2022-12\",\n        \"2023-01\",\n        \"2023-02\",\n        \"2023-03\",\n        \"2023-04\",\n        \"2023-05\",\n        \"2023-06\",\n        \"2023-07\",\n        \"2023-08\",\n        \"2023-09\",\n        \"2023-10\",\n        \"2023-11\",\n        \"2023-12\",\n        \"2024-01\",\n        \"2024-02\",\n        \"2024-03\",\n        \"2024-04\",\n        \"2024-05\",\n        \"2024-06\",\n        \"2024-07\",\n        \"2024-08\",\n        \"2024-09\",\n        \"2024-10\"\n      ],\n      \"axis\": {\n        \"left\": [\n          4,\n          8\n        ],\n        \"yTicks\": [\n          4.0,\n          4.5,\n          5.0,\n          5.5,\n          6.0,\n          6.5,\n          7.0,\n          7.5,\n          8.0\n        ]\n      },\n      \"digitizationError\": 0.003\n    },\n    {\n      \"id\": \"slide-17\",\n      \"page\": 17,\n      \"title\": \"非私营单位制造业与服务业工资增速\",\n      \"section\": \"就业与统计\",\n      \"kind\": \"line\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=17\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"制造业\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2004\",\n              \"y\": 12.47\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2005\",\n              \"y\": 11.81\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2006\",\n              \"y\": 14.38\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2007\",\n              \"y\": 16.01\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2008\",\n              \"y\": 15.42\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2009\",\n              \"y\": 9.86\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2010\",\n              \"y\": 15.32\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2011\",\n              \"y\": 18.6\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2012\",\n              \"y\": 13.59\n            },\n            {\n              \"x\": 9,\n              \"label\": \"2013\",\n              \"y\": 11.48\n            },\n            {\n              \"x\": 10,\n              \"label\": \"2014\",\n              \"y\": 10.63\n            },\n            {\n              \"x\": 11,\n              \"label\": \"2015\",\n              \"y\": 7.7\n            },\n            {\n              \"x\": 12,\n              \"label\": \"2016\",\n              \"y\": 7.5\n            },\n            {\n              \"x\": 13,\n              \"label\": \"2017\",\n              \"y\": 8.37\n            },\n            {\n              \"x\": 14,\n              \"label\": \"2018\",\n              \"y\": 11.85\n            },\n            {\n              \"x\": 15,\n              \"label\": \"2019\",\n              \"y\": 8.41\n            },\n            {\n              \"x\": 16,\n              \"label\": \"2020\",\n              \"y\": 5.94\n            },\n            {\n              \"x\": 17,\n              \"label\": \"2021\",\n              \"y\": 11.68\n            },\n            {\n              \"x\": 18,\n              \"label\": \"2022\",\n              \"y\": 5.48\n            },\n            {\n              \"x\": 19,\n              \"label\": \"2023\",\n              \"y\": 6.56\n            }\n          ]\n        },\n        {\n          \"name\": \"服务业\",\n          \"color\": \"#0070c0\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2004\",\n              \"y\": 12.78\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2005\",\n              \"y\": 14.5\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2006\",\n              \"y\": 14.15\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2007\",\n              \"y\": 17.52\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2008\",\n              \"y\": 16.52\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2009\",\n              \"y\": 9.94\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2010\",\n              \"y\": 12.29\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2011\",\n              \"y\": 14.96\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2012\",\n              \"y\": 11.34\n            },\n            {\n              \"x\": 9,\n              \"label\": \"2013\",\n              \"y\": 10.61\n            },\n            {\n              \"x\": 10,\n              \"label\": \"2014\",\n              \"y\": 8.92\n            },\n            {\n              \"x\": 11,\n              \"label\": \"2015\",\n              \"y\": 10.3\n            },\n            {\n              \"x\": 12,\n              \"label\": \"2016\",\n              \"y\": 8.26\n            },\n            {\n              \"x\": 13,\n              \"label\": \"2017\",\n              \"y\": 8.87\n            },\n            {\n              \"x\": 14,\n              \"label\": \"2018\",\n              \"y\": 9.69\n            },\n            {\n              \"x\": 15,\n              \"label\": \"2019\",\n              \"y\": 7.37\n            },\n            {\n              \"x\": 16,\n              \"label\": \"2020\",\n              \"y\": 5.56\n            },\n            {\n              \"x\": 17,\n              \"label\": \"2021\",\n              \"y\": 9.07\n            },\n            {\n              \"x\": 18,\n              \"label\": \"2022\",\n              \"y\": 6.43\n            },\n            {\n              \"x\": 19,\n              \"label\": \"2023\",\n              \"y\": 5.36\n            }\n          ]\n        }\n      ],\n      \"method\": \"原图使用非私营单位口径。\",\n      \"limits\": [\n        \"非私营不等于全部体制内或全部劳动者；不能用在岗工资均值描述离岗者收入。服务业聚合权重未披露。\"\n      ],\n      \"labels\": [\n        \"2004\",\n        \"2005\",\n        \"2006\",\n        \"2007\",\n        \"2008\",\n        \"2009\",\n        \"2010\",\n        \"2011\",\n        \"2012\",\n        \"2013\",\n        \"2014\",\n        \"2015\",\n        \"2016\",\n        \"2017\",\n        \"2018\",\n        \"2019\",\n        \"2020\",\n        \"2021\",\n        \"2022\",\n        \"2023\"\n      ],\n      \"axis\": {\n        \"left\": [\n          0,\n          20\n        ],\n        \"yTicks\": [\n          0,\n          2,\n          4,\n          6,\n          8,\n          10,\n          12,\n          14,\n          16,\n          18,\n          20\n        ]\n      },\n      \"digitizationError\": 0.017\n    },\n    {\n      \"id\": \"slide-18\",\n      \"page\": 18,\n      \"title\": \"城镇就业增速与原图趋势\",\n      \"section\": \"就业与统计\",\n      \"kind\": \"line\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=18\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"城镇就业增速\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2011\",\n              \"y\": 3.79\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2012\",\n              \"y\": 3.57\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2013\",\n              \"y\": 3.33\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2014\",\n              \"y\": 3.06\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2015\",\n              \"y\": 3.06\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2016\",\n              \"y\": 2.77\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2017\",\n              \"y\": 2.75\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2018\",\n              \"y\": 2.51\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2019\",\n              \"y\": 2.16\n            },\n            {\n              \"x\": 9,\n              \"label\": \"2020\",\n              \"y\": 2.26\n            },\n            {\n              \"x\": 10,\n              \"label\": \"2021\",\n              \"y\": 1.09\n            },\n            {\n              \"x\": 11,\n              \"label\": \"2022\",\n              \"y\": -1.8\n            },\n            {\n              \"x\": 12,\n              \"label\": \"2023\",\n              \"y\": 0.3\n            }\n          ]\n        },\n        {\n          \"name\": \"城镇就业增速 · 原图趋势线\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"dashed\": true,\n          \"points\": [\n            {\n              \"x\": 9.038,\n              \"y\": 2.25,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 9.1818,\n              \"y\": 2.23,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 9.3255,\n              \"y\": 2.21,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 9.4693,\n              \"y\": 2.18,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 9.6131,\n              \"y\": 2.16,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 9.7569,\n              \"y\": 2.13,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 9.9006,\n              \"y\": 2.11,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.0444,\n              \"y\": 2.09,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.1881,\n              \"y\": 2.06,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.3318,\n              \"y\": 2.04,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.4755,\n              \"y\": 2.01,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.6193,\n              \"y\": 1.99,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.763,\n              \"y\": 1.96,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.9067,\n              \"y\": 1.94,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.0504,\n              \"y\": 1.91,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.1942,\n              \"y\": 1.89,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.338,\n              \"y\": 1.87,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.4817,\n              \"y\": 1.84,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.6255,\n              \"y\": 1.82,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.7692,\n              \"y\": 1.8,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.913,\n              \"y\": 1.77,\n              \"label\": \"原图趋势片段\"\n            }\n          ]\n        }\n      ],\n      \"method\": \"2023年使用两年复合增速；虚线恢复自原图，不宣称已复现其趋势模型。\",\n      \"limits\": [\n        \"统计定义与人口基准修订可能改变历史就业数。\"\n      ],\n      \"labels\": [\n        \"2011\",\n        \"2012\",\n        \"2013\",\n        \"2014\",\n        \"2015\",\n        \"2016\",\n        \"2017\",\n        \"2018\",\n        \"2019\",\n        \"2020\",\n        \"2021\",\n        \"2022\",\n        \"2023\"\n      ],\n      \"axis\": {\n        \"left\": [\n          -3,\n          5\n        ],\n        \"yTicks\": [\n          -3,\n          -2,\n          -1,\n          0,\n          1,\n          2,\n          3,\n          4,\n          5\n        ]\n      },\n      \"digitizationError\": 0.007\n    },\n    {\n      \"id\": \"slide-19\",\n      \"page\": 19,\n      \"title\": \"城镇就业人数与原图趋势\",\n      \"section\": \"就业与统计\",\n      \"kind\": \"line\",\n      \"unit\": \"万人\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=19\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"城镇就业人数\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2011\",\n              \"y\": 36002.98\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2012\",\n              \"y\": 37289.63\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2013\",\n              \"y\": 38527.15\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2014\",\n              \"y\": 39698.85\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2015\",\n              \"y\": 40910.04\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2016\",\n              \"y\": 42055.4\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2017\",\n              \"y\": 43213.93\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2018\",\n              \"y\": 44293.47\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2019\",\n              \"y\": 45254.52\n            },\n            {\n              \"x\": 9,\n              \"label\": \"2020\",\n              \"y\": 46268.24\n            },\n            {\n              \"x\": 10,\n              \"label\": \"2021\",\n              \"y\": 46768.51\n            },\n            {\n              \"x\": 11,\n              \"label\": \"2022\",\n              \"y\": 45925.94\n            },\n            {\n              \"x\": 12,\n              \"label\": \"2023\",\n              \"y\": 47032.01\n            }\n          ]\n        },\n        {\n          \"name\": \"城镇就业人数 · 原图趋势线\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"dashed\": true,\n          \"points\": [\n            {\n              \"x\": 9.0368,\n              \"y\": 46304.74,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 9.1757,\n              \"y\": 46439.68,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 9.3147,\n              \"y\": 46574.61,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 9.4536,\n              \"y\": 46709.54,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 9.5925,\n              \"y\": 46844.47,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 9.7315,\n              \"y\": 46979.4,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 9.8704,\n              \"y\": 47114.34,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.0095,\n              \"y\": 47248.45,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.1488,\n              \"y\": 47377.77,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.2883,\n              \"y\": 47506.58,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.4277,\n              \"y\": 47635.38,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.5671,\n              \"y\": 47764.19,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.7066,\n              \"y\": 47893.0,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.846,\n              \"y\": 48021.81,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.9855,\n              \"y\": 48150.21,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.1254,\n              \"y\": 48273.01,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.2653,\n              \"y\": 48394.67,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.4053,\n              \"y\": 48516.32,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.5453,\n              \"y\": 48637.98,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.6853,\n              \"y\": 48759.63,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.8253,\n              \"y\": 48881.28,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.9651,\n              \"y\": 49002.83,\n              \"label\": \"原图趋势片段\"\n            }\n          ]\n        }\n      ],\n      \"method\": \"原图给出的2021—2023年缺口为472、2236、2001万人，合计4709。\",\n      \"limits\": [\n        \"三个年度存量缺口的相加不等于4709万个去重的失业者；须区分存量、人年与跨年重复。\"\n      ],\n      \"labels\": [\n        \"2011\",\n        \"2012\",\n        \"2013\",\n        \"2014\",\n        \"2015\",\n        \"2016\",\n        \"2017\",\n        \"2018\",\n        \"2019\",\n        \"2020\",\n        \"2021\",\n        \"2022\",\n        \"2023\"\n      ],\n      \"axis\": {\n        \"left\": [\n          34000,\n          50000\n        ],\n        \"yTicks\": [\n          34000,\n          36000,\n          38000,\n          40000,\n          42000,\n          44000,\n          46000,\n          48000,\n          50000\n        ]\n      },\n      \"digitizationError\": 13.714\n    },\n    {\n      \"id\": \"slide-20\",\n      \"page\": 20,\n      \"title\": \"第三产业增加值占比与趋势\",\n      \"section\": \"就业与统计\",\n      \"kind\": \"line\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=20\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"第三产业占比（4Q TTM）\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2011-Q1\",\n              \"y\": 44.51\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2011-Q2\",\n              \"y\": 44.51\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2011-Q3\",\n              \"y\": 44.47\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2011-Q4\",\n              \"y\": 44.59\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2012-Q1\",\n              \"y\": 44.69\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2012-Q2\",\n              \"y\": 45.0\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2012-Q3\",\n              \"y\": 45.4\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2012-Q4\",\n              \"y\": 45.69\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2013-Q1\",\n              \"y\": 46.1\n            },\n            {\n              \"x\": 9,\n              \"label\": \"2013-Q2\",\n              \"y\": 46.53\n            },\n            {\n              \"x\": 10,\n              \"label\": \"2013-Q3\",\n              \"y\": 46.88\n            },\n            {\n              \"x\": 11,\n              \"label\": \"2013-Q4\",\n              \"y\": 47.14\n            },\n            {\n              \"x\": 12,\n              \"label\": \"2014-Q1\",\n              \"y\": 47.49\n            },\n            {\n              \"x\": 13,\n              \"label\": \"2014-Q2\",\n              \"y\": 47.77\n            },\n            {\n              \"x\": 14,\n              \"label\": \"2014-Q3\",\n              \"y\": 48.08\n            },\n            {\n              \"x\": 15,\n              \"label\": \"2014-Q4\",\n              \"y\": 48.51\n            },\n            {\n              \"x\": 16,\n              \"label\": \"2015-Q1\",\n              \"y\": 49.05\n            },\n            {\n              \"x\": 17,\n              \"label\": \"2015-Q2\",\n              \"y\": 49.64\n            },\n            {\n              \"x\": 18,\n              \"label\": \"2015-Q3\",\n              \"y\": 50.35\n            },\n            {\n              \"x\": 19,\n              \"label\": \"2015-Q4\",\n              \"y\": 50.99\n            },\n            {\n              \"x\": 20,\n              \"label\": \"2016-Q1\",\n              \"y\": 51.53\n            },\n            {\n              \"x\": 21,\n              \"label\": \"2016-Q2\",\n              \"y\": 51.96\n            },\n            {\n              \"x\": 22,\n              \"label\": \"2016-Q3\",\n              \"y\": 52.36\n            },\n            {\n              \"x\": 23,\n              \"label\": \"2016-Q4\",\n              \"y\": 52.64\n            },\n            {\n              \"x\": 24,\n              \"label\": \"2017-Q1\",\n              \"y\": 52.65\n            },\n            {\n              \"x\": 25,\n              \"label\": \"2017-Q2\",\n              \"y\": 52.75\n            },\n            {\n              \"x\": 26,\n              \"label\": \"2017-Q3\",\n              \"y\": 52.83\n            },\n            {\n              \"x\": 27,\n              \"label\": \"2017-Q4\",\n              \"y\": 52.93\n            },\n            {\n              \"x\": 28,\n              \"label\": \"2018-Q1\",\n              \"y\": 53.05\n            },\n            {\n              \"x\": 29,\n              \"label\": \"2018-Q2\",\n              \"y\": 53.2\n            },\n            {\n              \"x\": 30,\n              \"label\": \"2018-Q3\",\n              \"y\": 53.39\n            },\n            {\n              \"x\": 31,\n              \"label\": \"2018-Q4\",\n              \"y\": 53.51\n            },\n            {\n              \"x\": 32,\n              \"label\": \"2019-Q1\",\n              \"y\": 53.76\n            },\n            {\n              \"x\": 33,\n              \"label\": \"2019-Q2\",\n              \"y\": 53.95\n            },\n            {\n              \"x\": 34,\n              \"label\": \"2019-Q3\",\n              \"y\": 54.25\n            },\n            {\n              \"x\": 35,\n              \"label\": \"2019-Q4\",\n              \"y\": 54.5\n            },\n            {\n              \"x\": 36,\n              \"label\": \"2020-Q1\",\n              \"y\": 54.73\n            },\n            {\n              \"x\": 37,\n              \"label\": \"2020-Q2\",\n              \"y\": 54.73\n            },\n            {\n              \"x\": 38,\n              \"label\": \"2020-Q3\",\n              \"y\": 54.76\n            },\n            {\n              \"x\": 39,\n              \"label\": \"2020-Q4\",\n              \"y\": 54.84\n            },\n            {\n              \"x\": 40,\n              \"label\": \"2021-Q1\",\n              \"y\": 54.48\n            },\n            {\n              \"x\": 41,\n              \"label\": \"2021-Q2\",\n              \"y\": 54.27\n            },\n            {\n              \"x\": 42,\n              \"label\": \"2021-Q3\",\n              \"y\": 54.07\n            },\n            {\n              \"x\": 43,\n              \"label\": \"2021-Q4\",\n              \"y\": 53.74\n            },\n            {\n              \"x\": 44,\n              \"label\": \"2022-Q1\",\n              \"y\": 53.51\n            },\n            {\n              \"x\": 45,\n              \"label\": \"2022-Q2\",\n              \"y\": 53.31\n            },\n            {\n              \"x\": 46,\n              \"label\": \"2022-Q3\",\n              \"y\": 53.28\n            },\n            {\n              \"x\": 47,\n              \"label\": \"2022-Q4\",\n              \"y\": 53.51\n            },\n            {\n              \"x\": 48,\n              \"label\": \"2023-Q1\",\n              \"y\": 53.82\n            },\n            {\n              \"x\": 49,\n              \"label\": \"2023-Q2\",\n              \"y\": 54.27\n            },\n            {\n              \"x\": 50,\n              \"label\": \"2023-Q3\",\n              \"y\": 54.55\n            },\n            {\n              \"x\": 51,\n              \"label\": \"2023-Q4\",\n              \"y\": 54.76\n            },\n            {\n              \"x\": 52,\n              \"label\": \"2024-Q1\",\n              \"y\": 54.87\n            },\n            {\n              \"x\": 53,\n              \"label\": \"2024-Q2\",\n              \"y\": 54.87\n            },\n            {\n              \"x\": 54,\n              \"label\": \"2024-Q3\",\n              \"y\": 54.97\n            }\n          ]\n        },\n        {\n          \"name\": \"原图趋势线\",\n          \"color\": \"#ff0000\",\n          \"dashed\": true,\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0.7,\n              \"y\": 44.9,\n              \"label\": \"趋势线\"\n            },\n            {\n              \"x\": 54.214,\n              \"y\": 59.47,\n              \"label\": \"趋势线\"\n            }\n          ]\n        }\n      ],\n      \"method\": \"滚动四季度第三产业增加值 / GDP；不以单季占比替代。\",\n      \"limits\": [\n        \"原图趋势线窗口和估计方法未披露，当前仅从其几何线恢复。\"\n      ],\n      \"labels\": [\n        \"2011-Q1\",\n        \"2011-Q2\",\n        \"2011-Q3\",\n        \"2011-Q4\",\n        \"2012-Q1\",\n        \"2012-Q2\",\n        \"2012-Q3\",\n        \"2012-Q4\",\n        \"2013-Q1\",\n        \"2013-Q2\",\n        \"2013-Q3\",\n        \"2013-Q4\",\n        \"2014-Q1\",\n        \"2014-Q2\",\n        \"2014-Q3\",\n        \"2014-Q4\",\n        \"2015-Q1\",\n        \"2015-Q2\",\n        \"2015-Q3\",\n        \"2015-Q4\",\n        \"2016-Q1\",\n        \"2016-Q2\",\n        \"2016-Q3\",\n        \"2016-Q4\",\n        \"2017-Q1\",\n        \"2017-Q2\",\n        \"2017-Q3\",\n        \"2017-Q4\",\n        \"2018-Q1\",\n        \"2018-Q2\",\n        \"2018-Q3\",\n        \"2018-Q4\",\n        \"2019-Q1\",\n        \"2019-Q2\",\n        \"2019-Q3\",\n        \"2019-Q4\",\n        \"2020-Q1\",\n        \"2020-Q2\",\n        \"2020-Q3\",\n        \"2020-Q4\",\n        \"2021-Q1\",\n        \"2021-Q2\",\n        \"2021-Q3\",\n        \"2021-Q4\",\n        \"2022-Q1\",\n        \"2022-Q2\",\n        \"2022-Q3\",\n        \"2022-Q4\",\n        \"2023-Q1\",\n        \"2023-Q2\",\n        \"2023-Q3\",\n        \"2023-Q4\",\n        \"2024-Q1\",\n        \"2024-Q2\",\n        \"2024-Q3\"\n      ],\n      \"axis\": {\n        \"left\": [\n          40,\n          60\n        ],\n        \"yTicks\": [\n          40,\n          42,\n          44,\n          46,\n          48,\n          50,\n          52,\n          54,\n          56,\n          58,\n          60\n        ]\n      },\n      \"digitizationError\": 0.017\n    },\n    {\n      \"id\": \"slide-21\",\n      \"page\": 21,\n      \"title\": \"城乡就业人数与原图趋势\",\n      \"section\": \"就业与统计\",\n      \"kind\": \"line\",\n      \"unit\": \"万人\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=21\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"乡村就业人数\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2010\",\n              \"y\": 41418.01\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2011\",\n              \"y\": 40184.28\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2012\",\n              \"y\": 38974.74\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2013\",\n              \"y\": 37765.19\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2014\",\n              \"y\": 36642.04\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2015\",\n              \"y\": 35403.7\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2016\",\n              \"y\": 34194.15\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2017\",\n              \"y\": 32840.62\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2018\",\n              \"y\": 31487.08\n            },\n            {\n              \"x\": 9,\n              \"label\": \"2019\",\n              \"y\": 30191.14\n            },\n            {\n              \"x\": 10,\n              \"label\": \"2020\",\n              \"y\": 28780.0\n            },\n            {\n              \"x\": 11,\n              \"label\": \"2021\",\n              \"y\": 27887.24\n            },\n            {\n              \"x\": 12,\n              \"label\": \"2022\",\n              \"y\": 27426.46\n            },\n            {\n              \"x\": 13,\n              \"label\": \"2023\",\n              \"y\": 27008.97\n            }\n          ]\n        },\n        {\n          \"name\": \"城镇就业人数\",\n          \"color\": \"#0070c0\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2010\",\n              \"y\": 34686.99\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2011\",\n              \"y\": 36008.47\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2012\",\n              \"y\": 37275.61\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2013\",\n              \"y\": 38513.96\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2014\",\n              \"y\": 39694.7\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2015\",\n              \"y\": 40904.25\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2016\",\n              \"y\": 42056.2\n            },\n            {\n              \"x\": 7,\n              \"label\": \"2017\",\n              \"y\": 43208.14\n            },\n            {\n              \"x\": 8,\n              \"label\": \"2018\",\n              \"y\": 44302.49\n            },\n            {\n              \"x\": 9,\n              \"label\": \"2019\",\n              \"y\": 45252.85\n            },\n            {\n              \"x\": 10,\n              \"label\": \"2020\",\n              \"y\": 46260.8\n            },\n            {\n              \"x\": 11,\n              \"label\": \"2021\",\n              \"y\": 46779.18\n            },\n            {\n              \"x\": 12,\n              \"label\": \"2022\",\n              \"y\": 45944.02\n            },\n            {\n              \"x\": 13,\n              \"label\": \"2023\",\n              \"y\": 47032.03\n            }\n          ]\n        },\n        {\n          \"name\": \"乡村就业人数 · 原图趋势线\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"dashed\": true,\n          \"points\": [\n            {\n              \"x\": 10.0402,\n              \"y\": 28739.51,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.1936,\n              \"y\": 28525.68,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.347,\n              \"y\": 28311.85,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.5004,\n              \"y\": 28098.02,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.6537,\n              \"y\": 27884.19,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.8071,\n              \"y\": 27670.36,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.9605,\n              \"y\": 27456.53,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.114,\n              \"y\": 27246.64,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.2675,\n              \"y\": 27038.25,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.421,\n              \"y\": 26829.87,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.5746,\n              \"y\": 26621.49,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.7281,\n              \"y\": 26413.11,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.8816,\n              \"y\": 26204.72,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 12.0352,\n              \"y\": 25996.54,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 12.1887,\n              \"y\": 25789.05,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 12.3423,\n              \"y\": 25581.55,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 12.4958,\n              \"y\": 25374.06,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 12.6494,\n              \"y\": 25166.57,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 12.8029,\n              \"y\": 24959.07,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 12.9565,\n              \"y\": 24751.58,\n              \"label\": \"原图趋势片段\"\n            }\n          ]\n        },\n        {\n          \"name\": \"城镇就业人数 · 原图趋势线\",\n          \"color\": \"#0070c0\",\n          \"axis\": \"left\",\n          \"dashed\": true,\n          \"points\": [\n            {\n              \"x\": 10.0406,\n              \"y\": 46308.53,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.1956,\n              \"y\": 46458.54,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.3505,\n              \"y\": 46608.56,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.5055,\n              \"y\": 46758.59,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.6605,\n              \"y\": 46908.61,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.8154,\n              \"y\": 47058.63,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 10.9704,\n              \"y\": 47208.56,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.1254,\n              \"y\": 47353.36,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.2805,\n              \"y\": 47496.68,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.4356,\n              \"y\": 47640.0,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.5907,\n              \"y\": 47783.31,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.7458,\n              \"y\": 47926.63,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 11.9009,\n              \"y\": 48069.95,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 12.056,\n              \"y\": 48210.37,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 12.2112,\n              \"y\": 48345.67,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 12.3665,\n              \"y\": 48480.97,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 12.5217,\n              \"y\": 48616.28,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 12.677,\n              \"y\": 48751.58,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 12.8322,\n              \"y\": 48886.89,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 12.9743,\n              \"y\": 49010.75,\n              \"label\": \"原图趋势片段\"\n            }\n          ]\n        }\n      ],\n      \"method\": \"乡村相对趋势增加474、1383、2316万人。原稿列合计4174；逐项已显示数相加为4173，保留1万的舍入差。\",\n      \"limits\": [\n        \"乡村超趋势值不能直接当作已追踪到的城镇回流人数；两条趋势都不是因果识别。\"\n      ],\n      \"labels\": [\n        \"2010\",\n        \"2011\",\n        \"2012\",\n        \"2013\",\n        \"2014\",\n        \"2015\",\n        \"2016\",\n        \"2017\",\n        \"2018\",\n        \"2019\",\n        \"2020\",\n        \"2021\",\n        \"2022\",\n        \"2023\"\n      ],\n      \"axis\": {\n        \"left\": [\n          20000,\n          55000\n        ],\n        \"yTicks\": [\n          20000,\n          25000,\n          30000,\n          35000,\n          40000,\n          45000,\n          50000,\n          55000\n        ]\n      },\n      \"digitizationError\": 29.999\n    },\n    {\n      \"id\": \"slide-22\",\n      \"page\": 22,\n      \"title\": \"就业质量：参保与公积金覆盖率\",\n      \"section\": \"就业与统计\",\n      \"kind\": \"line\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=22\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"失业保险\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2017\",\n              \"y\": 43.47\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2018\",\n              \"y\": 44.35\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2019\",\n              \"y\": 45.4\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2020\",\n              \"y\": 46.87\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2021\",\n              \"y\": 49.09\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2022\",\n              \"y\": 51.83\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2023\",\n              \"y\": 51.83\n            }\n          ]\n        },\n        {\n          \"name\": \"工伤保险\",\n          \"color\": \"#0070c0\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2017\",\n              \"y\": 52.6\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2018\",\n              \"y\": 53.89\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2019\",\n              \"y\": 56.3\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2020\",\n              \"y\": 57.85\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2021\",\n              \"y\": 60.48\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2022\",\n              \"y\": 63.37\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2023\",\n              \"y\": 64.15\n            }\n          ]\n        },\n        {\n          \"name\": \"住房公积金\",\n          \"color\": \"#00b050\",\n          \"axis\": \"right\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2017\",\n              \"y\": 31.79\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2018\",\n              \"y\": 32.6\n            },\n            {\n              \"x\": 2,\n              \"label\": \"2019\",\n              \"y\": 32.89\n            },\n            {\n              \"x\": 3,\n              \"label\": \"2020\",\n              \"y\": 33.13\n            },\n            {\n              \"x\": 4,\n              \"label\": \"2021\",\n              \"y\": 35.14\n            },\n            {\n              \"x\": 5,\n              \"label\": \"2022\",\n              \"y\": 36.97\n            },\n            {\n              \"x\": 6,\n              \"label\": \"2023\",\n              \"y\": 37.11\n            }\n          ]\n        },\n        {\n          \"name\": \"失业保险 · 原图趋势线\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"dashed\": true,\n          \"points\": [\n            {\n              \"x\": 5.0182,\n              \"y\": 51.86,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.0892,\n              \"y\": 52.0,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.1602,\n              \"y\": 52.13,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.2312,\n              \"y\": 52.26,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.3022,\n              \"y\": 52.39,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.3732,\n              \"y\": 52.52,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.4442,\n              \"y\": 52.65,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.5152,\n              \"y\": 52.78,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.5862,\n              \"y\": 52.91,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.6572,\n              \"y\": 53.04,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.7282,\n              \"y\": 53.17,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.7992,\n              \"y\": 53.3,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.8702,\n              \"y\": 53.44,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.9412,\n              \"y\": 53.57,\n              \"label\": \"原图趋势片段\"\n            }\n          ]\n        },\n        {\n          \"name\": \"工伤保险 · 原图趋势线\",\n          \"color\": \"#0070c0\",\n          \"axis\": \"left\",\n          \"dashed\": true,\n          \"points\": [\n            {\n              \"x\": 5.0181,\n              \"y\": 63.42,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.0888,\n              \"y\": 63.56,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.1594,\n              \"y\": 63.71,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.2301,\n              \"y\": 63.86,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.3008,\n              \"y\": 64.01,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.3714,\n              \"y\": 64.15,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.4421,\n              \"y\": 64.3,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.5127,\n              \"y\": 64.45,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.5834,\n              \"y\": 64.6,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.654,\n              \"y\": 64.74,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.7247,\n              \"y\": 64.89,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.7954,\n              \"y\": 65.04,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.866,\n              \"y\": 65.19,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.9367,\n              \"y\": 65.33,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.9948,\n              \"y\": 65.46,\n              \"label\": \"原图趋势片段\"\n            }\n          ]\n        },\n        {\n          \"name\": \"住房公积金 · 原图趋势线\",\n          \"color\": \"#00b050\",\n          \"axis\": \"right\",\n          \"dashed\": true,\n          \"points\": [\n            {\n              \"x\": 5.0178,\n              \"y\": 36.99,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.0871,\n              \"y\": 37.07,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.1564,\n              \"y\": 37.14,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.2257,\n              \"y\": 37.22,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.2951,\n              \"y\": 37.3,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.3644,\n              \"y\": 37.38,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.4337,\n              \"y\": 37.46,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.503,\n              \"y\": 37.53,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.5723,\n              \"y\": 37.61,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.6417,\n              \"y\": 37.69,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.711,\n              \"y\": 37.77,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.7803,\n              \"y\": 37.85,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.8496,\n              \"y\": 37.92,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.9189,\n              \"y\": 38.0,\n              \"label\": \"原图趋势片段\"\n            },\n            {\n              \"x\": 5.9855,\n              \"y\": 38.08,\n              \"label\": \"原图趋势片段\"\n            }\n          ]\n        }\n      ],\n      \"method\": \"参保或实缴人数 / 城镇就业人数；住房公积金使用右轴。\",\n      \"limits\": [\n        \"不同制度的参保人数不可相加成独立劳动者；分母和覆盖人群变化会影响比率。\"\n      ],\n      \"labels\": [\n        \"2017\",\n        \"2018\",\n        \"2019\",\n        \"2020\",\n        \"2021\",\n        \"2022\",\n        \"2023\"\n      ],\n      \"axis\": {\n        \"left\": [\n          43,\n          66\n        ],\n        \"right\": [\n          31,\n          40\n        ],\n        \"yTicks\": [\n          43,\n          48,\n          53,\n          58,\n          63\n        ],\n        \"rightTicks\": [\n          31,\n          32,\n          33,\n          34,\n          35,\n          36,\n          37,\n          38,\n          39,\n          40\n        ]\n      },\n      \"digitizationError\": 0.02\n    },\n    {\n      \"id\": \"slide-24\",\n      \"page\": 24,\n      \"title\": \"产出缺口与核心CPI\",\n      \"section\": \"总量与地产\",\n      \"kind\": \"scatter\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=24\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"原图散点\",\n          \"points\": [\n            {\n              \"x\": 0.0,\n              \"y\": 1.599,\n              \"label\": \"2013—2019 观测 1\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.59,\n              \"y\": 1.9,\n              \"label\": \"2013—2019 观测 2\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.857,\n              \"y\": 2.2,\n              \"label\": \"2013—2019 观测 3\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.072,\n              \"y\": 1.599,\n              \"label\": \"2013—2019 观测 4\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.475,\n              \"y\": 1.537,\n              \"label\": \"2013—2019 观测 5\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.044,\n              \"y\": 1.599,\n              \"label\": \"2013—2019 观测 6\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -0.204,\n              \"y\": 1.7,\n              \"label\": \"2013—2019 观测 7\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 0.2,\n              \"y\": 0.4,\n              \"label\": \"2024（原图估计）\",\n              \"color\": \"#9bbb59\"\n            },\n            {\n              \"x\": -0.0,\n              \"y\": 0.7,\n              \"label\": \"2023\",\n              \"color\": \"#ff0000\"\n            }\n          ]\n        }\n      ],\n      \"xLabel\": \"产出缺口，百分点\",\n      \"yLabel\": \"核心CPI同比，%\",\n      \"method\": \"基准散点为2013—2019；2020—2022被原研究排除，2024核心CPI当时估为0.4%。\",\n      \"limits\": [\n        \"原图坐标将2023画在x≈0、2024画在x≈0.2；脚注却将两年的产出缺口依次写成0.2和0，存在顺序矛盾，未擅自修正。\",\n        \"潜在增速属于模型估计，不能将回归外推自动当成真实GDP的精确测量。\"\n      ],\n      \"axis\": {\n        \"x\": [\n          -0.6,\n          1\n        ],\n        \"left\": [\n          0.3,\n          2.3\n        ],\n        \"yTicks\": [\n          0.3,\n          0.5,\n          0.7,\n          0.9,\n          1.1,\n          1.3,\n          1.5,\n          1.7,\n          1.9,\n          2.1,\n          2.3\n        ],\n        \"xTicks\": [\n          -0.6,\n          -0.4,\n          -0.2,\n          0.0,\n          0.2,\n          0.4,\n          0.6,\n          0.8,\n          1.0\n        ]\n      },\n      \"regression\": {\n        \"slope\": 0.47,\n        \"intercept\": 1.69,\n        \"r2\": 0.86\n      },\n      \"drawnFit\": [\n        {\n          \"x\": -0.4756,\n          \"y\": 1.465\n        },\n        {\n          \"x\": 0.8572,\n          \"y\": 2.0953\n        }\n      ],\n      \"recoveredOLS\": {\n        \"n\": 7,\n        \"slope\": 0.47358,\n        \"intercept\": 1.68932,\n        \"r2\": 0.85665\n      }\n    },\n    {\n      \"id\": \"slide-25\",\n      \"page\": 25,\n      \"title\": \"就业增速与实际GDP：历史关系\",\n      \"section\": \"总量与地产\",\n      \"kind\": \"scatter\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=25\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"原图散点\",\n          \"points\": [\n            {\n              \"x\": 3.298,\n              \"y\": 8.49,\n              \"label\": \"2000\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 4.197,\n              \"y\": 8.336,\n              \"label\": \"2001\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 4.295,\n              \"y\": 9.132,\n              \"label\": \"2002\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 4.258,\n              \"y\": 10.031,\n              \"label\": \"2003\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 4.053,\n              \"y\": 10.108,\n              \"label\": \"2004\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 4.016,\n              \"y\": 11.392,\n              \"label\": \"2005\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 4.371,\n              \"y\": 12.714,\n              \"label\": \"2006\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 4.465,\n              \"y\": 14.229,\n              \"label\": \"2007\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 3.715,\n              \"y\": 9.646,\n              \"label\": \"2008\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 3.796,\n              \"y\": 9.402,\n              \"label\": \"2009\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 4.095,\n              \"y\": 10.634,\n              \"label\": \"2010\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 3.793,\n              \"y\": 9.543,\n              \"label\": \"2011\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 3.565,\n              \"y\": 7.861,\n              \"label\": \"2012\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 3.326,\n              \"y\": 7.758,\n              \"label\": \"2013\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 3.054,\n              \"y\": 7.425,\n              \"label\": \"2014\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 3.056,\n              \"y\": 7.04,\n              \"label\": \"2015\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.773,\n              \"y\": 6.847,\n              \"label\": \"2016\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.752,\n              \"y\": 6.95,\n              \"label\": \"2017\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.508,\n              \"y\": 6.744,\n              \"label\": \"2018\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.162,\n              \"y\": 5.948,\n              \"label\": \"2019\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 2.259,\n              \"y\": 2.238,\n              \"label\": \"2020\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": 1.671,\n              \"y\": 5.345,\n              \"label\": \"2021\",\n              \"color\": \"#4f81bd\"\n            },\n            {\n              \"x\": -1.8,\n              \"y\": 2.946,\n              \"label\": \"2022\",\n              \"color\": \"#ff0000\"\n            },\n            {\n              \"x\": 0.299,\n              \"y\": 4.102,\n              \"label\": \"2023\",\n              \"color\": \"#ff0000\"\n            }\n          ]\n        }\n      ],\n      \"xLabel\": \"城镇就业人员增速，%\",\n      \"yLabel\": \"实际GDP同比，%\",\n      \"method\": \"原图2000—2023年年度数据；2021和2023年用两年复合增速。\",\n      \"limits\": [\n        \"拟合样本是否排除2022—2023须回归核对；关系不稳定不唯一说明GDP被高估。\",\n        \"仅排除2022—2023的恢复点回归，与原稿方程不一致；进一步排除2020的敏感性结果也不能复现原标注，具体回归样本或权重仍待确认。\"\n      ],\n      \"axis\": {\n        \"x\": [\n          -3,\n          5\n        ],\n        \"left\": [\n          0,\n          16\n        ],\n        \"yTicks\": [\n          0,\n          2,\n          4,\n          6,\n          8,\n          10,\n          12,\n          14,\n          16\n        ],\n        \"xTicks\": [\n          -3,\n          -2,\n          -1,\n          0,\n          1,\n          2,\n          3,\n          4,\n          5\n        ]\n      },\n      \"regression\": {\n        \"slope\": 3.0,\n        \"intercept\": -2.0,\n        \"pText\": \"原图显示 p=0（舍入）\"\n      },\n      \"drawnFit\": [\n        {\n          \"x\": 4.7948,\n          \"y\": 12.7469\n        },\n        {\n          \"x\": 0.4699,\n          \"y\": 1.0435\n        }\n      ],\n      \"recoveredOLS\": {\n        \"n\": 22,\n        \"slope\": 2.75262,\n        \"intercept\": -0.90677,\n        \"r2\": 0.73735\n      }\n    },\n    {\n      \"id\": \"slide-26\",\n      \"page\": 26,\n      \"title\": \"消费与名义GDP：前后五年比较\",\n      \"section\": \"总量与地产\",\n      \"kind\": \"bar\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=26\",\n      \"fidelity\": \"原图明确标注值\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"名义GDP同比\",\n          \"color\": \"#0070c0\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2015—2019\",\n              \"y\": 8.9\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2020—2024（当时估计）\",\n              \"y\": 5.9\n            }\n          ]\n        },\n        {\n          \"name\": \"社零同比\",\n          \"color\": \"#ff0000\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2015—2019\",\n              \"y\": 9.7\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2020—2024（当时估计）\",\n              \"y\": 3.8\n            }\n          ]\n        }\n      ],\n      \"method\": \"按原图明示的两个五年窗口数值重绘；2024值在演讲时属于估计。\",\n      \"limits\": [\n        \"不是截至2025年的事后年度统计；固定资产投资并不等于GDP核算中的资本形成。\"\n      ],\n      \"labels\": [\n        \"2015—2019\",\n        \"2020—2024（当时估计）\"\n      ],\n      \"axis\": {\n        \"left\": [\n          0,\n          11\n        ],\n        \"yTicks\": [\n          0,\n          2,\n          4,\n          6,\n          8,\n          10\n        ]\n      }\n    },\n    {\n      \"id\": \"slide-27\",\n      \"page\": 27,\n      \"title\": \"投资与名义GDP：前后五年比较\",\n      \"section\": \"总量与地产\",\n      \"kind\": \"bar\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=27\",\n      \"fidelity\": \"原图明确标注值\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"名义GDP同比\",\n          \"color\": \"#0070c0\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2015—2019\",\n              \"y\": 8.9\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2020—2024（当时估计）\",\n              \"y\": 5.9\n            }\n          ]\n        },\n        {\n          \"name\": \"固定资产投资同比\",\n          \"color\": \"#ff0000\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"2015—2019\",\n              \"y\": 7.3\n            },\n            {\n              \"x\": 1,\n              \"label\": \"2020—2024（当时估计）\",\n              \"y\": 3.9\n            }\n          ]\n        }\n      ],\n      \"method\": \"按原图明示的两个五年窗口数值重绘；2024值在演讲时属于估计。\",\n      \"limits\": [\n        \"不是截至2025年的事后年度统计；固定资产投资并不等于GDP核算中的资本形成。\"\n      ],\n      \"labels\": [\n        \"2015—2019\",\n        \"2020—2024（当时估计）\"\n      ],\n      \"axis\": {\n        \"left\": [\n          0,\n          11\n        ],\n        \"yTicks\": [\n          0,\n          2,\n          4,\n          6,\n          8,\n          10\n        ]\n      }\n    },\n    {\n      \"id\": \"slide-28\",\n      \"page\": 28,\n      \"title\": \"地产危机前后三年增速差\",\n      \"section\": \"总量与地产\",\n      \"kind\": \"bar\",\n      \"unit\": \"百分点\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=28\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"后3年均值 − 前3年均值\",\n          \"color\": \"#2876ab\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"y\": -0.18,\n              \"label\": \"中国2021\",\n              \"color\": \"#ff0000\"\n            },\n            {\n              \"x\": 1,\n              \"y\": -1.7,\n              \"label\": \"西班牙1978\",\n              \"color\": \"#0070c0\"\n            },\n            {\n              \"x\": 2,\n              \"y\": -3.27,\n              \"label\": \"瑞典1991\",\n              \"color\": \"#0070c0\"\n            },\n            {\n              \"x\": 3,\n              \"y\": -3.53,\n              \"label\": \"美国2008\",\n              \"color\": \"#0070c0\"\n            },\n            {\n              \"x\": 4,\n              \"y\": -3.57,\n              \"label\": \"丹麦2008\",\n              \"color\": \"#0070c0\"\n            },\n            {\n              \"x\": 5,\n              \"y\": -4.43,\n              \"label\": \"日本1991\",\n              \"color\": \"#0070c0\"\n            },\n            {\n              \"x\": 6,\n              \"y\": -4.69,\n              \"label\": \"西班牙2008\",\n              \"color\": \"#0070c0\"\n            },\n            {\n              \"x\": 7,\n              \"y\": -6.94,\n              \"label\": \"芬兰1991\",\n              \"color\": \"#0070c0\"\n            }\n          ]\n        }\n      ],\n      \"method\": \"危机后3年平均实际增长减危机前3年平均实际增长；中国以2021为0点，2021用两年复合，2024为当时估计。\",\n      \"limits\": [\n        \"事件包括西班牙1978、瑞典/日本/芬兰1991及美国/丹麦/西班牙2008；事件选择、财政反应和全球环境不同。差异不是因果估计。\"\n      ],\n      \"labels\": [\n        \"中国2021\",\n        \"西班牙1978\",\n        \"瑞典1991\",\n        \"美国2008\",\n        \"丹麦2008\",\n        \"日本1991\",\n        \"西班牙2008\",\n        \"芬兰1991\"\n      ],\n      \"axis\": {\n        \"left\": [\n          -7,\n          0\n        ],\n        \"yTicks\": [\n          -7,\n          -6,\n          -5,\n          -4,\n          -3,\n          -2,\n          -1,\n          0\n        ]\n      }\n    },\n    {\n      \"id\": \"slide-29\",\n      \"page\": 29,\n      \"title\": \"地产危机前后的事件时间路径\",\n      \"section\": \"总量与地产\",\n      \"kind\": \"line\",\n      \"unit\": \"%\",\n      \"source\": \"https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=29\",\n      \"fidelity\": \"图中数值恢复\",\n      \"rawRecalculated\": false,\n      \"series\": [\n        {\n          \"name\": \"危机国家平均\",\n          \"color\": \"#ff0000\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"-10\",\n              \"y\": 3.09\n            },\n            {\n              \"x\": 1,\n              \"label\": \"-9\",\n              \"y\": 3.78\n            },\n            {\n              \"x\": 2,\n              \"label\": \"-8\",\n              \"y\": 4.39\n            },\n            {\n              \"x\": 3,\n              \"label\": \"-7\",\n              \"y\": 3.58\n            },\n            {\n              \"x\": 4,\n              \"label\": \"-6\",\n              \"y\": 2.96\n            },\n            {\n              \"x\": 5,\n              \"label\": \"-5\",\n              \"y\": 3.12\n            },\n            {\n              \"x\": 6,\n              \"label\": \"-4\",\n              \"y\": 3.9\n            },\n            {\n              \"x\": 7,\n              \"label\": \"-3\",\n              \"y\": 4.33\n            },\n            {\n              \"x\": 8,\n              \"label\": \"-2\",\n              \"y\": 3.6\n            },\n            {\n              \"x\": 9,\n              \"label\": \"-1\",\n              \"y\": 2.48\n            },\n            {\n              \"x\": 10,\n              \"label\": \"0\",\n              \"y\": 0.23\n            },\n            {\n              \"x\": 11,\n              \"label\": \"1\",\n              \"y\": -1.52\n            },\n            {\n              \"x\": 12,\n              \"label\": \"2\",\n              \"y\": -0.44\n            },\n            {\n              \"x\": 13,\n              \"label\": \"3\",\n              \"y\": 1.29\n            },\n            {\n              \"x\": 14,\n              \"label\": \"4\",\n              \"y\": 1.35\n            },\n            {\n              \"x\": 15,\n              \"label\": \"5\",\n              \"y\": 1.63\n            },\n            {\n              \"x\": 16,\n              \"label\": \"6\",\n              \"y\": 2.43\n            },\n            {\n              \"x\": 17,\n              \"label\": \"7\",\n              \"y\": 2.68\n            },\n            {\n              \"x\": 18,\n              \"label\": \"8\",\n              \"y\": 2.81\n            },\n            {\n              \"x\": 19,\n              \"label\": \"9\",\n              \"y\": 3.44\n            },\n            {\n              \"x\": 20,\n              \"label\": \"10\",\n              \"y\": 2.36\n            }\n          ]\n        },\n        {\n          \"name\": \"中国（2021=事件年0）\",\n          \"color\": \"#0070c0\",\n          \"axis\": \"left\",\n          \"points\": [\n            {\n              \"x\": 0,\n              \"label\": \"-10\",\n              \"y\": 9.55\n            },\n            {\n              \"x\": 1,\n              \"label\": \"-9\",\n              \"y\": 7.86\n            },\n            {\n              \"x\": 2,\n              \"label\": \"-8\",\n              \"y\": 7.77\n            },\n            {\n              \"x\": 3,\n              \"label\": \"-7\",\n              \"y\": 7.43\n            },\n            {\n              \"x\": 4,\n              \"label\": \"-6\",\n              \"y\": 7.04\n            },\n            {\n              \"x\": 5,\n              \"label\": \"-5\",\n              \"y\": 6.85\n            },\n            {\n              \"x\": 6,\n              \"label\": \"-4\",\n              \"y\": 6.95\n            },\n            {\n              \"x\": 7,\n              \"label\": \"-3\",\n              \"y\": 6.75\n            },\n            {\n              \"x\": 8,\n              \"label\": \"-2\",\n              \"y\": 6.0\n            },\n            {\n              \"x\": 9,\n              \"label\": \"-1\",\n              \"y\": 2.2\n            },\n            {\n              \"x\": 10,\n              \"label\": \"0\",\n              \"y\": 5.25\n            },\n            {\n              \"x\": 11,\n              \"label\": \"1\",\n              \"y\": 3.0\n            },\n            {\n              \"x\": 12,\n              \"label\": \"2\",\n              \"y\": 5.0\n            },\n            {\n              \"x\": 13,\n              \"label\": \"3\",\n              \"y\": 4.9\n            }\n          ]\n        }\n      ],\n      \"method\": \"横轴0为危机年份；七次历史事件按算术平均对齐；中国0点为2021。\",\n      \"limits\": [\n        \"平均路径隐藏国别差异；2024仍是当时估计；恢复的是原图路径，不能直接当作中国未来预测。\"\n      ],\n      \"labels\": [\n        \"-10\",\n        \"-9\",\n        \"-8\",\n        \"-7\",\n        \"-6\",\n        \"-5\",\n        \"-4\",\n        \"-3\",\n        \"-2\",\n        \"-1\",\n        \"0\",\n        \"1\",\n        \"2\",\n        \"3\",\n        \"4\",\n        \"5\",\n        \"6\",\n        \"7\",\n        \"8\",\n        \"9\",\n        \"10\"\n      ],\n      \"axis\": {\n        \"left\": [\n          -2,\n          8\n        ],\n        \"yTicks\": [\n          -2,\n          0,\n          2,\n          4,\n          6,\n          8\n        ]\n      },\n      \"digitizationError\": 0.009\n    }\n  ],\n  \"notes\": [\n    \"原图的矢量位置按刻度线性标定恢复，保留绘图误差；数值小数位用于复算，不代表原始数据精度。\",\n    \"没有将图形恢复说成逐公司原始数据库复算；原始Wind样本、去重及公司口径仍缺失。\",\n    \"已有2012年起的官方年度数据为事后观察，演讲原图中2024年估计另行保留，不事后替换。\"\n  ]\n}\n</script><script type=\"application/json\" id=\"worldbank-initial\">{\n  \"source\": \"https://api.worldbank.org/v2/country/USA;ESP;DNK;JPN;FIN;SWE;CHN/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=20000&date=1968:2025\",\n  \"indicator\": \"NY.GDP.MKTP.KD.ZG\",\n  \"lastUpdated\": \"2026-10-08\",\n  \"retrievedAt\": \"2026-10-25T21:50:56.569Z\",\n  \"observations\": [\n    {\n      \"country\": \"CHN\",\n      \"year\": 2025,\n      \"value\": 4.95994886240992\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2024,\n      \"value\": 4.95830378788091\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2023,\n      \"value\": 5.41600334492955\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2022,\n      \"value\": 3.13385438394069\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2021,\n      \"value\": 8.57038414981781\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2020,\n      \"value\": 2.33950385203023\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2019,\n      \"value\": 6.06737806333672\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2018,\n      \"value\": 6.757806142324\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2017,\n      \"value\": 6.89123916636191\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2016,\n      \"value\": 6.7736886867727\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2015,\n      \"value\": 6.98162255562367\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2014,\n      \"value\": 7.46100735778161\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2013,\n      \"value\": 7.77842954757257\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2012,\n      \"value\": 7.8578201481217\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2011,\n      \"value\": 9.46205248298186\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2010,\n      \"value\": 10.5916903885704\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2009,\n      \"value\": 9.40610014336416\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2008,\n      \"value\": 9.66877608164454\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2007,\n      \"value\": 14.1507710506103\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2006,\n      \"value\": 12.6752842281595\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2005,\n      \"value\": 11.4535130030645\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2004,\n      \"value\": 10.1404291872206\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2003,\n      \"value\": 10.1138119025242\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2002,\n      \"value\": 9.23604870383861\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2001,\n      \"value\": 8.32404695347056\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 2000,\n      \"value\": 8.57357328926101\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1999,\n      \"value\": 7.74123827728161\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1998,\n      \"value\": 7.92354535108497\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1997,\n      \"value\": 9.29759460595947\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1996,\n      \"value\": 9.97328781228394\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1995,\n      \"value\": 11.0154136659719\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1994,\n      \"value\": 13.0827122987906\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1993,\n      \"value\": 13.9261028311995\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1992,\n      \"value\": 14.2976226152779\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1991,\n      \"value\": 9.37563237902144\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1990,\n      \"value\": 3.9225195692421\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1989,\n      \"value\": 4.20785693658392\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1988,\n      \"value\": 11.2209115803492\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1987,\n      \"value\": 11.6552658383921\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1986,\n      \"value\": 8.9437463904392\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1985,\n      \"value\": 13.4284820016509\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1984,\n      \"value\": 15.1921349118079\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1983,\n      \"value\": 10.7718383060041\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1982,\n      \"value\": 9.02434347373044\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1981,\n      \"value\": 5.11486309071954\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1980,\n      \"value\": 7.84141706847441\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1979,\n      \"value\": 7.59480175999998\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1978,\n      \"value\": 11.3269542129809\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1977,\n      \"value\": 7.57000000138403\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1976,\n      \"value\": -1.57000000165326\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1975,\n      \"value\": 8.71999999747992\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1974,\n      \"value\": 2.31000000294736\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1973,\n      \"value\": 7.76000000084325\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1972,\n      \"value\": 3.81000000021984\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1971,\n      \"value\": 7.05999999853672\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1970,\n      \"value\": 19.2999999967022\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1969,\n      \"value\": 16.9399999960609\n    },\n    {\n      \"country\": \"CHN\",\n      \"year\": 1968,\n      \"value\": -4.09999998647768\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2025,\n      \"value\": 2.92843280014236\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2024,\n      \"value\": 3.47783593140312\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2023,\n      \"value\": 0.604587766175584\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2022,\n      \"value\": 0.443832614908331\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2021,\n      \"value\": 6.50025445756295\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2020,\n      \"value\": -1.78010601831291\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2019,\n      \"value\": 1.71140093932736\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2018,\n      \"value\": 1.8600074900921\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2017,\n      \"value\": 3.05647723922718\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2016,\n      \"value\": 3.07304549209093\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2015,\n      \"value\": 2.10441456445301\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2014,\n      \"value\": 1.27799983192831\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2013,\n      \"value\": 1.39267343161971\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2012,\n      \"value\": -0.00543230161670749\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2011,\n      \"value\": 1.3108037609606\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2010,\n      \"value\": 1.58289703108802\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2009,\n      \"value\": -4.97447905669058\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2008,\n      \"value\": -0.417178439991005\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2007,\n      \"value\": 0.987173815945127\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2006,\n      \"value\": 3.81648769908172\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2005,\n      \"value\": 2.35960882992528\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2004,\n      \"value\": 2.77635180744053\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2003,\n      \"value\": 0.441091006625101\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2002,\n      \"value\": 0.456530018779986\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2001,\n      \"value\": 0.95003224600012\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 2000,\n      \"value\": 3.72400899471576\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1999,\n      \"value\": 2.96730536257029\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1998,\n      \"value\": 2.32630274538961\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1997,\n      \"value\": 3.16848143784479\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1996,\n      \"value\": 2.89575069230459\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1995,\n      \"value\": 3.03802150461165\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1994,\n      \"value\": 5.29469615156448\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1993,\n      \"value\": -0.078900412805325\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1992,\n      \"value\": 2.0228112415746\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1991,\n      \"value\": 1.45818005306188\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1990,\n      \"value\": 1.66026774169177\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1989,\n      \"value\": 0.697173210370437\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1988,\n      \"value\": 0.272951118976223\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1987,\n      \"value\": 0.462955829960563\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1986,\n      \"value\": 4.73340611933794\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1985,\n      \"value\": 4.15308383294486\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1984,\n      \"value\": 4.33934505132922\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1983,\n      \"value\": 2.65480394401855\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1982,\n      \"value\": 3.89211245643591\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1981,\n      \"value\": -0.740986389012875\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1980,\n      \"value\": -0.751430002361559\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1979,\n      \"value\": 4.05329979126334\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1978,\n      \"value\": 2.41699354282181\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1977,\n      \"value\": 1.98543025474245\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1976,\n      \"value\": 5.99340195153275\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1975,\n      \"value\": -1.40989953291778\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1974,\n      \"value\": -0.964267384329801\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1973,\n      \"value\": 4.71949291132046\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1972,\n      \"value\": 3.79759816845579\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1971,\n      \"value\": 3.17782168196071\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1970,\n      \"value\": 1.85600172758038\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1969,\n      \"value\": 6.79912047392293\n    },\n    {\n      \"country\": \"DNK\",\n      \"year\": 1968,\n      \"value\": 5.85299737649714\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2025,\n      \"value\": 2.82495400578509\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2024,\n      \"value\": 3.45525405630191\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2023,\n      \"value\": 2.46085796805582\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2022,\n      \"value\": 6.37031712129601\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2021,\n      \"value\": 6.68314420473001\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2020,\n      \"value\": -10.9400706350371\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2019,\n      \"value\": 1.96117850841711\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2018,\n      \"value\": 2.39541124478878\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2017,\n      \"value\": 2.89604207865007\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2016,\n      \"value\": 2.91515598595787\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2015,\n      \"value\": 4.06086672473866\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2014,\n      \"value\": 1.52048593647231\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2013,\n      \"value\": -1.42732224757626\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2012,\n      \"value\": -2.86511368637748\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2011,\n      \"value\": -0.639920636520344\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2010,\n      \"value\": 0.0941223116369514\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2009,\n      \"value\": -3.76813306940053\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2008,\n      \"value\": 0.767165748290694\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2007,\n      \"value\": 3.53350013165972\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2006,\n      \"value\": 4.04343515605099\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2005,\n      \"value\": 3.5512255846125\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2004,\n      \"value\": 3.1145314799161\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2003,\n      \"value\": 2.9392895953076\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2002,\n      \"value\": 2.75545611564098\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2001,\n      \"value\": 3.91908880808811\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 2000,\n      \"value\": 5.20064125553942\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1999,\n      \"value\": 4.40886545305924\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1998,\n      \"value\": 4.30197745333581\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1997,\n      \"value\": 3.58729972356299\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1996,\n      \"value\": 2.60741117110229\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1995,\n      \"value\": 2.75749400293542\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1994,\n      \"value\": 2.38319537908909\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1993,\n      \"value\": -1.03149183695307\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1992,\n      \"value\": 0.929215482921151\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1991,\n      \"value\": 2.54600049647455\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1990,\n      \"value\": 3.7813935513235\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1989,\n      \"value\": 4.82703031299745\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1988,\n      \"value\": 5.09432412898086\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1987,\n      \"value\": 5.54712273579352\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1986,\n      \"value\": 3.25332169179885\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1985,\n      \"value\": 2.3214357659951\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1984,\n      \"value\": 1.78468751370853\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1983,\n      \"value\": 1.77011581051299\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1982,\n      \"value\": 1.2464617922282\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1981,\n      \"value\": -0.13246859717357\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1980,\n      \"value\": 2.20872810257116\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1979,\n      \"value\": 0.0415465166768456\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1978,\n      \"value\": 1.46300333315605\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1977,\n      \"value\": 2.83857436106388\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1976,\n      \"value\": 3.30379140860018\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1975,\n      \"value\": 0.542203343297047\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1974,\n      \"value\": 5.61878564719633\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1973,\n      \"value\": 7.7884653422601\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1972,\n      \"value\": 8.14974586367205\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1971,\n      \"value\": 4.64947364578497\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1970,\n      \"value\": 4.24497088667341\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1969,\n      \"value\": 8.90701540575571\n    },\n    {\n      \"country\": \"ESP\",\n      \"year\": 1968,\n      \"value\": 6.59702019075823\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2025,\n      \"value\": 0.173444509584499\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2024,\n      \"value\": 0.374566568538427\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2023,\n      \"value\": -1.28973484453397\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2022,\n      \"value\": 0.763041912763526\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2021,\n      \"value\": 2.67634641498897\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2020,\n      \"value\": -2.49103605535707\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2019,\n      \"value\": 1.34973845741737\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2018,\n      \"value\": 1.19297759742292\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2017,\n      \"value\": 3.30337003591039\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2016,\n      \"value\": 2.57193414898754\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2015,\n      \"value\": 0.466503766322674\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2014,\n      \"value\": -0.4780684247837\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2013,\n      \"value\": -0.979741024949618\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2012,\n      \"value\": -1.52284013040689\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2011,\n      \"value\": 2.39039455396828\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2010,\n      \"value\": 3.1682879121621\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2009,\n      \"value\": -8.07603116552393\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2008,\n      \"value\": 0.784431235717051\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2007,\n      \"value\": 5.31280176694145\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2006,\n      \"value\": 4.01957326515895\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2005,\n      \"value\": 2.77730918518017\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2004,\n      \"value\": 4.00537952277651\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2003,\n      \"value\": 2.01179992738312\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2002,\n      \"value\": 1.68732644358099\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2001,\n      \"value\": 2.64026205699308\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 2000,\n      \"value\": 5.75373770498848\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1999,\n      \"value\": 4.38928070374669\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1998,\n      \"value\": 5.45427021765444\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1997,\n      \"value\": 6.39770068404337\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1996,\n      \"value\": 3.66265716987186\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1995,\n      \"value\": 4.23436710187066\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1994,\n      \"value\": 3.96437283726799\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1993,\n      \"value\": -0.779815061561479\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1992,\n      \"value\": -3.31137361706595\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1991,\n      \"value\": -5.88059618513641\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1990,\n      \"value\": 0.691649917806032\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1989,\n      \"value\": 5.08392955255206\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1988,\n      \"value\": 5.23111280719965\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1987,\n      \"value\": 3.56103297195551\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1986,\n      \"value\": 2.75509931172768\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1985,\n      \"value\": 3.54005438717211\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1984,\n      \"value\": 3.22653291609758\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1983,\n      \"value\": 3.10384880639285\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1982,\n      \"value\": 3.08671541654802\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1981,\n      \"value\": 1.28938426892493\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1980,\n      \"value\": 5.38904748575388\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1979,\n      \"value\": 7.12192593764533\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1978,\n      \"value\": 2.91970756437469\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1977,\n      \"value\": 0.239510630103453\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1976,\n      \"value\": 0.344383187103318\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1975,\n      \"value\": 1.80489795187316\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1974,\n      \"value\": 3.23653343563224\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1973,\n      \"value\": 6.98382835563822\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1972,\n      \"value\": 7.7354848193458\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1971,\n      \"value\": 2.35692123166586\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1970,\n      \"value\": 7.47043267144105\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1969,\n      \"value\": 9.59328847858328\n    },\n    {\n      \"country\": \"FIN\",\n      \"year\": 1968,\n      \"value\": 2.30328981591643\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2025,\n      \"value\": 1.19311288444599\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2024,\n      \"value\": -0.240084236041696\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2023,\n      \"value\": 0.720785304749811\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2022,\n      \"value\": 1.33164750653741\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2021,\n      \"value\": 3.56419531474475\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2020,\n      \"value\": -4.28327942675573\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2019,\n      \"value\": -0.308496921143259\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2018,\n      \"value\": 0.834143845965585\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2017,\n      \"value\": 1.62345062245441\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2016,\n      \"value\": 0.704986495111257\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2015,\n      \"value\": 1.79997735783475\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2014,\n      \"value\": 0.905915486065865\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2013,\n      \"value\": 1.99727653399265\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2012,\n      \"value\": 1.64893452981225\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2011,\n      \"value\": -0.20035785332982\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2010,\n      \"value\": 4.13645589222239\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2009,\n      \"value\": -5.9359411383964\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2008,\n      \"value\": -1.16662209355141\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2007,\n      \"value\": 1.72837912865577\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2006,\n      \"value\": 1.54630843078741\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2005,\n      \"value\": 1.8482813374834\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2004,\n      \"value\": 2.11294823723127\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2003,\n      \"value\": 1.38010935830795\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2002,\n      \"value\": 0.0849888050363319\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2001,\n      \"value\": 0.284608556379041\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 2000,\n      \"value\": 2.97832688768516\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1999,\n      \"value\": -0.347600398675738\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1998,\n      \"value\": -1.77264091037956\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1997,\n      \"value\": 1.36297109407448\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1996,\n      \"value\": 3.07546731409349\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1995,\n      \"value\": 2.34205546196849\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1994,\n      \"value\": 0.99306636322622\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1993,\n      \"value\": -0.517919847117952\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1992,\n      \"value\": 0.848069581218368\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1991,\n      \"value\": 3.41749676183089\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1990,\n      \"value\": 4.89271306574565\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1989,\n      \"value\": 4.85803768615389\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1988,\n      \"value\": 6.78502010955764\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1987,\n      \"value\": 4.73066586040017\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1986,\n      \"value\": 3.32652561623384\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1985,\n      \"value\": 5.23338094687848\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1984,\n      \"value\": 4.50199481622435\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1983,\n      \"value\": 3.52304498510377\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1982,\n      \"value\": 3.31245673740017\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1981,\n      \"value\": 4.20933646523171\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1980,\n      \"value\": 2.81759120738283\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1979,\n      \"value\": 5.4840418324284\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1978,\n      \"value\": 5.27194150317187\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1977,\n      \"value\": 4.39033795009327\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1976,\n      \"value\": 3.97498409113672\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1975,\n      \"value\": 3.09157591623077\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1974,\n      \"value\": -1.22523982750916\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1973,\n      \"value\": 8.03259997458245\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1972,\n      \"value\": 8.41354725497627\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1971,\n      \"value\": 4.69899204214205\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1970,\n      \"value\": 0.399050611065093\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1969,\n      \"value\": 12.4778945420024\n    },\n    {\n      \"country\": \"JPN\",\n      \"year\": 1968,\n      \"value\": 12.8824681707163\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2025,\n      \"value\": 1.54316373266217\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2024,\n      \"value\": 1.01779633304398\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2023,\n      \"value\": -0.204061304891439\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2022,\n      \"value\": 1.25543620445816\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2021,\n      \"value\": 5.2258643028773\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2020,\n      \"value\": -1.93379704032216\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2019,\n      \"value\": 2.60823012869524\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2018,\n      \"value\": 1.7702553546772\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2017,\n      \"value\": 1.88282184966646\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2016,\n      \"value\": 2.13117914731151\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2015,\n      \"value\": 4.38824673608589\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2014,\n      \"value\": 2.29577238758284\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2013,\n      \"value\": 1.13766671801426\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2012,\n      \"value\": -0.414397702454409\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2011,\n      \"value\": 3.16388567406926\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2010,\n      \"value\": 5.75076477579255\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2009,\n      \"value\": -4.25561384207619\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2008,\n      \"value\": -0.923113250067971\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2007,\n      \"value\": 3.22486814096095\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2006,\n      \"value\": 4.67607488877992\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2005,\n      \"value\": 2.79313782840156\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2004,\n      \"value\": 4.17958419343711\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2003,\n      \"value\": 1.88102769675844\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2002,\n      \"value\": 2.27772867861897\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2001,\n      \"value\": 1.36080642694121\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 2000,\n      \"value\": 4.63112136551369\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1999,\n      \"value\": 4.20111929805536\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1998,\n      \"value\": 4.24583179417877\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1997,\n      \"value\": 3.06499186399252\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1996,\n      \"value\": 1.70471985374236\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1995,\n      \"value\": 4.09438992772475\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1994,\n      \"value\": 4.01576585901515\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1993,\n      \"value\": -2.06561636908388\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1992,\n      \"value\": -1.15859275987265\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1991,\n      \"value\": -1.14597485051154\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1990,\n      \"value\": 0.754674765275468\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1989,\n      \"value\": 2.65480690949124\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1988,\n      \"value\": 2.55903868133913\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1987,\n      \"value\": 3.35384296895474\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1986,\n      \"value\": 2.69132318957357\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1985,\n      \"value\": 2.16037374917175\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1984,\n      \"value\": 4.22953525809793\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1983,\n      \"value\": 1.90063868064665\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1982,\n      \"value\": 1.24866467425022\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1981,\n      \"value\": 0.454830427902976\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1980,\n      \"value\": 1.69997145285421\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1979,\n      \"value\": 3.84000348607525\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1978,\n      \"value\": 1.75154803918647\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1977,\n      \"value\": -1.59625857600648\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1976,\n      \"value\": 1.05810489091265\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1975,\n      \"value\": 2.55286265850103\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1974,\n      \"value\": 3.19819561873223\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1973,\n      \"value\": 3.96798115589563\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1972,\n      \"value\": 2.28873878707626\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1971,\n      \"value\": 0.944646218021433\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1970,\n      \"value\": 6.47367396370416\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1969,\n      \"value\": 5.00907518225404\n    },\n    {\n      \"country\": \"SWE\",\n      \"year\": 1968,\n      \"value\": 3.638505638623\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2025,\n      \"value\": 2.16138195623856\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2024,\n      \"value\": 2.79318715363841\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2023,\n      \"value\": 2.93436322440155\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2022,\n      \"value\": 2.52421385073222\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2021,\n      \"value\": 6.15202247867526\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2020,\n      \"value\": -2.081375977796\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2019,\n      \"value\": 2.58382533052225\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2018,\n      \"value\": 2.96650506701943\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2017,\n      \"value\": 2.45762230126449\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2016,\n      \"value\": 1.81945147909089\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2015,\n      \"value\": 2.94555045227337\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2014,\n      \"value\": 2.52381981757846\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2013,\n      \"value\": 2.11783009443471\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2012,\n      \"value\": 2.28911339009767\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2011,\n      \"value\": 1.56440685205419\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2010,\n      \"value\": 2.69519258673525\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2009,\n      \"value\": -2.5765002366652\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2008,\n      \"value\": 0.113587247501258\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2007,\n      \"value\": 2.0038583039496\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2006,\n      \"value\": 2.78453963674239\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2005,\n      \"value\": 3.48354993710312\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2004,\n      \"value\": 3.84777169267127\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2003,\n      \"value\": 2.79560596378604\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2002,\n      \"value\": 1.70044733078285\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2001,\n      \"value\": 0.955538337599847\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 2000,\n      \"value\": 4.07758575997799\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1999,\n      \"value\": 4.78842504836746\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1998,\n      \"value\": 4.48313335499124\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1997,\n      \"value\": 4.44712793442667\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1996,\n      \"value\": 3.77277269047364\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1995,\n      \"value\": 2.68443073970295\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1994,\n      \"value\": 4.02902272637739\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1993,\n      \"value\": 2.75179586314481\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1992,\n      \"value\": 3.52249717254271\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1991,\n      \"value\": -0.108312873733027\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1990,\n      \"value\": 1.88596557755378\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1989,\n      \"value\": 3.67223784138015\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1988,\n      \"value\": 4.17698239478443\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1987,\n      \"value\": 3.45462966441372\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1986,\n      \"value\": 3.46265504522061\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1985,\n      \"value\": 4.16957535422245\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1984,\n      \"value\": 7.2364531665454\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1983,\n      \"value\": 4.58379096944093\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1982,\n      \"value\": -1.80301377321203\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1981,\n      \"value\": 2.53770127042986\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1980,\n      \"value\": -0.256775739391401\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1979,\n      \"value\": 3.16598822512103\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1978,\n      \"value\": 5.53520648057204\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1977,\n      \"value\": 4.62418650079432\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1976,\n      \"value\": 5.38803390614694\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1975,\n      \"value\": -0.205619191208058\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1974,\n      \"value\": -0.540550190362552\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1973,\n      \"value\": 5.64567975951033\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1972,\n      \"value\": 5.25550197771585\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1971,\n      \"value\": 3.29272243899894\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1970,\n      \"value\": 0.216606498143278\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1969,\n      \"value\": 3.09999999656958\n    },\n    {\n      \"country\": \"USA\",\n      \"year\": 1968,\n      \"value\": 4.80000000278329\n    }\n  ]\n}\n</script><script>// Shared deterministic calculations used by the browser and verification scripts.\nfunction speechOLS(points){\n const a=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));if(a.length<3)throw Error('至少需要3个有效观测');const n=a.length,mx=a.reduce((s,p)=>s+p.x,0)/n,my=a.reduce((s,p)=>s+p.y,0)/n;\n const xx=a.reduce((s,p)=>s+(p.x-mx)**2,0),xy=a.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0),yy=a.reduce((s,p)=>s+(p.y-my)**2,0);if(xx<1e-12)throw Error('横轴没有变化');const slope=xy/xx,intercept=my-slope*mx,sse=a.reduce((s,p)=>s+(p.y-slope*p.x-intercept)**2,0);return {n,slope,intercept,r2:yy?1-sse/yy:0,residualSD:Math.sqrt(sse/(n-2))};\n}\nfunction sampleAggregation(input){\n if(!Array.isArray(input)||!input.length)throw Error('没有公司记录');if(input.length>100000)throw Error('最多100000条记录');\n const seen=new Set(),groups=new Map(),periodMembers=new Map(),byPeriod=new Map();\n for(const r of input){const {company_id,period,group}=r;if(!company_id||!/^\\d{4}(?:-(?:0[1-9]|1[0-2]))?$/.test(period)||!['支持','中性','限制'].includes(group))throw Error('需要company_id、YYYY或YYYY-MM格式period与明确group');\n  const key=company_id+'|'+period;if(seen.has(key))throw Error('同一公司同期重复：'+key+'。请先处理A/H/ADR交叉上市，不能重复计算合并营收。');seen.add(key);\n  if(groups.has(company_id)&&groups.get(company_id)!==group)throw Error('固定样本公司的分类跨期改变：'+company_id);groups.set(company_id,group);\n  for(const k of ['revenue_cny','market_cap_cny','employees'])if(r[k]===''||r[k]===null||!Number.isFinite(Number(r[k]))||Number(r[k])<0)throw Error('数值缺失或无效：'+company_id+' / '+k);\n  if(!Number.isInteger(Number(r.employees)))throw Error('员工人数必须是整数');\n  if(!periodMembers.has(period))periodMembers.set(period,new Set());periodMembers.get(period).add(company_id);\n  if(!byPeriod.has(period))byPeriod.set(period,Object.fromEntries(['支持','中性','限制'].map(g=>[g,{revenue:0,cap:0,employees:0}])));\n  const target=byPeriod.get(period)[group];target.revenue+=Number(r.revenue_cny);target.cap+=Number(r.market_cap_cny);target.employees+=Number(r.employees);\n }\n for(const [p,members]of periodMembers)if(members.size!==groups.size)throw Error(p+'不是相同固定样本，缺失公司不能按零补齐。');\n const rows=[];for(const [period,groupData]of [...byPeriod].sort((a,b)=>a[0].localeCompare(b[0]))){const totalRev=Object.values(groupData).reduce((s,g)=>s+g.revenue,0),totalCap=Object.values(groupData).reduce((s,g)=>s+g.cap,0);if(!totalRev||!totalCap)throw Error('全样本营收或市值为零');const priorPeriod=String(Number(period.slice(0,4))-1)+period.slice(4),prior=byPeriod.get(priorPeriod);\n  for(const [group,g]of Object.entries(groupData))rows.push({period,group,revenue:g.revenue,marketCap:g.cap,employees:g.employees,revenueShare:g.revenue/totalRev*100,capShare:g.cap/totalCap*100,revenueYoY:prior?.[group].revenue?100*(g.revenue/prior[group].revenue-1):null,employeeYoY:prior?.[group].employees?100*(g.employees/prior[group].employees-1):null});\n }\n return {scope:'自定义固定样本；未与原作者证券名单核对',companies:groups.size,periods:[...byPeriod.keys()].sort(),rows,groupCounts:Object.fromEntries(['支持','中性','限制'].map(g=>[g,[...groups.values()].filter(v=>v===g).length])),notes:['所有金额必须预先统一成人民币；合并报表按公司去重。','只比较同一月份或年度格式的同比，不把年度和季度累计混算。','本工具不构造作者未披露权重和复权规则的股价指数。']};\n}\nfunction parseCompanyCSV(text){\n const lines=text.trim().replace(/^\\uFEFF/,'').split(/\\r?\\n/),head=lines.shift().split(',').map(s=>s.trim());if(head.some(s=>s.includes('\"')))throw Error('模板使用不带引号的简单CSV');return lines.filter(s=>s.trim()).map((line,i)=>{const a=line.split(',').map(s=>s.trim());if(a.length!==head.length)throw Error('第'+(i+2)+'行列数不匹配');return Object.fromEntries(head.map((k,j)=>[k,a[j]]));});\n}\nfunction worldbankEvents(dataset,windowMode='exclude0'){\n const get=(country,year)=>{const v=dataset.observations.find(r=>r.country===country&&r.year===year)?.value;return typeof v==='number'?v:null};\n const definitions=[['CHN',2021,'中国2021'],['ESP',1978,'西班牙1978'],['SWE',1991,'瑞典1991'],['USA',2008,'美国2008'],['DNK',2008,'丹麦2008'],['JPN',1991,'日本1991'],['ESP',2008,'西班牙2008'],['FIN',1991,'芬兰1991']];\n const adjusted=(country,year)=>country==='CHN'&&year===2021?(get(country,2020)===null||get(country,2021)===null?null:100*(Math.sqrt((1+get(country,2020)/100)*(1+get(country,2021)/100))-1)):get(country,year);\n const avg=a=>a.some(x=>x===null)?null:a.reduce((s,v)=>s+v,0)/a.length;\n const events=definitions.map(([country,year,label])=>{const preYears=windowMode==='include0'?[year-2,year-1,year]:[year-3,year-2,year-1],postYears=windowMode==='postIncludes0'?[year,year+1,year+2]:[year+1,year+2,year+3],before=avg(preYears.map(y=>adjusted(country,y))),after=avg(postYears.map(y=>adjusted(country,y)));return {country,year,label,preYears,postYears,before,after,difference:before===null||after===null?null:after-before,path:Array.from({length:21},(_,i)=>({x:i,label:String(i-10),y:adjusted(country,year+i-10)}))};});\n return {events,averagePath:Array.from({length:21},(_,i)=>({x:i,label:String(i-10),y:avg(events.slice(1).map(e=>e.path[i].y))})),windowMode};\n}\nfunction speechChartSVG(chart,{width=960,height=430,showFit=true,computedFit=null}={}){\n const esc=x=>String(x??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));const pad={l:75,r:chart.axis?.right?80:30,t:64,b:100},w=width-pad.l-pad.r,h=height-pad.t-pad.b;\n const scatter=chart.kind==='scatter',bar=chart.kind==='bar',all=chart.series.flatMap(s=>s.points.filter(p=>Number.isFinite(p.y)));\n const xr=scatter?chart.axis.x:[0,Math.max(...all.map(p=>p.x),1)];\n const left=chart.axis.left||[Math.min(0,...all.map(p=>p.y)),Math.max(...all.map(p=>p.y))];\n // Extend to show observations outside labelled tick extents, but preserve right-axis units.\n const lr=[Math.min(left[0],...chart.series.filter(s=>s.axis!=='right').flatMap(s=>s.points.filter(p=>Number.isFinite(p.y)).map(p=>p.y))),Math.max(left[1],...chart.series.filter(s=>s.axis!=='right').flatMap(s=>s.points.filter(p=>Number.isFinite(p.y)).map(p=>p.y)))];\n const x=v=>pad.l+(bar?(v+.5)/(xr[1]+1):(v-xr[0])/(xr[1]-xr[0]||1))*w;\n const y=(v,axis)=>{const range=axis==='right'?chart.axis.right:lr;return pad.t+h-(v-range[0])/(range[1]-range[0]||1)*h};\n const f=v=>Math.abs(v)>=1000?Math.round(v).toLocaleString('en-US'):Math.abs(v)<2?Number(v.toFixed(2)):Number(v.toFixed(1));\n const clipId='clip-'+Array.from(chart.id||chart.title).map(c=>c.codePointAt(0).toString(16)).join('-');\n let svg='<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 '+width+' '+height+'\" role=\"img\" aria-label=\"'+esc(chart.title)+'\" style=\"font-family:system-ui,sans-serif;background:#fffef9\"><title>'+esc(chart.title)+'</title><defs><clipPath id=\"'+clipId+'\"><rect x=\"'+pad.l+'\" y=\"'+pad.t+'\" width=\"'+w+'\" height=\"'+h+'\"/></clipPath></defs>';\n svg+='<text x=\"'+pad.l+'\" y=\"23\" fill=\"#173c35\" font-size=\"17\" font-weight=\"600\">'+esc(chart.title)+'</text>';\n const ticks=chart.axis.yTicks||Array.from({length:6},(_,i)=>lr[0]+(lr[1]-lr[0])*i/5);\n for(const v of ticks){const yy=y(v);svg+='<line x1=\"'+pad.l+'\" y1=\"'+yy+'\" x2=\"'+(pad.l+w)+'\" y2=\"'+yy+'\" stroke=\"#e1e7da\"/><text x=\"'+(pad.l-10)+'\" y=\"'+(yy+4)+'\" text-anchor=\"end\" fill=\"#697469\" font-size=\"12\">'+f(v)+'</text>';}\n if(chart.axis.right){const range=chart.axis.right,rt=chart.axis.rightTicks||Array.from({length:6},(_,i)=>range[0]+(range[1]-range[0])*i/5);for(const v of rt)svg+='<text x=\"'+(pad.l+w+10)+'\" y=\"'+(y(v,'right')+4)+'\" fill=\"#697469\" font-size=\"12\">'+f(v)+'</text>';}\n if(lr[0]<0&&lr[1]>0)svg+='<line x1=\"'+pad.l+'\" y1=\"'+y(0)+'\" x2=\"'+(pad.l+w)+'\" y2=\"'+y(0)+'\" stroke=\"#abb7a5\"/>';\n const labels=scatter?(chart.axis.xTicks||Array.from({length:6},(_,i)=>xr[0]+(xr[1]-xr[0])*i/5)).map(v=>({x:v,text:f(v)})):(chart.labels||[]).map((text,i)=>({x:i,text})).filter((p,i,a)=>i===0||i===a.length-1||p.text==='0'||(a.length<=21&&String(p.text).length<=5)||i%Math.max(1,Math.ceil(a.length/(bar?8:7)))===0);\n for(const p of labels)svg+='<text x=\"'+x(p.x)+'\" y=\"'+(pad.t+h+23)+'\" text-anchor=\"middle\" font-size=\"11\" fill=\"#697469\">'+esc(p.text)+'</text>';\n svg+='<text x=\"'+pad.l+'\" y=\"47\" font-size=\"12\" fill=\"#697469\">'+esc(chart.yLabel||chart.unit||'%')+'</text>';\n if(chart.axis.right)svg+='<text x=\"'+(pad.l+w)+'\" y=\"47\" text-anchor=\"end\" font-size=\"12\" fill=\"#697469\">右轴 '+esc(chart.unit)+'</text>';\n if(chart.xLabel)svg+='<text x=\"'+(pad.l+w/2)+'\" y=\"'+(height-59)+'\" text-anchor=\"middle\" font-size=\"12\" fill=\"#697469\">'+esc(chart.xLabel)+'</text>';\n svg+='<g clip-path=\"url(#'+clipId+')\">';\n if(scatter&&showFit){const fit=computedFit?xr.map(xx=>({x:xx,y:computedFit.slope*xx+computedFit.intercept})):chart.drawnFit;if(fit?.length)svg+='<polyline points=\"'+fit.map(p=>x(p.x)+','+y(p.y)).join(' ')+'\" fill=\"none\" stroke=\"#627363\" stroke-dasharray=\"5 4\" stroke-width=\"1.8\"/>';}\n chart.series.forEach((series,si)=>{const color=series.color||'#4f81bd';if(bar){const bw=w/(xr[1]+1)*.7/chart.series.length;for(const p of series.points){if(!Number.isFinite(p.y))continue;const zero=y(Math.max(lr[0],Math.min(lr[1],0))),yy=y(p.y);svg+='<rect x=\"'+(x(p.x)-bw*chart.series.length/2+si*bw)+'\" y=\"'+Math.min(zero,yy)+'\" width=\"'+(bw-2)+'\" height=\"'+Math.max(1,Math.abs(zero-yy))+'\" fill=\"'+(p.color||color)+'\"><title>'+esc(series.name+' · '+p.label+'：'+p.y)+'</title></rect>';}}\n else if(scatter){for(const p of series.points)svg+='<circle cx=\"'+x(p.x)+'\" cy=\"'+y(p.y)+'\" r=\"4\" fill=\"'+(p.color||color)+'\" opacity=\".86\"><title>'+esc(p.label+'：x='+p.x+'，y='+p.y)+'</title></circle>';}\n else{let seg=[];const flush=()=>{if(seg.length)svg+='<polyline points=\"'+seg.map(p=>x(p.x)+','+y(p.y,series.axis)).join(' ')+'\" fill=\"none\" stroke=\"'+color+'\" stroke-width=\"'+(series.dashed?1.6:2.1)+'\" '+(series.dashed?'stroke-dasharray=\"5 4\"':'')+'/>';seg=[];};for(const p of series.points){if(Number.isFinite(p.y))seg.push(p);else flush();}flush();if(!series.dashed)for(const p of series.points)if(Number.isFinite(p.y))svg+='<circle cx=\"'+x(p.x)+'\" cy=\"'+y(p.y,series.axis)+'\" r=\"'+(series.points.length<25?3:2)+'\" fill=\"'+(p.color||color)+'\"><title>'+esc(series.name+' · '+p.label+'：'+p.y+(series.axis==='right'?'（右轴）':''))+'</title></circle>';}});\n svg+='</g>';\n let legends=chart.series.map(s=>({name:s.name,color:s.color||'#4f81bd',dashed:s.dashed}));\n if(scatter&&chart.page===24)legends=[{name:'2013—2019',color:'#4f81bd'},{name:'2023',color:'#ff0000'},{name:'2024（当时估计）',color:'#9bbb59'}];\n if(scatter&&chart.page===25)legends=[{name:'2000—2021',color:'#4f81bd'},{name:'2022—2023',color:'#ff0000'}];\n let lx=pad.l,ly=height-37;for(const item of legends){const name=item.name.replace(' · 原图趋势线','（趋势）');const tw=Array.from(name).reduce((s,c)=>s+(c.charCodeAt(0)>255?10:6),0)+30;if(lx+tw>width-pad.r){lx=pad.l;ly+=16;}\n svg+='<line x1=\"'+lx+'\" y1=\"'+(ly-4)+'\" x2=\"'+(lx+16)+'\" y2=\"'+(ly-4)+'\" stroke=\"'+item.color+'\" stroke-width=\"2\" '+(item.dashed?'stroke-dasharray=\"4 3\"':'')+'/><text x=\"'+(lx+21)+'\" y=\"'+ly+'\" fill=\"#697469\" font-size=\"11\">'+esc(name)+'</text>';lx+=tw;}\n svg+='<text x=\"'+pad.l+'\" y=\"'+(height-7)+'\" font-size=\"10\" fill=\"#87917f\">'+esc(chart.page?'原稿 P'+chart.page+' · 图中数值恢复 / 标注值 · 非原始底表复算':chart.provenance||'公开数据独立计算；来源与版本见网页说明')+'</text>';\n return svg+'</svg>';\n}\n\nconst speech=JSON.parse(document.getElementById('speech-initial').textContent);\nlet customCompanyResult=null;\nlet international=JSON.parse(document.getElementById('worldbank-initial').textContent),selectedSpeechPage=4,speechSection='全部';\nconst sp=id=>document.getElementById(id);const se=x=>String(x??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nconst sf=(v,n=2)=>Number.isFinite(v)?Number(v).toFixed(n):'缺失';\nfunction downloadSpeech(name,text,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}\nfunction currentSpeechChart(){return speech.charts.find(c=>c.page===selectedSpeechPage);}\nfunction renderSpeech(){\n const charts=speech.charts.filter(c=>speechSection==='全部'||c.section===speechSection);if(!charts.some(c=>c.page===selectedSpeechPage))selectedSpeechPage=charts[0].page;\n sp('speech-count').textContent='1 张分类表 + '+speech.charts.length+' 张统计图 · 演讲时点 2024-12-03';\n sp('speech-nav').innerHTML=charts.map(c=>'<button class=\"speech-step '+(c.page===selectedSpeechPage?'active':'')+'\" data-page=\"'+c.page+'\"><span>P'+c.page+'</span> '+se(c.title)+'</button>').join('');\n document.querySelectorAll('.speech-step').forEach(b=>b.onclick=()=>{selectedSpeechPage=Number(b.dataset.page);renderSpeech();});\n const c=currentSpeechChart();sp('speech-title').textContent=c.title;sp('speech-category').textContent=c.section+' · 原稿第 '+c.page+' 页 · '+c.fidelity;\n sp('speech-source').href=c.source;sp('speech-svg-download').href='/api/speech/charts/'+c.page+'.svg';\n sp('speech-method').textContent=c.method;sp('speech-limits').innerHTML=c.limits.map(x=>'<li>'+se(x)+'</li>').join('');\n let computedFit=null;\n if(c.kind==='scatter'){\n  let points=c.series[0].points.filter(p=>!(c.page===24&&['2023','2024（原图估计）'].includes(p.label))&&!(c.page===25&&['2022','2023'].includes(p.label)));\n  if(c.page===25&&sp('speech-exclude-2020').checked)points=points.filter(p=>p.label!=='2020');\n  const fit=speechOLS(points);computedFit=sp('speech-ols').checked?fit:null;\n  const printed=c.regression? '原稿标注：y='+sf(c.regression.slope)+'x '+(c.regression.intercept>=0?'+ ':'− ')+sf(Math.abs(c.regression.intercept))+(c.regression.r2!==undefined?'；R²='+sf(c.regression.r2):'')+(c.regression.p!==undefined?'；p='+sf(c.regression.p):c.regression.pText?'；'+c.regression.pText:''):'原稿未列方程';\n  sp('speech-regression').textContent=printed+'。恢复点复算：n='+fit.n+'，y='+sf(fit.slope,3)+'x '+(fit.intercept>=0?'+ ':'− ')+sf(Math.abs(fit.intercept),3)+'，R²='+sf(fit.r2,3)+'。复算用于核对图形，未当作原始数据库结果。';\n }else sp('speech-regression').textContent=c.axis.right?'该图保留左右两个坐标轴。右轴系列有单独单位标识，不能从线条高低直接比较数值。':'数值来自原图矢量坐标标定；不是实时行情，不是逐公司原始财务数据库。';\n sp('speech-ols-controls').style.display=c.kind==='scatter'?'flex':'none';sp('speech-2020-control').style.display=c.page===25?'inline':'none';\n sp('speech-chart').innerHTML=speechChartSVG(c,{showFit:sp('speech-fit').checked,computedFit});\n sp('speech-legend').innerHTML=c.series.map(s=>'<span><i style=\"background:'+(s.color||'#4f81bd')+'\"></i>'+se(s.name)+(s.axis==='right'?'（右轴）':'')+'</span>').join('');\n sp('speech-values').innerHTML=c.series.flatMap(s=>s.points.map(p=>'<tr><td>'+se(s.name)+'</td><td>'+se(p.label||p.x)+'</td><td>'+sf(p.x,3)+'</td><td>'+sf(p.y)+'</td><td>'+se(s.axis==='right'?'右轴':'左轴')+'</td></tr>')).join('');\n sp('speech-position').textContent=(charts.indexOf(c)+1)+' / '+charts.length;\n}\nfunction moveSpeech(delta){const list=speech.charts.filter(c=>speechSection==='全部'||c.section===speechSection);const i=list.findIndex(c=>c.page===selectedSpeechPage);selectedSpeechPage=list[(i+delta+list.length)%list.length].page;renderSpeech();}\nfunction renderClassification(){sp('speech-classification').innerHTML=speech.classification.map(g=>'<tr><td><strong>'+se(g.name)+'</strong></td><td>'+g.count+'</td><td>'+se(g.industries.join('、'))+'</td><td>'+se(g.countDetail||'原表合计，未附完整证券名单')+'</td></tr>').join('');}\nfunction renderEmploymentScenario(){\n const c=speech.charts.find(c=>c.page===19),actual=c.series[0].points,baseline=actual.find(p=>p.label==='2020').y,rate=Number(sp('employment-growth').value)/100;\n const gaps=[2021,2022,2023].map(year=>{const observed=actual.find(p=>p.label===String(year)).y,forecast=baseline*(1+rate)**(year-2020);return {year,observed,forecast,gap:forecast-observed};});\n sp('employment-growth-value').textContent=sf(rate*100,1)+'%';\n sp('employment-result').innerHTML='<p>按2020年图中存量起算，假定每年增长 '+sf(rate*100,1)+'%，三年相对该路径的存量差之和为 <strong>'+sf(gaps.reduce((s,g)=>s+g.gap,0),0)+' 万人年</strong>。</p><p class=\"fine\">原图给出的三项差值为472、2236、2001，合计4709。它们不是4709万个已去重的个人；更换基准增长率会改变结果。此滑块是独立敏感性演示，未冒充作者趋势模型。</p>';\n sp('employment-details').innerHTML=gaps.map(g=>'<tr><td>'+g.year+'</td><td>'+sf(g.observed,0)+'</td><td>'+sf(g.forecast,0)+'</td><td>'+sf(g.gap,0)+'</td></tr>').join('');\n}\nfunction renderInflationScenario(){\n const c=speech.charts.find(c=>c.page===24),fit=speechOLS(c.series[0].points.filter(p=>p.label.startsWith('2013'))),year=sp('inflation-year').value,point=c.series[0].points.find(p=>p.label.startsWith(year)),adjustment=Number(sp('growth-adjustment').value),gap=point.x-adjustment,prediction=fit.slope*gap+fit.intercept;\n sp('growth-adjustment-value').textContent=sf(adjustment,1)+' 个百分点';\n sp('inflation-result').innerHTML='<p>使用恢复的2013—2019点拟合：核心CPI ≈ '+sf(fit.slope,3)+' × 产出缺口 + '+sf(fit.intercept,3)+'。</p><p>原图该年x≈'+sf(point.x)+'，核心CPI≈'+sf(point.y)+'%；按滑块调整后，模型预测 '+sf(prediction)+'%，与图中通胀差 '+sf(prediction-point.y)+' 个百分点。</p><p class=\"fine\">这只是给定潜在增长假设后的回归外推。该单一关系所隐含的增长调整约 '+sf((fit.slope*point.x+fit.intercept-point.y)/fit.slope)+' 个百分点；不能由此证明每年统一下修3个百分点。原图年份位置与脚注顺序还存在冲突。</p>';\n}\nfunction renderInternational(){\n const model=worldbankEvents(international,sp('event-window').value),original=speech.charts.find(c=>c.page===28),comparison={id:'worldbank-events',title:'公开WDI数据的事件窗口复算',kind:'bar',unit:'百分点',labels:model.events.map(e=>e.label),axis:{left:[-8,1]},series:[{name:'原图恢复值（当时估计）',color:'#9bada0',points:original.series[0].points},{name:'WDI 当前版本独立复算',color:'#315f48',points:model.events.map((e,i)=>({x:i,label:e.label,y:e.difference}))}]};\n sp('international-chart').innerHTML=speechChartSVG(comparison);\n const originalChina=speech.charts.find(c=>c.page===29).series[1].points,mean=a=>a.reduce((t,p)=>t+p.y,0)/a.length,post=mean(originalChina.slice(11,14)),included=post-mean(originalChina.slice(8,11)),excluded=post-mean(originalChina.slice(7,10));\n sp('event-window-audit').textContent='原图内部核对：中国路径前窗含0时（2019—2021对2022—2024），差值约 '+sf(included,3)+' 个百分点，与原图柱值−0.18接近；前窗不含0（2018—2020）则为 '+sf(excluded,3)+'。这只验证中国路径的窗口敏感性，不能据此认定所有历史事件的原始计算规则。';\n sp('international-status').textContent='WDI 数据更新 '+international.lastUpdated+' · 抓取 '+new Date(international.retrievedAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Singapore'})+' · '+(international.status==='live'?'在线核验成功':'核验存档');\n sp('international-values').innerHTML=model.events.map(e=>'<tr><td>'+e.label+'</td><td>'+e.preYears.join('、')+'</td><td>'+sf(e.before)+'</td><td>'+e.postYears.join('、')+'</td><td>'+sf(e.after)+'</td><td>'+sf(e.difference)+'</td></tr>').join('');\n const p={id:'worldbank-path',title:'事件时间路径：当前WDI版本',kind:'line',unit:'%',labels:Array.from({length:21},(_,i)=>String(i-10)),axis:{left:[-4,10]},series:[{name:'七次危机等权平均',color:'#b5523f',points:model.averagePath},{name:'中国（2021=0）',color:'#315f48',points:model.events[0].path}]};\n sp('international-path').innerHTML=speechChartSVG(p);sp('worldbank-source').href=international.source;\n}\nasync function refreshInternational(force=false){sp('worldbank-refresh').disabled=true;try{const r=await fetch('/api/worldbank'+(force?'?refresh=1':''),{cache:'no-store'});if(!r.ok)throw Error();const d=await r.json();if(!d.observations?.length)throw Error();international=d;renderInternational();}catch{sp('international-status').textContent+=' · 本次在线检查失败，继续使用核验存档';}finally{sp('worldbank-refresh').disabled=false;}}\nsp('speech-section').onchange=()=>{speechSection=sp('speech-section').value;renderSpeech()};sp('speech-prev').onclick=()=>moveSpeech(-1);sp('speech-next').onclick=()=>moveSpeech(1);\nsp('speech-fit').onchange=renderSpeech;sp('speech-ols').onchange=renderSpeech;sp('speech-exclude-2020').onchange=renderSpeech;\nsp('speech-csv').onclick=()=>{const c=currentSpeechChart();const rows=['series,observation,x,y,axis,source_page'];for(const s of c.series)for(const p of s.points)rows.push([s.name,p.label||p.x,p.x,p.y,s.axis||'left',c.page].map(v=>'\"'+String(v).replace(/\"/g,'\"\"')+'\"').join(','));downloadSpeech('speech-page-'+c.page+'.csv','\\uFEFF'+rows.join('\\n'),'text/csv;charset=utf-8')};\nsp('speech-all-download').onclick=()=>downloadSpeech('speech-reconstruction.json',JSON.stringify(speech,null,2),'application/json');\nsp('employment-growth').oninput=renderEmploymentScenario;sp('inflation-year').onchange=renderInflationScenario;sp('growth-adjustment').oninput=renderInflationScenario;\nsp('event-window').onchange=renderInternational;sp('worldbank-refresh').onclick=()=>refreshInternational(true);sp('worldbank-download').onclick=()=>downloadSpeech('worldbank-event-recalculation.json',JSON.stringify({data:international,calculation:worldbankEvents(international,sp('event-window').value)},null,2),'application/json');\nsp('company-template').onclick=()=>downloadSpeech('company-fixed-sample-template.csv','company_id,security_id,market,group,period,revenue_cny,market_cap_cny,employees\\n','text/csv;charset=utf-8');\nsp('company-file').onchange=async()=>{const f=sp('company-file').files[0];if(!f)return;try{if(f.size>10000000)throw Error('文件最大10MB');const result=sampleAggregation(parseCompanyCSV(await f.text()));customCompanyResult=result;sp('company-result-metric').style.display='inline-block';renderCompanyChart();sp('company-output').textContent='计算成功：'+result.companies+'家公司，'+result.periods.length+'期。'+result.scope+'。记录中只计算可核验的营收/市值占比及同口径增速，不构造缺少原权重的股价指数。';sp('company-result-table').innerHTML='<table><thead><tr><th>期间</th><th>类别</th><th>营收占比</th><th>市值占比</th><th>营收同比</th><th>员工同比</th></tr></thead><tbody>'+result.rows.map(r=>'<tr><td>'+se(r.period)+'</td><td>'+se(r.group)+'</td><td>'+sf(r.revenueShare)+'%</td><td>'+sf(r.capShare)+'%</td><td>'+sf(r.revenueYoY)+(r.revenueYoY===null?'':'%')+'</td><td>'+sf(r.employeeYoY)+(r.employeeYoY===null?'':'%')+'</td></tr>').join('')+'</tbody></table>';}catch(e){sp('company-output').textContent='未计算：'+e.message;sp('company-result-table').innerHTML='';sp('company-result-chart').innerHTML='';sp('company-result-metric').style.display='none';}};\nrenderClassification();renderSpeech();renderEmploymentScenario();renderInflationScenario();renderInternational();refreshInternational();\n\nfunction renderCompanyChart(){if(!customCompanyResult)return;const id=sp('company-result-metric').value||'revenueShare',names={revenueShare:'自定义样本营业收入占比',capShare:'自定义样本市值占比',revenueYoY:'自定义样本营收同比',employeeYoY:'自定义样本员工同比'},result=customCompanyResult;const chart={id:'custom-company',title:names[id],provenance:'用户导入的自定义固定样本；未与原作者名单核对',kind:'line',unit:'%',labels:result.periods,axis:{left:id.endsWith('Share')?[0,100]:[-10,30]},series:['支持','中性','限制'].map((group,j)=>({name:group,color:['#cc5147','#649455','#2478ac'][j],points:result.periods.map((period,i)=>({x:i,label:period,y:result.rows.find(r=>r.period===period&&r.group===group)?.[id]??null}))}))};sp('company-result-chart').innerHTML=speechChartSVG(chart);}\nsp('company-result-metric').onchange=renderCompanyChart;\n</script><script type=\"application/json\" id=\"initial-data\">{\n  \"annual\": [\n    {\n      \"year\": 2012,\n      \"kind\": \"annual\",\n      \"title\": \"2012年度经济观察报告\",\n      \"period\": \"2012年全年\",\n      \"published\": \"2013-02-22\",\n      \"fetchedAt\": \"2026-10-25T21:32:36.556Z\",\n      \"source\": \"https://www.stats.gov.cn/sj/tjgb/ndtjgb/qgndtjgb/202302/t20230206_1901956.html\",\n      \"sourceTitle\": \"中华人民共和国2012年国民经济和社会发展统计公报\",\n      \"notes\": [\n        \"采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。\",\n        \"调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。\",\n        \"全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。\"\n      ],\n      \"metrics\": [\n        {\n          \"id\": \"gdp\",\n          \"label\": \"实际 GDP\",\n          \"value\": 7.8,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2012年全年\"\n        },\n        {\n          \"id\": \"retail\",\n          \"label\": \"社会消费品零售\",\n          \"value\": 14.3,\n          \"basis\": \"全年名义同比\",\n          \"period\": \"2012年全年\"\n        },\n        {\n          \"id\": \"unemployment\",\n          \"label\": \"城镇调查失业率\",\n          \"value\": null,\n          \"basis\": \"全年平均值\",\n          \"period\": \"2012年全年\",\n          \"missingReason\": \"该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。\"\n        },\n        {\n          \"id\": \"cpi\",\n          \"label\": \"居民消费价格 CPI\",\n          \"value\": 2.6,\n          \"basis\": \"全年同比\",\n          \"period\": \"2012年全年\"\n        },\n        {\n          \"id\": \"property\",\n          \"label\": \"房地产开发投资\",\n          \"value\": 16.2,\n          \"basis\": \"全年同比\",\n          \"period\": \"2012年全年\"\n        },\n        {\n          \"id\": \"sales\",\n          \"label\": \"商品房销售面积\",\n          \"value\": 1.8,\n          \"basis\": \"全年同比\",\n          \"period\": \"2012年全年\"\n        },\n        {\n          \"id\": \"industry\",\n          \"label\": \"规模以上工业增加值\",\n          \"value\": 10,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2012年全年\"\n        },\n        {\n          \"id\": \"income\",\n          \"label\": \"居民人均可支配收入\",\n          \"value\": null,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2012年全年\",\n          \"missingReason\": \"该公报未列同口径全国居民实际同比；城乡分组指标不替代全国指标。\"\n        },\n        {\n          \"id\": \"spending\",\n          \"label\": \"居民人均消费支出\",\n          \"value\": null,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2012年全年\",\n          \"missingReason\": \"该公报未列同口径全国居民实际同比；城乡分组指标不替代全国指标。\"\n        }\n      ]\n    },\n    {\n      \"year\": 2013,\n      \"kind\": \"annual\",\n      \"title\": \"2013年度经济观察报告\",\n      \"period\": \"2013年全年\",\n      \"published\": \"2014-02-24\",\n      \"fetchedAt\": \"2026-10-25T21:32:36.566Z\",\n      \"source\": \"https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1898455.html\",\n      \"sourceTitle\": \"中华人民共和国2013年国民经济和社会发展统计公报\",\n      \"notes\": [\n        \"采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。\",\n        \"调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。\",\n        \"全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。\"\n      ],\n      \"metrics\": [\n        {\n          \"id\": \"gdp\",\n          \"label\": \"实际 GDP\",\n          \"value\": 7.7,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2013年全年\"\n        },\n        {\n          \"id\": \"retail\",\n          \"label\": \"社会消费品零售\",\n          \"value\": 13.1,\n          \"basis\": \"全年名义同比\",\n          \"period\": \"2013年全年\"\n        },\n        {\n          \"id\": \"unemployment\",\n          \"label\": \"城镇调查失业率\",\n          \"value\": null,\n          \"basis\": \"全年平均值\",\n          \"period\": \"2013年全年\",\n          \"missingReason\": \"该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。\"\n        },\n        {\n          \"id\": \"cpi\",\n          \"label\": \"居民消费价格 CPI\",\n          \"value\": 2.6,\n          \"basis\": \"全年同比\",\n          \"period\": \"2013年全年\"\n        },\n        {\n          \"id\": \"property\",\n          \"label\": \"房地产开发投资\",\n          \"value\": 19.8,\n          \"basis\": \"全年同比\",\n          \"period\": \"2013年全年\"\n        },\n        {\n          \"id\": \"sales\",\n          \"label\": \"商品房销售面积\",\n          \"value\": 17.3,\n          \"basis\": \"全年同比\",\n          \"period\": \"2013年全年\"\n        },\n        {\n          \"id\": \"industry\",\n          \"label\": \"规模以上工业增加值\",\n          \"value\": 9.7,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2013年全年\"\n        },\n        {\n          \"id\": \"income\",\n          \"label\": \"居民人均可支配收入\",\n          \"value\": 8.1,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2013年全年\"\n        },\n        {\n          \"id\": \"spending\",\n          \"label\": \"居民人均消费支出\",\n          \"value\": null,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2013年全年\",\n          \"missingReason\": \"该公报未列同口径全国居民实际同比；城乡分组指标不替代全国指标。\"\n        }\n      ]\n    },\n    {\n      \"year\": 2014,\n      \"kind\": \"annual\",\n      \"title\": \"2014年度经济观察报告\",\n      \"period\": \"2014年全年\",\n      \"published\": \"2015-02-26\",\n      \"fetchedAt\": \"2026-10-25T21:32:36.574Z\",\n      \"source\": \"https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1898704.html\",\n      \"sourceTitle\": \"中华人民共和国2014年国民经济和社会发展统计公报\",\n      \"notes\": [\n        \"采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。\",\n        \"调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。\",\n        \"全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。\"\n      ],\n      \"metrics\": [\n        {\n          \"id\": \"gdp\",\n          \"label\": \"实际 GDP\",\n          \"value\": 7.4,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2014年全年\"\n        },\n        {\n          \"id\": \"retail\",\n          \"label\": \"社会消费品零售\",\n          \"value\": 12,\n          \"basis\": \"全年名义同比\",\n          \"period\": \"2014年全年\"\n        },\n        {\n          \"id\": \"unemployment\",\n          \"label\": \"城镇调查失业率\",\n          \"value\": null,\n          \"basis\": \"全年平均值\",\n          \"period\": \"2014年全年\",\n          \"missingReason\": \"该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。\"\n        },\n        {\n          \"id\": \"cpi\",\n          \"label\": \"居民消费价格 CPI\",\n          \"value\": 2,\n          \"basis\": \"全年同比\",\n          \"period\": \"2014年全年\"\n        },\n        {\n          \"id\": \"property\",\n          \"label\": \"房地产开发投资\",\n          \"value\": 10.5,\n          \"basis\": \"全年同比\",\n          \"period\": \"2014年全年\"\n        },\n        {\n          \"id\": \"sales\",\n          \"label\": \"商品房销售面积\",\n          \"value\": -7.6,\n          \"basis\": \"全年同比\",\n          \"period\": \"2014年全年\"\n        },\n        {\n          \"id\": \"industry\",\n          \"label\": \"规模以上工业增加值\",\n          \"value\": 8.3,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2014年全年\"\n        },\n        {\n          \"id\": \"income\",\n          \"label\": \"居民人均可支配收入\",\n          \"value\": 8,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2014年全年\"\n        },\n        {\n          \"id\": \"spending\",\n          \"label\": \"居民人均消费支出\",\n          \"value\": 7.5,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2014年全年\"\n        }\n      ]\n    },\n    {\n      \"year\": 2015,\n      \"kind\": \"annual\",\n      \"title\": \"2015年度经济观察报告\",\n      \"period\": \"2015年全年\",\n      \"published\": \"2016-02-29\",\n      \"fetchedAt\": \"2026-10-25T21:32:36.583Z\",\n      \"source\": \"https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1899041.html\",\n      \"sourceTitle\": \"中华人民共和国2015年国民经济和社会发展统计公报\",\n      \"notes\": [\n        \"采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。\",\n        \"调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。\",\n        \"全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。\"\n      ],\n      \"metrics\": [\n        {\n          \"id\": \"gdp\",\n          \"label\": \"实际 GDP\",\n          \"value\": 6.9,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2015年全年\"\n        },\n        {\n          \"id\": \"retail\",\n          \"label\": \"社会消费品零售\",\n          \"value\": 10.7,\n          \"basis\": \"全年名义同比\",\n          \"period\": \"2015年全年\"\n        },\n        {\n          \"id\": \"unemployment\",\n          \"label\": \"城镇调查失业率\",\n          \"value\": null,\n          \"basis\": \"全年平均值\",\n          \"period\": \"2015年全年\",\n          \"missingReason\": \"该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。\"\n        },\n        {\n          \"id\": \"cpi\",\n          \"label\": \"居民消费价格 CPI\",\n          \"value\": 1.4,\n          \"basis\": \"全年同比\",\n          \"period\": \"2015年全年\"\n        },\n        {\n          \"id\": \"property\",\n          \"label\": \"房地产开发投资\",\n          \"value\": 1,\n          \"basis\": \"全年同比\",\n          \"period\": \"2015年全年\"\n        },\n        {\n          \"id\": \"sales\",\n          \"label\": \"商品房销售面积\",\n          \"value\": 6.5,\n          \"basis\": \"全年同比\",\n          \"period\": \"2015年全年\"\n        },\n        {\n          \"id\": \"industry\",\n          \"label\": \"规模以上工业增加值\",\n          \"value\": 6.1,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2015年全年\"\n        },\n        {\n          \"id\": \"income\",\n          \"label\": \"居民人均可支配收入\",\n          \"value\": 7.4,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2015年全年\"\n        },\n        {\n          \"id\": \"spending\",\n          \"label\": \"居民人均消费支出\",\n          \"value\": 6.9,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2015年全年\"\n        }\n      ]\n    },\n    {\n      \"year\": 2016,\n      \"kind\": \"annual\",\n      \"title\": \"2016年度经济观察报告\",\n      \"period\": \"2016年全年\",\n      \"published\": \"2017-02-28\",\n      \"fetchedAt\": \"2026-10-25T21:32:36.591Z\",\n      \"source\": \"https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1899428.html\",\n      \"sourceTitle\": \"中华人民共和国2016年国民经济和社会发展统计公报\",\n      \"notes\": [\n        \"采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。\",\n        \"调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。\",\n        \"全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。\"\n      ],\n      \"metrics\": [\n        {\n          \"id\": \"gdp\",\n          \"label\": \"实际 GDP\",\n          \"value\": 6.7,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2016年全年\"\n        },\n        {\n          \"id\": \"retail\",\n          \"label\": \"社会消费品零售\",\n          \"value\": 10.4,\n          \"basis\": \"全年名义同比\",\n          \"period\": \"2016年全年\"\n        },\n        {\n          \"id\": \"unemployment\",\n          \"label\": \"城镇调查失业率\",\n          \"value\": null,\n          \"basis\": \"全年平均值\",\n          \"period\": \"2016年全年\",\n          \"missingReason\": \"该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。\"\n        },\n        {\n          \"id\": \"cpi\",\n          \"label\": \"居民消费价格 CPI\",\n          \"value\": 2,\n          \"basis\": \"全年同比\",\n          \"period\": \"2016年全年\"\n        },\n        {\n          \"id\": \"property\",\n          \"label\": \"房地产开发投资\",\n          \"value\": 6.9,\n          \"basis\": \"全年同比\",\n          \"period\": \"2016年全年\"\n        },\n        {\n          \"id\": \"sales\",\n          \"label\": \"商品房销售面积\",\n          \"value\": 22.5,\n          \"basis\": \"全年同比\",\n          \"period\": \"2016年全年\"\n        },\n        {\n          \"id\": \"industry\",\n          \"label\": \"规模以上工业增加值\",\n          \"value\": 6,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2016年全年\"\n        },\n        {\n          \"id\": \"income\",\n          \"label\": \"居民人均可支配收入\",\n          \"value\": 6.3,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2016年全年\"\n        },\n        {\n          \"id\": \"spending\",\n          \"label\": \"居民人均消费支出\",\n          \"value\": 6.8,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2016年全年\"\n        }\n      ]\n    },\n    {\n      \"year\": 2017,\n      \"kind\": \"annual\",\n      \"title\": \"2017年度经济观察报告\",\n      \"period\": \"2017年全年\",\n      \"published\": \"2018-02-28\",\n      \"fetchedAt\": \"2026-10-25T21:32:36.599Z\",\n      \"source\": \"https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1899855.html\",\n      \"sourceTitle\": \"中华人民共和国2017年国民经济和社会发展统计公报\",\n      \"notes\": [\n        \"采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。\",\n        \"调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。\",\n        \"全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。\"\n      ],\n      \"metrics\": [\n        {\n          \"id\": \"gdp\",\n          \"label\": \"实际 GDP\",\n          \"value\": 6.9,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2017年全年\"\n        },\n        {\n          \"id\": \"retail\",\n          \"label\": \"社会消费品零售\",\n          \"value\": 10.2,\n          \"basis\": \"全年名义同比\",\n          \"period\": \"2017年全年\"\n        },\n        {\n          \"id\": \"unemployment\",\n          \"label\": \"城镇调查失业率\",\n          \"value\": null,\n          \"basis\": \"全年平均值\",\n          \"period\": \"2017年全年\",\n          \"missingReason\": \"该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。\"\n        },\n        {\n          \"id\": \"cpi\",\n          \"label\": \"居民消费价格 CPI\",\n          \"value\": 1.6,\n          \"basis\": \"全年同比\",\n          \"period\": \"2017年全年\"\n        },\n        {\n          \"id\": \"property\",\n          \"label\": \"房地产开发投资\",\n          \"value\": 7,\n          \"basis\": \"全年同比\",\n          \"period\": \"2017年全年\"\n        },\n        {\n          \"id\": \"sales\",\n          \"label\": \"商品房销售面积\",\n          \"value\": 7.7,\n          \"basis\": \"全年同比\",\n          \"period\": \"2017年全年\"\n        },\n        {\n          \"id\": \"industry\",\n          \"label\": \"规模以上工业增加值\",\n          \"value\": 6.6,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2017年全年\"\n        },\n        {\n          \"id\": \"income\",\n          \"label\": \"居民人均可支配收入\",\n          \"value\": 7.3,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2017年全年\"\n        },\n        {\n          \"id\": \"spending\",\n          \"label\": \"居民人均消费支出\",\n          \"value\": 5.4,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2017年全年\"\n        }\n      ]\n    },\n    {\n      \"year\": 2018,\n      \"kind\": \"annual\",\n      \"title\": \"2018年度经济观察报告\",\n      \"period\": \"2018年全年\",\n      \"published\": \"2019-02-28\",\n      \"fetchedAt\": \"2026-10-25T21:32:36.608Z\",\n      \"source\": \"https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1900241.html\",\n      \"sourceTitle\": \"中华人民共和国2018年国民经济和社会发展统计公报\",\n      \"notes\": [\n        \"采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。\",\n        \"调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。\",\n        \"全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。\"\n      ],\n      \"metrics\": [\n        {\n          \"id\": \"gdp\",\n          \"label\": \"实际 GDP\",\n          \"value\": 6.6,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2018年全年\"\n        },\n        {\n          \"id\": \"retail\",\n          \"label\": \"社会消费品零售\",\n          \"value\": 9,\n          \"basis\": \"全年名义同比\",\n          \"period\": \"2018年全年\"\n        },\n        {\n          \"id\": \"unemployment\",\n          \"label\": \"城镇调查失业率\",\n          \"value\": null,\n          \"basis\": \"全年平均值\",\n          \"period\": \"2018年全年\",\n          \"missingReason\": \"该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。\"\n        },\n        {\n          \"id\": \"cpi\",\n          \"label\": \"居民消费价格 CPI\",\n          \"value\": 2.1,\n          \"basis\": \"全年同比\",\n          \"period\": \"2018年全年\"\n        },\n        {\n          \"id\": \"property\",\n          \"label\": \"房地产开发投资\",\n          \"value\": 9.5,\n          \"basis\": \"全年同比\",\n          \"period\": \"2018年全年\"\n        },\n        {\n          \"id\": \"sales\",\n          \"label\": \"商品房销售面积\",\n          \"value\": 1.3,\n          \"basis\": \"全年同比\",\n          \"period\": \"2018年全年\"\n        },\n        {\n          \"id\": \"industry\",\n          \"label\": \"规模以上工业增加值\",\n          \"value\": 6.2,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2018年全年\"\n        },\n        {\n          \"id\": \"income\",\n          \"label\": \"居民人均可支配收入\",\n          \"value\": 6.5,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2018年全年\"\n        },\n        {\n          \"id\": \"spending\",\n          \"label\": \"居民人均消费支出\",\n          \"value\": 6.2,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2018年全年\"\n        }\n      ]\n    },\n    {\n      \"year\": 2019,\n      \"kind\": \"annual\",\n      \"title\": \"2019年度经济观察报告\",\n      \"period\": \"2019年全年\",\n      \"published\": \"2020-02-28\",\n      \"fetchedAt\": \"2026-10-25T21:32:36.617Z\",\n      \"source\": \"https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1900640.html\",\n      \"sourceTitle\": \"中华人民共和国2019年国民经济和社会发展统计公报\",\n      \"notes\": [\n        \"采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。\",\n        \"调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。\",\n        \"全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。\"\n      ],\n      \"metrics\": [\n        {\n          \"id\": \"gdp\",\n          \"label\": \"实际 GDP\",\n          \"value\": 6.1,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2019年全年\"\n        },\n        {\n          \"id\": \"retail\",\n          \"label\": \"社会消费品零售\",\n          \"value\": 8,\n          \"basis\": \"全年名义同比\",\n          \"period\": \"2019年全年\"\n        },\n        {\n          \"id\": \"unemployment\",\n          \"label\": \"城镇调查失业率\",\n          \"value\": null,\n          \"basis\": \"全年平均值\",\n          \"period\": \"2019年全年\",\n          \"missingReason\": \"该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。\"\n        },\n        {\n          \"id\": \"cpi\",\n          \"label\": \"居民消费价格 CPI\",\n          \"value\": 2.9,\n          \"basis\": \"全年同比\",\n          \"period\": \"2019年全年\"\n        },\n        {\n          \"id\": \"property\",\n          \"label\": \"房地产开发投资\",\n          \"value\": 9.9,\n          \"basis\": \"全年同比\",\n          \"period\": \"2019年全年\"\n        },\n        {\n          \"id\": \"sales\",\n          \"label\": \"商品房销售面积\",\n          \"value\": -0.1,\n          \"basis\": \"全年同比\",\n          \"period\": \"2019年全年\"\n        },\n        {\n          \"id\": \"industry\",\n          \"label\": \"规模以上工业增加值\",\n          \"value\": 5.7,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2019年全年\"\n        },\n        {\n          \"id\": \"income\",\n          \"label\": \"居民人均可支配收入\",\n          \"value\": 5.8,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2019年全年\"\n        },\n        {\n          \"id\": \"spending\",\n          \"label\": \"居民人均消费支出\",\n          \"value\": 5.5,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2019年全年\"\n        }\n      ]\n    },\n    {\n      \"year\": 2020,\n      \"kind\": \"annual\",\n      \"title\": \"2020年度经济观察报告\",\n      \"period\": \"2020年全年\",\n      \"published\": \"2021-02-28\",\n      \"fetchedAt\": \"2026-10-25T21:32:36.626Z\",\n      \"source\": \"https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1901004.html\",\n      \"sourceTitle\": \"中华人民共和国2020年国民经济和社会发展统计公报\",\n      \"notes\": [\n        \"采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。\",\n        \"调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。\",\n        \"全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。\"\n      ],\n      \"metrics\": [\n        {\n          \"id\": \"gdp\",\n          \"label\": \"实际 GDP\",\n          \"value\": 2.3,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2020年全年\"\n        },\n        {\n          \"id\": \"retail\",\n          \"label\": \"社会消费品零售\",\n          \"value\": -3.9,\n          \"basis\": \"全年名义同比\",\n          \"period\": \"2020年全年\"\n        },\n        {\n          \"id\": \"unemployment\",\n          \"label\": \"城镇调查失业率\",\n          \"value\": null,\n          \"basis\": \"全年平均值\",\n          \"period\": \"2020年全年\",\n          \"missingReason\": \"该公报未列全国城镇调查失业率全年平均值；登记失业率和年末调查值不替代全年均值。\"\n        },\n        {\n          \"id\": \"cpi\",\n          \"label\": \"居民消费价格 CPI\",\n          \"value\": 2.5,\n          \"basis\": \"全年同比\",\n          \"period\": \"2020年全年\"\n        },\n        {\n          \"id\": \"property\",\n          \"label\": \"房地产开发投资\",\n          \"value\": 7,\n          \"basis\": \"全年同比\",\n          \"period\": \"2020年全年\"\n        },\n        {\n          \"id\": \"sales\",\n          \"label\": \"商品房销售面积\",\n          \"value\": 2.6,\n          \"basis\": \"全年同比\",\n          \"period\": \"2020年全年\"\n        },\n        {\n          \"id\": \"industry\",\n          \"label\": \"规模以上工业增加值\",\n          \"value\": 2.8,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2020年全年\"\n        },\n        {\n          \"id\": \"income\",\n          \"label\": \"居民人均可支配收入\",\n          \"value\": 2.1,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2020年全年\"\n        },\n        {\n          \"id\": \"spending\",\n          \"label\": \"居民人均消费支出\",\n          \"value\": -4,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2020年全年\"\n        }\n      ]\n    },\n    {\n      \"year\": 2021,\n      \"kind\": \"annual\",\n      \"title\": \"2021年度经济观察报告\",\n      \"period\": \"2021年全年\",\n      \"published\": \"2022-02-28\",\n      \"fetchedAt\": \"2026-10-25T21:32:36.634Z\",\n      \"source\": \"https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1901393.html\",\n      \"sourceTitle\": \"中华人民共和国2021年国民经济和社会发展统计公报\",\n      \"notes\": [\n        \"采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。\",\n        \"调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。\",\n        \"全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。\",\n        \"2021年含低基数影响；本页列一年同比，不以两年平均增速替代。\"\n      ],\n      \"metrics\": [\n        {\n          \"id\": \"gdp\",\n          \"label\": \"实际 GDP\",\n          \"value\": 8.1,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2021年全年\"\n        },\n        {\n          \"id\": \"retail\",\n          \"label\": \"社会消费品零售\",\n          \"value\": 12.5,\n          \"basis\": \"全年名义同比\",\n          \"period\": \"2021年全年\"\n        },\n        {\n          \"id\": \"unemployment\",\n          \"label\": \"城镇调查失业率\",\n          \"value\": 5.1,\n          \"basis\": \"全年平均值\",\n          \"period\": \"2021年全年\"\n        },\n        {\n          \"id\": \"cpi\",\n          \"label\": \"居民消费价格 CPI\",\n          \"value\": 0.9,\n          \"basis\": \"全年同比\",\n          \"period\": \"2021年全年\"\n        },\n        {\n          \"id\": \"property\",\n          \"label\": \"房地产开发投资\",\n          \"value\": 4.4,\n          \"basis\": \"全年同比\",\n          \"period\": \"2021年全年\"\n        },\n        {\n          \"id\": \"sales\",\n          \"label\": \"商品房销售面积\",\n          \"value\": 1.9,\n          \"basis\": \"全年同比\",\n          \"period\": \"2021年全年\"\n        },\n        {\n          \"id\": \"industry\",\n          \"label\": \"规模以上工业增加值\",\n          \"value\": 9.6,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2021年全年\"\n        },\n        {\n          \"id\": \"income\",\n          \"label\": \"居民人均可支配收入\",\n          \"value\": 8.1,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2021年全年\"\n        },\n        {\n          \"id\": \"spending\",\n          \"label\": \"居民人均消费支出\",\n          \"value\": 12.6,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2021年全年\"\n        }\n      ]\n    },\n    {\n      \"year\": 2022,\n      \"kind\": \"annual\",\n      \"title\": \"2022年度经济观察报告\",\n      \"period\": \"2022年全年\",\n      \"published\": \"2023-02-28\",\n      \"fetchedAt\": \"2026-10-25T21:32:36.645Z\",\n      \"source\": \"https://www.stats.gov.cn/sj/zxfb/202302/t20230228_1919011.html\",\n      \"sourceTitle\": \"中华人民共和国2022年国民经济和社会发展统计公报\",\n      \"notes\": [\n        \"采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。\",\n        \"调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。\",\n        \"全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。\"\n      ],\n      \"metrics\": [\n        {\n          \"id\": \"gdp\",\n          \"label\": \"实际 GDP\",\n          \"value\": 3,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2022年全年\"\n        },\n        {\n          \"id\": \"retail\",\n          \"label\": \"社会消费品零售\",\n          \"value\": -0.2,\n          \"basis\": \"全年名义同比\",\n          \"period\": \"2022年全年\"\n        },\n        {\n          \"id\": \"unemployment\",\n          \"label\": \"城镇调查失业率\",\n          \"value\": 5.6,\n          \"basis\": \"全年平均值\",\n          \"period\": \"2022年全年\"\n        },\n        {\n          \"id\": \"cpi\",\n          \"label\": \"居民消费价格 CPI\",\n          \"value\": 2,\n          \"basis\": \"全年同比\",\n          \"period\": \"2022年全年\"\n        },\n        {\n          \"id\": \"property\",\n          \"label\": \"房地产开发投资\",\n          \"value\": -10,\n          \"basis\": \"全年同比\",\n          \"period\": \"2022年全年\"\n        },\n        {\n          \"id\": \"sales\",\n          \"label\": \"商品房销售面积\",\n          \"value\": -24.3,\n          \"basis\": \"全年同比\",\n          \"period\": \"2022年全年\"\n        },\n        {\n          \"id\": \"industry\",\n          \"label\": \"规模以上工业增加值\",\n          \"value\": 3.6,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2022年全年\"\n        },\n        {\n          \"id\": \"income\",\n          \"label\": \"居民人均可支配收入\",\n          \"value\": 2.9,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2022年全年\"\n        },\n        {\n          \"id\": \"spending\",\n          \"label\": \"居民人均消费支出\",\n          \"value\": -0.2,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2022年全年\"\n        }\n      ]\n    },\n    {\n      \"year\": 2023,\n      \"kind\": \"annual\",\n      \"title\": \"2023年度经济观察报告\",\n      \"period\": \"2023年全年\",\n      \"published\": \"2024-02-29\",\n      \"fetchedAt\": \"2026-10-25T21:32:36.652Z\",\n      \"source\": \"https://www.stats.gov.cn/sj/zxfb/202402/t20240228_1947915.html\",\n      \"sourceTitle\": \"中华人民共和国2023年国民经济和社会发展统计公报\",\n      \"notes\": [\n        \"采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。\",\n        \"调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。\",\n        \"全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。\"\n      ],\n      \"metrics\": [\n        {\n          \"id\": \"gdp\",\n          \"label\": \"实际 GDP\",\n          \"value\": 5.2,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2023年全年\"\n        },\n        {\n          \"id\": \"retail\",\n          \"label\": \"社会消费品零售\",\n          \"value\": 7.2,\n          \"basis\": \"全年名义同比\",\n          \"period\": \"2023年全年\"\n        },\n        {\n          \"id\": \"unemployment\",\n          \"label\": \"城镇调查失业率\",\n          \"value\": 5.2,\n          \"basis\": \"全年平均值\",\n          \"period\": \"2023年全年\"\n        },\n        {\n          \"id\": \"cpi\",\n          \"label\": \"居民消费价格 CPI\",\n          \"value\": 0.2,\n          \"basis\": \"全年同比\",\n          \"period\": \"2023年全年\"\n        },\n        {\n          \"id\": \"property\",\n          \"label\": \"房地产开发投资\",\n          \"value\": -9.6,\n          \"basis\": \"全年同比\",\n          \"period\": \"2023年全年\"\n        },\n        {\n          \"id\": \"sales\",\n          \"label\": \"新建商品房销售面积\",\n          \"value\": -8.5,\n          \"basis\": \"全年同比\",\n          \"period\": \"2023年全年\"\n        },\n        {\n          \"id\": \"industry\",\n          \"label\": \"规模以上工业增加值\",\n          \"value\": 4.6,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2023年全年\"\n        },\n        {\n          \"id\": \"income\",\n          \"label\": \"居民人均可支配收入\",\n          \"value\": 6.1,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2023年全年\"\n        },\n        {\n          \"id\": \"spending\",\n          \"label\": \"居民人均消费支出\",\n          \"value\": 9,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2023年全年\"\n        }\n      ]\n    },\n    {\n      \"year\": 2024,\n      \"kind\": \"annual\",\n      \"title\": \"2024年度经济观察报告\",\n      \"period\": \"2024年全年\",\n      \"published\": \"2025-02-28\",\n      \"fetchedAt\": \"2026-10-25T21:32:36.659Z\",\n      \"source\": \"https://www.stats.gov.cn/sj/zxfb/202502/t20250228_1958817.html\",\n      \"sourceTitle\": \"中华人民共和国2024年国民经济和社会发展统计公报\",\n      \"notes\": [\n        \"采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。\",\n        \"调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。\",\n        \"全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。\"\n      ],\n      \"metrics\": [\n        {\n          \"id\": \"gdp\",\n          \"label\": \"实际 GDP\",\n          \"value\": 5,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2024年全年\"\n        },\n        {\n          \"id\": \"retail\",\n          \"label\": \"社会消费品零售\",\n          \"value\": 3.5,\n          \"basis\": \"全年名义同比\",\n          \"period\": \"2024年全年\"\n        },\n        {\n          \"id\": \"unemployment\",\n          \"label\": \"城镇调查失业率\",\n          \"value\": 5.1,\n          \"basis\": \"全年平均值\",\n          \"period\": \"2024年全年\"\n        },\n        {\n          \"id\": \"cpi\",\n          \"label\": \"居民消费价格 CPI\",\n          \"value\": 0.2,\n          \"basis\": \"全年同比\",\n          \"period\": \"2024年全年\"\n        },\n        {\n          \"id\": \"property\",\n          \"label\": \"房地产开发投资\",\n          \"value\": -10.6,\n          \"basis\": \"全年同比\",\n          \"period\": \"2024年全年\"\n        },\n        {\n          \"id\": \"sales\",\n          \"label\": \"新建商品房销售面积\",\n          \"value\": -12.9,\n          \"basis\": \"全年同比\",\n          \"period\": \"2024年全年\"\n        },\n        {\n          \"id\": \"industry\",\n          \"label\": \"规模以上工业增加值\",\n          \"value\": 5.8,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2024年全年\"\n        },\n        {\n          \"id\": \"income\",\n          \"label\": \"居民人均可支配收入\",\n          \"value\": 5.1,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2024年全年\"\n        },\n        {\n          \"id\": \"spending\",\n          \"label\": \"居民人均消费支出\",\n          \"value\": 5.1,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2024年全年\"\n        }\n      ]\n    },\n    {\n      \"year\": 2025,\n      \"kind\": \"annual\",\n      \"title\": \"2025年度经济观察报告\",\n      \"period\": \"2025年全年\",\n      \"published\": \"2026-02-28\",\n      \"fetchedAt\": \"2026-10-25T21:32:36.665Z\",\n      \"source\": \"https://www.stats.gov.cn/sj/zxfb/202602/t20260228_1962662.html\",\n      \"sourceTitle\": \"中华人民共和国2025年国民经济和社会发展统计公报\",\n      \"notes\": [\n        \"采用各年公报发布时公布值，不是统一修订后的历史数据库；保留正文署期，网站迁移日期不作为原始发布日期。\",\n        \"调查失业率全年均值缺失时留空，不用登记失业率或年末值拼接。\",\n        \"全国居民收支系列有住户调查口径变化；商品房统计名称及企业样本范围也有变化，长周期对照仅描述各年公布值。\"\n      ],\n      \"metrics\": [\n        {\n          \"id\": \"gdp\",\n          \"label\": \"实际 GDP\",\n          \"value\": 5,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2025年全年\"\n        },\n        {\n          \"id\": \"retail\",\n          \"label\": \"社会消费品零售\",\n          \"value\": 3.7,\n          \"basis\": \"全年名义同比\",\n          \"period\": \"2025年全年\"\n        },\n        {\n          \"id\": \"unemployment\",\n          \"label\": \"城镇调查失业率\",\n          \"value\": 5.2,\n          \"basis\": \"全年平均值\",\n          \"period\": \"2025年全年\"\n        },\n        {\n          \"id\": \"cpi\",\n          \"label\": \"居民消费价格 CPI\",\n          \"value\": 0,\n          \"basis\": \"全年同比\",\n          \"period\": \"2025年全年\"\n        },\n        {\n          \"id\": \"property\",\n          \"label\": \"房地产开发投资\",\n          \"value\": -17.2,\n          \"basis\": \"全年同比\",\n          \"period\": \"2025年全年\"\n        },\n        {\n          \"id\": \"sales\",\n          \"label\": \"新建商品房销售面积\",\n          \"value\": -8.7,\n          \"basis\": \"全年同比\",\n          \"period\": \"2025年全年\"\n        },\n        {\n          \"id\": \"industry\",\n          \"label\": \"规模以上工业增加值\",\n          \"value\": 5.9,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2025年全年\"\n        },\n        {\n          \"id\": \"income\",\n          \"label\": \"居民人均可支配收入\",\n          \"value\": 5,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2025年全年\"\n        },\n        {\n          \"id\": \"spending\",\n          \"label\": \"居民人均消费支出\",\n          \"value\": 4.4,\n          \"basis\": \"全年实际同比\",\n          \"period\": \"2025年全年\"\n        }\n      ]\n    }\n  ],\n  \"latest\": {\n    \"source\": \"https://www.stats.gov.cn/sj/zxfb/202610/t20261019_1965618.html\",\n    \"published\": \"2026-10-19\",\n    \"fetchedAt\": \"2026-10-25T21:18:27.257Z\",\n    \"metrics\": [\n      {\n        \"id\": \"retail\",\n        \"label\": \"社会消费品零售\",\n        \"value\": 1.1,\n        \"period\": \"2026年9月\",\n        \"basis\": \"当月同比\"\n      },\n      {\n        \"id\": \"unemployment\",\n        \"label\": \"城镇调查失业率\",\n        \"value\": 5.2,\n        \"period\": \"2026年9月\",\n        \"basis\": \"当月水平\"\n      },\n      {\n        \"id\": \"core\",\n        \"label\": \"核心 CPI\",\n        \"value\": 1,\n        \"period\": \"2026年9月\",\n        \"basis\": \"当月同比\"\n      },\n      {\n        \"id\": \"property\",\n        \"label\": \"房地产开发投资\",\n        \"value\": -20.6,\n        \"period\": \"2026年前三季度\",\n        \"basis\": \"累计同比\"\n      },\n      {\n        \"id\": \"sales\",\n        \"label\": \"新建商品房销售面积\",\n        \"value\": -13.2,\n        \"period\": \"2026年前三季度\",\n        \"basis\": \"累计同比\"\n      },\n      {\n        \"id\": \"pmi\",\n        \"label\": \"制造业 PMI\",\n        \"value\": 50.1,\n        \"period\": \"2026年9月\",\n        \"basis\": \"当月指数 · 50为荣枯线\"\n      },\n      {\n        \"id\": \"industry\",\n        \"label\": \"规模以上工业增加值\",\n        \"value\": 5.5,\n        \"period\": \"2026年9月\",\n        \"basis\": \"当月实际同比\"\n      },\n      {\n        \"id\": \"gdp\",\n        \"label\": \"实际 GDP\",\n        \"value\": 4.6,\n        \"period\": \"2026年前三季度\",\n        \"basis\": \"累计实际同比\"\n      }\n    ],\n    \"quarters\": [\n      {\n        \"label\": \"2026 Q1\",\n        \"value\": 5\n      },\n      {\n        \"label\": \"2026 Q2\",\n        \"value\": 4.3\n      },\n      {\n        \"label\": \"2026 Q3\",\n        \"value\": 4.5\n      }\n    ],\n    \"updatePolicy\": \"On request, cached 30 minutes; browser checks every 30 minutes\"\n  }\n}\n</script><script type=\"application/json\" id=\"judgments-initial\">{\n  \"version\": 1,\n  \"checkedAt\": \"2026-10-26\",\n  \"coverage\": \"公开资料选集；非逐年全部演讲目录，未收录不等于没有观点\",\n  \"speechSource\": {\n    \"title\": \"2024-12-03演讲第三方听打稿（2025-05-17刊载）\",\n    \"url\": \"https://www.jenniferzengblog.com/home/2025/5/17/gdp3\",\n    \"publishedAt\": \"2025-05-17\",\n    \"spokenAt\": \"2024-12-03\"\n  },\n  \"records\": [\n    {\n      \"id\": \"view-2012\",\n      \"publishedAt\": \"2012-04-16\",\n      \"spokenAt\": \"2012-04-15\",\n      \"title\": \"短期环比可能修复，一年内仍谨慎\",\n      \"summary\": \"他认为融资体系修复可支撑二季度环比回升，但房地产库存与资金约束仍在，对未来一年的增长保持保守。\",\n      \"horizon\": \"二季度环比及未来一年\",\n      \"condition\": \"短期资金缓解不等于货币政策已明显放松。\",\n      \"limit\": \"当前图为年度实际同比，无法检验二季度环比预测；需要当时版本的季调季度序列。\",\n      \"metrics\": [\n        \"gdp\",\n        \"property\"\n      ],\n      \"source\": \"https://news.cntv.cn/20120416/121619.shtml\",\n      \"sourceTitle\": \"中国证券报报道（央视网转载）\",\n      \"sourceType\": \"同期媒体报道\",\n      \"locator\": \"正文“经济状况短多长空”\",\n      \"checkedAt\": \"2026-10-26\",\n      \"isQuote\": false\n    },\n    {\n      \"id\": \"view-2014\",\n      \"publishedAt\": \"2014-12-18\",\n      \"spokenAt\": \"2014-12-16\",\n      \"title\": \"供给收缩改善盈利，A股牛熊格局可能转变\",\n      \"summary\": \"他以供给调整与企业利润率改善解释股市转强，并认为地产对经济的拖累可能在2015年二季度耗尽。\",\n      \"horizon\": \"2015年及更长的市场周期\",\n      \"condition\": \"仍须防范总需求意外走弱，以及监管变化带来的资金冲击。\",\n      \"limit\": \"年度地产投资不能定位二季度拐点；检验牛市持续时间还需指数、回撤和盈利序列。\",\n      \"metrics\": [\n        \"property\",\n        \"gdp\"\n      ],\n      \"source\": \"https://www.aisixiang.com/data/81507.html\",\n      \"sourceTitle\": \"《2015股市楼市走势究竟会怎样》（万得演讲实录转载）\",\n      \"sourceType\": \"演讲实录转载\",\n      \"locator\": \"正文房地产成交与投资关系、风险提示部分\",\n      \"checkedAt\": \"2026-10-26\",\n      \"isQuote\": false\n    },\n    {\n      \"id\": \"view-2015\",\n      \"publishedAt\": \"2015-06-29\",\n      \"spokenAt\": \"2015-06-25\",\n      \"title\": \"认为年底前博弈行情的宏观条件未根本改变\",\n      \"summary\": \"他判断市场驱动已由基本面转向资金与筹码博弈，预计年底前相关条件未根本改变；同时预期财政冲击在年底前后逐渐被吸收。\",\n      \"horizon\": \"2015年底至2016年初\",\n      \"condition\": \"经济恢复、红筹回归和注册制推进，可能改变后续市场环境。\",\n      \"limit\": \"保留这一带有乐观时点的判断，不将其改写成事后风险预警；当前未接入可核验的指数日线，尚不能完成股市路径检验。\",\n      \"metrics\": [\n        \"gdp\",\n        \"retail\"\n      ],\n      \"source\": \"https://chinadigitaltimes.net/chinese/396696.html\",\n      \"sourceTitle\": \"《2015中期宏观经济讲演全文》（第三方留存）\",\n      \"sourceType\": \"第三方演讲听录转载\",\n      \"locator\": \"末尾总结第1、2点；演讲日参照作者财新博客索引\",\n      \"checkedAt\": \"2026-10-26\",\n      \"isQuote\": false\n    },\n    {\n      \"id\": \"view-2016\",\n      \"publishedAt\": \"2016-02-02\",\n      \"spokenAt\": \"2016-01-20\",\n      \"title\": \"年初预判出口、房地产仍有收缩压力\",\n      \"summary\": \"在回顾2015年内外冲击时，他对2016年出口、房地产的展望仍偏弱，预计预算内财政更积极但增量有限。\",\n      \"horizon\": \"2016年\",\n      \"condition\": \"财政支出、地方融资与外部需求共同影响走势。\",\n      \"limit\": \"当前销售面积与开发投资只覆盖地产部分；若年内结果相反也应保留。未接入出口与财政原口径，不把这两个判断判为已验证。\",\n      \"metrics\": [\n        \"property\",\n        \"sales\",\n        \"gdp\"\n      ],\n      \"source\": \"https://www.saif.sjtu.edu.cn/show-236-56.html\",\n      \"sourceTitle\": \"上海高级金融学院：2016中国经济分析展望会观点摘要\",\n      \"sourceType\": \"主办方活动摘要\",\n      \"locator\": \"正文“在活动现场”与“观点精粹”\",\n      \"checkedAt\": \"2026-10-26\",\n      \"isQuote\": false\n    },\n    {\n      \"id\": \"view-2017\",\n      \"publishedAt\": \"2017-12-26\",\n      \"spokenAt\": null,\n      \"title\": \"三大拖累减轻，对随后两年更乐观\",\n      \"summary\": \"他认为出口、地产库存与过剩产能的拖累正减轻，预期补库存支持后续经济，判断2018—2019年名义GDP增速有望保持9%或以上。\",\n      \"horizon\": \"2018—2019年\",\n      \"condition\": \"依赖全球复苏与地产、产能去化的延续。\",\n      \"limit\": \"报道提出的是名义GDP展望，当前曲线为实际GDP；不能用它直接判定数值预测命中。全国销售增速也不能替代库存去化指标。\",\n      \"metrics\": [\n        \"property\",\n        \"sales\",\n        \"gdp\"\n      ],\n      \"source\": \"https://www.yicai.com/news/5386662.html\",\n      \"sourceTitle\": \"第一财经：三大经济拖累因素正消除\",\n      \"sourceType\": \"同期媒体报道\",\n      \"locator\": \"首段名义GDP展望与正文三项拖累分析\",\n      \"checkedAt\": \"2026-10-26\",\n      \"isQuote\": false\n    },\n    {\n      \"id\": \"view-2018\",\n      \"publishedAt\": \"2018-06-21\",\n      \"spokenAt\": null,\n      \"title\": \"贸易摩擦可能长期化，需防全球化碎片化\",\n      \"summary\": \"他把中美贸易纷争视为可能延续多年的竞争，提示投资、技术和人才往来分离的风险，主张维护多边规则并扩大开放。\",\n      \"horizon\": \"多年\",\n      \"condition\": \"双方能否形成妥协和制度安排，影响风险是否兑现。\",\n      \"limit\": \"这不是某年的GDP点预测。需要关税、双向投资和贸易结构数据；当前GDP仅作背景，不能验证贸易冲突的因果影响。\",\n      \"metrics\": [\n        \"gdp\",\n        \"industry\"\n      ],\n      \"source\": \"https://pfile.essence.com.cn/data/00/33/CgcKWFsrLySAErTNAAdnmTYiKv4430.pdf\",\n      \"sourceTitle\": \"安信证券宏观研究《中美贸易战的走向》\",\n      \"sourceType\": \"原机构研究报告\",\n      \"locator\": \"第1—3页；报告基于4月11日演讲并进一步更新\",\n      \"checkedAt\": \"2026-10-26\",\n      \"isQuote\": false\n    },\n    {\n      \"id\": \"view-2019\",\n      \"publishedAt\": \"2019-12-08\",\n      \"spokenAt\": null,\n      \"title\": \"转型中的减速尚未结束\",\n      \"summary\": \"在《知止不殆》中，他预期中长期增长中枢继续下移，并提示2020年仍有地产投资减速、去产能提振消退等压力。\",\n      \"horizon\": \"2020年及其后数年\",\n      \"condition\": \"资源配置改善和新产业机会可形成结构性支撑。\",\n      \"limit\": \"资料为正式书面报告的第三方存档，不把演讲日期与报告日期混同。2020年后疫情是额外冲击，单年增速不足以识别长期潜在增长。\",\n      \"metrics\": [\n        \"gdp\",\n        \"property\",\n        \"industry\"\n      ],\n      \"source\": \"https://www.gaoshanwen.com/articles/analysis-2019-12-08-1c9smie\",\n      \"sourceTitle\": \"《知止不殆》2019-12-08书面报告存档\",\n      \"sourceType\": \"第三方研究报告存档\",\n      \"locator\": \"内容提要及“一、中国经济转型的国际比较”\",\n      \"checkedAt\": \"2026-10-26\",\n      \"isQuote\": false\n    },\n    {\n      \"id\": \"view-2020\",\n      \"publishedAt\": \"2020-03-18\",\n      \"spokenAt\": \"2020-03-15\",\n      \"title\": \"疫情冲击主要体现为需求骤降\",\n      \"summary\": \"他认为疫情初期多数行业承受的主要是需求冲击，供给恢复相对更快，消费与地产交易的大幅收缩需重点观察。\",\n      \"horizon\": \"疫情冲击与恢复阶段\",\n      \"condition\": \"少数行业仍可能存在供应短缺，恢复路径受疫情发展制约。\",\n      \"limit\": \"全年社零能展示需求表现，不能独立识别供需冲击份额；2021年的高同比受2020低基数影响。\",\n      \"metrics\": [\n        \"retail\",\n        \"spending\",\n        \"gdp\"\n      ],\n      \"source\": \"https://www.yicai.com/news/100553628.html\",\n      \"sourceTitle\": \"高善文署名《新冠疫情下的全球金融动荡》\",\n      \"sourceType\": \"作者署名演讲整理稿（媒体刊载）\",\n      \"locator\": \"“中国经济情况的评估和展望”\",\n      \"checkedAt\": \"2026-10-26\",\n      \"isQuote\": false\n    },\n    {\n      \"id\": \"view-2021\",\n      \"publishedAt\": \"2021-11-18\",\n      \"spokenAt\": null,\n      \"title\": \"能源转型需保留传统供给缓冲\",\n      \"summary\": \"他提出新能源替代过程中应保留传统能源产能冗余，并为能耗调节保留弹性，以降低供给波动的经济成本。\",\n      \"horizon\": \"能源转型的中长期\",\n      \"condition\": \"大规模低成本储能尚未广泛应用时，备用产能尤为重要。\",\n      \"limit\": \"这是供给与政策设计判断，当前工业和CPI只是背景；没有能源结构、缺电与煤价序列，不能完成直接检验。\",\n      \"metrics\": [\n        \"industry\",\n        \"cpi\"\n      ],\n      \"source\": \"https://finance.sina.com.cn/money/bank/bank_hydt/2021-11-19/doc-iktzscyy6478356.shtml\",\n      \"sourceTitle\": \"高善文署名《能源短缺与碳达峰》\",\n      \"sourceType\": \"作者署名演讲整理稿（CF40转载）\",\n      \"locator\": \"提要；页面正文发布时间为11月18日，URL日期不作发表日期\",\n      \"checkedAt\": \"2026-10-26\",\n      \"isQuote\": false\n    },\n    {\n      \"id\": \"view-2022\",\n      \"publishedAt\": \"2022-06-28\",\n      \"spokenAt\": \"2022-06-28\",\n      \"title\": \"仍看估值修复，中长期增长依赖制度补短板\",\n      \"summary\": \"他认为4月底后的估值修复尚在延续；对2035年前提出增长可能在4.5%附近或略高的情景，同时强调制度改善与汇率等条件。\",\n      \"horizon\": \"当时市场修复及2035年前\",\n      \"condition\": \"长期增长情景包含汇率、生产率和制度改善等条件。\",\n      \"limit\": \"短期反弹判断与长期增长情景必须分开。当前无指数日线，不能检验反弹时点；2035年尚未到达，不提前判定长期结论。\",\n      \"metrics\": [\n        \"gdp\",\n        \"industry\"\n      ],\n      \"source\": \"https://fund.eastmoney.com/a/202206282427744346.html\",\n      \"sourceTitle\": \"中国基金报：2022中期策略会《吹尽狂沙始到金》实录（东方财富转载）\",\n      \"sourceType\": \"同期媒体演讲整理\",\n      \"locator\": \"开篇及重要观点第1—5项\",\n      \"checkedAt\": \"2026-10-26\",\n      \"isQuote\": false\n    },\n    {\n      \"id\": \"view-2023\",\n      \"publishedAt\": \"2023-08-23\",\n      \"spokenAt\": null,\n      \"title\": \"疤痕效应与地产流动性压力相互强化\",\n      \"summary\": \"他用疫情疤痕和地产融资压力的交互解释经济困难，判断地产可能已明显超调、会发生均值回归，但时间不确定。\",\n      \"horizon\": \"修复过程；未给确定完成日\",\n      \"condition\": \"房企流动性与居民资产负债表状况会影响修复。\",\n      \"limit\": \"保留“时间不确定”的限定。全国开发投资、销售面积不能替代城市房价估值或房企现金流。\",\n      \"metrics\": [\n        \"property\",\n        \"sales\",\n        \"spending\"\n      ],\n      \"source\": \"https://finance.sina.com.cn/zl/china/2023-08-23/zl-imziefaf8861665.shtml\",\n      \"sourceTitle\": \"高善文署名《关于当前资本市场的一些思考》\",\n      \"sourceType\": \"作者署名文章（CF40专栏）\",\n      \"locator\": \"开篇观点摘要与正文疤痕效应分析\",\n      \"checkedAt\": \"2026-10-26\",\n      \"isQuote\": false\n    },\n    {\n      \"id\": \"view-2024\",\n      \"publishedAt\": \"2024-12-03\",\n      \"spokenAt\": \"2024-12-03\",\n      \"title\": \"从周期收缩转向后泡沫的较弱增长\",\n      \"summary\": \"他认为周期压力重于转型代价，2025年可能逐步转向较弱但可维持的增长，前提包括继续政策干预。\",\n      \"horizon\": \"2025年及其后数年\",\n      \"condition\": \"并非预测恢复此前高速增长；需要时间消化调整与政策支持。\",\n      \"limit\": \"下方拆为六条判断逐年跟踪。全文来源为第三方听打稿，2025年转载时间不当作新的演讲日期。\",\n      \"metrics\": [\n        \"gdp\",\n        \"retail\",\n        \"property\",\n        \"sales\",\n        \"unemployment\"\n      ],\n      \"source\": \"https://www.jenniferzengblog.com/home/2025/5/17/gdp3\",\n      \"sourceTitle\": \"《云开雾散曙光现》2024-12-03演讲听打稿\",\n      \"sourceType\": \"第三方听打稿（2025-05-17发布）\",\n      \"locator\": \"开篇结论及结尾2025年展望；日期与原幻灯片、路演记录交叉核对\",\n      \"checkedAt\": \"2026-10-26\",\n      \"isQuote\": false,\n      \"sourcePublishedAt\": \"2025-05-17\"\n    }\n  ],\n  \"theses\": [\n    {\n      \"id\": \"cycle\",\n      \"title\": \"周期压力重于转型代价\",\n      \"summary\": \"他认为转型已有进展，但近期疲弱主要有周期性成因。\",\n      \"watch\": \"消费、工业与地产是否一起持续改善\",\n      \"limit\": \"全国宏观指标仅作辅助；产业分类的因果识别仍需原公司底表。\",\n      \"metrics\": [\n        \"retail\",\n        \"spending\",\n        \"industry\",\n        \"property\"\n      ],\n      \"pages\": [\n        4,\n        5,\n        6,\n        7,\n        8\n      ],\n      \"horizon\": \"2021年以来的诊断及后续修复\",\n      \"date\": \"2024-12-03\",\n      \"source\": \"https://www.jenniferzengblog.com/home/2025/5/17/gdp3\",\n      \"sourceTitle\": \"2024-12-03演讲第三方听打稿（2025-05-17刊载）\",\n      \"sourceType\": \"第三方听打稿与原幻灯片交叉阅读\",\n      \"condition\": \"保留当时估计及研究假设，不把后来公布值倒填原演讲。\"\n    },\n    {\n      \"id\": \"consumption\",\n      \"title\": \"消费疲弱与收入预期受损\",\n      \"summary\": \"他把消费疲弱与就业、收入预期联系起来。\",\n      \"watch\": \"社零名义增速与居民消费实际增速分别变化\",\n      \"limit\": \"两项口径不同，不相减排名；年龄和房价回归不能用全国序列替代。\",\n      \"metrics\": [\n        \"retail\",\n        \"spending\",\n        \"income\"\n      ],\n      \"pages\": [\n        10,\n        11,\n        12,\n        13,\n        14\n      ],\n      \"horizon\": \"疫情后需求修复\",\n      \"date\": \"2024-12-03\",\n      \"source\": \"https://www.jenniferzengblog.com/home/2025/5/17/gdp3\",\n      \"sourceTitle\": \"2024-12-03演讲第三方听打稿（2025-05-17刊载）\",\n      \"sourceType\": \"第三方听打稿与原幻灯片交叉阅读\",\n      \"condition\": \"保留当时估计及研究假设，不把后来公布值倒填原演讲。\"\n    },\n    {\n      \"id\": \"employment\",\n      \"title\": \"就业人数比失业率提供更多线索\",\n      \"summary\": \"他认为失业率不足以反映就业与参与率的压力。\",\n      \"watch\": \"调查失业率仅作交叉观察，并回看就业人数图\",\n      \"limit\": \"比率下降不等于人数恢复；原稿4709万是年度存量缺口之和，不能当去重失业人数。\",\n      \"metrics\": [\n        \"unemployment\",\n        \"income\"\n      ],\n      \"pages\": [\n        16,\n        17,\n        18,\n        19,\n        20,\n        21,\n        22\n      ],\n      \"horizon\": \"2021年以来的就业变化\",\n      \"date\": \"2024-12-03\",\n      \"source\": \"https://www.jenniferzengblog.com/home/2025/5/17/gdp3\",\n      \"sourceTitle\": \"2024-12-03演讲第三方听打稿（2025-05-17刊载）\",\n      \"sourceType\": \"第三方听打稿与原幻灯片交叉阅读\",\n      \"condition\": \"保留当时估计及研究假设，不把后来公布值倒填原演讲。\"\n    },\n    {\n      \"id\": \"statistics\",\n      \"title\": \"增长统计与价格、就业需交叉核对\",\n      \"summary\": \"他据就业、价格等关系推测，疫情后经济增速可能被高估约3个百分点。\",\n      \"watch\": \"GDP实际增长、CPI及就业的并行变化\",\n      \"limit\": \"不能用CPI替代核心CPI，也不自动将GDP减3个百分点；需识别潜在增速与模型误差。\",\n      \"metrics\": [\n        \"gdp\",\n        \"cpi\",\n        \"unemployment\"\n      ],\n      \"pages\": [\n        24,\n        25,\n        26,\n        27\n      ],\n      \"horizon\": \"疫情后的统计解释\",\n      \"date\": \"2024-12-03\",\n      \"source\": \"https://www.jenniferzengblog.com/home/2025/5/17/gdp3\",\n      \"sourceTitle\": \"2024-12-03演讲第三方听打稿（2025-05-17刊载）\",\n      \"sourceType\": \"第三方听打稿与原幻灯片交叉阅读\",\n      \"condition\": \"保留当时估计及研究假设，不把后来公布值倒填原演讲。\"\n    },\n    {\n      \"id\": \"turning\",\n      \"title\": \"2025年可能转向较弱但稳定的增长\",\n      \"summary\": \"他对2025年的转折判断有政策支持与调整消化的前提。\",\n      \"watch\": \"2025年之后消费、就业、地产能否持续交叉印证\",\n      \"limit\": \"未给统一数值门槛；一年GDP达标或股市上涨都不足以证明转折完成。\",\n      \"metrics\": [\n        \"gdp\",\n        \"retail\",\n        \"spending\",\n        \"unemployment\",\n        \"property\",\n        \"sales\"\n      ],\n      \"pages\": [\n        28,\n        29\n      ],\n      \"horizon\": \"2025年及之后；长期恢复尚需等待\",\n      \"date\": \"2024-12-03\",\n      \"source\": \"https://www.jenniferzengblog.com/home/2025/5/17/gdp3\",\n      \"sourceTitle\": \"2024-12-03演讲第三方听打稿（2025-05-17刊载）\",\n      \"sourceType\": \"第三方听打稿与原幻灯片交叉阅读\",\n      \"condition\": \"保留当时估计及研究假设，不把后来公布值倒填原演讲。\"\n    },\n    {\n      \"id\": \"property\",\n      \"title\": \"地产冲击的修复需要时间与干预\",\n      \"summary\": \"他以国际经验区分约3—4年的稳定化与8—9年的较完整修复，推测中国或到2030年前后更正常。\",\n      \"watch\": \"地产投资、销售与国际事件路径分别观察\",\n      \"limit\": \"国际均值不是中国倒计时；原稿估计保持冻结，当前WDI修订另列复算。\",\n      \"metrics\": [\n        \"property\",\n        \"sales\",\n        \"gdp\"\n      ],\n      \"pages\": [\n        28,\n        29\n      ],\n      \"horizon\": \"2025年的稳定化与约2030年的较长期修复分别观察\",\n      \"date\": \"2024-12-03\",\n      \"source\": \"https://www.jenniferzengblog.com/home/2025/5/17/gdp3\",\n      \"sourceTitle\": \"2024-12-03演讲第三方听打稿（2025-05-17刊载）\",\n      \"sourceType\": \"第三方听打稿与原幻灯片交叉阅读\",\n      \"condition\": \"保留当时估计及研究假设，不把后来公布值倒填原演讲。\"\n    }\n  ]\n}\n</script><script>const judgmentData=JSON.parse(document.getElementById('judgments-initial').textContent);\nfunction judgmentsForYear(db,year){return db.records.filter(r=>Number(r.publishedAt.slice(0,4))===Number(year));}\nfunction judgmentPhase(year,date){const y=Number(date.slice(0,4));return year<y?'判断前背景':year===y?'形成当年（含判断前月份）':'判断后全年';}\nfunction judgmentMetricRows(reports,ids){return reports.filter(r=>r.kind==='annual').sort((a,b)=>a.year-b.year).map(r=>({year:r.year,source:r.source,values:ids.map(id=>({id,...r.metrics.find(m=>m.id===id)}))}));}\nfunction judgmentYearText(db,report){\n const records=judgmentsForYear(db,report.year);let s='\\n## 高善文当时的判断（来源摘要）\\n\\n';\n s+='以下为本站对公开资料的转述，并非本人撰写的年度报告，也不代表当年全部观点。按资料公开年份归档，演讲日与公开日分别保留。\\n\\n';\n if(!records.length)s+='本次来源集中尚无该年已核实的观点条目；留空不表示当年没有发表观点。\\n\\n';\n for(const r of records){s+='### '+r.title+'\\n\\n公开：'+r.publishedAt+'；演讲：'+(r.spokenAt||'未核实到具体日期')+'；来源类型：'+r.sourceType+(r.sourcePublishedAt?'；本存档刊载：'+r.sourcePublishedAt:'')+'。\\n\\n'+r.summary+'\\n\\n适用时间与条件：'+r.horizon+'；'+r.condition+'\\n\\n核对边界：'+r.limit+'\\n\\n来源：['+r.sourceTitle+']('+r.source+')\\n\\n';}\n if(report.year>=2024){s+='### 持续追踪：2024-12-03 演讲的判断\\n\\n'+(report.year===2024?'2024全年含演讲前月份，属于判断形成背景，不能当作事后预测验证。':'以下与后来数据对照，属于本站复盘，并非讲者在本年发表的新观点。')+'\\n\\n';for(const t of db.theses)s+='- '+t.title+'：'+t.summary+' 观察：'+t.watch+'；边界：'+t.limit+'\\n';s+='\\n来源：['+db.speechSource.title+']('+db.speechSource.url+')；第三方听打稿，不是审定稿。\\n';}\n else s+='2024年的判断尚未提出；本年数据仅可作为后来研究的历史背景，不将后来的观点写成当年的预测。\\n';\n return s;\n}\n\nconst $=id=>document.getElementById(id);\nconst escapeHTML=x=>String(x??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nfunction storageGet(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}\nfunction storageSet(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}\nlet data=JSON.parse($('initial-data').textContent).latest, reports=JSON.parse($('initial-data').textContent).annual;\nlet mode='all',saved=new Set(Array.isArray(storageGet('watch',[]))?storageGet('watch',[]):[]),selectedYear=null;\nconst number=x=>x===null||x===undefined?'—':Number(x).toFixed(1);\nfunction render(){if(!data?.metrics)return;\n $('cards').innerHTML=data.metrics.filter(m=>mode==='all'||saved.has(m.id)).map(m=>'<article class=\"card\"><button class=\"star\" data-id=\"'+escapeHTML(m.id)+'\" aria-label=\"关注'+escapeHTML(m.label)+'\" aria-pressed=\"'+saved.has(m.id)+'\">'+(saved.has(m.id)?'★':'☆')+'</button><div class=\"label\">'+escapeHTML(m.label)+'</div><div class=\"value\">'+number(m.value)+'<small>'+(m.value===null?'':m.id==='pmi'?'':'%')+'</small></div><div class=\"meta\">'+escapeHTML(m.period)+' · '+escapeHTML(m.basis)+'</div><div class=\"meta\">'+(m.value===null?'待核验':'官方公布值')+'</div><a class=\"source\" href=\"'+escapeHTML(data.source)+'\" target=\"_blank\" rel=\"noopener\">国家统计局原文 ↗</a></article>').join('')||'<p>点击全部指标中的 ☆ 添加关注。</p>';\n $('chart').innerHTML=(data.quarters||[]).length?data.quarters.map(q=>'<div class=\"barrow\"><span>'+escapeHTML(q.label)+'</span><div class=\"bar\" style=\"width:'+Math.min(100,Math.max(0,q.value)*15)+'%\"></div><strong>'+number(q.value)+'%</strong></div>').join(''):'本篇发布未提供可解析的当年季度序列';\n document.querySelectorAll('.star').forEach(b=>b.onclick=()=>{saved.has(b.dataset.id)?saved.delete(b.dataset.id):saved.add(b.dataset.id);storageSet('watch',[...saved]);render()});\n}\nfunction showStatus(status='archived',failed=false){\n const live=status==='live'||status==='stored';\n $('error').style.display=live&&!failed?'none':'block';\n $('error').textContent=failed?'在线检查未完成，已保留可阅读的核验存档；不是实时确认的最新数据。':'当前展示已核验存档；在线更新暂未成功。数据仍可查看、导出，统计期与存档时间如下。';\n $('stamp').textContent=(live?'在线核验':'核验存档')+' · 来源发布 '+data.published+' · '+(live?'核验':'存档')+' '+new Date(data.fetchedAt).toLocaleString('zh-CN',{timeZone:'Asia/Singapore'});\n}\nfunction progressRecord(){const year=Number(data.metrics.find(m=>m.id==='gdp')?.period.match(/\\d{4}/)?.[0]||data.published.slice(0,4));return {...data,year,kind:'progress',title:year+'年度经济观察 · 进展版',period:data.metrics.find(m=>m.id==='gdp')?.period||'截至最新发布',sourceTitle:'国家统计局综合经济运行报告'};}\nfunction currentReports(){const p=progressRecord();return (reports.some(r=>r.year===p.year)?reports:[...reports,p]).sort((a,b)=>a.year-b.year);}\nfunction reportSummary(r){const v=id=>r.metrics.find(m=>m.id===id)?.value;const f=id=>v(id)===null||v(id)===undefined?'公报未列同口径数据':number(v(id))+'%';if(r.kind!=='annual')return [{title:'本年进展，保留原统计期',body:'本页数据截至 '+r.period+'。当月值、累计值和季度值分别保留，尚不构成完整年度判断。'},{title:'继续观察，而非提前定论',body:'以消费、就业、物价与房地产的后续发布交叉检验。完整年报待次年官方年度公报发布后形成。'}];return [{title:'消费与收入',body:v('spending')===null||v('income')===null?'全年社零名义增长 '+f('retail')+'。该公报未同时列出全国居民收支的同口径实际同比；本页保留缺项，不用城乡分组指标补齐。':'全年社零名义增长 '+f('retail')+'；人均消费支出实际增长 '+f('spending')+'，可支配收入实际增长 '+f('income')+'。这组数据提供需求线索，不能直接替代省际人口消费模型。'},{title:'就业',body:v('unemployment')===null?'该公报未列全国城镇调查失业率全年均值。本页不以登记失业率或年末调查失业率代替。':'全年城镇调查失业率平均为 '+f('unemployment')+'。该比率不能直接换算成流失就业人数，也不能代表青年分组失业率。'},{title:'房地产调整',body:'全年开发投资同比 '+f('property')+'，'+r.metrics.find(m=>m.id==='sales').label+'同比 '+f('sales')+'。投资与销售分别观察，不能凭单项变化宣布整个调整周期结束。'},{title:'供给与总量',body:'规模以上工业实际增长 '+f('industry')+'，实际 GDP 增长 '+f('gdp')+'。这是官方统计的交叉观察，未独立验证演讲中对增长数据的质疑。'}];}\nfunction renderReports(){\n const list=currentReports();if(!list.length)return;renderHistory(list);\n if(!list.some(r=>r.year===Number(selectedYear)))selectedYear=(list.filter(r=>r.kind==='annual').at(-1)||list.at(-1)).year;\n $('report-year').innerHTML=[...list].reverse().map(r=>'<option value=\"'+r.year+'\" '+(r.year===Number(selectedYear)?'selected':'')+'>'+r.year+' · '+(r.kind==='annual'?'完整年度':'进展版')+'</option>').join('');\n const r=list.find(r=>r.year===Number(selectedYear)),previous=list.find(x=>x.year===r.year-1&&x.kind==='annual');\n $('report-title').textContent=r.title;\n $('report-period').textContent=(r.kind==='annual'?'完整年度 · ':'进展版 · ')+r.period+' · 来源发布 '+r.published+' · 核验存档 '+new Date(r.fetchedAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Singapore'});\n $('report-note').textContent=r.kind==='annual'?'按官方年度公报组织的历史复盘，保留各版公报公布值，不是统一修订后的历史序列。'+(r.notes||[]).join(' '):'本年尚未形成完整年度结果。以下保留当月、累计或季度口径，不与上年全年结果计算差值。';\n const canCompare=r.kind==='annual'&&previous;\n $('report-head').innerHTML='<tr><th>指标</th><th>'+r.year+'年</th>'+(canCompare?'<th>'+previous.year+'年</th><th>公布值变化</th>':'')+'<th>统计口径</th></tr>';\n $('report-table').innerHTML=r.metrics.map(m=>{const p=previous?.metrics.find(x=>x.id===m.id&&x.basis===m.basis);let diff='—';if(canCompare&&m.value!==null&&p?.value!==undefined&&p.value!==null){const d=Number((m.value-p.value).toFixed(1));diff=d===0?'持平':(d>0?'+':'')+d.toFixed(1)+' 个百分点';}return '<tr><td>'+escapeHTML(m.label)+'</td><td>'+number(m.value)+(m.value===null||m.id==='pmi'?'':'%')+'</td>'+(canCompare?'<td>'+number(p?.value)+(p?.value===null||p?.value===undefined?'':'%')+'</td><td>'+diff+'</td>':'')+'<td>'+escapeHTML(m.period)+' · '+escapeHTML(m.basis)+(m.missingReason?'<br><small>'+escapeHTML(m.missingReason)+'</small>':'')+'</td></tr>';}).join('');\n $('report-findings').innerHTML=reportSummary(r).map(x=>'<div class=\"report-finding\"><h3>'+escapeHTML(x.title)+'</h3><p>'+escapeHTML(x.body)+'</p></div>').join('');\n $('report-source').href=r.source;$('report-source').textContent=r.sourceTitle+' ↗';\n $('report-previous').innerHTML=canCompare?'比较来源：<a href=\"'+escapeHTML(previous.source)+'\" target=\"_blank\" rel=\"noopener\">'+escapeHTML(previous.sourceTitle)+' ↗</a>':'';\n $('download-report').href='/api/reports/'+r.year+'.md';\n renderAnnualJudgments(r);if(window.judgmentsReady)renderJudgments();\n}\nasync function load(force=false){$('refresh').disabled=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);try{\n const r=await fetch('/api/data'+(force?'?refresh=1':''),{signal:controller.signal,cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const incoming=await r.json();if(!Array.isArray(incoming.metrics)||!incoming.source)throw Error('invalid response');data=incoming;storageSet('snapshot',data);showStatus(data.status);render();renderReports();\n }catch{showStatus('archived',true);render();}finally{clearTimeout(timer);$('refresh').disabled=false;}}\nasync function loadReports(){try{const r=await fetch('/api/reports',{cache:'no-store'});if(!r.ok)return;const d=await r.json();if(Array.isArray(d.reports))reports=d.reports;renderReports();}catch{/* The bundled, verified annual archive remains available. */}}\n$('refresh').onclick=()=>load(true).then(loadReports);$('all').onclick=()=>{mode='all';$('all').classList.add('active');$('watch').classList.remove('active');render()};$('watch').onclick=()=>{mode='watch';$('watch').classList.add('active');$('all').classList.remove('active');render()};\n$('export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='economy-'+data.published+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};\n$('report-year').onchange=()=>{selectedYear=Number($('report-year').value);renderReports()};$('print-report').onclick=()=>window.print();\nrender();showStatus();renderReports();load().then(loadReports);setInterval(()=>load().then(loadReports),1800000);\n\nfunction renderHistory(list){\n const annual=list.filter(r=>r.kind==='annual');const selector=$('history-metric');const id=selector.value||'gdp';\n if(!selector.innerHTML){selector.innerHTML=annual.at(-1).metrics.map(m=>'<option value=\"'+escapeHTML(m.id)+'\">'+escapeHTML(m.label)+'</option>').join('');selector.value=id;selector.onchange=()=>renderHistory(currentReports());}\n const points=annual.map(r=>({year:r.year,source:r.source,m:r.metrics.find(m=>m.id===id)}));\n const values=points.map(p=>p.m?.value).filter(v=>typeof v==='number');if(!values.length){$('history-chart').textContent='没有同口径数据';return;}\n const width=960,height=240,pad=35,min=Math.min(0,...values),max=Math.max(...values)+1,span=max-min||1;\n const x=y=>pad+(y-annual[0].year)/(annual.at(-1).year-annual[0].year||1)*(width-pad*2),yp=v=>height-pad-(v-min)/span*(height-pad*2);\n let segments=[],line=[];for(const p of points){if(p.m?.value===null||p.m?.value===undefined){if(line.length)segments.push(line);line=[];}else line.push(p);}if(line.length)segments.push(line);\n let svg='<svg viewBox=\"0 0 '+width+' '+height+'\" role=\"img\" aria-label=\"2012年以来'+escapeHTML(selector.options?.[selector.selectedIndex]?.text||id)+'年度公布值趋势\" style=\"width:100%;height:auto;max-height:300px\"><line x1=\"'+pad+'\" y1=\"'+yp(0)+'\" x2=\"'+(width-pad)+'\" y2=\"'+yp(0)+'\" stroke=\"#cad3c1\"/>';\n for(const level of [min,max])svg+='<text x=\"0\" y=\"'+yp(level)+'\" font-size=\"12\" fill=\"#737d73\">'+level.toFixed(1)+'</text>';\n for(const seg of segments)svg+='<polyline fill=\"none\" stroke=\"#406b4f\" stroke-width=\"2.5\" points=\"'+seg.map(p=>x(p.year)+','+yp(p.m.value)).join(' ')+'\"/>';\n for(const p of points){if(p.m?.value!==null&&p.m?.value!==undefined)svg+='<circle cx=\"'+x(p.year)+'\" cy=\"'+yp(p.m.value)+'\" r=\"4\" fill=\"#406b4f\"><title>'+p.year+'：'+number(p.m.value)+'% · '+escapeHTML(p.m.basis)+'</title></circle>';if(p.year%2===0||p.year===annual.at(-1).year)svg+='<text x=\"'+x(p.year)+'\" y=\"'+(height-7)+'\" text-anchor=\"middle\" font-size=\"12\" fill=\"#737d73\">'+p.year+'</text>';}\n $('history-chart').innerHTML=svg+'</svg>';\n $('history-note').textContent='单位：%。'+(id==='unemployment'?'仅展示各年公报列出的全年调查失业率均值；不以年末调查值或登记失业率补齐缺口。':id==='income'||id==='spending'?'全国居民实际同比；早期公报未列的项目留空，不用城乡分组数据替代。':id==='sales'?'早年为“商品房销售面积”，近年名称为“新建商品房销售面积”；按各版公报原口径列出。':'按当年公报公布值观察；经济普查、基期与样本修订可能影响可比性。');\n $('history-table').innerHTML=points.map(p=>'<tr><td>'+p.year+'</td><td>'+number(p.m?.value)+(p.m?.value===null||p.m?.value===undefined?'':'%')+'</td><td>'+escapeHTML(p.m?.missingReason||p.m?.basis)+'</td><td><a href=\"'+escapeHTML(p.source)+'\" target=\"_blank\" rel=\"noopener\">原文 ↗</a></td></tr>').join('');\n}\n\nlet judgmentMode='speech',judgmentSelection='turning',judgmentYear=2024;\nfunction je(x){return escapeHTML(x);}\nfunction judgmentCard(r,compact=false){return '<div class=\"judgment-card\"><div class=\"eyebrow\">'+je(r.date||r.publishedAt)+' · '+je(r.sourceType)+'</div><h3>'+je(r.title)+'</h3><p><span class=\"tag\">本站转述</span>'+je(r.summary)+'</p>'+(r.id==='turning'?'<blockquote>“2025年很可能就是这样的转折点”</blockquote><p class=\"fine\">第三方听打稿所记原话；“转折”指向较弱而可维持的增长，并非恢复原有高速增长。</p>':'')+'<div class=\"judgment-facts\"><div><strong>时间范围与条件</strong><p>'+je(r.horizon)+'</p><p>'+je(r.condition)+'</p></div><div><strong>怎样核对</strong><p>'+je(r.watch||r.limit)+'</p></div></div><p class=\"fine\">核对边界：'+je(r.limit)+'</p>'+(!r.date?'<p class=\"fine\">演讲日：'+je(r.spokenAt||'未核实到具体日期')+'；观点 / 报告公开日：'+je(r.publishedAt)+(r.sourcePublishedAt?'；本存档刊载：'+je(r.sourcePublishedAt):'')+'。定位：'+je(r.locator)+'</p>':'')+'<a href=\"'+je(r.source)+'\" target=\"_blank\" rel=\"noopener\">'+je(r.sourceTitle)+' ↗</a>'+(r.pages&&!compact?'<p class=\"fine\">关联原图：'+r.pages.map(p=>'<button class=\"judgment-page\" data-page=\"'+p+'\">P'+p+'</button>').join(' ')+'</p>':'')+'</div>';}\nfunction activeJudgment(){return judgmentMode==='speech'?judgmentData.theses.find(r=>r.id===judgmentSelection):judgmentsForYear(judgmentData,judgmentYear)[0];}\nfunction setJudgmentMode(mode){judgmentMode=mode;renderJudgments();}\nfunction renderJudgments(){\n if(!document.getElementById('judgments'))return;\n const speechMode=judgmentMode==='speech',list=currentReports(),latestYear=Math.max(new Date().getFullYear(),...list.map(r=>r.year));\n for(const mode of ['speech','history']){const b=$('judgment-mode-'+mode);b.classList.toggle('active',judgmentMode===mode);b.setAttribute('aria-pressed',String(judgmentMode===mode));}\n $('judgment-select-label').textContent=speechMode?'选择演讲中的一项判断':'选择观点年份';\n $('judgment-select').innerHTML=speechMode?judgmentData.theses.map(r=>'<option value=\"'+r.id+'\" '+(r.id===judgmentSelection?'selected':'')+'>'+je(r.title)+'</option>').join(''):Array.from({length:latestYear-2011},(_,i)=>i+2012).reverse().map(y=>'<option value=\"'+y+'\" '+(y===judgmentYear?'selected':'')+'>'+y+' · '+(judgmentsForYear(judgmentData,y).length?'已有来源':'待补来源')+'</option>').join('');\n $('judgment-year-strip').style.display=speechMode?'none':'grid';\n $('judgment-year-strip').innerHTML=Array.from({length:latestYear-2011},(_,i)=>i+2012).map(y=>'<button data-year=\"'+y+'\" data-empty=\"'+!judgmentsForYear(judgmentData,y).length+'\" '+(y===judgmentYear?'class=\"active\"':'')+'>'+y+'</button>').join('');\n $('judgment-coverage').textContent='本次收录 '+judgmentData.records.length+' 个年份的公开资料，核对于 '+judgmentData.checkedAt+'。选集不代表当年所有观点。2013年及此后尚未收录的年份明确待补。';\n const r=activeJudgment();$('judgment-detail').innerHTML=r?judgmentCard(r):'<div class=\"judgment-empty\"><h3>'+judgmentYear+'年 · 尚未收录已核实的观点</h3><p>本次来源集中未补齐该年资料，不能由后来演讲倒推当年判断。下方仍可查看官方历史数据。</p></div>';\n const metrics=r?.metrics||['gdp','retail','property'],old=$('judgment-metric').value;\n const defs=list.find(x=>x.kind==='annual')?.metrics||[];\n $('judgment-metric').innerHTML=metrics.map(id=>'<option value=\"'+id+'\">'+je(defs.find(m=>m.id===id)?.label||id)+'</option>').join('');\n if(metrics.includes(old))$('judgment-metric').value=old;\n document.querySelectorAll('#judgment-year-strip button').forEach(b=>b.onclick=()=>{judgmentYear=Number(b.dataset.year);renderJudgments()});\n document.querySelectorAll('.judgment-page').forEach(b=>b.onclick=()=>{speechSection='全部';sp('speech-section').value='全部';selectedSpeechPage=Number(b.dataset.page);renderSpeech();sp('speech').scrollIntoView({behavior:'smooth'});});\n renderJudgmentTrend();\n}\nfunction renderJudgmentTrend(){\n const r=activeJudgment(),id=$('judgment-metric').value||'gdp',rows=judgmentMetricRows(currentReports(),[id]),date=r?.date||r?.publishedAt||judgmentYear+'-12-31',year=Number(date.slice(0,4)),valid=rows.filter(p=>typeof p.values[0]?.value==='number');\n const name=rows[0]?.values[0]?.label||id;\n $('judgment-trend-title').textContent=name+' · 2012年以来';\n $('judgment-trend-note').textContent='单位：%。虚线表示判断所在年份（'+year+'），不是日级位置。窄屏可左右滑动图表。全年数据包含判断前月份；仅后续完整年度属于判断后观察。失业率为全年均值，CPI不是核心CPI。';\n if(!valid.length){$('judgment-trend').textContent='缺少同口径年度数据，保留缺项。';}else{\n const w=960,h=270,pad=42,min=Math.min(0,...valid.map(p=>p.values[0].value))-1,max=Math.max(...valid.map(p=>p.values[0].value))+1,span=max-min||1;\n const x=y=>pad+(y-rows[0].year)/(rows.at(-1).year-rows[0].year||1)*(w-pad*2),yp=v=>h-pad-(v-min)/span*(h-pad*2);\n let svg='<svg viewBox=\"0 0 '+w+' '+h+'\" role=\"img\" aria-label=\"'+je(name)+'与判断时间的对照\"><title>'+je(name)+'年度公布值趋势；判断年份'+year+'</title>';\n if(year<rows.at(-1).year)svg+='<rect x=\"'+Math.max(pad,x(year)+1)+'\" y=\"25\" width=\"'+Math.max(0,w-pad-Math.max(pad,x(year)+1))+'\" height=\"'+(h-pad-25)+'\" fill=\"#e6eed9\"/>';\n for(let j=0;j<=4;j++){const n=min+span*j/4;svg+='<line x1=\"'+pad+'\" y1=\"'+yp(n)+'\" x2=\"'+(w-pad)+'\" y2=\"'+yp(n)+'\" stroke=\"#d8ded3\"/><text x=\"2\" y=\"'+(yp(n)+4)+'\" font-size=\"11\" fill=\"#737d73\">'+n.toFixed(1)+'</text>';}\n let segment=[];const draw=()=>{if(segment.length)svg+='<polyline fill=\"none\" stroke=\"#406b4f\" stroke-width=\"2.5\" points=\"'+segment.map(p=>x(p.year)+','+yp(p.values[0].value)).join(' ')+'\"/>';segment=[];};\n for(const p of rows){if(typeof p.values[0]?.value==='number')segment.push(p);else draw();}draw();\n if(year>=rows[0].year&&year<=rows.at(-1).year)svg+='<line x1=\"'+x(year)+'\" y1=\"22\" x2=\"'+x(year)+'\" y2=\"'+(h-pad)+'\" stroke=\"#9b7a30\" stroke-dasharray=\"5 4\"/><text x=\"'+Math.min(w-200,Math.max(pad,x(year)+8))+'\" y=\"16\" font-size=\"12\" fill=\"#806329\">'+je(date)+' 判断时点</text>';\n for(const p of rows){if(typeof p.values[0]?.value==='number')svg+='<circle cx=\"'+x(p.year)+'\" cy=\"'+yp(p.values[0].value)+'\" r=\"4\" fill=\"'+(p.year>year?'#295b45':'#8a9c87')+'\"><title>'+p.year+'：'+number(p.values[0].value)+'% · '+judgmentPhase(p.year,date)+'</title></circle>';svg+='<text x=\"'+x(p.year)+'\" y=\"'+(h-15)+'\" text-anchor=\"middle\" font-size=\"11\" fill=\"#737d73\">'+p.year+'</text>';}\n $('judgment-trend').innerHTML=svg+'</svg>';\n }\n $('judgment-trend-table').innerHTML=rows.map(p=>{const m=p.values[0];return '<tr><td>'+p.year+'</td><td>'+number(m?.value)+(typeof m?.value==='number'?'%':'')+'</td><td>'+je(r?judgmentPhase(p.year,date):'该年观点未收录')+'</td><td>'+je(m?.basis||'缺项')+' · <a href=\"'+je(p.source)+'\" target=\"_blank\" rel=\"noopener\">当年公报 ↗</a></td></tr>';}).join('');\n const post=valid.filter(p=>p.year>year),last=valid.at(-1);\n let note='本站复盘：'+(r?(post.length?'已有 '+post.length+' 个判断后的完整年度可观察。最新为 '+last.year+'年 '+number(last.values[0].value)+'%。':'当前缺少判断后的完整年度数据，不下结论。'):'本年观点尚未收录，下方仅展示数据背景。');\n if(r?.id==='turning'){\n  const recent=currentReports().filter(x=>x.kind==='annual'&&x.year>=2025).at(-1);\n  if(recent){const v=id=>number(recent.metrics.find(m=>m.id===id)?.value);note+=' '+recent.year+'年，GDP '+v('gdp')+'%、社零 '+v('retail')+'%、地产投资 '+v('property')+'%、销售面积 '+v('sales')+'%、调查失业率均值 '+v('unemployment')+'%。这些是不同口径的并列观察，尚不能仅凭总量增长判定转折已完成。';}\n }\n note+=' '+(r?.limit||'不以后来观点补写当年观点。')+' 各年保留当版公报公布值，统计修订和基数变化会影响可比性。当前年内进展不接到全年曲线上。';\n $('judgment-observation').textContent=note;\n}\nfunction renderAnnualJudgments(report){\n const root=$('annual-judgments');if(!root)return;const records=judgmentsForYear(judgmentData,report.year);\n root.innerHTML='<h3>当时的判断与年度回看</h3><p class=\"fine\">观点是公开资料选集；数据与复盘由本站整理，不是高善文本人撰写的报告。</p>'+(records.length?records.map(r=>judgmentCard(r,true)).join(''):'<p>'+report.year+'年尚未收录已核实的当年观点，不用2024年的演讲倒推。</p>')+(report.year>=2024?'<p>'+ (report.year===2024?'2024全年属于判断形成背景，不能当作后验验证。':'持续跟踪的是2024年的观点，并不代表讲者在'+report.year+'年重新发表相同判断。')+'</p>':'<p class=\"fine\">本年数据是后来2024年研究的历史背景，不属于该次演讲的事后验证。</p>')+'<a href=\"#judgments\" id=\"annual-to-judgment\">打开判断与年度趋势 ↗</a>';\n $('annual-to-judgment').onclick=()=>{judgmentMode='history';judgmentYear=report.year;renderJudgments()};\n}\n$('judgment-mode-speech').onclick=()=>setJudgmentMode('speech');$('judgment-mode-history').onclick=()=>setJudgmentMode('history');\n$('judgment-select').onchange=e=>{if(judgmentMode==='speech')judgmentSelection=e.target.value;else judgmentYear=Number(e.target.value);renderJudgments()};$('judgment-metric').onchange=renderJudgmentTrend;\nrenderJudgments();\n\nwindow.judgmentsReady=true;\n</script></html>";
const SPEECH={
  "version": 1,
  "asOf": "2024-12-03",
  "retrievedAt": "2026-10-25T22:09:34.716759+00:00",
  "source": {
    "url": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf",
    "mirror": "https://statics.biogeeker.com/obsidian/202412100302794.pdf",
    "sha256": "76544e0149ff4409577f079c4707609de837c1f24229a470fbeaa35ac394346c",
    "pages": 30,
    "provenance": "第三方保存的演讲幻灯片；与公开听打稿逐项核对。"
  },
  "classification": [
    {
      "name": "支持",
      "count": 2341,
      "industries": [
        "电力设备",
        "电子",
        "机械设备",
        "国防军工",
        "汽车",
        "计算机",
        "通信"
      ]
    },
    {
      "name": "中性",
      "count": 2638,
      "industries": [
        "商贸零售",
        "社会服务（不包括教育）",
        "基础化工",
        "钢铁",
        "有色金属",
        "建筑材料",
        "家用电器",
        "纺织服饰",
        "轻工制造",
        "农林牧渔",
        "食品饮料",
        "医药生物",
        "公用事业",
        "交通运输",
        "煤炭",
        "石油石化",
        "环保",
        "美容护理"
      ]
    },
    {
      "name": "限制",
      "count": 473,
      "countDetail": "A股342；中概股131（原表备注：没有国企）",
      "industries": [
        "房地产",
        "非银金融",
        "传媒",
        "教育（二级）",
        "中概股中的房地产、保险、媒体、软件与服务"
      ]
    }
  ],
  "classificationPage": 3,
  "charts": [
    {
      "id": "slide-04",
      "page": 4,
      "title": "三类公司的营业收入占比",
      "section": "企业与转型",
      "kind": "line",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=4",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "支持类",
          "color": "#ff0000",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2016",
              "y": 20.55
            },
            {
              "x": 1,
              "label": "2017",
              "y": 20.59
            },
            {
              "x": 2,
              "label": "2018",
              "y": 20.16
            },
            {
              "x": 3,
              "label": "2019",
              "y": 19.95
            },
            {
              "x": 4,
              "label": "2020",
              "y": 20.92
            },
            {
              "x": 5,
              "label": "2021",
              "y": 20.31
            },
            {
              "x": 6,
              "label": "2022",
              "y": 21.55
            },
            {
              "x": 7,
              "label": "2023",
              "y": 24.11
            },
            {
              "x": 8,
              "label": "2024-09",
              "y": 25.0
            }
          ]
        },
        {
          "name": "限制类",
          "color": "#0070c0",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2016",
              "y": 14.61
            },
            {
              "x": 1,
              "label": "2017",
              "y": 13.78
            },
            {
              "x": 2,
              "label": "2018",
              "y": 13.33
            },
            {
              "x": 3,
              "label": "2019",
              "y": 15.39
            },
            {
              "x": 4,
              "label": "2020",
              "y": 16.05
            },
            {
              "x": 5,
              "label": "2021",
              "y": 14.4
            },
            {
              "x": 6,
              "label": "2022",
              "y": 12.26
            },
            {
              "x": 7,
              "label": "2023",
              "y": 11.01
            },
            {
              "x": 8,
              "label": "2024-09",
              "y": 9.63
            }
          ]
        },
        {
          "name": "中性类",
          "color": "#70ad47",
          "axis": "right",
          "points": [
            {
              "x": 0,
              "label": "2016",
              "y": 64.85
            },
            {
              "x": 1,
              "label": "2017",
              "y": 65.66
            },
            {
              "x": 2,
              "label": "2018",
              "y": 66.52
            },
            {
              "x": 3,
              "label": "2019",
              "y": 64.65
            },
            {
              "x": 4,
              "label": "2020",
              "y": 63.04
            },
            {
              "x": 5,
              "label": "2021",
              "y": 65.29
            },
            {
              "x": 6,
              "label": "2022",
              "y": 66.18
            },
            {
              "x": 7,
              "label": "2023",
              "y": 64.87
            },
            {
              "x": 8,
              "label": "2024-09",
              "y": 65.37
            }
          ]
        }
      ],
      "method": "固定公司样本；组内营业总收入之和 / 全样本营业总收入。中性类使用右轴。",
      "limits": [
        "固定样本和行业规则已知；逐公司证券名单、汇率和跨市场去重规则仍未取得。"
      ],
      "labels": [
        "2016",
        "2017",
        "2018",
        "2019",
        "2020",
        "2021",
        "2022",
        "2023",
        "2024-09"
      ],
      "axis": {
        "left": [
          9,
          30
        ],
        "right": [
          40,
          70
        ],
        "yTicks": [
          9,
          14,
          19,
          24,
          29
        ],
        "rightTicks": [
          40,
          45,
          50,
          55,
          60,
          65,
          70
        ]
      },
      "digitizationError": 0.018
    },
    {
      "id": "slide-05",
      "page": 5,
      "title": "三类公司的总市值占比",
      "section": "企业与转型",
      "kind": "line",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=5",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "支持类",
          "color": "#ff0000",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2016",
              "y": 27.28
            },
            {
              "x": 1,
              "label": "2017",
              "y": 25.8
            },
            {
              "x": 2,
              "label": "2018",
              "y": 24.93
            },
            {
              "x": 3,
              "label": "2019",
              "y": 27.18
            },
            {
              "x": 4,
              "label": "2020",
              "y": 30.98
            },
            {
              "x": 5,
              "label": "2021",
              "y": 35.72
            },
            {
              "x": 6,
              "label": "2022",
              "y": 33.5
            },
            {
              "x": 7,
              "label": "2023",
              "y": 36.79
            },
            {
              "x": 8,
              "label": "2024-09",
              "y": 36.41
            }
          ]
        },
        {
          "name": "中性类",
          "color": "#70ad47",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2016",
              "y": 52.51
            },
            {
              "x": 1,
              "label": "2017",
              "y": 53.35
            },
            {
              "x": 2,
              "label": "2018",
              "y": 54.58
            },
            {
              "x": 3,
              "label": "2019",
              "y": 51.13
            },
            {
              "x": 4,
              "label": "2020",
              "y": 51.08
            },
            {
              "x": 5,
              "label": "2021",
              "y": 51.08
            },
            {
              "x": 6,
              "label": "2022",
              "y": 53.3
            },
            {
              "x": 7,
              "label": "2023",
              "y": 50.73
            },
            {
              "x": 8,
              "label": "2024-09",
              "y": 49.84
            }
          ]
        },
        {
          "name": "限制类",
          "color": "#0070c0",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2016",
              "y": 20.22
            },
            {
              "x": 1,
              "label": "2017",
              "y": 20.86
            },
            {
              "x": 2,
              "label": "2018",
              "y": 20.52
            },
            {
              "x": 3,
              "label": "2019",
              "y": 21.7
            },
            {
              "x": 4,
              "label": "2020",
              "y": 17.95
            },
            {
              "x": 5,
              "label": "2021",
              "y": 13.21
            },
            {
              "x": 6,
              "label": "2022",
              "y": 13.21
            },
            {
              "x": 7,
              "label": "2023",
              "y": 12.5
            },
            {
              "x": 8,
              "label": "2024-09",
              "y": 13.75
            }
          ]
        }
      ],
      "method": "同一固定样本，各组总市值除以全部样本总市值。",
      "limits": [
        "金融企业、A/H 双重上市及 ADR 的市值口径需要原始样本表核对。"
      ],
      "labels": [
        "2016",
        "2017",
        "2018",
        "2019",
        "2020",
        "2021",
        "2022",
        "2023",
        "2024-09"
      ],
      "axis": {
        "left": [
          0,
          60
        ],
        "yTicks": [
          0,
          10,
          20,
          30,
          40,
          50,
          60
        ]
      },
      "digitizationError": 0.051
    },
    {
      "id": "slide-06",
      "page": 6,
      "title": "相对中性行业的股价表现",
      "section": "企业与转型",
      "kind": "line",
      "unit": "2018=1",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=6",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "支持类 / 中性类",
          "color": "#ff0000",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2009",
              "y": 1.02
            },
            {
              "x": 1,
              "label": "2010",
              "y": 1.15
            },
            {
              "x": 2,
              "label": "2011",
              "y": 0.95
            },
            {
              "x": 3,
              "label": "2012",
              "y": 0.9
            },
            {
              "x": 4,
              "label": "2013",
              "y": 1.17
            },
            {
              "x": 5,
              "label": "2014",
              "y": 1.12
            },
            {
              "x": 6,
              "label": "2015",
              "y": 1.36
            },
            {
              "x": 7,
              "label": "2016",
              "y": 1.21
            },
            {
              "x": 8,
              "label": "2017",
              "y": 1.12
            },
            {
              "x": 9,
              "label": "2018",
              "y": 1.0
            },
            {
              "x": 10,
              "label": "2019",
              "y": 1.17
            },
            {
              "x": 11,
              "label": "2020",
              "y": 1.35
            },
            {
              "x": 12,
              "label": "2021",
              "y": 1.41
            },
            {
              "x": 13,
              "label": "2022",
              "y": 1.21
            },
            {
              "x": 14,
              "label": "2023",
              "y": 1.33
            },
            {
              "x": 15,
              "label": "2024-11-22",
              "y": 1.29
            }
          ]
        },
        {
          "name": "限制类 / 中性类",
          "color": "#0070c0",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2009",
              "y": 0.57
            },
            {
              "x": 1,
              "label": "2010",
              "y": 0.52
            },
            {
              "x": 2,
              "label": "2011",
              "y": 0.58
            },
            {
              "x": 3,
              "label": "2012",
              "y": 0.71
            },
            {
              "x": 4,
              "label": "2013",
              "y": 0.8
            },
            {
              "x": 5,
              "label": "2014",
              "y": 1.0
            },
            {
              "x": 6,
              "label": "2015",
              "y": 1.02
            },
            {
              "x": 7,
              "label": "2016",
              "y": 0.95
            },
            {
              "x": 8,
              "label": "2017",
              "y": 1.03
            },
            {
              "x": 9,
              "label": "2018",
              "y": 1.0
            },
            {
              "x": 10,
              "label": "2019",
              "y": 1.05
            },
            {
              "x": 11,
              "label": "2020",
              "y": 0.82
            },
            {
              "x": 12,
              "label": "2021",
              "y": 0.59
            },
            {
              "x": 13,
              "label": "2022",
              "y": 0.58
            },
            {
              "x": 14,
              "label": "2023",
              "y": 0.6
            },
            {
              "x": 15,
              "label": "2024-11-22",
              "y": 0.64
            }
          ]
        }
      ],
      "method": "先取类别组合股价相对中性类别的比值，再按 2018 年归一化。不是上证指数或未除以中性行业的绝对收益。",
      "limits": [
        "原稿没有给出完整的价格调整、分红和组合权重规则；此处恢复图中比值，不用行业指数冒充。"
      ],
      "labels": [
        "2009",
        "2010",
        "2011",
        "2012",
        "2013",
        "2014",
        "2015",
        "2016",
        "2017",
        "2018",
        "2019",
        "2020",
        "2021",
        "2022",
        "2023",
        "2024-11-22"
      ],
      "axis": {
        "left": [
          0.4,
          1.6
        ],
        "yTicks": [
          0.4,
          0.6,
          0.8,
          1,
          1.2,
          1.4,
          1.6
        ]
      },
      "digitizationError": 0.001
    },
    {
      "id": "slide-07",
      "page": 7,
      "title": "中性行业营业总收入增速",
      "section": "企业与转型",
      "kind": "line",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=7",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "中性行业",
          "color": "#ff0000",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2017",
              "y": 22.81
            },
            {
              "x": 1,
              "label": "2018",
              "y": 17.19
            },
            {
              "x": 2,
              "label": "2019",
              "y": 10.34
            },
            {
              "x": 3,
              "label": "2020",
              "y": 2.19
            },
            {
              "x": 4,
              "label": "2021",
              "y": 28.03
            },
            {
              "x": 5,
              "label": "2022",
              "y": 12.21
            },
            {
              "x": 6,
              "label": "2023",
              "y": 2.48
            },
            {
              "x": 7,
              "label": "2024-09",
              "y": -2.28
            }
          ]
        }
      ],
      "method": "同一固定中性公司样本的组内营收合计同比。2024 点是截至三季度口径。",
      "limits": [
        "季度累计与完整年度不同；原稿样本内公司名单仍缺失。"
      ],
      "labels": [
        "2017",
        "2018",
        "2019",
        "2020",
        "2021",
        "2022",
        "2023",
        "2024-09"
      ],
      "axis": {
        "left": [
          -5,
          30
        ],
        "yTicks": [
          -5,
          0,
          5,
          10,
          15,
          20,
          25,
          30
        ]
      },
      "digitizationError": 0.03
    },
    {
      "id": "slide-08",
      "page": 8,
      "title": "中性行业员工总数增速",
      "section": "企业与转型",
      "kind": "line",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=8",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "中性行业",
          "color": "#ff0000",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2017",
              "y": 3.43
            },
            {
              "x": 1,
              "label": "2018",
              "y": 8.05
            },
            {
              "x": 2,
              "label": "2019",
              "y": 4.23
            },
            {
              "x": 3,
              "label": "2020",
              "y": 4.67
            },
            {
              "x": 4,
              "label": "2021",
              "y": 7.0
            },
            {
              "x": 5,
              "label": "2022",
              "y": 5.6
            },
            {
              "x": 6,
              "label": "2023",
              "y": 2.84
            }
          ]
        }
      ],
      "method": "固定样本公司披露的员工人数合计同比；原图截至 2023 年。",
      "limits": [
        "员工披露口径和合并范围变化可影响增长。"
      ],
      "labels": [
        "2017",
        "2018",
        "2019",
        "2020",
        "2021",
        "2022",
        "2023"
      ],
      "axis": {
        "left": [
          2,
          9
        ],
        "yTicks": [
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9
        ]
      },
      "digitizationError": 0.006
    },
    {
      "id": "slide-10",
      "page": 10,
      "title": "人口年龄结构与消费：疫情前",
      "section": "消费与信心",
      "kind": "scatter",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=10",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "原图散点",
          "points": [
            {
              "x": 84.989,
              "y": 10.997,
              "label": "安徽",
              "color": "#4f81bd"
            },
            {
              "x": 86.699,
              "y": 4.223,
              "label": "北京",
              "color": "#4f81bd"
            },
            {
              "x": 88.902,
              "y": 10.709,
              "label": "福建",
              "color": "#4f81bd"
            },
            {
              "x": 87.418,
              "y": 7.414,
              "label": "甘肃",
              "color": "#4f81bd"
            },
            {
              "x": 91.418,
              "y": 7.84,
              "label": "广东",
              "color": "#4f81bd"
            },
            {
              "x": 87.798,
              "y": 7.299,
              "label": "广西",
              "color": "#4f81bd"
            },
            {
              "x": 88.44,
              "y": 5.099,
              "label": "贵州",
              "color": "#4f81bd"
            },
            {
              "x": 89.569,
              "y": 5.179,
              "label": "海南",
              "color": "#4f81bd"
            },
            {
              "x": 86.078,
              "y": 8.624,
              "label": "河北",
              "color": "#4f81bd"
            },
            {
              "x": 86.509,
              "y": 10.444,
              "label": "河南",
              "color": "#4f81bd"
            },
            {
              "x": 84.389,
              "y": 6.297,
              "label": "黑龙江",
              "color": "#4f81bd"
            },
            {
              "x": 85.41,
              "y": 10.467,
              "label": "湖北",
              "color": "#4f81bd"
            },
            {
              "x": 85.19,
              "y": 9.902,
              "label": "湖南",
              "color": "#4f81bd"
            },
            {
              "x": 84.389,
              "y": 3.855,
              "label": "吉林",
              "color": "#4f81bd"
            },
            {
              "x": 83.798,
              "y": 6.873,
              "label": "江苏",
              "color": "#4f81bd"
            },
            {
              "x": 88.111,
              "y": 11.158,
              "label": "江西",
              "color": "#4f81bd"
            },
            {
              "x": 82.581,
              "y": 6.078,
              "label": "辽宁",
              "color": "#4f81bd"
            },
            {
              "x": 86.951,
              "y": 4.661,
              "label": "内蒙古",
              "color": "#4f81bd"
            },
            {
              "x": 90.38,
              "y": 4.799,
              "label": "宁夏",
              "color": "#4f81bd"
            },
            {
              "x": 91.32,
              "y": 6.158,
              "label": "青海",
              "color": "#4f81bd"
            },
            {
              "x": 84.871,
              "y": 7.138,
              "label": "山东",
              "color": "#4f81bd"
            },
            {
              "x": 87.1,
              "y": 8.059,
              "label": "山西",
              "color": "#4f81bd"
            },
            {
              "x": 86.679,
              "y": 8.002,
              "label": "陕西",
              "color": "#4f81bd"
            },
            {
              "x": 83.721,
              "y": 7.253,
              "label": "上海",
              "color": "#4f81bd"
            },
            {
              "x": 83.069,
              "y": 10.444,
              "label": "四川",
              "color": "#4f81bd"
            },
            {
              "x": 85.251,
              "y": -0.638,
              "label": "天津",
              "color": "#4f81bd"
            },
            {
              "x": 94.329,
              "y": 8.877,
              "label": "西藏",
              "color": "#4f81bd"
            },
            {
              "x": 92.239,
              "y": 5.237,
              "label": "新疆",
              "color": "#4f81bd"
            },
            {
              "x": 89.251,
              "y": 10.743,
              "label": "云南",
              "color": "#4f81bd"
            },
            {
              "x": 86.73,
              "y": 8.635,
              "label": "浙江",
              "color": "#4f81bd"
            },
            {
              "x": 82.92,
              "y": 8.601,
              "label": "重庆",
              "color": "#4f81bd"
            }
          ]
        }
      ],
      "xLabel": "65岁以下人口占比，%",
      "yLabel": "2018—2019 社零同比平均，%",
      "method": "省级横截面：65岁以下人口占比与 2018—2019 社零平均同比。",
      "limits": [
        "恢复了图中的省份点值；人口年龄结构基准年的原稿说明仍不充分。",
        "从恢复散点复算OLS斜率约−0.018，原图却标注+0.02、截距7.20，与图中散点不一致；不把原图方程当作已通过核验的拟合结果。"
      ],
      "axis": {
        "x": [
          80,
          96
        ],
        "left": [
          -2,
          12
        ],
        "yTicks": [
          -2,
          0,
          2,
          4,
          6,
          8,
          10,
          12
        ],
        "xTicks": [
          80,
          82,
          84,
          86,
          88,
          90,
          92,
          94,
          96
        ]
      },
      "regression": {
        "slope": 0.02,
        "intercept": 7.2,
        "r2": 0.0,
        "p": 0.92
      },
      "drawnFit": [
        {
          "x": 82.5801,
          "y": 7.5117
        },
        {
          "x": 94.33,
          "y": 7.3034
        }
      ],
      "recoveredOLS": {
        "n": 31,
        "slope": -0.01778,
        "intercept": 8.97963,
        "r2": 0.00038
      }
    },
    {
      "id": "slide-11",
      "page": 11,
      "title": "人口年龄结构与消费：疫情后",
      "section": "消费与信心",
      "kind": "scatter",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=11",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "原图散点",
          "points": [
            {
              "x": 84.989,
              "y": 4.102,
              "label": "安徽",
              "color": "#4f81bd"
            },
            {
              "x": 86.699,
              "y": 0.995,
              "label": "北京",
              "color": "#4f81bd"
            },
            {
              "x": 88.902,
              "y": 5.392,
              "label": "福建",
              "color": "#4f81bd"
            },
            {
              "x": 87.418,
              "y": 3.404,
              "label": "甘肃",
              "color": "#4f81bd"
            },
            {
              "x": 91.418,
              "y": 2.101,
              "label": "广东",
              "color": "#4f81bd"
            },
            {
              "x": 87.798,
              "y": 1.1,
              "label": "广西",
              "color": "#4f81bd"
            },
            {
              "x": 89.569,
              "y": -5.798,
              "label": "海南",
              "color": "#4f81bd"
            },
            {
              "x": 86.078,
              "y": 4.484,
              "label": "河北",
              "color": "#4f81bd"
            },
            {
              "x": 86.509,
              "y": 5.603,
              "label": "河南",
              "color": "#4f81bd"
            },
            {
              "x": 84.389,
              "y": 1.6,
              "label": "黑龙江",
              "color": "#4f81bd"
            },
            {
              "x": 85.41,
              "y": 5.629,
              "label": "湖北",
              "color": "#4f81bd"
            },
            {
              "x": 85.19,
              "y": 5.892,
              "label": "湖南",
              "color": "#4f81bd"
            },
            {
              "x": 84.389,
              "y": 3.904,
              "label": "吉林",
              "color": "#4f81bd"
            },
            {
              "x": 83.798,
              "y": 5.497,
              "label": "江苏",
              "color": "#4f81bd"
            },
            {
              "x": 88.111,
              "y": 4.8,
              "label": "江西",
              "color": "#4f81bd"
            },
            {
              "x": 82.581,
              "y": 5.194,
              "label": "辽宁",
              "color": "#4f81bd"
            },
            {
              "x": 86.951,
              "y": 2.496,
              "label": "内蒙古",
              "color": "#4f81bd"
            },
            {
              "x": 90.38,
              "y": 1.403,
              "label": "宁夏",
              "color": "#4f81bd"
            },
            {
              "x": 91.32,
              "y": -4.508,
              "label": "青海",
              "color": "#4f81bd"
            },
            {
              "x": 84.871,
              "y": 5.497,
              "label": "山东",
              "color": "#4f81bd"
            },
            {
              "x": 87.1,
              "y": 2.403,
              "label": "山西",
              "color": "#4f81bd"
            },
            {
              "x": 86.679,
              "y": 2.496,
              "label": "陕西",
              "color": "#4f81bd"
            },
            {
              "x": 83.721,
              "y": -0.704,
              "label": "上海",
              "color": "#4f81bd"
            },
            {
              "x": 83.069,
              "y": 4.997,
              "label": "四川",
              "color": "#4f81bd"
            },
            {
              "x": 85.251,
              "y": -1.006,
              "label": "天津",
              "color": "#4f81bd"
            },
            {
              "x": 94.329,
              "y": 1.403,
              "label": "西藏",
              "color": "#4f81bd"
            },
            {
              "x": 92.239,
              "y": 0.1,
              "label": "新疆",
              "color": "#4f81bd"
            },
            {
              "x": 89.251,
              "y": 2.996,
              "label": "云南",
              "color": "#4f81bd"
            },
            {
              "x": 86.73,
              "y": 5.3,
              "label": "浙江",
              "color": "#4f81bd"
            },
            {
              "x": 82.92,
              "y": 4.602,
              "label": "重庆",
              "color": "#4f81bd"
            }
          ]
        }
      ],
      "xLabel": "65岁以下人口占比，%",
      "yLabel": "2024 年 1—5 月社零累计同比，%",
      "method": "30 个省份的图中观测；23省用2024年1—5月，其余用最近进度，最早为1—3月。",
      "limits": [
        "不是同一观察窗口的严格可比面板；与疫情前图的样本量也不同。横截面相关不能直接识别年龄的因果影响。"
      ],
      "axis": {
        "x": [
          80,
          96
        ],
        "left": [
          -8,
          8
        ],
        "yTicks": [
          -8,
          -6,
          -4,
          -2,
          0,
          2,
          4,
          6,
          8
        ],
        "xTicks": [
          80,
          82,
          84,
          86,
          88,
          90,
          92,
          94,
          96
        ]
      },
      "regression": {
        "slope": -0.47,
        "intercept": 43.19,
        "r2": 0.22,
        "p": 0.01
      },
      "drawnFit": [
        {
          "x": 82.5801,
          "y": 4.7418
        },
        {
          "x": 94.33,
          "y": -0.7295
        }
      ],
      "recoveredOLS": {
        "n": 30,
        "slope": -0.46546,
        "intercept": 43.17712,
        "r2": 0.21896
      }
    },
    {
      "id": "slide-12",
      "page": 12,
      "title": "房价与调整后消费：疫情前",
      "section": "消费与信心",
      "kind": "scatter",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=12",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "原图散点",
          "points": [
            {
              "x": 3.805,
              "y": 28.975,
              "label": "观测 1",
              "color": "#4f81bd"
            },
            {
              "x": 4.801,
              "y": 0.374,
              "label": "观测 2",
              "color": "#4f81bd"
            },
            {
              "x": 3.856,
              "y": -2.704,
              "label": "观测 3",
              "color": "#4f81bd"
            },
            {
              "x": 1.972,
              "y": 1.279,
              "label": "观测 4",
              "color": "#4f81bd"
            },
            {
              "x": 1.643,
              "y": 1.279,
              "label": "观测 5",
              "color": "#4f81bd"
            },
            {
              "x": 2.157,
              "y": 6.709,
              "label": "观测 6",
              "color": "#4f81bd"
            },
            {
              "x": 1.233,
              "y": 14.403,
              "label": "观测 7",
              "color": "#4f81bd"
            },
            {
              "x": -0.492,
              "y": 6.302,
              "label": "观测 8",
              "color": "#4f81bd"
            },
            {
              "x": 0.226,
              "y": -1.21,
              "label": "观测 9",
              "color": "#4f81bd"
            },
            {
              "x": -2.233,
              "y": 2.772,
              "label": "观测 10",
              "color": "#4f81bd"
            },
            {
              "x": -2.254,
              "y": 16.711,
              "label": "观测 11",
              "color": "#4f81bd"
            },
            {
              "x": -2.823,
              "y": 10.285,
              "label": "观测 12",
              "color": "#4f81bd"
            },
            {
              "x": 2.249,
              "y": 31.871,
              "label": "观测 13",
              "color": "#4f81bd"
            },
            {
              "x": 1.885,
              "y": -1.391,
              "label": "观测 14",
              "color": "#4f81bd"
            },
            {
              "x": -0.621,
              "y": -1.798,
              "label": "观测 15",
              "color": "#4f81bd"
            },
            {
              "x": 0.319,
              "y": -0.486,
              "label": "观测 16",
              "color": "#4f81bd"
            },
            {
              "x": 1.243,
              "y": 0.283,
              "label": "观测 17",
              "color": "#4f81bd"
            },
            {
              "x": -0.955,
              "y": 5.578,
              "label": "观测 18",
              "color": "#4f81bd"
            },
            {
              "x": -3.45,
              "y": 9.606,
              "label": "观测 19",
              "color": "#4f81bd"
            },
            {
              "x": -2.336,
              "y": 7.207,
              "label": "观测 20",
              "color": "#4f81bd"
            },
            {
              "x": -0.282,
              "y": 5.488,
              "label": "观测 21",
              "color": "#4f81bd"
            },
            {
              "x": 0.504,
              "y": 4.583,
              "label": "观测 22",
              "color": "#4f81bd"
            },
            {
              "x": -6.818,
              "y": 5.714,
              "label": "观测 23",
              "color": "#4f81bd"
            },
            {
              "x": -0.657,
              "y": 0.51,
              "label": "观测 24",
              "color": "#4f81bd"
            },
            {
              "x": 2.645,
              "y": 21.915,
              "label": "观测 25",
              "color": "#4f81bd"
            },
            {
              "x": 1.289,
              "y": -0.215,
              "label": "观测 26",
              "color": "#4f81bd"
            },
            {
              "x": -4.359,
              "y": 5.895,
              "label": "观测 27",
              "color": "#4f81bd"
            },
            {
              "x": -4.543,
              "y": 0.012,
              "label": "观测 28",
              "color": "#4f81bd"
            },
            {
              "x": -0.688,
              "y": 0.193,
              "label": "观测 29",
              "color": "#4f81bd"
            },
            {
              "x": 1.931,
              "y": 0.872,
              "label": "观测 30",
              "color": "#4f81bd"
            },
            {
              "x": -1.53,
              "y": 5.307,
              "label": "观测 31",
              "color": "#4f81bd"
            },
            {
              "x": -2.669,
              "y": 7.479,
              "label": "观测 32",
              "color": "#4f81bd"
            },
            {
              "x": 1.51,
              "y": -0.712,
              "label": "观测 33",
              "color": "#4f81bd"
            },
            {
              "x": -2.064,
              "y": 3.089,
              "label": "观测 34",
              "color": "#4f81bd"
            },
            {
              "x": -2.541,
              "y": 14.584,
              "label": "观测 35",
              "color": "#4f81bd"
            },
            {
              "x": -1.858,
              "y": 2.591,
              "label": "观测 36",
              "color": "#4f81bd"
            },
            {
              "x": -2.613,
              "y": 9.696,
              "label": "观测 37",
              "color": "#4f81bd"
            },
            {
              "x": -3.553,
              "y": -2.115,
              "label": "观测 38",
              "color": "#4f81bd"
            },
            {
              "x": -1.976,
              "y": 3.904,
              "label": "观测 39",
              "color": "#4f81bd"
            },
            {
              "x": -2.207,
              "y": 7.615,
              "label": "观测 40",
              "color": "#4f81bd"
            },
            {
              "x": -0.539,
              "y": 9.606,
              "label": "观测 41",
              "color": "#4f81bd"
            },
            {
              "x": -0.431,
              "y": 3.994,
              "label": "观测 42",
              "color": "#4f81bd"
            },
            {
              "x": -1.453,
              "y": 23.273,
              "label": "观测 43",
              "color": "#4f81bd"
            },
            {
              "x": -1.334,
              "y": 9.606,
              "label": "观测 44",
              "color": "#4f81bd"
            },
            {
              "x": -2.069,
              "y": 2.274,
              "label": "观测 45",
              "color": "#4f81bd"
            },
            {
              "x": -1.745,
              "y": -1.889,
              "label": "观测 46",
              "color": "#4f81bd"
            },
            {
              "x": -1.658,
              "y": 4.99,
              "label": "观测 47",
              "color": "#4f81bd"
            },
            {
              "x": -0.852,
              "y": 8.384,
              "label": "观测 48",
              "color": "#4f81bd"
            },
            {
              "x": -2.351,
              "y": 6.483,
              "label": "观测 49",
              "color": "#4f81bd"
            },
            {
              "x": -3.979,
              "y": 9.289,
              "label": "观测 50",
              "color": "#4f81bd"
            },
            {
              "x": -3.994,
              "y": -3.79,
              "label": "观测 51",
              "color": "#4f81bd"
            },
            {
              "x": -4.785,
              "y": 9.199,
              "label": "观测 52",
              "color": "#4f81bd"
            },
            {
              "x": -6.325,
              "y": 12.774,
              "label": "观测 53",
              "color": "#4f81bd"
            },
            {
              "x": -6.099,
              "y": 2.093,
              "label": "观测 54",
              "color": "#4f81bd"
            },
            {
              "x": 1.402,
              "y": 29.473,
              "label": "观测 55",
              "color": "#4f81bd"
            },
            {
              "x": 1.946,
              "y": -1.301,
              "label": "观测 56",
              "color": "#4f81bd"
            },
            {
              "x": -0.333,
              "y": 1.007,
              "label": "观测 57",
              "color": "#4f81bd"
            },
            {
              "x": -2.094,
              "y": 5.307,
              "label": "观测 58",
              "color": "#4f81bd"
            },
            {
              "x": 2.948,
              "y": 11.28,
              "label": "观测 59",
              "color": "#4f81bd"
            },
            {
              "x": 3.215,
              "y": 3.587,
              "label": "观测 60",
              "color": "#4f81bd"
            },
            {
              "x": -6.91,
              "y": 10.013,
              "label": "观测 61",
              "color": "#4f81bd"
            },
            {
              "x": 2.229,
              "y": 1.415,
              "label": "观测 62",
              "color": "#4f81bd"
            },
            {
              "x": -0.097,
              "y": 16.485,
              "label": "观测 63",
              "color": "#4f81bd"
            },
            {
              "x": 0.139,
              "y": 0.872,
              "label": "观测 64",
              "color": "#4f81bd"
            },
            {
              "x": -6.125,
              "y": 4.583,
              "label": "观测 65",
              "color": "#4f81bd"
            },
            {
              "x": -1.545,
              "y": 1.279,
              "label": "观测 66",
              "color": "#4f81bd"
            },
            {
              "x": -0.78,
              "y": 24.495,
              "label": "观测 67",
              "color": "#4f81bd"
            },
            {
              "x": -0.133,
              "y": 1.098,
              "label": "观测 68",
              "color": "#4f81bd"
            },
            {
              "x": -1.129,
              "y": 1.007,
              "label": "观测 69",
              "color": "#4f81bd"
            },
            {
              "x": -0.852,
              "y": -3.111,
              "label": "观测 70",
              "color": "#4f81bd"
            },
            {
              "x": 0.37,
              "y": 19.879,
              "label": "观测 71",
              "color": "#4f81bd"
            },
            {
              "x": 0.119,
              "y": 6.891,
              "label": "观测 72",
              "color": "#4f81bd"
            },
            {
              "x": -1.601,
              "y": 4.492,
              "label": "观测 73",
              "color": "#4f81bd"
            },
            {
              "x": -1.53,
              "y": 3.315,
              "label": "观测 74",
              "color": "#4f81bd"
            },
            {
              "x": 0.504,
              "y": 3.587,
              "label": "观测 75",
              "color": "#4f81bd"
            },
            {
              "x": 2.157,
              "y": 0.691,
              "label": "观测 76",
              "color": "#4f81bd"
            },
            {
              "x": -1.535,
              "y": 11.28,
              "label": "观测 77",
              "color": "#4f81bd"
            },
            {
              "x": -3.912,
              "y": -1.391,
              "label": "观测 78",
              "color": "#4f81bd"
            },
            {
              "x": 1.474,
              "y": 20.196,
              "label": "观测 79",
              "color": "#4f81bd"
            },
            {
              "x": 1.798,
              "y": 8.474,
              "label": "观测 80",
              "color": "#4f81bd"
            },
            {
              "x": 1.736,
              "y": 7.615,
              "label": "观测 81",
              "color": "#4f81bd"
            },
            {
              "x": 0.997,
              "y": -1.391,
              "label": "观测 82",
              "color": "#4f81bd"
            },
            {
              "x": 0.601,
              "y": 11.688,
              "label": "观测 83",
              "color": "#4f81bd"
            },
            {
              "x": 0.0,
              "y": 10.873,
              "label": "观测 84",
              "color": "#4f81bd"
            },
            {
              "x": -0.354,
              "y": 7.705,
              "label": "观测 85",
              "color": "#4f81bd"
            },
            {
              "x": 0.226,
              "y": -1.301,
              "label": "观测 86",
              "color": "#4f81bd"
            },
            {
              "x": -0.256,
              "y": 1.505,
              "label": "观测 87",
              "color": "#4f81bd"
            },
            {
              "x": -2.325,
              "y": 3.813,
              "label": "观测 88",
              "color": "#4f81bd"
            },
            {
              "x": -8.985,
              "y": 10.104,
              "label": "观测 89",
              "color": "#4f81bd"
            },
            {
              "x": -1.591,
              "y": 7.388,
              "label": "观测 90",
              "color": "#4f81bd"
            },
            {
              "x": 2.573,
              "y": 15.489,
              "label": "观测 91",
              "color": "#4f81bd"
            },
            {
              "x": 2.727,
              "y": 5.985,
              "label": "观测 92",
              "color": "#4f81bd"
            },
            {
              "x": 2.511,
              "y": -0.215,
              "label": "观测 93",
              "color": "#4f81bd"
            },
            {
              "x": 1.243,
              "y": 3.677,
              "label": "观测 94",
              "color": "#4f81bd"
            },
            {
              "x": 0.226,
              "y": 2.003,
              "label": "观测 95",
              "color": "#4f81bd"
            },
            {
              "x": -0.318,
              "y": 5.397,
              "label": "观测 96",
              "color": "#4f81bd"
            },
            {
              "x": -5.991,
              "y": -2.025,
              "label": "观测 97",
              "color": "#4f81bd"
            },
            {
              "x": -4.497,
              "y": 0.6,
              "label": "观测 98",
              "color": "#4f81bd"
            },
            {
              "x": -5.94,
              "y": 7.072,
              "label": "观测 99",
              "color": "#4f81bd"
            },
            {
              "x": -2.028,
              "y": 7.615,
              "label": "观测 100",
              "color": "#4f81bd"
            },
            {
              "x": -0.826,
              "y": 9.787,
              "label": "观测 101",
              "color": "#4f81bd"
            },
            {
              "x": 3.702,
              "y": 5.307,
              "label": "观测 102",
              "color": "#4f81bd"
            },
            {
              "x": 2.28,
              "y": 8.61,
              "label": "观测 103",
              "color": "#4f81bd"
            },
            {
              "x": 0.878,
              "y": 8.701,
              "label": "观测 104",
              "color": "#4f81bd"
            },
            {
              "x": -0.184,
              "y": 1.686,
              "label": "观测 105",
              "color": "#4f81bd"
            },
            {
              "x": 1.649,
              "y": -1.527,
              "label": "观测 106",
              "color": "#4f81bd"
            },
            {
              "x": 1.864,
              "y": 8.61,
              "label": "观测 107",
              "color": "#4f81bd"
            },
            {
              "x": 0.488,
              "y": 14.312,
              "label": "观测 108",
              "color": "#4f81bd"
            },
            {
              "x": -1.807,
              "y": 0.374,
              "label": "观测 109",
              "color": "#4f81bd"
            },
            {
              "x": 1.962,
              "y": -1.301,
              "label": "观测 110",
              "color": "#4f81bd"
            },
            {
              "x": 1.048,
              "y": 2.908,
              "label": "观测 111",
              "color": "#4f81bd"
            },
            {
              "x": -0.605,
              "y": 6.981,
              "label": "观测 112",
              "color": "#4f81bd"
            },
            {
              "x": -2.372,
              "y": 12.185,
              "label": "观测 113",
              "color": "#4f81bd"
            },
            {
              "x": 1.803,
              "y": 0.012,
              "label": "观测 114",
              "color": "#4f81bd"
            },
            {
              "x": 0.457,
              "y": 7.207,
              "label": "观测 115",
              "color": "#4f81bd"
            },
            {
              "x": -0.944,
              "y": 10.511,
              "label": "观测 116",
              "color": "#4f81bd"
            },
            {
              "x": 1.577,
              "y": 11.19,
              "label": "观测 117",
              "color": "#4f81bd"
            }
          ]
        }
      ],
      "xLabel": "二手住宅价格同比，%",
      "yLabel": "剔除人口等因素后的社零，%",
      "method": "将社零对常住人口增速、城镇化率及病床数对数回归，使用残差与房价增速比较。",
      "limits": [
        "残差化不等于消费原始增速；完整回归窗口、样本配对及控制变量底表未取得。"
      ],
      "axis": {
        "x": [
          -10,
          6
        ],
        "left": [
          -10,
          45
        ],
        "yTicks": [
          -10,
          -5,
          0,
          5,
          10,
          15,
          20,
          25,
          30,
          35,
          40,
          45
        ],
        "xTicks": [
          -10,
          -8,
          -6,
          -4,
          -2,
          0,
          2,
          4,
          6
        ]
      },
      "regression": {
        "slope": 0.16,
        "intercept": 6.29,
        "r2": 0.0,
        "p": 0.54
      },
      "drawnFit": [
        {
          "x": -8.9849,
          "y": 4.8891
        },
        {
          "x": 4.8003,
          "y": 7.0316
        }
      ],
      "recoveredOLS": {
        "n": 117,
        "slope": 0.15506,
        "intercept": 6.27923,
        "r2": 0.00327
      }
    },
    {
      "id": "slide-13",
      "page": 13,
      "title": "房价与调整后消费：疫情后",
      "section": "消费与信心",
      "kind": "scatter",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=13",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "原图散点",
          "points": [
            {
              "x": 10.076,
              "y": 6.492,
              "label": "观测 1",
              "color": "#4f81bd"
            },
            {
              "x": -11.253,
              "y": 2.592,
              "label": "观测 2",
              "color": "#4f81bd"
            },
            {
              "x": 8.155,
              "y": -3.406,
              "label": "观测 3",
              "color": "#4f81bd"
            },
            {
              "x": -4.177,
              "y": -6.615,
              "label": "观测 4",
              "color": "#4f81bd"
            },
            {
              "x": 4.531,
              "y": 0.395,
              "label": "观测 5",
              "color": "#4f81bd"
            },
            {
              "x": -5.708,
              "y": 1.901,
              "label": "观测 6",
              "color": "#4f81bd"
            },
            {
              "x": 1.036,
              "y": -3.999,
              "label": "观测 7",
              "color": "#4f81bd"
            },
            {
              "x": -2.791,
              "y": -3.406,
              "label": "观测 8",
              "color": "#4f81bd"
            },
            {
              "x": 2.047,
              "y": -1.703,
              "label": "观测 9",
              "color": "#4f81bd"
            },
            {
              "x": -6.386,
              "y": -5.208,
              "label": "观测 10",
              "color": "#4f81bd"
            },
            {
              "x": 4.054,
              "y": -4.912,
              "label": "观测 11",
              "color": "#4f81bd"
            },
            {
              "x": -1.794,
              "y": -10.392,
              "label": "观测 12",
              "color": "#4f81bd"
            },
            {
              "x": 5.31,
              "y": 8.097,
              "label": "观测 13",
              "color": "#4f81bd"
            },
            {
              "x": -9.866,
              "y": 3.703,
              "label": "观测 14",
              "color": "#4f81bd"
            },
            {
              "x": 1.527,
              "y": -1.999,
              "label": "观测 15",
              "color": "#4f81bd"
            },
            {
              "x": -2.097,
              "y": -9.207,
              "label": "观测 16",
              "color": "#4f81bd"
            },
            {
              "x": 7.578,
              "y": -0.592,
              "label": "观测 17",
              "color": "#4f81bd"
            },
            {
              "x": -12.047,
              "y": -6.615,
              "label": "观测 18",
              "color": "#4f81bd"
            },
            {
              "x": 4.906,
              "y": -5.899,
              "label": "观测 19",
              "color": "#4f81bd"
            },
            {
              "x": 0.877,
              "y": -7.208,
              "label": "观测 20",
              "color": "#4f81bd"
            },
            {
              "x": 8.588,
              "y": 3.703,
              "label": "观测 21",
              "color": "#4f81bd"
            },
            {
              "x": -7.469,
              "y": 8.689,
              "label": "观测 22",
              "color": "#4f81bd"
            },
            {
              "x": 2.032,
              "y": 0.593,
              "label": "观测 23",
              "color": "#4f81bd"
            },
            {
              "x": -2.256,
              "y": -11.009,
              "label": "观测 24",
              "color": "#4f81bd"
            },
            {
              "x": 5.209,
              "y": 1.506,
              "label": "观测 25",
              "color": "#4f81bd"
            },
            {
              "x": -5.852,
              "y": -6.714,
              "label": "观测 26",
              "color": "#4f81bd"
            },
            {
              "x": 4.646,
              "y": -1.802,
              "label": "观测 27",
              "color": "#4f81bd"
            },
            {
              "x": -1.968,
              "y": -9.207,
              "label": "观测 28",
              "color": "#4f81bd"
            },
            {
              "x": -1.087,
              "y": 2.987,
              "label": "观测 29",
              "color": "#4f81bd"
            },
            {
              "x": -3.123,
              "y": -3.703,
              "label": "观测 30",
              "color": "#4f81bd"
            },
            {
              "x": -1.505,
              "y": -2.715,
              "label": "观测 31",
              "color": "#4f81bd"
            },
            {
              "x": -1.809,
              "y": -8.393,
              "label": "观测 32",
              "color": "#4f81bd"
            },
            {
              "x": 10.394,
              "y": 2.592,
              "label": "观测 33",
              "color": "#4f81bd"
            },
            {
              "x": -6.791,
              "y": -1.308,
              "label": "观测 34",
              "color": "#4f81bd"
            },
            {
              "x": 0.603,
              "y": -3.999,
              "label": "观测 35",
              "color": "#4f81bd"
            },
            {
              "x": -2.632,
              "y": -9.405,
              "label": "观测 36",
              "color": "#4f81bd"
            },
            {
              "x": 8.199,
              "y": 1.407,
              "label": "观测 37",
              "color": "#4f81bd"
            },
            {
              "x": -8.235,
              "y": -3.604,
              "label": "观测 38",
              "color": "#4f81bd"
            },
            {
              "x": 2.61,
              "y": -3.011,
              "label": "观测 39",
              "color": "#4f81bd"
            },
            {
              "x": -1.202,
              "y": -10.195,
              "label": "观测 40",
              "color": "#4f81bd"
            },
            {
              "x": 10.177,
              "y": -3.9,
              "label": "观测 41",
              "color": "#4f81bd"
            },
            {
              "x": -7.729,
              "y": -4.813,
              "label": "观测 42",
              "color": "#4f81bd"
            },
            {
              "x": 1.267,
              "y": -2.913,
              "label": "观测 43",
              "color": "#4f81bd"
            },
            {
              "x": -2.314,
              "y": -4.394,
              "label": "观测 44",
              "color": "#4f81bd"
            },
            {
              "x": 2.697,
              "y": 5.801,
              "label": "观测 45",
              "color": "#4f81bd"
            },
            {
              "x": -4.162,
              "y": -0.592,
              "label": "观测 46",
              "color": "#4f81bd"
            },
            {
              "x": -1.274,
              "y": -5.307,
              "label": "观测 47",
              "color": "#4f81bd"
            },
            {
              "x": -4.653,
              "y": -15.403,
              "label": "观测 48",
              "color": "#4f81bd"
            },
            {
              "x": 1.975,
              "y": -1.802,
              "label": "观测 49",
              "color": "#4f81bd"
            },
            {
              "x": -6.776,
              "y": -6.294,
              "label": "观测 50",
              "color": "#4f81bd"
            },
            {
              "x": -4.235,
              "y": -5.899,
              "label": "观测 51",
              "color": "#4f81bd"
            },
            {
              "x": -5.52,
              "y": -9.602,
              "label": "观测 52",
              "color": "#4f81bd"
            },
            {
              "x": 11.823,
              "y": -1.506,
              "label": "观测 53",
              "color": "#4f81bd"
            },
            {
              "x": -14.646,
              "y": -2.394,
              "label": "观测 54",
              "color": "#4f81bd"
            },
            {
              "x": 12.69,
              "y": -3.505,
              "label": "观测 55",
              "color": "#4f81bd"
            },
            {
              "x": -5.245,
              "y": -6.813,
              "label": "观测 56",
              "color": "#4f81bd"
            },
            {
              "x": 8.329,
              "y": 3.802,
              "label": "观测 57",
              "color": "#4f81bd"
            },
            {
              "x": -6.242,
              "y": -3.801,
              "label": "观测 58",
              "color": "#4f81bd"
            },
            {
              "x": 0.141,
              "y": -6.294,
              "label": "观测 59",
              "color": "#4f81bd"
            },
            {
              "x": -1.043,
              "y": -8.195,
              "label": "观测 60",
              "color": "#4f81bd"
            },
            {
              "x": 11.924,
              "y": -0.395,
              "label": "观测 61",
              "color": "#4f81bd"
            },
            {
              "x": -1.101,
              "y": -1.901,
              "label": "观测 62",
              "color": "#4f81bd"
            },
            {
              "x": 1.007,
              "y": -5.011,
              "label": "观测 63",
              "color": "#4f81bd"
            },
            {
              "x": -1.058,
              "y": -11.997,
              "label": "观测 64",
              "color": "#4f81bd"
            },
            {
              "x": 0.314,
              "y": -3.604,
              "label": "观测 65",
              "color": "#4f81bd"
            },
            {
              "x": -5.751,
              "y": -3.604,
              "label": "观测 66",
              "color": "#4f81bd"
            },
            {
              "x": 5.527,
              "y": -1.999,
              "label": "观测 67",
              "color": "#4f81bd"
            },
            {
              "x": -1.448,
              "y": -8.195,
              "label": "观测 68",
              "color": "#4f81bd"
            },
            {
              "x": 2.148,
              "y": 0.593,
              "label": "观测 69",
              "color": "#4f81bd"
            },
            {
              "x": -7.166,
              "y": -5.899,
              "label": "观测 70",
              "color": "#4f81bd"
            },
            {
              "x": 0.256,
              "y": -6.492,
              "label": "观测 71",
              "color": "#4f81bd"
            },
            {
              "x": -1.072,
              "y": -7.8,
              "label": "观测 72",
              "color": "#4f81bd"
            },
            {
              "x": 1.715,
              "y": 4.986,
              "label": "观测 73",
              "color": "#4f81bd"
            },
            {
              "x": -2.487,
              "y": -1.012,
              "label": "观测 74",
              "color": "#4f81bd"
            },
            {
              "x": -0.394,
              "y": -2.098,
              "label": "观测 75",
              "color": "#4f81bd"
            },
            {
              "x": -2.054,
              "y": -8.393,
              "label": "观测 76",
              "color": "#4f81bd"
            },
            {
              "x": 21.383,
              "y": 6.887,
              "label": "观测 77",
              "color": "#4f81bd"
            },
            {
              "x": -14.025,
              "y": -1.407,
              "label": "观测 78",
              "color": "#4f81bd"
            },
            {
              "x": 3.968,
              "y": -5.11,
              "label": "观测 79",
              "color": "#4f81bd"
            },
            {
              "x": -11.354,
              "y": -9.602,
              "label": "观测 80",
              "color": "#4f81bd"
            },
            {
              "x": 10.379,
              "y": 2.296,
              "label": "观测 81",
              "color": "#4f81bd"
            },
            {
              "x": -4.018,
              "y": -6.294,
              "label": "观测 82",
              "color": "#4f81bd"
            },
            {
              "x": 2.379,
              "y": -5.504,
              "label": "观测 83",
              "color": "#4f81bd"
            },
            {
              "x": -1.881,
              "y": -16.193,
              "label": "观测 84",
              "color": "#4f81bd"
            },
            {
              "x": 8.314,
              "y": 4.986,
              "label": "观测 85",
              "color": "#4f81bd"
            },
            {
              "x": -3.787,
              "y": 0.0,
              "label": "观测 86",
              "color": "#4f81bd"
            },
            {
              "x": 0.43,
              "y": -1.308,
              "label": "观测 87",
              "color": "#4f81bd"
            },
            {
              "x": -0.061,
              "y": -12.194,
              "label": "观测 88",
              "color": "#4f81bd"
            },
            {
              "x": 6.61,
              "y": 1.308,
              "label": "观测 89",
              "color": "#4f81bd"
            },
            {
              "x": -8.523,
              "y": -5.208,
              "label": "观测 90",
              "color": "#4f81bd"
            },
            {
              "x": 7.202,
              "y": -5.504,
              "label": "观测 91",
              "color": "#4f81bd"
            },
            {
              "x": -1.101,
              "y": -9.997,
              "label": "观测 92",
              "color": "#4f81bd"
            },
            {
              "x": 3.087,
              "y": 3.086,
              "label": "观测 93",
              "color": "#4f81bd"
            },
            {
              "x": -1.679,
              "y": -3.011,
              "label": "观测 94",
              "color": "#4f81bd"
            },
            {
              "x": 0.329,
              "y": -5.504,
              "label": "观测 95",
              "color": "#4f81bd"
            },
            {
              "x": 0.025,
              "y": -9.8,
              "label": "观测 96",
              "color": "#4f81bd"
            },
            {
              "x": 7.809,
              "y": -2.098,
              "label": "观测 97",
              "color": "#4f81bd"
            },
            {
              "x": -10.935,
              "y": -4.097,
              "label": "观测 98",
              "color": "#4f81bd"
            },
            {
              "x": -0.899,
              "y": -3.801,
              "label": "观测 99",
              "color": "#4f81bd"
            },
            {
              "x": 5.195,
              "y": 1.802,
              "label": "观测 100",
              "color": "#4f81bd"
            },
            {
              "x": -6.3,
              "y": -7.109,
              "label": "观测 101",
              "color": "#4f81bd"
            },
            {
              "x": 4.227,
              "y": -5.307,
              "label": "观测 102",
              "color": "#4f81bd"
            },
            {
              "x": 1.123,
              "y": -9.207,
              "label": "观测 103",
              "color": "#4f81bd"
            },
            {
              "x": 13.296,
              "y": 4.394,
              "label": "观测 104",
              "color": "#4f81bd"
            },
            {
              "x": -5.419,
              "y": -1.999,
              "label": "观测 105",
              "color": "#4f81bd"
            },
            {
              "x": 5.108,
              "y": -5.504,
              "label": "观测 106",
              "color": "#4f81bd"
            },
            {
              "x": -0.032,
              "y": -7.998,
              "label": "观测 107",
              "color": "#4f81bd"
            },
            {
              "x": 1.137,
              "y": 5.307,
              "label": "观测 108",
              "color": "#4f81bd"
            },
            {
              "x": -4.264,
              "y": -2.394,
              "label": "观测 109",
              "color": "#4f81bd"
            },
            {
              "x": -1.982,
              "y": -0.814,
              "label": "观测 110",
              "color": "#4f81bd"
            },
            {
              "x": -3.094,
              "y": -7.208,
              "label": "观测 111",
              "color": "#4f81bd"
            },
            {
              "x": 4.892,
              "y": 1.901,
              "label": "观测 112",
              "color": "#4f81bd"
            },
            {
              "x": -14.3,
              "y": -3.209,
              "label": "观测 113",
              "color": "#4f81bd"
            },
            {
              "x": 14.899,
              "y": -1.999,
              "label": "观测 114",
              "color": "#4f81bd"
            },
            {
              "x": -7.383,
              "y": -6.813,
              "label": "观测 115",
              "color": "#4f81bd"
            },
            {
              "x": 6.668,
              "y": -1.407,
              "label": "观测 116",
              "color": "#4f81bd"
            },
            {
              "x": -9.534,
              "y": -9.602,
              "label": "观测 117",
              "color": "#4f81bd"
            },
            {
              "x": 5.368,
              "y": -4.912,
              "label": "观测 118",
              "color": "#4f81bd"
            },
            {
              "x": -1.217,
              "y": -8.195,
              "label": "观测 119",
              "color": "#4f81bd"
            }
          ]
        }
      ],
      "xLabel": "二手住宅价格同比，%",
      "yLabel": "剔除人口等因素后的社零，%",
      "method": "沿用残差化消费与房价的横截面比较；图中每一点不擅自匹配省份。",
      "limits": [
        "原图显示 p=0.00 是舍入，不是概率严格为零。不能由相关关系直接推导房价下跌造成消费下降。"
      ],
      "axis": {
        "x": [
          -20,
          25
        ],
        "left": [
          -20,
          10
        ],
        "yTicks": [
          -20,
          -15,
          -10,
          -5,
          0,
          5,
          10
        ],
        "xTicks": [
          -20,
          -15,
          -10,
          -5,
          0,
          5,
          10,
          15,
          20,
          25
        ]
      },
      "regression": {
        "slope": 0.28,
        "intercept": -3.41,
        "r2": 0.14,
        "pText": "原图显示 0.00（舍入）"
      },
      "drawnFit": [
        {
          "x": -14.6475,
          "y": -7.4467
        },
        {
          "x": 21.3882,
          "y": 2.4758
        }
      ],
      "recoveredOLS": {
        "n": 119,
        "slope": 0.27537,
        "intercept": -3.41641,
        "r2": 0.13616
      }
    },
    {
      "id": "slide-14",
      "page": 14,
      "title": "消费者信心指数",
      "section": "消费与信心",
      "kind": "line",
      "unit": "指数",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=14",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "消费者信心",
          "color": "#ff0000",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2015-01",
              "y": 105.69
            },
            {
              "x": 1,
              "label": "2015-02",
              "y": 109.79
            },
            {
              "x": 2,
              "label": "2015-03",
              "y": 107.12
            },
            {
              "x": 3,
              "label": "2015-04",
              "y": 107.61
            },
            {
              "x": 4,
              "label": "2015-05",
              "y": 109.88
            },
            {
              "x": 5,
              "label": "2015-06",
              "y": 105.49
            },
            {
              "x": 6,
              "label": "2015-07",
              "y": 104.5
            },
            {
              "x": 7,
              "label": "2015-08",
              "y": 104.01
            },
            {
              "x": 8,
              "label": "2015-09",
              "y": 105.59
            },
            {
              "x": 9,
              "label": "2015-10",
              "y": 103.81
            },
            {
              "x": 10,
              "label": "2015-11",
              "y": 104.11
            },
            {
              "x": 11,
              "label": "2015-12",
              "y": 103.71
            },
            {
              "x": 12,
              "label": "2016-01",
              "y": 104.01
            },
            {
              "x": 13,
              "label": "2016-02",
              "y": 104.4
            },
            {
              "x": 14,
              "label": "2016-03",
              "y": 100.01
            },
            {
              "x": 15,
              "label": "2016-04",
              "y": 101.0
            },
            {
              "x": 16,
              "label": "2016-05",
              "y": 99.81
            },
            {
              "x": 17,
              "label": "2016-06",
              "y": 102.92
            },
            {
              "x": 18,
              "label": "2016-07",
              "y": 106.82
            },
            {
              "x": 19,
              "label": "2016-08",
              "y": 105.59
            },
            {
              "x": 20,
              "label": "2016-09",
              "y": 104.6
            },
            {
              "x": 21,
              "label": "2016-10",
              "y": 107.22
            },
            {
              "x": 22,
              "label": "2016-11",
              "y": 108.6
            },
            {
              "x": 23,
              "label": "2016-12",
              "y": 108.4
            },
            {
              "x": 24,
              "label": "2017-01",
              "y": 109.19
            },
            {
              "x": 25,
              "label": "2017-02",
              "y": 112.6
            },
            {
              "x": 26,
              "label": "2017-03",
              "y": 111.02
            },
            {
              "x": 27,
              "label": "2017-04",
              "y": 113.39
            },
            {
              "x": 28,
              "label": "2017-05",
              "y": 112.01
            },
            {
              "x": 29,
              "label": "2017-06",
              "y": 113.29
            },
            {
              "x": 30,
              "label": "2017-07",
              "y": 114.62
            },
            {
              "x": 31,
              "label": "2017-08",
              "y": 114.72
            },
            {
              "x": 32,
              "label": "2017-09",
              "y": 118.62
            },
            {
              "x": 33,
              "label": "2017-10",
              "y": 123.9
            },
            {
              "x": 34,
              "label": "2017-11",
              "y": 121.29
            },
            {
              "x": 35,
              "label": "2017-12",
              "y": 122.62
            },
            {
              "x": 36,
              "label": "2018-01",
              "y": 122.28
            },
            {
              "x": 37,
              "label": "2018-02",
              "y": 124.0
            },
            {
              "x": 38,
              "label": "2018-03",
              "y": 122.28
            },
            {
              "x": 39,
              "label": "2018-04",
              "y": 122.92
            },
            {
              "x": 40,
              "label": "2018-05",
              "y": 122.92
            },
            {
              "x": 41,
              "label": "2018-06",
              "y": 118.18
            },
            {
              "x": 42,
              "label": "2018-07",
              "y": 119.71
            },
            {
              "x": 43,
              "label": "2018-08",
              "y": 118.62
            },
            {
              "x": 44,
              "label": "2018-09",
              "y": 118.52
            },
            {
              "x": 45,
              "label": "2018-10",
              "y": 119.12
            },
            {
              "x": 46,
              "label": "2018-11",
              "y": 122.08
            },
            {
              "x": 47,
              "label": "2018-12",
              "y": 123.02
            },
            {
              "x": 48,
              "label": "2019-01",
              "y": 123.71
            },
            {
              "x": 49,
              "label": "2019-02",
              "y": 125.98
            },
            {
              "x": 50,
              "label": "2019-03",
              "y": 124.1
            },
            {
              "x": 51,
              "label": "2019-04",
              "y": 125.29
            },
            {
              "x": 52,
              "label": "2019-05",
              "y": 123.41
            },
            {
              "x": 53,
              "label": "2019-06",
              "y": 125.88
            },
            {
              "x": 54,
              "label": "2019-07",
              "y": 124.4
            },
            {
              "x": 55,
              "label": "2019-08",
              "y": 122.42
            },
            {
              "x": 56,
              "label": "2019-09",
              "y": 124.1
            },
            {
              "x": 57,
              "label": "2019-10",
              "y": 124.3
            },
            {
              "x": 58,
              "label": "2019-11",
              "y": 124.6
            },
            {
              "x": 59,
              "label": "2019-12",
              "y": 126.62
            },
            {
              "x": 60,
              "label": "2020-01",
              "y": 126.42
            },
            {
              "x": 61,
              "label": "2020-02",
              "y": 118.92
            },
            {
              "x": 62,
              "label": "2020-03",
              "y": 122.18
            },
            {
              "x": 63,
              "label": "2020-04",
              "y": 116.4
            },
            {
              "x": 64,
              "label": "2020-05",
              "y": 115.81
            },
            {
              "x": 65,
              "label": "2020-06",
              "y": 112.6
            },
            {
              "x": 66,
              "label": "2020-07",
              "y": 117.19
            },
            {
              "x": 67,
              "label": "2020-08",
              "y": 116.4
            },
            {
              "x": 68,
              "label": "2020-09",
              "y": 120.5
            },
            {
              "x": 69,
              "label": "2020-10",
              "y": 121.68
            },
            {
              "x": 70,
              "label": "2020-11",
              "y": 124.0
            },
            {
              "x": 71,
              "label": "2020-12",
              "y": 122.08
            },
            {
              "x": 72,
              "label": "2021-01",
              "y": 122.82
            },
            {
              "x": 73,
              "label": "2021-02",
              "y": 127.0
            },
            {
              "x": 74,
              "label": "2021-03",
              "y": 122.18
            },
            {
              "x": 75,
              "label": "2021-04",
              "y": 121.49
            },
            {
              "x": 76,
              "label": "2021-05",
              "y": 121.78
            },
            {
              "x": 77,
              "label": "2021-06",
              "y": 122.82
            },
            {
              "x": 78,
              "label": "2021-07",
              "y": 117.78
            },
            {
              "x": 79,
              "label": "2021-08",
              "y": 117.49
            },
            {
              "x": 80,
              "label": "2021-09",
              "y": 121.19
            },
            {
              "x": 81,
              "label": "2021-10",
              "y": 120.2
            },
            {
              "x": 82,
              "label": "2021-11",
              "y": 119.51
            },
            {
              "x": 83,
              "label": "2021-12",
              "y": 119.81
            },
            {
              "x": 84,
              "label": "2022-01",
              "y": 121.49
            },
            {
              "x": 85,
              "label": "2022-02",
              "y": 120.5
            },
            {
              "x": 86,
              "label": "2022-03",
              "y": 113.19
            },
            {
              "x": 87,
              "label": "2022-04",
              "y": 86.68
            },
            {
              "x": 88,
              "label": "2022-05",
              "y": 86.78
            },
            {
              "x": 89,
              "label": "2022-06",
              "y": 88.9
            },
            {
              "x": 90,
              "label": "2022-07",
              "y": 87.91
            },
            {
              "x": 91,
              "label": "2022-08",
              "y": 86.98
            },
            {
              "x": 92,
              "label": "2022-09",
              "y": 87.22
            },
            {
              "x": 93,
              "label": "2022-10",
              "y": 86.78
            },
            {
              "x": 94,
              "label": "2022-11",
              "y": 85.5
            },
            {
              "x": 95,
              "label": "2022-12",
              "y": 88.31
            },
            {
              "x": 96,
              "label": "2023-01",
              "y": 91.22
            },
            {
              "x": 97,
              "label": "2023-02",
              "y": 94.68
            },
            {
              "x": 98,
              "label": "2023-03",
              "y": 94.88
            },
            {
              "x": 99,
              "label": "2023-04",
              "y": 87.08
            },
            {
              "x": 100,
              "label": "2023-05",
              "y": 88.21
            },
            {
              "x": 101,
              "label": "2023-06",
              "y": 86.38
            },
            {
              "x": 102,
              "label": "2023-07",
              "y": 86.38
            },
            {
              "x": 103,
              "label": "2023-08",
              "y": 86.48
            },
            {
              "x": 104,
              "label": "2023-09",
              "y": 87.22
            },
            {
              "x": 105,
              "label": "2023-10",
              "y": 87.91
            },
            {
              "x": 106,
              "label": "2023-11",
              "y": 86.98
            },
            {
              "x": 107,
              "label": "2023-12",
              "y": 87.62
            },
            {
              "x": 108,
              "label": "2024-01",
              "y": 88.9
            },
            {
              "x": 109,
              "label": "2024-02",
              "y": 89.1
            },
            {
              "x": 110,
              "label": "2024-03",
              "y": 89.4
            },
            {
              "x": 111,
              "label": "2024-04",
              "y": 88.21
            },
            {
              "x": 112,
              "label": "2024-05",
              "y": 86.38
            },
            {
              "x": 113,
              "label": "2024-06",
              "y": 86.19
            },
            {
              "x": 114,
              "label": "2024-07",
              "y": 85.99
            },
            {
              "x": 115,
              "label": "2024-08",
              "y": 85.79
            },
            {
              "x": 116,
              "label": "2024-09",
              "y": 85.69
            }
          ]
        }
      ],
      "method": "月度指数，原图2015年1月至2024年9月。",
      "limits": [
        "此为历史图中指数，不是实时调查结果。"
      ],
      "labels": [
        "2015-01",
        "2015-02",
        "2015-03",
        "2015-04",
        "2015-05",
        "2015-06",
        "2015-07",
        "2015-08",
        "2015-09",
        "2015-10",
        "2015-11",
        "2015-12",
        "2016-01",
        "2016-02",
        "2016-03",
        "2016-04",
        "2016-05",
        "2016-06",
        "2016-07",
        "2016-08",
        "2016-09",
        "2016-10",
        "2016-11",
        "2016-12",
        "2017-01",
        "2017-02",
        "2017-03",
        "2017-04",
        "2017-05",
        "2017-06",
        "2017-07",
        "2017-08",
        "2017-09",
        "2017-10",
        "2017-11",
        "2017-12",
        "2018-01",
        "2018-02",
        "2018-03",
        "2018-04",
        "2018-05",
        "2018-06",
        "2018-07",
        "2018-08",
        "2018-09",
        "2018-10",
        "2018-11",
        "2018-12",
        "2019-01",
        "2019-02",
        "2019-03",
        "2019-04",
        "2019-05",
        "2019-06",
        "2019-07",
        "2019-08",
        "2019-09",
        "2019-10",
        "2019-11",
        "2019-12",
        "2020-01",
        "2020-02",
        "2020-03",
        "2020-04",
        "2020-05",
        "2020-06",
        "2020-07",
        "2020-08",
        "2020-09",
        "2020-10",
        "2020-11",
        "2020-12",
        "2021-01",
        "2021-02",
        "2021-03",
        "2021-04",
        "2021-05",
        "2021-06",
        "2021-07",
        "2021-08",
        "2021-09",
        "2021-10",
        "2021-11",
        "2021-12",
        "2022-01",
        "2022-02",
        "2022-03",
        "2022-04",
        "2022-05",
        "2022-06",
        "2022-07",
        "2022-08",
        "2022-09",
        "2022-10",
        "2022-11",
        "2022-12",
        "2023-01",
        "2023-02",
        "2023-03",
        "2023-04",
        "2023-05",
        "2023-06",
        "2023-07",
        "2023-08",
        "2023-09",
        "2023-10",
        "2023-11",
        "2023-12",
        "2024-01",
        "2024-02",
        "2024-03",
        "2024-04",
        "2024-05",
        "2024-06",
        "2024-07",
        "2024-08",
        "2024-09"
      ],
      "axis": {
        "left": [
          70,
          130
        ],
        "yTicks": [
          70,
          80,
          90,
          100,
          110,
          120,
          130
        ]
      },
      "digitizationError": 0.051
    },
    {
      "id": "slide-16",
      "page": 16,
      "title": "全国与31城调查失业率",
      "section": "就业与统计",
      "kind": "line",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=16",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "全国",
          "color": "#ff0000",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2018-01",
              "y": 4.96
            },
            {
              "x": 1,
              "label": "2018-02",
              "y": 5.0
            },
            {
              "x": 2,
              "label": "2018-03",
              "y": 5.06
            },
            {
              "x": 3,
              "label": "2018-04",
              "y": 4.9
            },
            {
              "x": 4,
              "label": "2018-05",
              "y": 4.8
            },
            {
              "x": 5,
              "label": "2018-06",
              "y": 4.8
            },
            {
              "x": 6,
              "label": "2018-07",
              "y": 5.1
            },
            {
              "x": 7,
              "label": "2018-08",
              "y": 5.0
            },
            {
              "x": 8,
              "label": "2018-09",
              "y": 4.9
            },
            {
              "x": 9,
              "label": "2018-10",
              "y": 4.9
            },
            {
              "x": 10,
              "label": "2018-11",
              "y": 4.8
            },
            {
              "x": 11,
              "label": "2018-12",
              "y": 4.9
            },
            {
              "x": 12,
              "label": "2019-01",
              "y": 5.1
            },
            {
              "x": 13,
              "label": "2019-02",
              "y": 5.3
            },
            {
              "x": 14,
              "label": "2019-03",
              "y": 5.2
            },
            {
              "x": 15,
              "label": "2019-04",
              "y": 5.0
            },
            {
              "x": 16,
              "label": "2019-05",
              "y": 5.0
            },
            {
              "x": 17,
              "label": "2019-06",
              "y": 5.1
            },
            {
              "x": 18,
              "label": "2019-07",
              "y": 5.3
            },
            {
              "x": 19,
              "label": "2019-08",
              "y": 5.2
            },
            {
              "x": 20,
              "label": "2019-09",
              "y": 5.2
            },
            {
              "x": 21,
              "label": "2019-10",
              "y": 5.1
            },
            {
              "x": 22,
              "label": "2019-11",
              "y": 5.1
            },
            {
              "x": 23,
              "label": "2019-12",
              "y": 5.2
            },
            {
              "x": 24,
              "label": "2020-01",
              "y": 5.3
            },
            {
              "x": 25,
              "label": "2020-02",
              "y": 6.2
            },
            {
              "x": 26,
              "label": "2020-03",
              "y": 5.9
            },
            {
              "x": 27,
              "label": "2020-04",
              "y": 6.0
            },
            {
              "x": 28,
              "label": "2020-05",
              "y": 5.9
            },
            {
              "x": 29,
              "label": "2020-06",
              "y": 5.7
            },
            {
              "x": 30,
              "label": "2020-07",
              "y": 5.7
            },
            {
              "x": 31,
              "label": "2020-08",
              "y": 5.6
            },
            {
              "x": 32,
              "label": "2020-09",
              "y": 5.4
            },
            {
              "x": 33,
              "label": "2020-10",
              "y": 5.3
            },
            {
              "x": 34,
              "label": "2020-11",
              "y": 5.2
            },
            {
              "x": 35,
              "label": "2020-12",
              "y": 5.2
            },
            {
              "x": 36,
              "label": "2021-01",
              "y": 5.4
            },
            {
              "x": 37,
              "label": "2021-02",
              "y": 5.5
            },
            {
              "x": 38,
              "label": "2021-03",
              "y": 5.3
            },
            {
              "x": 39,
              "label": "2021-04",
              "y": 5.1
            },
            {
              "x": 40,
              "label": "2021-05",
              "y": 5.0
            },
            {
              "x": 41,
              "label": "2021-06",
              "y": 5.0
            },
            {
              "x": 42,
              "label": "2021-07",
              "y": 5.1
            },
            {
              "x": 43,
              "label": "2021-08",
              "y": 5.1
            },
            {
              "x": 44,
              "label": "2021-09",
              "y": 4.9
            },
            {
              "x": 45,
              "label": "2021-10",
              "y": 4.9
            },
            {
              "x": 46,
              "label": "2021-11",
              "y": 5.0
            },
            {
              "x": 47,
              "label": "2021-12",
              "y": 5.1
            },
            {
              "x": 48,
              "label": "2022-01",
              "y": 5.3
            },
            {
              "x": 49,
              "label": "2022-02",
              "y": 5.5
            },
            {
              "x": 50,
              "label": "2022-03",
              "y": 5.8
            },
            {
              "x": 51,
              "label": "2022-04",
              "y": 6.1
            },
            {
              "x": 52,
              "label": "2022-05",
              "y": 5.9
            },
            {
              "x": 53,
              "label": "2022-06",
              "y": 5.5
            },
            {
              "x": 54,
              "label": "2022-07",
              "y": 5.4
            },
            {
              "x": 55,
              "label": "2022-08",
              "y": 5.3
            },
            {
              "x": 56,
              "label": "2022-09",
              "y": 5.5
            },
            {
              "x": 57,
              "label": "2022-10",
              "y": 5.5
            },
            {
              "x": 58,
              "label": "2022-11",
              "y": 5.7
            },
            {
              "x": 59,
              "label": "2022-12",
              "y": 5.5
            },
            {
              "x": 60,
              "label": "2023-01",
              "y": 5.5
            },
            {
              "x": 61,
              "label": "2023-02",
              "y": 5.6
            },
            {
              "x": 62,
              "label": "2023-03",
              "y": 5.3
            },
            {
              "x": 63,
              "label": "2023-04",
              "y": 5.2
            },
            {
              "x": 64,
              "label": "2023-05",
              "y": 5.2
            },
            {
              "x": 65,
              "label": "2023-06",
              "y": 5.2
            },
            {
              "x": 66,
              "label": "2023-07",
              "y": 5.3
            },
            {
              "x": 67,
              "label": "2023-08",
              "y": 5.2
            },
            {
              "x": 68,
              "label": "2023-09",
              "y": 5.0
            },
            {
              "x": 69,
              "label": "2023-10",
              "y": 5.0
            },
            {
              "x": 70,
              "label": "2023-11",
              "y": 5.0
            },
            {
              "x": 71,
              "label": "2023-12",
              "y": 5.1
            },
            {
              "x": 72,
              "label": "2024-01",
              "y": 5.2
            },
            {
              "x": 73,
              "label": "2024-02",
              "y": 5.3
            },
            {
              "x": 74,
              "label": "2024-03",
              "y": 5.2
            },
            {
              "x": 75,
              "label": "2024-04",
              "y": 5.0
            },
            {
              "x": 76,
              "label": "2024-05",
              "y": 5.0
            },
            {
              "x": 77,
              "label": "2024-06",
              "y": 5.0
            },
            {
              "x": 78,
              "label": "2024-07",
              "y": 5.2
            },
            {
              "x": 79,
              "label": "2024-08",
              "y": 5.3
            },
            {
              "x": 80,
              "label": "2024-09",
              "y": 5.1
            },
            {
              "x": 81,
              "label": "2024-10",
              "y": 5.0
            }
          ]
        },
        {
          "name": "31个大城市",
          "color": "#0070c0",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2018-01",
              "y": 4.87
            },
            {
              "x": 1,
              "label": "2018-02",
              "y": 4.84
            },
            {
              "x": 2,
              "label": "2018-03",
              "y": 4.88
            },
            {
              "x": 3,
              "label": "2018-04",
              "y": 4.7
            },
            {
              "x": 4,
              "label": "2018-05",
              "y": 4.7
            },
            {
              "x": 5,
              "label": "2018-06",
              "y": 4.7
            },
            {
              "x": 6,
              "label": "2018-07",
              "y": 5.0
            },
            {
              "x": 7,
              "label": "2018-08",
              "y": 4.9
            },
            {
              "x": 8,
              "label": "2018-09",
              "y": 4.7
            },
            {
              "x": 9,
              "label": "2018-10",
              "y": 4.7
            },
            {
              "x": 10,
              "label": "2018-11",
              "y": 4.65
            },
            {
              "x": 11,
              "label": "2018-12",
              "y": 4.7
            },
            {
              "x": 12,
              "label": "2019-01",
              "y": 4.8
            },
            {
              "x": 13,
              "label": "2019-02",
              "y": 5.0
            },
            {
              "x": 14,
              "label": "2019-03",
              "y": 5.1
            },
            {
              "x": 15,
              "label": "2019-04",
              "y": 5.0
            },
            {
              "x": 16,
              "label": "2019-05",
              "y": 5.0
            },
            {
              "x": 17,
              "label": "2019-06",
              "y": 5.0
            },
            {
              "x": 18,
              "label": "2019-07",
              "y": 5.2
            },
            {
              "x": 19,
              "label": "2019-08",
              "y": 5.2
            },
            {
              "x": 20,
              "label": "2019-09",
              "y": 5.2
            },
            {
              "x": 21,
              "label": "2019-10",
              "y": 5.1
            },
            {
              "x": 22,
              "label": "2019-11",
              "y": 5.1
            },
            {
              "x": 23,
              "label": "2019-12",
              "y": 5.2
            },
            {
              "x": 24,
              "label": "2020-01",
              "y": 5.2
            },
            {
              "x": 25,
              "label": "2020-02",
              "y": 5.7
            },
            {
              "x": 26,
              "label": "2020-03",
              "y": 5.7
            },
            {
              "x": 27,
              "label": "2020-04",
              "y": 5.8
            },
            {
              "x": 28,
              "label": "2020-05",
              "y": 5.9
            },
            {
              "x": 29,
              "label": "2020-06",
              "y": 5.8
            },
            {
              "x": 30,
              "label": "2020-07",
              "y": 5.8
            },
            {
              "x": 31,
              "label": "2020-08",
              "y": 5.7
            },
            {
              "x": 32,
              "label": "2020-09",
              "y": 5.5
            },
            {
              "x": 33,
              "label": "2020-10",
              "y": 5.3
            },
            {
              "x": 34,
              "label": "2020-11",
              "y": 5.2
            },
            {
              "x": 35,
              "label": "2020-12",
              "y": 5.1
            },
            {
              "x": 36,
              "label": "2021-01",
              "y": 5.4
            },
            {
              "x": 37,
              "label": "2021-02",
              "y": 5.5
            },
            {
              "x": 38,
              "label": "2021-03",
              "y": 5.3
            },
            {
              "x": 39,
              "label": "2021-04",
              "y": 5.2
            },
            {
              "x": 40,
              "label": "2021-05",
              "y": 5.2
            },
            {
              "x": 41,
              "label": "2021-06",
              "y": 5.2
            },
            {
              "x": 42,
              "label": "2021-07",
              "y": 5.2
            },
            {
              "x": 43,
              "label": "2021-08",
              "y": 5.3
            },
            {
              "x": 44,
              "label": "2021-09",
              "y": 5.0
            },
            {
              "x": 45,
              "label": "2021-10",
              "y": 5.1
            },
            {
              "x": 46,
              "label": "2021-11",
              "y": 5.1
            },
            {
              "x": 47,
              "label": "2021-12",
              "y": 5.1
            },
            {
              "x": 48,
              "label": "2022-01",
              "y": 5.4
            },
            {
              "x": 49,
              "label": "2022-02",
              "y": 5.4
            },
            {
              "x": 50,
              "label": "2022-03",
              "y": 6.0
            },
            {
              "x": 51,
              "label": "2022-04",
              "y": 6.7
            },
            {
              "x": 52,
              "label": "2022-05",
              "y": 6.9
            },
            {
              "x": 53,
              "label": "2022-06",
              "y": 5.8
            },
            {
              "x": 54,
              "label": "2022-07",
              "y": 5.6
            },
            {
              "x": 55,
              "label": "2022-08",
              "y": 5.4
            },
            {
              "x": 56,
              "label": "2022-09",
              "y": 5.8
            },
            {
              "x": 57,
              "label": "2022-10",
              "y": 6.0
            },
            {
              "x": 58,
              "label": "2022-11",
              "y": 6.7
            },
            {
              "x": 59,
              "label": "2022-12",
              "y": 6.1
            },
            {
              "x": 60,
              "label": "2023-01",
              "y": 5.8
            },
            {
              "x": 61,
              "label": "2023-02",
              "y": 5.7
            },
            {
              "x": 62,
              "label": "2023-03",
              "y": 5.5
            },
            {
              "x": 63,
              "label": "2023-04",
              "y": 5.5
            },
            {
              "x": 64,
              "label": "2023-05",
              "y": 5.5
            },
            {
              "x": 65,
              "label": "2023-06",
              "y": 5.5
            },
            {
              "x": 66,
              "label": "2023-07",
              "y": 5.4
            },
            {
              "x": 67,
              "label": "2023-08",
              "y": 5.3
            },
            {
              "x": 68,
              "label": "2023-09",
              "y": 5.2
            },
            {
              "x": 69,
              "label": "2023-10",
              "y": 5.0
            },
            {
              "x": 70,
              "label": "2023-11",
              "y": 5.0
            },
            {
              "x": 71,
              "label": "2023-12",
              "y": 5.0
            },
            {
              "x": 72,
              "label": "2024-01",
              "y": 4.9
            },
            {
              "x": 73,
              "label": "2024-02",
              "y": 5.1
            },
            {
              "x": 74,
              "label": "2024-03",
              "y": 5.1
            },
            {
              "x": 75,
              "label": "2024-04",
              "y": 5.0
            },
            {
              "x": 76,
              "label": "2024-05",
              "y": 4.9
            },
            {
              "x": 77,
              "label": "2024-06",
              "y": 4.9
            },
            {
              "x": 78,
              "label": "2024-07",
              "y": 5.3
            },
            {
              "x": 79,
              "label": "2024-08",
              "y": 5.4
            },
            {
              "x": 80,
              "label": "2024-09",
              "y": 5.1
            },
            {
              "x": 81,
              "label": "2024-10",
              "y": 5.0
            }
          ]
        }
      ],
      "method": "保留两条月度调查失业率。原轴以半个百分点设刻度，但文字标签重复舍入为整数。",
      "limits": [
        "图形实际按4—8的连续坐标恢复，不按重复整数刻度错误映射；离开劳动力市场与城乡迁移不等于被该比率完整覆盖。"
      ],
      "labels": [
        "2018-01",
        "2018-02",
        "2018-03",
        "2018-04",
        "2018-05",
        "2018-06",
        "2018-07",
        "2018-08",
        "2018-09",
        "2018-10",
        "2018-11",
        "2018-12",
        "2019-01",
        "2019-02",
        "2019-03",
        "2019-04",
        "2019-05",
        "2019-06",
        "2019-07",
        "2019-08",
        "2019-09",
        "2019-10",
        "2019-11",
        "2019-12",
        "2020-01",
        "2020-02",
        "2020-03",
        "2020-04",
        "2020-05",
        "2020-06",
        "2020-07",
        "2020-08",
        "2020-09",
        "2020-10",
        "2020-11",
        "2020-12",
        "2021-01",
        "2021-02",
        "2021-03",
        "2021-04",
        "2021-05",
        "2021-06",
        "2021-07",
        "2021-08",
        "2021-09",
        "2021-10",
        "2021-11",
        "2021-12",
        "2022-01",
        "2022-02",
        "2022-03",
        "2022-04",
        "2022-05",
        "2022-06",
        "2022-07",
        "2022-08",
        "2022-09",
        "2022-10",
        "2022-11",
        "2022-12",
        "2023-01",
        "2023-02",
        "2023-03",
        "2023-04",
        "2023-05",
        "2023-06",
        "2023-07",
        "2023-08",
        "2023-09",
        "2023-10",
        "2023-11",
        "2023-12",
        "2024-01",
        "2024-02",
        "2024-03",
        "2024-04",
        "2024-05",
        "2024-06",
        "2024-07",
        "2024-08",
        "2024-09",
        "2024-10"
      ],
      "axis": {
        "left": [
          4,
          8
        ],
        "yTicks": [
          4.0,
          4.5,
          5.0,
          5.5,
          6.0,
          6.5,
          7.0,
          7.5,
          8.0
        ]
      },
      "digitizationError": 0.003
    },
    {
      "id": "slide-17",
      "page": 17,
      "title": "非私营单位制造业与服务业工资增速",
      "section": "就业与统计",
      "kind": "line",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=17",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "制造业",
          "color": "#ff0000",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2004",
              "y": 12.47
            },
            {
              "x": 1,
              "label": "2005",
              "y": 11.81
            },
            {
              "x": 2,
              "label": "2006",
              "y": 14.38
            },
            {
              "x": 3,
              "label": "2007",
              "y": 16.01
            },
            {
              "x": 4,
              "label": "2008",
              "y": 15.42
            },
            {
              "x": 5,
              "label": "2009",
              "y": 9.86
            },
            {
              "x": 6,
              "label": "2010",
              "y": 15.32
            },
            {
              "x": 7,
              "label": "2011",
              "y": 18.6
            },
            {
              "x": 8,
              "label": "2012",
              "y": 13.59
            },
            {
              "x": 9,
              "label": "2013",
              "y": 11.48
            },
            {
              "x": 10,
              "label": "2014",
              "y": 10.63
            },
            {
              "x": 11,
              "label": "2015",
              "y": 7.7
            },
            {
              "x": 12,
              "label": "2016",
              "y": 7.5
            },
            {
              "x": 13,
              "label": "2017",
              "y": 8.37
            },
            {
              "x": 14,
              "label": "2018",
              "y": 11.85
            },
            {
              "x": 15,
              "label": "2019",
              "y": 8.41
            },
            {
              "x": 16,
              "label": "2020",
              "y": 5.94
            },
            {
              "x": 17,
              "label": "2021",
              "y": 11.68
            },
            {
              "x": 18,
              "label": "2022",
              "y": 5.48
            },
            {
              "x": 19,
              "label": "2023",
              "y": 6.56
            }
          ]
        },
        {
          "name": "服务业",
          "color": "#0070c0",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2004",
              "y": 12.78
            },
            {
              "x": 1,
              "label": "2005",
              "y": 14.5
            },
            {
              "x": 2,
              "label": "2006",
              "y": 14.15
            },
            {
              "x": 3,
              "label": "2007",
              "y": 17.52
            },
            {
              "x": 4,
              "label": "2008",
              "y": 16.52
            },
            {
              "x": 5,
              "label": "2009",
              "y": 9.94
            },
            {
              "x": 6,
              "label": "2010",
              "y": 12.29
            },
            {
              "x": 7,
              "label": "2011",
              "y": 14.96
            },
            {
              "x": 8,
              "label": "2012",
              "y": 11.34
            },
            {
              "x": 9,
              "label": "2013",
              "y": 10.61
            },
            {
              "x": 10,
              "label": "2014",
              "y": 8.92
            },
            {
              "x": 11,
              "label": "2015",
              "y": 10.3
            },
            {
              "x": 12,
              "label": "2016",
              "y": 8.26
            },
            {
              "x": 13,
              "label": "2017",
              "y": 8.87
            },
            {
              "x": 14,
              "label": "2018",
              "y": 9.69
            },
            {
              "x": 15,
              "label": "2019",
              "y": 7.37
            },
            {
              "x": 16,
              "label": "2020",
              "y": 5.56
            },
            {
              "x": 17,
              "label": "2021",
              "y": 9.07
            },
            {
              "x": 18,
              "label": "2022",
              "y": 6.43
            },
            {
              "x": 19,
              "label": "2023",
              "y": 5.36
            }
          ]
        }
      ],
      "method": "原图使用非私营单位口径。",
      "limits": [
        "非私营不等于全部体制内或全部劳动者；不能用在岗工资均值描述离岗者收入。服务业聚合权重未披露。"
      ],
      "labels": [
        "2004",
        "2005",
        "2006",
        "2007",
        "2008",
        "2009",
        "2010",
        "2011",
        "2012",
        "2013",
        "2014",
        "2015",
        "2016",
        "2017",
        "2018",
        "2019",
        "2020",
        "2021",
        "2022",
        "2023"
      ],
      "axis": {
        "left": [
          0,
          20
        ],
        "yTicks": [
          0,
          2,
          4,
          6,
          8,
          10,
          12,
          14,
          16,
          18,
          20
        ]
      },
      "digitizationError": 0.017
    },
    {
      "id": "slide-18",
      "page": 18,
      "title": "城镇就业增速与原图趋势",
      "section": "就业与统计",
      "kind": "line",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=18",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "城镇就业增速",
          "color": "#ff0000",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2011",
              "y": 3.79
            },
            {
              "x": 1,
              "label": "2012",
              "y": 3.57
            },
            {
              "x": 2,
              "label": "2013",
              "y": 3.33
            },
            {
              "x": 3,
              "label": "2014",
              "y": 3.06
            },
            {
              "x": 4,
              "label": "2015",
              "y": 3.06
            },
            {
              "x": 5,
              "label": "2016",
              "y": 2.77
            },
            {
              "x": 6,
              "label": "2017",
              "y": 2.75
            },
            {
              "x": 7,
              "label": "2018",
              "y": 2.51
            },
            {
              "x": 8,
              "label": "2019",
              "y": 2.16
            },
            {
              "x": 9,
              "label": "2020",
              "y": 2.26
            },
            {
              "x": 10,
              "label": "2021",
              "y": 1.09
            },
            {
              "x": 11,
              "label": "2022",
              "y": -1.8
            },
            {
              "x": 12,
              "label": "2023",
              "y": 0.3
            }
          ]
        },
        {
          "name": "城镇就业增速 · 原图趋势线",
          "color": "#ff0000",
          "axis": "left",
          "dashed": true,
          "points": [
            {
              "x": 9.038,
              "y": 2.25,
              "label": "原图趋势片段"
            },
            {
              "x": 9.1818,
              "y": 2.23,
              "label": "原图趋势片段"
            },
            {
              "x": 9.3255,
              "y": 2.21,
              "label": "原图趋势片段"
            },
            {
              "x": 9.4693,
              "y": 2.18,
              "label": "原图趋势片段"
            },
            {
              "x": 9.6131,
              "y": 2.16,
              "label": "原图趋势片段"
            },
            {
              "x": 9.7569,
              "y": 2.13,
              "label": "原图趋势片段"
            },
            {
              "x": 9.9006,
              "y": 2.11,
              "label": "原图趋势片段"
            },
            {
              "x": 10.0444,
              "y": 2.09,
              "label": "原图趋势片段"
            },
            {
              "x": 10.1881,
              "y": 2.06,
              "label": "原图趋势片段"
            },
            {
              "x": 10.3318,
              "y": 2.04,
              "label": "原图趋势片段"
            },
            {
              "x": 10.4755,
              "y": 2.01,
              "label": "原图趋势片段"
            },
            {
              "x": 10.6193,
              "y": 1.99,
              "label": "原图趋势片段"
            },
            {
              "x": 10.763,
              "y": 1.96,
              "label": "原图趋势片段"
            },
            {
              "x": 10.9067,
              "y": 1.94,
              "label": "原图趋势片段"
            },
            {
              "x": 11.0504,
              "y": 1.91,
              "label": "原图趋势片段"
            },
            {
              "x": 11.1942,
              "y": 1.89,
              "label": "原图趋势片段"
            },
            {
              "x": 11.338,
              "y": 1.87,
              "label": "原图趋势片段"
            },
            {
              "x": 11.4817,
              "y": 1.84,
              "label": "原图趋势片段"
            },
            {
              "x": 11.6255,
              "y": 1.82,
              "label": "原图趋势片段"
            },
            {
              "x": 11.7692,
              "y": 1.8,
              "label": "原图趋势片段"
            },
            {
              "x": 11.913,
              "y": 1.77,
              "label": "原图趋势片段"
            }
          ]
        }
      ],
      "method": "2023年使用两年复合增速；虚线恢复自原图，不宣称已复现其趋势模型。",
      "limits": [
        "统计定义与人口基准修订可能改变历史就业数。"
      ],
      "labels": [
        "2011",
        "2012",
        "2013",
        "2014",
        "2015",
        "2016",
        "2017",
        "2018",
        "2019",
        "2020",
        "2021",
        "2022",
        "2023"
      ],
      "axis": {
        "left": [
          -3,
          5
        ],
        "yTicks": [
          -3,
          -2,
          -1,
          0,
          1,
          2,
          3,
          4,
          5
        ]
      },
      "digitizationError": 0.007
    },
    {
      "id": "slide-19",
      "page": 19,
      "title": "城镇就业人数与原图趋势",
      "section": "就业与统计",
      "kind": "line",
      "unit": "万人",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=19",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "城镇就业人数",
          "color": "#ff0000",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2011",
              "y": 36002.98
            },
            {
              "x": 1,
              "label": "2012",
              "y": 37289.63
            },
            {
              "x": 2,
              "label": "2013",
              "y": 38527.15
            },
            {
              "x": 3,
              "label": "2014",
              "y": 39698.85
            },
            {
              "x": 4,
              "label": "2015",
              "y": 40910.04
            },
            {
              "x": 5,
              "label": "2016",
              "y": 42055.4
            },
            {
              "x": 6,
              "label": "2017",
              "y": 43213.93
            },
            {
              "x": 7,
              "label": "2018",
              "y": 44293.47
            },
            {
              "x": 8,
              "label": "2019",
              "y": 45254.52
            },
            {
              "x": 9,
              "label": "2020",
              "y": 46268.24
            },
            {
              "x": 10,
              "label": "2021",
              "y": 46768.51
            },
            {
              "x": 11,
              "label": "2022",
              "y": 45925.94
            },
            {
              "x": 12,
              "label": "2023",
              "y": 47032.01
            }
          ]
        },
        {
          "name": "城镇就业人数 · 原图趋势线",
          "color": "#ff0000",
          "axis": "left",
          "dashed": true,
          "points": [
            {
              "x": 9.0368,
              "y": 46304.74,
              "label": "原图趋势片段"
            },
            {
              "x": 9.1757,
              "y": 46439.68,
              "label": "原图趋势片段"
            },
            {
              "x": 9.3147,
              "y": 46574.61,
              "label": "原图趋势片段"
            },
            {
              "x": 9.4536,
              "y": 46709.54,
              "label": "原图趋势片段"
            },
            {
              "x": 9.5925,
              "y": 46844.47,
              "label": "原图趋势片段"
            },
            {
              "x": 9.7315,
              "y": 46979.4,
              "label": "原图趋势片段"
            },
            {
              "x": 9.8704,
              "y": 47114.34,
              "label": "原图趋势片段"
            },
            {
              "x": 10.0095,
              "y": 47248.45,
              "label": "原图趋势片段"
            },
            {
              "x": 10.1488,
              "y": 47377.77,
              "label": "原图趋势片段"
            },
            {
              "x": 10.2883,
              "y": 47506.58,
              "label": "原图趋势片段"
            },
            {
              "x": 10.4277,
              "y": 47635.38,
              "label": "原图趋势片段"
            },
            {
              "x": 10.5671,
              "y": 47764.19,
              "label": "原图趋势片段"
            },
            {
              "x": 10.7066,
              "y": 47893.0,
              "label": "原图趋势片段"
            },
            {
              "x": 10.846,
              "y": 48021.81,
              "label": "原图趋势片段"
            },
            {
              "x": 10.9855,
              "y": 48150.21,
              "label": "原图趋势片段"
            },
            {
              "x": 11.1254,
              "y": 48273.01,
              "label": "原图趋势片段"
            },
            {
              "x": 11.2653,
              "y": 48394.67,
              "label": "原图趋势片段"
            },
            {
              "x": 11.4053,
              "y": 48516.32,
              "label": "原图趋势片段"
            },
            {
              "x": 11.5453,
              "y": 48637.98,
              "label": "原图趋势片段"
            },
            {
              "x": 11.6853,
              "y": 48759.63,
              "label": "原图趋势片段"
            },
            {
              "x": 11.8253,
              "y": 48881.28,
              "label": "原图趋势片段"
            },
            {
              "x": 11.9651,
              "y": 49002.83,
              "label": "原图趋势片段"
            }
          ]
        }
      ],
      "method": "原图给出的2021—2023年缺口为472、2236、2001万人，合计4709。",
      "limits": [
        "三个年度存量缺口的相加不等于4709万个去重的失业者；须区分存量、人年与跨年重复。"
      ],
      "labels": [
        "2011",
        "2012",
        "2013",
        "2014",
        "2015",
        "2016",
        "2017",
        "2018",
        "2019",
        "2020",
        "2021",
        "2022",
        "2023"
      ],
      "axis": {
        "left": [
          34000,
          50000
        ],
        "yTicks": [
          34000,
          36000,
          38000,
          40000,
          42000,
          44000,
          46000,
          48000,
          50000
        ]
      },
      "digitizationError": 13.714
    },
    {
      "id": "slide-20",
      "page": 20,
      "title": "第三产业增加值占比与趋势",
      "section": "就业与统计",
      "kind": "line",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=20",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "第三产业占比（4Q TTM）",
          "color": "#ff0000",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2011-Q1",
              "y": 44.51
            },
            {
              "x": 1,
              "label": "2011-Q2",
              "y": 44.51
            },
            {
              "x": 2,
              "label": "2011-Q3",
              "y": 44.47
            },
            {
              "x": 3,
              "label": "2011-Q4",
              "y": 44.59
            },
            {
              "x": 4,
              "label": "2012-Q1",
              "y": 44.69
            },
            {
              "x": 5,
              "label": "2012-Q2",
              "y": 45.0
            },
            {
              "x": 6,
              "label": "2012-Q3",
              "y": 45.4
            },
            {
              "x": 7,
              "label": "2012-Q4",
              "y": 45.69
            },
            {
              "x": 8,
              "label": "2013-Q1",
              "y": 46.1
            },
            {
              "x": 9,
              "label": "2013-Q2",
              "y": 46.53
            },
            {
              "x": 10,
              "label": "2013-Q3",
              "y": 46.88
            },
            {
              "x": 11,
              "label": "2013-Q4",
              "y": 47.14
            },
            {
              "x": 12,
              "label": "2014-Q1",
              "y": 47.49
            },
            {
              "x": 13,
              "label": "2014-Q2",
              "y": 47.77
            },
            {
              "x": 14,
              "label": "2014-Q3",
              "y": 48.08
            },
            {
              "x": 15,
              "label": "2014-Q4",
              "y": 48.51
            },
            {
              "x": 16,
              "label": "2015-Q1",
              "y": 49.05
            },
            {
              "x": 17,
              "label": "2015-Q2",
              "y": 49.64
            },
            {
              "x": 18,
              "label": "2015-Q3",
              "y": 50.35
            },
            {
              "x": 19,
              "label": "2015-Q4",
              "y": 50.99
            },
            {
              "x": 20,
              "label": "2016-Q1",
              "y": 51.53
            },
            {
              "x": 21,
              "label": "2016-Q2",
              "y": 51.96
            },
            {
              "x": 22,
              "label": "2016-Q3",
              "y": 52.36
            },
            {
              "x": 23,
              "label": "2016-Q4",
              "y": 52.64
            },
            {
              "x": 24,
              "label": "2017-Q1",
              "y": 52.65
            },
            {
              "x": 25,
              "label": "2017-Q2",
              "y": 52.75
            },
            {
              "x": 26,
              "label": "2017-Q3",
              "y": 52.83
            },
            {
              "x": 27,
              "label": "2017-Q4",
              "y": 52.93
            },
            {
              "x": 28,
              "label": "2018-Q1",
              "y": 53.05
            },
            {
              "x": 29,
              "label": "2018-Q2",
              "y": 53.2
            },
            {
              "x": 30,
              "label": "2018-Q3",
              "y": 53.39
            },
            {
              "x": 31,
              "label": "2018-Q4",
              "y": 53.51
            },
            {
              "x": 32,
              "label": "2019-Q1",
              "y": 53.76
            },
            {
              "x": 33,
              "label": "2019-Q2",
              "y": 53.95
            },
            {
              "x": 34,
              "label": "2019-Q3",
              "y": 54.25
            },
            {
              "x": 35,
              "label": "2019-Q4",
              "y": 54.5
            },
            {
              "x": 36,
              "label": "2020-Q1",
              "y": 54.73
            },
            {
              "x": 37,
              "label": "2020-Q2",
              "y": 54.73
            },
            {
              "x": 38,
              "label": "2020-Q3",
              "y": 54.76
            },
            {
              "x": 39,
              "label": "2020-Q4",
              "y": 54.84
            },
            {
              "x": 40,
              "label": "2021-Q1",
              "y": 54.48
            },
            {
              "x": 41,
              "label": "2021-Q2",
              "y": 54.27
            },
            {
              "x": 42,
              "label": "2021-Q3",
              "y": 54.07
            },
            {
              "x": 43,
              "label": "2021-Q4",
              "y": 53.74
            },
            {
              "x": 44,
              "label": "2022-Q1",
              "y": 53.51
            },
            {
              "x": 45,
              "label": "2022-Q2",
              "y": 53.31
            },
            {
              "x": 46,
              "label": "2022-Q3",
              "y": 53.28
            },
            {
              "x": 47,
              "label": "2022-Q4",
              "y": 53.51
            },
            {
              "x": 48,
              "label": "2023-Q1",
              "y": 53.82
            },
            {
              "x": 49,
              "label": "2023-Q2",
              "y": 54.27
            },
            {
              "x": 50,
              "label": "2023-Q3",
              "y": 54.55
            },
            {
              "x": 51,
              "label": "2023-Q4",
              "y": 54.76
            },
            {
              "x": 52,
              "label": "2024-Q1",
              "y": 54.87
            },
            {
              "x": 53,
              "label": "2024-Q2",
              "y": 54.87
            },
            {
              "x": 54,
              "label": "2024-Q3",
              "y": 54.97
            }
          ]
        },
        {
          "name": "原图趋势线",
          "color": "#ff0000",
          "dashed": true,
          "axis": "left",
          "points": [
            {
              "x": 0.7,
              "y": 44.9,
              "label": "趋势线"
            },
            {
              "x": 54.214,
              "y": 59.47,
              "label": "趋势线"
            }
          ]
        }
      ],
      "method": "滚动四季度第三产业增加值 / GDP；不以单季占比替代。",
      "limits": [
        "原图趋势线窗口和估计方法未披露，当前仅从其几何线恢复。"
      ],
      "labels": [
        "2011-Q1",
        "2011-Q2",
        "2011-Q3",
        "2011-Q4",
        "2012-Q1",
        "2012-Q2",
        "2012-Q3",
        "2012-Q4",
        "2013-Q1",
        "2013-Q2",
        "2013-Q3",
        "2013-Q4",
        "2014-Q1",
        "2014-Q2",
        "2014-Q3",
        "2014-Q4",
        "2015-Q1",
        "2015-Q2",
        "2015-Q3",
        "2015-Q4",
        "2016-Q1",
        "2016-Q2",
        "2016-Q3",
        "2016-Q4",
        "2017-Q1",
        "2017-Q2",
        "2017-Q3",
        "2017-Q4",
        "2018-Q1",
        "2018-Q2",
        "2018-Q3",
        "2018-Q4",
        "2019-Q1",
        "2019-Q2",
        "2019-Q3",
        "2019-Q4",
        "2020-Q1",
        "2020-Q2",
        "2020-Q3",
        "2020-Q4",
        "2021-Q1",
        "2021-Q2",
        "2021-Q3",
        "2021-Q4",
        "2022-Q1",
        "2022-Q2",
        "2022-Q3",
        "2022-Q4",
        "2023-Q1",
        "2023-Q2",
        "2023-Q3",
        "2023-Q4",
        "2024-Q1",
        "2024-Q2",
        "2024-Q3"
      ],
      "axis": {
        "left": [
          40,
          60
        ],
        "yTicks": [
          40,
          42,
          44,
          46,
          48,
          50,
          52,
          54,
          56,
          58,
          60
        ]
      },
      "digitizationError": 0.017
    },
    {
      "id": "slide-21",
      "page": 21,
      "title": "城乡就业人数与原图趋势",
      "section": "就业与统计",
      "kind": "line",
      "unit": "万人",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=21",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "乡村就业人数",
          "color": "#ff0000",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2010",
              "y": 41418.01
            },
            {
              "x": 1,
              "label": "2011",
              "y": 40184.28
            },
            {
              "x": 2,
              "label": "2012",
              "y": 38974.74
            },
            {
              "x": 3,
              "label": "2013",
              "y": 37765.19
            },
            {
              "x": 4,
              "label": "2014",
              "y": 36642.04
            },
            {
              "x": 5,
              "label": "2015",
              "y": 35403.7
            },
            {
              "x": 6,
              "label": "2016",
              "y": 34194.15
            },
            {
              "x": 7,
              "label": "2017",
              "y": 32840.62
            },
            {
              "x": 8,
              "label": "2018",
              "y": 31487.08
            },
            {
              "x": 9,
              "label": "2019",
              "y": 30191.14
            },
            {
              "x": 10,
              "label": "2020",
              "y": 28780.0
            },
            {
              "x": 11,
              "label": "2021",
              "y": 27887.24
            },
            {
              "x": 12,
              "label": "2022",
              "y": 27426.46
            },
            {
              "x": 13,
              "label": "2023",
              "y": 27008.97
            }
          ]
        },
        {
          "name": "城镇就业人数",
          "color": "#0070c0",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2010",
              "y": 34686.99
            },
            {
              "x": 1,
              "label": "2011",
              "y": 36008.47
            },
            {
              "x": 2,
              "label": "2012",
              "y": 37275.61
            },
            {
              "x": 3,
              "label": "2013",
              "y": 38513.96
            },
            {
              "x": 4,
              "label": "2014",
              "y": 39694.7
            },
            {
              "x": 5,
              "label": "2015",
              "y": 40904.25
            },
            {
              "x": 6,
              "label": "2016",
              "y": 42056.2
            },
            {
              "x": 7,
              "label": "2017",
              "y": 43208.14
            },
            {
              "x": 8,
              "label": "2018",
              "y": 44302.49
            },
            {
              "x": 9,
              "label": "2019",
              "y": 45252.85
            },
            {
              "x": 10,
              "label": "2020",
              "y": 46260.8
            },
            {
              "x": 11,
              "label": "2021",
              "y": 46779.18
            },
            {
              "x": 12,
              "label": "2022",
              "y": 45944.02
            },
            {
              "x": 13,
              "label": "2023",
              "y": 47032.03
            }
          ]
        },
        {
          "name": "乡村就业人数 · 原图趋势线",
          "color": "#ff0000",
          "axis": "left",
          "dashed": true,
          "points": [
            {
              "x": 10.0402,
              "y": 28739.51,
              "label": "原图趋势片段"
            },
            {
              "x": 10.1936,
              "y": 28525.68,
              "label": "原图趋势片段"
            },
            {
              "x": 10.347,
              "y": 28311.85,
              "label": "原图趋势片段"
            },
            {
              "x": 10.5004,
              "y": 28098.02,
              "label": "原图趋势片段"
            },
            {
              "x": 10.6537,
              "y": 27884.19,
              "label": "原图趋势片段"
            },
            {
              "x": 10.8071,
              "y": 27670.36,
              "label": "原图趋势片段"
            },
            {
              "x": 10.9605,
              "y": 27456.53,
              "label": "原图趋势片段"
            },
            {
              "x": 11.114,
              "y": 27246.64,
              "label": "原图趋势片段"
            },
            {
              "x": 11.2675,
              "y": 27038.25,
              "label": "原图趋势片段"
            },
            {
              "x": 11.421,
              "y": 26829.87,
              "label": "原图趋势片段"
            },
            {
              "x": 11.5746,
              "y": 26621.49,
              "label": "原图趋势片段"
            },
            {
              "x": 11.7281,
              "y": 26413.11,
              "label": "原图趋势片段"
            },
            {
              "x": 11.8816,
              "y": 26204.72,
              "label": "原图趋势片段"
            },
            {
              "x": 12.0352,
              "y": 25996.54,
              "label": "原图趋势片段"
            },
            {
              "x": 12.1887,
              "y": 25789.05,
              "label": "原图趋势片段"
            },
            {
              "x": 12.3423,
              "y": 25581.55,
              "label": "原图趋势片段"
            },
            {
              "x": 12.4958,
              "y": 25374.06,
              "label": "原图趋势片段"
            },
            {
              "x": 12.6494,
              "y": 25166.57,
              "label": "原图趋势片段"
            },
            {
              "x": 12.8029,
              "y": 24959.07,
              "label": "原图趋势片段"
            },
            {
              "x": 12.9565,
              "y": 24751.58,
              "label": "原图趋势片段"
            }
          ]
        },
        {
          "name": "城镇就业人数 · 原图趋势线",
          "color": "#0070c0",
          "axis": "left",
          "dashed": true,
          "points": [
            {
              "x": 10.0406,
              "y": 46308.53,
              "label": "原图趋势片段"
            },
            {
              "x": 10.1956,
              "y": 46458.54,
              "label": "原图趋势片段"
            },
            {
              "x": 10.3505,
              "y": 46608.56,
              "label": "原图趋势片段"
            },
            {
              "x": 10.5055,
              "y": 46758.59,
              "label": "原图趋势片段"
            },
            {
              "x": 10.6605,
              "y": 46908.61,
              "label": "原图趋势片段"
            },
            {
              "x": 10.8154,
              "y": 47058.63,
              "label": "原图趋势片段"
            },
            {
              "x": 10.9704,
              "y": 47208.56,
              "label": "原图趋势片段"
            },
            {
              "x": 11.1254,
              "y": 47353.36,
              "label": "原图趋势片段"
            },
            {
              "x": 11.2805,
              "y": 47496.68,
              "label": "原图趋势片段"
            },
            {
              "x": 11.4356,
              "y": 47640.0,
              "label": "原图趋势片段"
            },
            {
              "x": 11.5907,
              "y": 47783.31,
              "label": "原图趋势片段"
            },
            {
              "x": 11.7458,
              "y": 47926.63,
              "label": "原图趋势片段"
            },
            {
              "x": 11.9009,
              "y": 48069.95,
              "label": "原图趋势片段"
            },
            {
              "x": 12.056,
              "y": 48210.37,
              "label": "原图趋势片段"
            },
            {
              "x": 12.2112,
              "y": 48345.67,
              "label": "原图趋势片段"
            },
            {
              "x": 12.3665,
              "y": 48480.97,
              "label": "原图趋势片段"
            },
            {
              "x": 12.5217,
              "y": 48616.28,
              "label": "原图趋势片段"
            },
            {
              "x": 12.677,
              "y": 48751.58,
              "label": "原图趋势片段"
            },
            {
              "x": 12.8322,
              "y": 48886.89,
              "label": "原图趋势片段"
            },
            {
              "x": 12.9743,
              "y": 49010.75,
              "label": "原图趋势片段"
            }
          ]
        }
      ],
      "method": "乡村相对趋势增加474、1383、2316万人。原稿列合计4174；逐项已显示数相加为4173，保留1万的舍入差。",
      "limits": [
        "乡村超趋势值不能直接当作已追踪到的城镇回流人数；两条趋势都不是因果识别。"
      ],
      "labels": [
        "2010",
        "2011",
        "2012",
        "2013",
        "2014",
        "2015",
        "2016",
        "2017",
        "2018",
        "2019",
        "2020",
        "2021",
        "2022",
        "2023"
      ],
      "axis": {
        "left": [
          20000,
          55000
        ],
        "yTicks": [
          20000,
          25000,
          30000,
          35000,
          40000,
          45000,
          50000,
          55000
        ]
      },
      "digitizationError": 29.999
    },
    {
      "id": "slide-22",
      "page": 22,
      "title": "就业质量：参保与公积金覆盖率",
      "section": "就业与统计",
      "kind": "line",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=22",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "失业保险",
          "color": "#ff0000",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2017",
              "y": 43.47
            },
            {
              "x": 1,
              "label": "2018",
              "y": 44.35
            },
            {
              "x": 2,
              "label": "2019",
              "y": 45.4
            },
            {
              "x": 3,
              "label": "2020",
              "y": 46.87
            },
            {
              "x": 4,
              "label": "2021",
              "y": 49.09
            },
            {
              "x": 5,
              "label": "2022",
              "y": 51.83
            },
            {
              "x": 6,
              "label": "2023",
              "y": 51.83
            }
          ]
        },
        {
          "name": "工伤保险",
          "color": "#0070c0",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "2017",
              "y": 52.6
            },
            {
              "x": 1,
              "label": "2018",
              "y": 53.89
            },
            {
              "x": 2,
              "label": "2019",
              "y": 56.3
            },
            {
              "x": 3,
              "label": "2020",
              "y": 57.85
            },
            {
              "x": 4,
              "label": "2021",
              "y": 60.48
            },
            {
              "x": 5,
              "label": "2022",
              "y": 63.37
            },
            {
              "x": 6,
              "label": "2023",
              "y": 64.15
            }
          ]
        },
        {
          "name": "住房公积金",
          "color": "#00b050",
          "axis": "right",
          "points": [
            {
              "x": 0,
              "label": "2017",
              "y": 31.79
            },
            {
              "x": 1,
              "label": "2018",
              "y": 32.6
            },
            {
              "x": 2,
              "label": "2019",
              "y": 32.89
            },
            {
              "x": 3,
              "label": "2020",
              "y": 33.13
            },
            {
              "x": 4,
              "label": "2021",
              "y": 35.14
            },
            {
              "x": 5,
              "label": "2022",
              "y": 36.97
            },
            {
              "x": 6,
              "label": "2023",
              "y": 37.11
            }
          ]
        },
        {
          "name": "失业保险 · 原图趋势线",
          "color": "#ff0000",
          "axis": "left",
          "dashed": true,
          "points": [
            {
              "x": 5.0182,
              "y": 51.86,
              "label": "原图趋势片段"
            },
            {
              "x": 5.0892,
              "y": 52.0,
              "label": "原图趋势片段"
            },
            {
              "x": 5.1602,
              "y": 52.13,
              "label": "原图趋势片段"
            },
            {
              "x": 5.2312,
              "y": 52.26,
              "label": "原图趋势片段"
            },
            {
              "x": 5.3022,
              "y": 52.39,
              "label": "原图趋势片段"
            },
            {
              "x": 5.3732,
              "y": 52.52,
              "label": "原图趋势片段"
            },
            {
              "x": 5.4442,
              "y": 52.65,
              "label": "原图趋势片段"
            },
            {
              "x": 5.5152,
              "y": 52.78,
              "label": "原图趋势片段"
            },
            {
              "x": 5.5862,
              "y": 52.91,
              "label": "原图趋势片段"
            },
            {
              "x": 5.6572,
              "y": 53.04,
              "label": "原图趋势片段"
            },
            {
              "x": 5.7282,
              "y": 53.17,
              "label": "原图趋势片段"
            },
            {
              "x": 5.7992,
              "y": 53.3,
              "label": "原图趋势片段"
            },
            {
              "x": 5.8702,
              "y": 53.44,
              "label": "原图趋势片段"
            },
            {
              "x": 5.9412,
              "y": 53.57,
              "label": "原图趋势片段"
            }
          ]
        },
        {
          "name": "工伤保险 · 原图趋势线",
          "color": "#0070c0",
          "axis": "left",
          "dashed": true,
          "points": [
            {
              "x": 5.0181,
              "y": 63.42,
              "label": "原图趋势片段"
            },
            {
              "x": 5.0888,
              "y": 63.56,
              "label": "原图趋势片段"
            },
            {
              "x": 5.1594,
              "y": 63.71,
              "label": "原图趋势片段"
            },
            {
              "x": 5.2301,
              "y": 63.86,
              "label": "原图趋势片段"
            },
            {
              "x": 5.3008,
              "y": 64.01,
              "label": "原图趋势片段"
            },
            {
              "x": 5.3714,
              "y": 64.15,
              "label": "原图趋势片段"
            },
            {
              "x": 5.4421,
              "y": 64.3,
              "label": "原图趋势片段"
            },
            {
              "x": 5.5127,
              "y": 64.45,
              "label": "原图趋势片段"
            },
            {
              "x": 5.5834,
              "y": 64.6,
              "label": "原图趋势片段"
            },
            {
              "x": 5.654,
              "y": 64.74,
              "label": "原图趋势片段"
            },
            {
              "x": 5.7247,
              "y": 64.89,
              "label": "原图趋势片段"
            },
            {
              "x": 5.7954,
              "y": 65.04,
              "label": "原图趋势片段"
            },
            {
              "x": 5.866,
              "y": 65.19,
              "label": "原图趋势片段"
            },
            {
              "x": 5.9367,
              "y": 65.33,
              "label": "原图趋势片段"
            },
            {
              "x": 5.9948,
              "y": 65.46,
              "label": "原图趋势片段"
            }
          ]
        },
        {
          "name": "住房公积金 · 原图趋势线",
          "color": "#00b050",
          "axis": "right",
          "dashed": true,
          "points": [
            {
              "x": 5.0178,
              "y": 36.99,
              "label": "原图趋势片段"
            },
            {
              "x": 5.0871,
              "y": 37.07,
              "label": "原图趋势片段"
            },
            {
              "x": 5.1564,
              "y": 37.14,
              "label": "原图趋势片段"
            },
            {
              "x": 5.2257,
              "y": 37.22,
              "label": "原图趋势片段"
            },
            {
              "x": 5.2951,
              "y": 37.3,
              "label": "原图趋势片段"
            },
            {
              "x": 5.3644,
              "y": 37.38,
              "label": "原图趋势片段"
            },
            {
              "x": 5.4337,
              "y": 37.46,
              "label": "原图趋势片段"
            },
            {
              "x": 5.503,
              "y": 37.53,
              "label": "原图趋势片段"
            },
            {
              "x": 5.5723,
              "y": 37.61,
              "label": "原图趋势片段"
            },
            {
              "x": 5.6417,
              "y": 37.69,
              "label": "原图趋势片段"
            },
            {
              "x": 5.711,
              "y": 37.77,
              "label": "原图趋势片段"
            },
            {
              "x": 5.7803,
              "y": 37.85,
              "label": "原图趋势片段"
            },
            {
              "x": 5.8496,
              "y": 37.92,
              "label": "原图趋势片段"
            },
            {
              "x": 5.9189,
              "y": 38.0,
              "label": "原图趋势片段"
            },
            {
              "x": 5.9855,
              "y": 38.08,
              "label": "原图趋势片段"
            }
          ]
        }
      ],
      "method": "参保或实缴人数 / 城镇就业人数；住房公积金使用右轴。",
      "limits": [
        "不同制度的参保人数不可相加成独立劳动者；分母和覆盖人群变化会影响比率。"
      ],
      "labels": [
        "2017",
        "2018",
        "2019",
        "2020",
        "2021",
        "2022",
        "2023"
      ],
      "axis": {
        "left": [
          43,
          66
        ],
        "right": [
          31,
          40
        ],
        "yTicks": [
          43,
          48,
          53,
          58,
          63
        ],
        "rightTicks": [
          31,
          32,
          33,
          34,
          35,
          36,
          37,
          38,
          39,
          40
        ]
      },
      "digitizationError": 0.02
    },
    {
      "id": "slide-24",
      "page": 24,
      "title": "产出缺口与核心CPI",
      "section": "总量与地产",
      "kind": "scatter",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=24",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "原图散点",
          "points": [
            {
              "x": 0.0,
              "y": 1.599,
              "label": "2013—2019 观测 1",
              "color": "#4f81bd"
            },
            {
              "x": 0.59,
              "y": 1.9,
              "label": "2013—2019 观测 2",
              "color": "#4f81bd"
            },
            {
              "x": 0.857,
              "y": 2.2,
              "label": "2013—2019 观测 3",
              "color": "#4f81bd"
            },
            {
              "x": -0.072,
              "y": 1.599,
              "label": "2013—2019 观测 4",
              "color": "#4f81bd"
            },
            {
              "x": -0.475,
              "y": 1.537,
              "label": "2013—2019 观测 5",
              "color": "#4f81bd"
            },
            {
              "x": -0.044,
              "y": 1.599,
              "label": "2013—2019 观测 6",
              "color": "#4f81bd"
            },
            {
              "x": -0.204,
              "y": 1.7,
              "label": "2013—2019 观测 7",
              "color": "#4f81bd"
            },
            {
              "x": 0.2,
              "y": 0.4,
              "label": "2024（原图估计）",
              "color": "#9bbb59"
            },
            {
              "x": -0.0,
              "y": 0.7,
              "label": "2023",
              "color": "#ff0000"
            }
          ]
        }
      ],
      "xLabel": "产出缺口，百分点",
      "yLabel": "核心CPI同比，%",
      "method": "基准散点为2013—2019；2020—2022被原研究排除，2024核心CPI当时估为0.4%。",
      "limits": [
        "原图坐标将2023画在x≈0、2024画在x≈0.2；脚注却将两年的产出缺口依次写成0.2和0，存在顺序矛盾，未擅自修正。",
        "潜在增速属于模型估计，不能将回归外推自动当成真实GDP的精确测量。"
      ],
      "axis": {
        "x": [
          -0.6,
          1
        ],
        "left": [
          0.3,
          2.3
        ],
        "yTicks": [
          0.3,
          0.5,
          0.7,
          0.9,
          1.1,
          1.3,
          1.5,
          1.7,
          1.9,
          2.1,
          2.3
        ],
        "xTicks": [
          -0.6,
          -0.4,
          -0.2,
          0.0,
          0.2,
          0.4,
          0.6,
          0.8,
          1.0
        ]
      },
      "regression": {
        "slope": 0.47,
        "intercept": 1.69,
        "r2": 0.86
      },
      "drawnFit": [
        {
          "x": -0.4756,
          "y": 1.465
        },
        {
          "x": 0.8572,
          "y": 2.0953
        }
      ],
      "recoveredOLS": {
        "n": 7,
        "slope": 0.47358,
        "intercept": 1.68932,
        "r2": 0.85665
      }
    },
    {
      "id": "slide-25",
      "page": 25,
      "title": "就业增速与实际GDP：历史关系",
      "section": "总量与地产",
      "kind": "scatter",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=25",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "原图散点",
          "points": [
            {
              "x": 3.298,
              "y": 8.49,
              "label": "2000",
              "color": "#4f81bd"
            },
            {
              "x": 4.197,
              "y": 8.336,
              "label": "2001",
              "color": "#4f81bd"
            },
            {
              "x": 4.295,
              "y": 9.132,
              "label": "2002",
              "color": "#4f81bd"
            },
            {
              "x": 4.258,
              "y": 10.031,
              "label": "2003",
              "color": "#4f81bd"
            },
            {
              "x": 4.053,
              "y": 10.108,
              "label": "2004",
              "color": "#4f81bd"
            },
            {
              "x": 4.016,
              "y": 11.392,
              "label": "2005",
              "color": "#4f81bd"
            },
            {
              "x": 4.371,
              "y": 12.714,
              "label": "2006",
              "color": "#4f81bd"
            },
            {
              "x": 4.465,
              "y": 14.229,
              "label": "2007",
              "color": "#4f81bd"
            },
            {
              "x": 3.715,
              "y": 9.646,
              "label": "2008",
              "color": "#4f81bd"
            },
            {
              "x": 3.796,
              "y": 9.402,
              "label": "2009",
              "color": "#4f81bd"
            },
            {
              "x": 4.095,
              "y": 10.634,
              "label": "2010",
              "color": "#4f81bd"
            },
            {
              "x": 3.793,
              "y": 9.543,
              "label": "2011",
              "color": "#4f81bd"
            },
            {
              "x": 3.565,
              "y": 7.861,
              "label": "2012",
              "color": "#4f81bd"
            },
            {
              "x": 3.326,
              "y": 7.758,
              "label": "2013",
              "color": "#4f81bd"
            },
            {
              "x": 3.054,
              "y": 7.425,
              "label": "2014",
              "color": "#4f81bd"
            },
            {
              "x": 3.056,
              "y": 7.04,
              "label": "2015",
              "color": "#4f81bd"
            },
            {
              "x": 2.773,
              "y": 6.847,
              "label": "2016",
              "color": "#4f81bd"
            },
            {
              "x": 2.752,
              "y": 6.95,
              "label": "2017",
              "color": "#4f81bd"
            },
            {
              "x": 2.508,
              "y": 6.744,
              "label": "2018",
              "color": "#4f81bd"
            },
            {
              "x": 2.162,
              "y": 5.948,
              "label": "2019",
              "color": "#4f81bd"
            },
            {
              "x": 2.259,
              "y": 2.238,
              "label": "2020",
              "color": "#4f81bd"
            },
            {
              "x": 1.671,
              "y": 5.345,
              "label": "2021",
              "color": "#4f81bd"
            },
            {
              "x": -1.8,
              "y": 2.946,
              "label": "2022",
              "color": "#ff0000"
            },
            {
              "x": 0.299,
              "y": 4.102,
              "label": "2023",
              "color": "#ff0000"
            }
          ]
        }
      ],
      "xLabel": "城镇就业人员增速，%",
      "yLabel": "实际GDP同比，%",
      "method": "原图2000—2023年年度数据；2021和2023年用两年复合增速。",
      "limits": [
        "拟合样本是否排除2022—2023须回归核对；关系不稳定不唯一说明GDP被高估。",
        "仅排除2022—2023的恢复点回归，与原稿方程不一致；进一步排除2020的敏感性结果也不能复现原标注，具体回归样本或权重仍待确认。"
      ],
      "axis": {
        "x": [
          -3,
          5
        ],
        "left": [
          0,
          16
        ],
        "yTicks": [
          0,
          2,
          4,
          6,
          8,
          10,
          12,
          14,
          16
        ],
        "xTicks": [
          -3,
          -2,
          -1,
          0,
          1,
          2,
          3,
          4,
          5
        ]
      },
      "regression": {
        "slope": 3.0,
        "intercept": -2.0,
        "pText": "原图显示 p=0（舍入）"
      },
      "drawnFit": [
        {
          "x": 4.7948,
          "y": 12.7469
        },
        {
          "x": 0.4699,
          "y": 1.0435
        }
      ],
      "recoveredOLS": {
        "n": 22,
        "slope": 2.75262,
        "intercept": -0.90677,
        "r2": 0.73735
      }
    },
    {
      "id": "slide-26",
      "page": 26,
      "title": "消费与名义GDP：前后五年比较",
      "section": "总量与地产",
      "kind": "bar",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=26",
      "fidelity": "原图明确标注值",
      "rawRecalculated": false,
      "series": [
        {
          "name": "名义GDP同比",
          "color": "#0070c0",
          "points": [
            {
              "x": 0,
              "label": "2015—2019",
              "y": 8.9
            },
            {
              "x": 1,
              "label": "2020—2024（当时估计）",
              "y": 5.9
            }
          ]
        },
        {
          "name": "社零同比",
          "color": "#ff0000",
          "points": [
            {
              "x": 0,
              "label": "2015—2019",
              "y": 9.7
            },
            {
              "x": 1,
              "label": "2020—2024（当时估计）",
              "y": 3.8
            }
          ]
        }
      ],
      "method": "按原图明示的两个五年窗口数值重绘；2024值在演讲时属于估计。",
      "limits": [
        "不是截至2025年的事后年度统计；固定资产投资并不等于GDP核算中的资本形成。"
      ],
      "labels": [
        "2015—2019",
        "2020—2024（当时估计）"
      ],
      "axis": {
        "left": [
          0,
          11
        ],
        "yTicks": [
          0,
          2,
          4,
          6,
          8,
          10
        ]
      }
    },
    {
      "id": "slide-27",
      "page": 27,
      "title": "投资与名义GDP：前后五年比较",
      "section": "总量与地产",
      "kind": "bar",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=27",
      "fidelity": "原图明确标注值",
      "rawRecalculated": false,
      "series": [
        {
          "name": "名义GDP同比",
          "color": "#0070c0",
          "points": [
            {
              "x": 0,
              "label": "2015—2019",
              "y": 8.9
            },
            {
              "x": 1,
              "label": "2020—2024（当时估计）",
              "y": 5.9
            }
          ]
        },
        {
          "name": "固定资产投资同比",
          "color": "#ff0000",
          "points": [
            {
              "x": 0,
              "label": "2015—2019",
              "y": 7.3
            },
            {
              "x": 1,
              "label": "2020—2024（当时估计）",
              "y": 3.9
            }
          ]
        }
      ],
      "method": "按原图明示的两个五年窗口数值重绘；2024值在演讲时属于估计。",
      "limits": [
        "不是截至2025年的事后年度统计；固定资产投资并不等于GDP核算中的资本形成。"
      ],
      "labels": [
        "2015—2019",
        "2020—2024（当时估计）"
      ],
      "axis": {
        "left": [
          0,
          11
        ],
        "yTicks": [
          0,
          2,
          4,
          6,
          8,
          10
        ]
      }
    },
    {
      "id": "slide-28",
      "page": 28,
      "title": "地产危机前后三年增速差",
      "section": "总量与地产",
      "kind": "bar",
      "unit": "百分点",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=28",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "后3年均值 − 前3年均值",
          "color": "#2876ab",
          "points": [
            {
              "x": 0,
              "y": -0.18,
              "label": "中国2021",
              "color": "#ff0000"
            },
            {
              "x": 1,
              "y": -1.7,
              "label": "西班牙1978",
              "color": "#0070c0"
            },
            {
              "x": 2,
              "y": -3.27,
              "label": "瑞典1991",
              "color": "#0070c0"
            },
            {
              "x": 3,
              "y": -3.53,
              "label": "美国2008",
              "color": "#0070c0"
            },
            {
              "x": 4,
              "y": -3.57,
              "label": "丹麦2008",
              "color": "#0070c0"
            },
            {
              "x": 5,
              "y": -4.43,
              "label": "日本1991",
              "color": "#0070c0"
            },
            {
              "x": 6,
              "y": -4.69,
              "label": "西班牙2008",
              "color": "#0070c0"
            },
            {
              "x": 7,
              "y": -6.94,
              "label": "芬兰1991",
              "color": "#0070c0"
            }
          ]
        }
      ],
      "method": "危机后3年平均实际增长减危机前3年平均实际增长；中国以2021为0点，2021用两年复合，2024为当时估计。",
      "limits": [
        "事件包括西班牙1978、瑞典/日本/芬兰1991及美国/丹麦/西班牙2008；事件选择、财政反应和全球环境不同。差异不是因果估计。"
      ],
      "labels": [
        "中国2021",
        "西班牙1978",
        "瑞典1991",
        "美国2008",
        "丹麦2008",
        "日本1991",
        "西班牙2008",
        "芬兰1991"
      ],
      "axis": {
        "left": [
          -7,
          0
        ],
        "yTicks": [
          -7,
          -6,
          -5,
          -4,
          -3,
          -2,
          -1,
          0
        ]
      }
    },
    {
      "id": "slide-29",
      "page": 29,
      "title": "地产危机前后的事件时间路径",
      "section": "总量与地产",
      "kind": "line",
      "unit": "%",
      "source": "https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf#page=29",
      "fidelity": "图中数值恢复",
      "rawRecalculated": false,
      "series": [
        {
          "name": "危机国家平均",
          "color": "#ff0000",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "-10",
              "y": 3.09
            },
            {
              "x": 1,
              "label": "-9",
              "y": 3.78
            },
            {
              "x": 2,
              "label": "-8",
              "y": 4.39
            },
            {
              "x": 3,
              "label": "-7",
              "y": 3.58
            },
            {
              "x": 4,
              "label": "-6",
              "y": 2.96
            },
            {
              "x": 5,
              "label": "-5",
              "y": 3.12
            },
            {
              "x": 6,
              "label": "-4",
              "y": 3.9
            },
            {
              "x": 7,
              "label": "-3",
              "y": 4.33
            },
            {
              "x": 8,
              "label": "-2",
              "y": 3.6
            },
            {
              "x": 9,
              "label": "-1",
              "y": 2.48
            },
            {
              "x": 10,
              "label": "0",
              "y": 0.23
            },
            {
              "x": 11,
              "label": "1",
              "y": -1.52
            },
            {
              "x": 12,
              "label": "2",
              "y": -0.44
            },
            {
              "x": 13,
              "label": "3",
              "y": 1.29
            },
            {
              "x": 14,
              "label": "4",
              "y": 1.35
            },
            {
              "x": 15,
              "label": "5",
              "y": 1.63
            },
            {
              "x": 16,
              "label": "6",
              "y": 2.43
            },
            {
              "x": 17,
              "label": "7",
              "y": 2.68
            },
            {
              "x": 18,
              "label": "8",
              "y": 2.81
            },
            {
              "x": 19,
              "label": "9",
              "y": 3.44
            },
            {
              "x": 20,
              "label": "10",
              "y": 2.36
            }
          ]
        },
        {
          "name": "中国（2021=事件年0）",
          "color": "#0070c0",
          "axis": "left",
          "points": [
            {
              "x": 0,
              "label": "-10",
              "y": 9.55
            },
            {
              "x": 1,
              "label": "-9",
              "y": 7.86
            },
            {
              "x": 2,
              "label": "-8",
              "y": 7.77
            },
            {
              "x": 3,
              "label": "-7",
              "y": 7.43
            },
            {
              "x": 4,
              "label": "-6",
              "y": 7.04
            },
            {
              "x": 5,
              "label": "-5",
              "y": 6.85
            },
            {
              "x": 6,
              "label": "-4",
              "y": 6.95
            },
            {
              "x": 7,
              "label": "-3",
              "y": 6.75
            },
            {
              "x": 8,
              "label": "-2",
              "y": 6.0
            },
            {
              "x": 9,
              "label": "-1",
              "y": 2.2
            },
            {
              "x": 10,
              "label": "0",
              "y": 5.25
            },
            {
              "x": 11,
              "label": "1",
              "y": 3.0
            },
            {
              "x": 12,
              "label": "2",
              "y": 5.0
            },
            {
              "x": 13,
              "label": "3",
              "y": 4.9
            }
          ]
        }
      ],
      "method": "横轴0为危机年份；七次历史事件按算术平均对齐；中国0点为2021。",
      "limits": [
        "平均路径隐藏国别差异；2024仍是当时估计；恢复的是原图路径，不能直接当作中国未来预测。"
      ],
      "labels": [
        "-10",
        "-9",
        "-8",
        "-7",
        "-6",
        "-5",
        "-4",
        "-3",
        "-2",
        "-1",
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10"
      ],
      "axis": {
        "left": [
          -2,
          8
        ],
        "yTicks": [
          -2,
          0,
          2,
          4,
          6,
          8
        ]
      },
      "digitizationError": 0.009
    }
  ],
  "notes": [
    "原图的矢量位置按刻度线性标定恢复，保留绘图误差；数值小数位用于复算，不代表原始数据精度。",
    "没有将图形恢复说成逐公司原始数据库复算；原始Wind样本、去重及公司口径仍缺失。",
    "已有2012年起的官方年度数据为事后观察，演讲原图中2024年估计另行保留，不事后替换。"
  ]
}
;
const WORLDBANK={
  "source": "https://api.worldbank.org/v2/country/USA;ESP;DNK;JPN;FIN;SWE;CHN/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=20000&date=1968:2025",
  "indicator": "NY.GDP.MKTP.KD.ZG",
  "lastUpdated": "2026-10-08",
  "retrievedAt": "2026-10-25T21:50:56.569Z",
  "observations": [
    {
      "country": "CHN",
      "year": 2025,
      "value": 4.95994886240992
    },
    {
      "country": "CHN",
      "year": 2024,
      "value": 4.95830378788091
    },
    {
      "country": "CHN",
      "year": 2023,
      "value": 5.41600334492955
    },
    {
      "country": "CHN",
      "year": 2022,
      "value": 3.13385438394069
    },
    {
      "country": "CHN",
      "year": 2021,
      "value": 8.57038414981781
    },
    {
      "country": "CHN",
      "year": 2020,
      "value": 2.33950385203023
    },
    {
      "country": "CHN",
      "year": 2019,
      "value": 6.06737806333672
    },
    {
      "country": "CHN",
      "year": 2018,
      "value": 6.757806142324
    },
    {
      "country": "CHN",
      "year": 2017,
      "value": 6.89123916636191
    },
    {
      "country": "CHN",
      "year": 2016,
      "value": 6.7736886867727
    },
    {
      "country": "CHN",
      "year": 2015,
      "value": 6.98162255562367
    },
    {
      "country": "CHN",
      "year": 2014,
      "value": 7.46100735778161
    },
    {
      "country": "CHN",
      "year": 2013,
      "value": 7.77842954757257
    },
    {
      "country": "CHN",
      "year": 2012,
      "value": 7.8578201481217
    },
    {
      "country": "CHN",
      "year": 2011,
      "value": 9.46205248298186
    },
    {
      "country": "CHN",
      "year": 2010,
      "value": 10.5916903885704
    },
    {
      "country": "CHN",
      "year": 2009,
      "value": 9.40610014336416
    },
    {
      "country": "CHN",
      "year": 2008,
      "value": 9.66877608164454
    },
    {
      "country": "CHN",
      "year": 2007,
      "value": 14.1507710506103
    },
    {
      "country": "CHN",
      "year": 2006,
      "value": 12.6752842281595
    },
    {
      "country": "CHN",
      "year": 2005,
      "value": 11.4535130030645
    },
    {
      "country": "CHN",
      "year": 2004,
      "value": 10.1404291872206
    },
    {
      "country": "CHN",
      "year": 2003,
      "value": 10.1138119025242
    },
    {
      "country": "CHN",
      "year": 2002,
      "value": 9.23604870383861
    },
    {
      "country": "CHN",
      "year": 2001,
      "value": 8.32404695347056
    },
    {
      "country": "CHN",
      "year": 2000,
      "value": 8.57357328926101
    },
    {
      "country": "CHN",
      "year": 1999,
      "value": 7.74123827728161
    },
    {
      "country": "CHN",
      "year": 1998,
      "value": 7.92354535108497
    },
    {
      "country": "CHN",
      "year": 1997,
      "value": 9.29759460595947
    },
    {
      "country": "CHN",
      "year": 1996,
      "value": 9.97328781228394
    },
    {
      "country": "CHN",
      "year": 1995,
      "value": 11.0154136659719
    },
    {
      "country": "CHN",
      "year": 1994,
      "value": 13.0827122987906
    },
    {
      "country": "CHN",
      "year": 1993,
      "value": 13.9261028311995
    },
    {
      "country": "CHN",
      "year": 1992,
      "value": 14.2976226152779
    },
    {
      "country": "CHN",
      "year": 1991,
      "value": 9.37563237902144
    },
    {
      "country": "CHN",
      "year": 1990,
      "value": 3.9225195692421
    },
    {
      "country": "CHN",
      "year": 1989,
      "value": 4.20785693658392
    },
    {
      "country": "CHN",
      "year": 1988,
      "value": 11.2209115803492
    },
    {
      "country": "CHN",
      "year": 1987,
      "value": 11.6552658383921
    },
    {
      "country": "CHN",
      "year": 1986,
      "value": 8.9437463904392
    },
    {
      "country": "CHN",
      "year": 1985,
      "value": 13.4284820016509
    },
    {
      "country": "CHN",
      "year": 1984,
      "value": 15.1921349118079
    },
    {
      "country": "CHN",
      "year": 1983,
      "value": 10.7718383060041
    },
    {
      "country": "CHN",
      "year": 1982,
      "value": 9.02434347373044
    },
    {
      "country": "CHN",
      "year": 1981,
      "value": 5.11486309071954
    },
    {
      "country": "CHN",
      "year": 1980,
      "value": 7.84141706847441
    },
    {
      "country": "CHN",
      "year": 1979,
      "value": 7.59480175999998
    },
    {
      "country": "CHN",
      "year": 1978,
      "value": 11.3269542129809
    },
    {
      "country": "CHN",
      "year": 1977,
      "value": 7.57000000138403
    },
    {
      "country": "CHN",
      "year": 1976,
      "value": -1.57000000165326
    },
    {
      "country": "CHN",
      "year": 1975,
      "value": 8.71999999747992
    },
    {
      "country": "CHN",
      "year": 1974,
      "value": 2.31000000294736
    },
    {
      "country": "CHN",
      "year": 1973,
      "value": 7.76000000084325
    },
    {
      "country": "CHN",
      "year": 1972,
      "value": 3.81000000021984
    },
    {
      "country": "CHN",
      "year": 1971,
      "value": 7.05999999853672
    },
    {
      "country": "CHN",
      "year": 1970,
      "value": 19.2999999967022
    },
    {
      "country": "CHN",
      "year": 1969,
      "value": 16.9399999960609
    },
    {
      "country": "CHN",
      "year": 1968,
      "value": -4.09999998647768
    },
    {
      "country": "DNK",
      "year": 2025,
      "value": 2.92843280014236
    },
    {
      "country": "DNK",
      "year": 2024,
      "value": 3.47783593140312
    },
    {
      "country": "DNK",
      "year": 2023,
      "value": 0.604587766175584
    },
    {
      "country": "DNK",
      "year": 2022,
      "value": 0.443832614908331
    },
    {
      "country": "DNK",
      "year": 2021,
      "value": 6.50025445756295
    },
    {
      "country": "DNK",
      "year": 2020,
      "value": -1.78010601831291
    },
    {
      "country": "DNK",
      "year": 2019,
      "value": 1.71140093932736
    },
    {
      "country": "DNK",
      "year": 2018,
      "value": 1.8600074900921
    },
    {
      "country": "DNK",
      "year": 2017,
      "value": 3.05647723922718
    },
    {
      "country": "DNK",
      "year": 2016,
      "value": 3.07304549209093
    },
    {
      "country": "DNK",
      "year": 2015,
      "value": 2.10441456445301
    },
    {
      "country": "DNK",
      "year": 2014,
      "value": 1.27799983192831
    },
    {
      "country": "DNK",
      "year": 2013,
      "value": 1.39267343161971
    },
    {
      "country": "DNK",
      "year": 2012,
      "value": -0.00543230161670749
    },
    {
      "country": "DNK",
      "year": 2011,
      "value": 1.3108037609606
    },
    {
      "country": "DNK",
      "year": 2010,
      "value": 1.58289703108802
    },
    {
      "country": "DNK",
      "year": 2009,
      "value": -4.97447905669058
    },
    {
      "country": "DNK",
      "year": 2008,
      "value": -0.417178439991005
    },
    {
      "country": "DNK",
      "year": 2007,
      "value": 0.987173815945127
    },
    {
      "country": "DNK",
      "year": 2006,
      "value": 3.81648769908172
    },
    {
      "country": "DNK",
      "year": 2005,
      "value": 2.35960882992528
    },
    {
      "country": "DNK",
      "year": 2004,
      "value": 2.77635180744053
    },
    {
      "country": "DNK",
      "year": 2003,
      "value": 0.441091006625101
    },
    {
      "country": "DNK",
      "year": 2002,
      "value": 0.456530018779986
    },
    {
      "country": "DNK",
      "year": 2001,
      "value": 0.95003224600012
    },
    {
      "country": "DNK",
      "year": 2000,
      "value": 3.72400899471576
    },
    {
      "country": "DNK",
      "year": 1999,
      "value": 2.96730536257029
    },
    {
      "country": "DNK",
      "year": 1998,
      "value": 2.32630274538961
    },
    {
      "country": "DNK",
      "year": 1997,
      "value": 3.16848143784479
    },
    {
      "country": "DNK",
      "year": 1996,
      "value": 2.89575069230459
    },
    {
      "country": "DNK",
      "year": 1995,
      "value": 3.03802150461165
    },
    {
      "country": "DNK",
      "year": 1994,
      "value": 5.29469615156448
    },
    {
      "country": "DNK",
      "year": 1993,
      "value": -0.078900412805325
    },
    {
      "country": "DNK",
      "year": 1992,
      "value": 2.0228112415746
    },
    {
      "country": "DNK",
      "year": 1991,
      "value": 1.45818005306188
    },
    {
      "country": "DNK",
      "year": 1990,
      "value": 1.66026774169177
    },
    {
      "country": "DNK",
      "year": 1989,
      "value": 0.697173210370437
    },
    {
      "country": "DNK",
      "year": 1988,
      "value": 0.272951118976223
    },
    {
      "country": "DNK",
      "year": 1987,
      "value": 0.462955829960563
    },
    {
      "country": "DNK",
      "year": 1986,
      "value": 4.73340611933794
    },
    {
      "country": "DNK",
      "year": 1985,
      "value": 4.15308383294486
    },
    {
      "country": "DNK",
      "year": 1984,
      "value": 4.33934505132922
    },
    {
      "country": "DNK",
      "year": 1983,
      "value": 2.65480394401855
    },
    {
      "country": "DNK",
      "year": 1982,
      "value": 3.89211245643591
    },
    {
      "country": "DNK",
      "year": 1981,
      "value": -0.740986389012875
    },
    {
      "country": "DNK",
      "year": 1980,
      "value": -0.751430002361559
    },
    {
      "country": "DNK",
      "year": 1979,
      "value": 4.05329979126334
    },
    {
      "country": "DNK",
      "year": 1978,
      "value": 2.41699354282181
    },
    {
      "country": "DNK",
      "year": 1977,
      "value": 1.98543025474245
    },
    {
      "country": "DNK",
      "year": 1976,
      "value": 5.99340195153275
    },
    {
      "country": "DNK",
      "year": 1975,
      "value": -1.40989953291778
    },
    {
      "country": "DNK",
      "year": 1974,
      "value": -0.964267384329801
    },
    {
      "country": "DNK",
      "year": 1973,
      "value": 4.71949291132046
    },
    {
      "country": "DNK",
      "year": 1972,
      "value": 3.79759816845579
    },
    {
      "country": "DNK",
      "year": 1971,
      "value": 3.17782168196071
    },
    {
      "country": "DNK",
      "year": 1970,
      "value": 1.85600172758038
    },
    {
      "country": "DNK",
      "year": 1969,
      "value": 6.79912047392293
    },
    {
      "country": "DNK",
      "year": 1968,
      "value": 5.85299737649714
    },
    {
      "country": "ESP",
      "year": 2025,
      "value": 2.82495400578509
    },
    {
      "country": "ESP",
      "year": 2024,
      "value": 3.45525405630191
    },
    {
      "country": "ESP",
      "year": 2023,
      "value": 2.46085796805582
    },
    {
      "country": "ESP",
      "year": 2022,
      "value": 6.37031712129601
    },
    {
      "country": "ESP",
      "year": 2021,
      "value": 6.68314420473001
    },
    {
      "country": "ESP",
      "year": 2020,
      "value": -10.9400706350371
    },
    {
      "country": "ESP",
      "year": 2019,
      "value": 1.96117850841711
    },
    {
      "country": "ESP",
      "year": 2018,
      "value": 2.39541124478878
    },
    {
      "country": "ESP",
      "year": 2017,
      "value": 2.89604207865007
    },
    {
      "country": "ESP",
      "year": 2016,
      "value": 2.91515598595787
    },
    {
      "country": "ESP",
      "year": 2015,
      "value": 4.06086672473866
    },
    {
      "country": "ESP",
      "year": 2014,
      "value": 1.52048593647231
    },
    {
      "country": "ESP",
      "year": 2013,
      "value": -1.42732224757626
    },
    {
      "country": "ESP",
      "year": 2012,
      "value": -2.86511368637748
    },
    {
      "country": "ESP",
      "year": 2011,
      "value": -0.639920636520344
    },
    {
      "country": "ESP",
      "year": 2010,
      "value": 0.0941223116369514
    },
    {
      "country": "ESP",
      "year": 2009,
      "value": -3.76813306940053
    },
    {
      "country": "ESP",
      "year": 2008,
      "value": 0.767165748290694
    },
    {
      "country": "ESP",
      "year": 2007,
      "value": 3.53350013165972
    },
    {
      "country": "ESP",
      "year": 2006,
      "value": 4.04343515605099
    },
    {
      "country": "ESP",
      "year": 2005,
      "value": 3.5512255846125
    },
    {
      "country": "ESP",
      "year": 2004,
      "value": 3.1145314799161
    },
    {
      "country": "ESP",
      "year": 2003,
      "value": 2.9392895953076
    },
    {
      "country": "ESP",
      "year": 2002,
      "value": 2.75545611564098
    },
    {
      "country": "ESP",
      "year": 2001,
      "value": 3.91908880808811
    },
    {
      "country": "ESP",
      "year": 2000,
      "value": 5.20064125553942
    },
    {
      "country": "ESP",
      "year": 1999,
      "value": 4.40886545305924
    },
    {
      "country": "ESP",
      "year": 1998,
      "value": 4.30197745333581
    },
    {
      "country": "ESP",
      "year": 1997,
      "value": 3.58729972356299
    },
    {
      "country": "ESP",
      "year": 1996,
      "value": 2.60741117110229
    },
    {
      "country": "ESP",
      "year": 1995,
      "value": 2.75749400293542
    },
    {
      "country": "ESP",
      "year": 1994,
      "value": 2.38319537908909
    },
    {
      "country": "ESP",
      "year": 1993,
      "value": -1.03149183695307
    },
    {
      "country": "ESP",
      "year": 1992,
      "value": 0.929215482921151
    },
    {
      "country": "ESP",
      "year": 1991,
      "value": 2.54600049647455
    },
    {
      "country": "ESP",
      "year": 1990,
      "value": 3.7813935513235
    },
    {
      "country": "ESP",
      "year": 1989,
      "value": 4.82703031299745
    },
    {
      "country": "ESP",
      "year": 1988,
      "value": 5.09432412898086
    },
    {
      "country": "ESP",
      "year": 1987,
      "value": 5.54712273579352
    },
    {
      "country": "ESP",
      "year": 1986,
      "value": 3.25332169179885
    },
    {
      "country": "ESP",
      "year": 1985,
      "value": 2.3214357659951
    },
    {
      "country": "ESP",
      "year": 1984,
      "value": 1.78468751370853
    },
    {
      "country": "ESP",
      "year": 1983,
      "value": 1.77011581051299
    },
    {
      "country": "ESP",
      "year": 1982,
      "value": 1.2464617922282
    },
    {
      "country": "ESP",
      "year": 1981,
      "value": -0.13246859717357
    },
    {
      "country": "ESP",
      "year": 1980,
      "value": 2.20872810257116
    },
    {
      "country": "ESP",
      "year": 1979,
      "value": 0.0415465166768456
    },
    {
      "country": "ESP",
      "year": 1978,
      "value": 1.46300333315605
    },
    {
      "country": "ESP",
      "year": 1977,
      "value": 2.83857436106388
    },
    {
      "country": "ESP",
      "year": 1976,
      "value": 3.30379140860018
    },
    {
      "country": "ESP",
      "year": 1975,
      "value": 0.542203343297047
    },
    {
      "country": "ESP",
      "year": 1974,
      "value": 5.61878564719633
    },
    {
      "country": "ESP",
      "year": 1973,
      "value": 7.7884653422601
    },
    {
      "country": "ESP",
      "year": 1972,
      "value": 8.14974586367205
    },
    {
      "country": "ESP",
      "year": 1971,
      "value": 4.64947364578497
    },
    {
      "country": "ESP",
      "year": 1970,
      "value": 4.24497088667341
    },
    {
      "country": "ESP",
      "year": 1969,
      "value": 8.90701540575571
    },
    {
      "country": "ESP",
      "year": 1968,
      "value": 6.59702019075823
    },
    {
      "country": "FIN",
      "year": 2025,
      "value": 0.173444509584499
    },
    {
      "country": "FIN",
      "year": 2024,
      "value": 0.374566568538427
    },
    {
      "country": "FIN",
      "year": 2023,
      "value": -1.28973484453397
    },
    {
      "country": "FIN",
      "year": 2022,
      "value": 0.763041912763526
    },
    {
      "country": "FIN",
      "year": 2021,
      "value": 2.67634641498897
    },
    {
      "country": "FIN",
      "year": 2020,
      "value": -2.49103605535707
    },
    {
      "country": "FIN",
      "year": 2019,
      "value": 1.34973845741737
    },
    {
      "country": "FIN",
      "year": 2018,
      "value": 1.19297759742292
    },
    {
      "country": "FIN",
      "year": 2017,
      "value": 3.30337003591039
    },
    {
      "country": "FIN",
      "year": 2016,
      "value": 2.57193414898754
    },
    {
      "country": "FIN",
      "year": 2015,
      "value": 0.466503766322674
    },
    {
      "country": "FIN",
      "year": 2014,
      "value": -0.4780684247837
    },
    {
      "country": "FIN",
      "year": 2013,
      "value": -0.979741024949618
    },
    {
      "country": "FIN",
      "year": 2012,
      "value": -1.52284013040689
    },
    {
      "country": "FIN",
      "year": 2011,
      "value": 2.39039455396828
    },
    {
      "country": "FIN",
      "year": 2010,
      "value": 3.1682879121621
    },
    {
      "country": "FIN",
      "year": 2009,
      "value": -8.07603116552393
    },
    {
      "country": "FIN",
      "year": 2008,
      "value": 0.784431235717051
    },
    {
      "country": "FIN",
      "year": 2007,
      "value": 5.31280176694145
    },
    {
      "country": "FIN",
      "year": 2006,
      "value": 4.01957326515895
    },
    {
      "country": "FIN",
      "year": 2005,
      "value": 2.77730918518017
    },
    {
      "country": "FIN",
      "year": 2004,
      "value": 4.00537952277651
    },
    {
      "country": "FIN",
      "year": 2003,
      "value": 2.01179992738312
    },
    {
      "country": "FIN",
      "year": 2002,
      "value": 1.68732644358099
    },
    {
      "country": "FIN",
      "year": 2001,
      "value": 2.64026205699308
    },
    {
      "country": "FIN",
      "year": 2000,
      "value": 5.75373770498848
    },
    {
      "country": "FIN",
      "year": 1999,
      "value": 4.38928070374669
    },
    {
      "country": "FIN",
      "year": 1998,
      "value": 5.45427021765444
    },
    {
      "country": "FIN",
      "year": 1997,
      "value": 6.39770068404337
    },
    {
      "country": "FIN",
      "year": 1996,
      "value": 3.66265716987186
    },
    {
      "country": "FIN",
      "year": 1995,
      "value": 4.23436710187066
    },
    {
      "country": "FIN",
      "year": 1994,
      "value": 3.96437283726799
    },
    {
      "country": "FIN",
      "year": 1993,
      "value": -0.779815061561479
    },
    {
      "country": "FIN",
      "year": 1992,
      "value": -3.31137361706595
    },
    {
      "country": "FIN",
      "year": 1991,
      "value": -5.88059618513641
    },
    {
      "country": "FIN",
      "year": 1990,
      "value": 0.691649917806032
    },
    {
      "country": "FIN",
      "year": 1989,
      "value": 5.08392955255206
    },
    {
      "country": "FIN",
      "year": 1988,
      "value": 5.23111280719965
    },
    {
      "country": "FIN",
      "year": 1987,
      "value": 3.56103297195551
    },
    {
      "country": "FIN",
      "year": 1986,
      "value": 2.75509931172768
    },
    {
      "country": "FIN",
      "year": 1985,
      "value": 3.54005438717211
    },
    {
      "country": "FIN",
      "year": 1984,
      "value": 3.22653291609758
    },
    {
      "country": "FIN",
      "year": 1983,
      "value": 3.10384880639285
    },
    {
      "country": "FIN",
      "year": 1982,
      "value": 3.08671541654802
    },
    {
      "country": "FIN",
      "year": 1981,
      "value": 1.28938426892493
    },
    {
      "country": "FIN",
      "year": 1980,
      "value": 5.38904748575388
    },
    {
      "country": "FIN",
      "year": 1979,
      "value": 7.12192593764533
    },
    {
      "country": "FIN",
      "year": 1978,
      "value": 2.91970756437469
    },
    {
      "country": "FIN",
      "year": 1977,
      "value": 0.239510630103453
    },
    {
      "country": "FIN",
      "year": 1976,
      "value": 0.344383187103318
    },
    {
      "country": "FIN",
      "year": 1975,
      "value": 1.80489795187316
    },
    {
      "country": "FIN",
      "year": 1974,
      "value": 3.23653343563224
    },
    {
      "country": "FIN",
      "year": 1973,
      "value": 6.98382835563822
    },
    {
      "country": "FIN",
      "year": 1972,
      "value": 7.7354848193458
    },
    {
      "country": "FIN",
      "year": 1971,
      "value": 2.35692123166586
    },
    {
      "country": "FIN",
      "year": 1970,
      "value": 7.47043267144105
    },
    {
      "country": "FIN",
      "year": 1969,
      "value": 9.59328847858328
    },
    {
      "country": "FIN",
      "year": 1968,
      "value": 2.30328981591643
    },
    {
      "country": "JPN",
      "year": 2025,
      "value": 1.19311288444599
    },
    {
      "country": "JPN",
      "year": 2024,
      "value": -0.240084236041696
    },
    {
      "country": "JPN",
      "year": 2023,
      "value": 0.720785304749811
    },
    {
      "country": "JPN",
      "year": 2022,
      "value": 1.33164750653741
    },
    {
      "country": "JPN",
      "year": 2021,
      "value": 3.56419531474475
    },
    {
      "country": "JPN",
      "year": 2020,
      "value": -4.28327942675573
    },
    {
      "country": "JPN",
      "year": 2019,
      "value": -0.308496921143259
    },
    {
      "country": "JPN",
      "year": 2018,
      "value": 0.834143845965585
    },
    {
      "country": "JPN",
      "year": 2017,
      "value": 1.62345062245441
    },
    {
      "country": "JPN",
      "year": 2016,
      "value": 0.704986495111257
    },
    {
      "country": "JPN",
      "year": 2015,
      "value": 1.79997735783475
    },
    {
      "country": "JPN",
      "year": 2014,
      "value": 0.905915486065865
    },
    {
      "country": "JPN",
      "year": 2013,
      "value": 1.99727653399265
    },
    {
      "country": "JPN",
      "year": 2012,
      "value": 1.64893452981225
    },
    {
      "country": "JPN",
      "year": 2011,
      "value": -0.20035785332982
    },
    {
      "country": "JPN",
      "year": 2010,
      "value": 4.13645589222239
    },
    {
      "country": "JPN",
      "year": 2009,
      "value": -5.9359411383964
    },
    {
      "country": "JPN",
      "year": 2008,
      "value": -1.16662209355141
    },
    {
      "country": "JPN",
      "year": 2007,
      "value": 1.72837912865577
    },
    {
      "country": "JPN",
      "year": 2006,
      "value": 1.54630843078741
    },
    {
      "country": "JPN",
      "year": 2005,
      "value": 1.8482813374834
    },
    {
      "country": "JPN",
      "year": 2004,
      "value": 2.11294823723127
    },
    {
      "country": "JPN",
      "year": 2003,
      "value": 1.38010935830795
    },
    {
      "country": "JPN",
      "year": 2002,
      "value": 0.0849888050363319
    },
    {
      "country": "JPN",
      "year": 2001,
      "value": 0.284608556379041
    },
    {
      "country": "JPN",
      "year": 2000,
      "value": 2.97832688768516
    },
    {
      "country": "JPN",
      "year": 1999,
      "value": -0.347600398675738
    },
    {
      "country": "JPN",
      "year": 1998,
      "value": -1.77264091037956
    },
    {
      "country": "JPN",
      "year": 1997,
      "value": 1.36297109407448
    },
    {
      "country": "JPN",
      "year": 1996,
      "value": 3.07546731409349
    },
    {
      "country": "JPN",
      "year": 1995,
      "value": 2.34205546196849
    },
    {
      "country": "JPN",
      "year": 1994,
      "value": 0.99306636322622
    },
    {
      "country": "JPN",
      "year": 1993,
      "value": -0.517919847117952
    },
    {
      "country": "JPN",
      "year": 1992,
      "value": 0.848069581218368
    },
    {
      "country": "JPN",
      "year": 1991,
      "value": 3.41749676183089
    },
    {
      "country": "JPN",
      "year": 1990,
      "value": 4.89271306574565
    },
    {
      "country": "JPN",
      "year": 1989,
      "value": 4.85803768615389
    },
    {
      "country": "JPN",
      "year": 1988,
      "value": 6.78502010955764
    },
    {
      "country": "JPN",
      "year": 1987,
      "value": 4.73066586040017
    },
    {
      "country": "JPN",
      "year": 1986,
      "value": 3.32652561623384
    },
    {
      "country": "JPN",
      "year": 1985,
      "value": 5.23338094687848
    },
    {
      "country": "JPN",
      "year": 1984,
      "value": 4.50199481622435
    },
    {
      "country": "JPN",
      "year": 1983,
      "value": 3.52304498510377
    },
    {
      "country": "JPN",
      "year": 1982,
      "value": 3.31245673740017
    },
    {
      "country": "JPN",
      "year": 1981,
      "value": 4.20933646523171
    },
    {
      "country": "JPN",
      "year": 1980,
      "value": 2.81759120738283
    },
    {
      "country": "JPN",
      "year": 1979,
      "value": 5.4840418324284
    },
    {
      "country": "JPN",
      "year": 1978,
      "value": 5.27194150317187
    },
    {
      "country": "JPN",
      "year": 1977,
      "value": 4.39033795009327
    },
    {
      "country": "JPN",
      "year": 1976,
      "value": 3.97498409113672
    },
    {
      "country": "JPN",
      "year": 1975,
      "value": 3.09157591623077
    },
    {
      "country": "JPN",
      "year": 1974,
      "value": -1.22523982750916
    },
    {
      "country": "JPN",
      "year": 1973,
      "value": 8.03259997458245
    },
    {
      "country": "JPN",
      "year": 1972,
      "value": 8.41354725497627
    },
    {
      "country": "JPN",
      "year": 1971,
      "value": 4.69899204214205
    },
    {
      "country": "JPN",
      "year": 1970,
      "value": 0.399050611065093
    },
    {
      "country": "JPN",
      "year": 1969,
      "value": 12.4778945420024
    },
    {
      "country": "JPN",
      "year": 1968,
      "value": 12.8824681707163
    },
    {
      "country": "SWE",
      "year": 2025,
      "value": 1.54316373266217
    },
    {
      "country": "SWE",
      "year": 2024,
      "value": 1.01779633304398
    },
    {
      "country": "SWE",
      "year": 2023,
      "value": -0.204061304891439
    },
    {
      "country": "SWE",
      "year": 2022,
      "value": 1.25543620445816
    },
    {
      "country": "SWE",
      "year": 2021,
      "value": 5.2258643028773
    },
    {
      "country": "SWE",
      "year": 2020,
      "value": -1.93379704032216
    },
    {
      "country": "SWE",
      "year": 2019,
      "value": 2.60823012869524
    },
    {
      "country": "SWE",
      "year": 2018,
      "value": 1.7702553546772
    },
    {
      "country": "SWE",
      "year": 2017,
      "value": 1.88282184966646
    },
    {
      "country": "SWE",
      "year": 2016,
      "value": 2.13117914731151
    },
    {
      "country": "SWE",
      "year": 2015,
      "value": 4.38824673608589
    },
    {
      "country": "SWE",
      "year": 2014,
      "value": 2.29577238758284
    },
    {
      "country": "SWE",
      "year": 2013,
      "value": 1.13766671801426
    },
    {
      "country": "SWE",
      "year": 2012,
      "value": -0.414397702454409
    },
    {
      "country": "SWE",
      "year": 2011,
      "value": 3.16388567406926
    },
    {
      "country": "SWE",
      "year": 2010,
      "value": 5.75076477579255
    },
    {
      "country": "SWE",
      "year": 2009,
      "value": -4.25561384207619
    },
    {
      "country": "SWE",
      "year": 2008,
      "value": -0.923113250067971
    },
    {
      "country": "SWE",
      "year": 2007,
      "value": 3.22486814096095
    },
    {
      "country": "SWE",
      "year": 2006,
      "value": 4.67607488877992
    },
    {
      "country": "SWE",
      "year": 2005,
      "value": 2.79313782840156
    },
    {
      "country": "SWE",
      "year": 2004,
      "value": 4.17958419343711
    },
    {
      "country": "SWE",
      "year": 2003,
      "value": 1.88102769675844
    },
    {
      "country": "SWE",
      "year": 2002,
      "value": 2.27772867861897
    },
    {
      "country": "SWE",
      "year": 2001,
      "value": 1.36080642694121
    },
    {
      "country": "SWE",
      "year": 2000,
      "value": 4.63112136551369
    },
    {
      "country": "SWE",
      "year": 1999,
      "value": 4.20111929805536
    },
    {
      "country": "SWE",
      "year": 1998,
      "value": 4.24583179417877
    },
    {
      "country": "SWE",
      "year": 1997,
      "value": 3.06499186399252
    },
    {
      "country": "SWE",
      "year": 1996,
      "value": 1.70471985374236
    },
    {
      "country": "SWE",
      "year": 1995,
      "value": 4.09438992772475
    },
    {
      "country": "SWE",
      "year": 1994,
      "value": 4.01576585901515
    },
    {
      "country": "SWE",
      "year": 1993,
      "value": -2.06561636908388
    },
    {
      "country": "SWE",
      "year": 1992,
      "value": -1.15859275987265
    },
    {
      "country": "SWE",
      "year": 1991,
      "value": -1.14597485051154
    },
    {
      "country": "SWE",
      "year": 1990,
      "value": 0.754674765275468
    },
    {
      "country": "SWE",
      "year": 1989,
      "value": 2.65480690949124
    },
    {
      "country": "SWE",
      "year": 1988,
      "value": 2.55903868133913
    },
    {
      "country": "SWE",
      "year": 1987,
      "value": 3.35384296895474
    },
    {
      "country": "SWE",
      "year": 1986,
      "value": 2.69132318957357
    },
    {
      "country": "SWE",
      "year": 1985,
      "value": 2.16037374917175
    },
    {
      "country": "SWE",
      "year": 1984,
      "value": 4.22953525809793
    },
    {
      "country": "SWE",
      "year": 1983,
      "value": 1.90063868064665
    },
    {
      "country": "SWE",
      "year": 1982,
      "value": 1.24866467425022
    },
    {
      "country": "SWE",
      "year": 1981,
      "value": 0.454830427902976
    },
    {
      "country": "SWE",
      "year": 1980,
      "value": 1.69997145285421
    },
    {
      "country": "SWE",
      "year": 1979,
      "value": 3.84000348607525
    },
    {
      "country": "SWE",
      "year": 1978,
      "value": 1.75154803918647
    },
    {
      "country": "SWE",
      "year": 1977,
      "value": -1.59625857600648
    },
    {
      "country": "SWE",
      "year": 1976,
      "value": 1.05810489091265
    },
    {
      "country": "SWE",
      "year": 1975,
      "value": 2.55286265850103
    },
    {
      "country": "SWE",
      "year": 1974,
      "value": 3.19819561873223
    },
    {
      "country": "SWE",
      "year": 1973,
      "value": 3.96798115589563
    },
    {
      "country": "SWE",
      "year": 1972,
      "value": 2.28873878707626
    },
    {
      "country": "SWE",
      "year": 1971,
      "value": 0.944646218021433
    },
    {
      "country": "SWE",
      "year": 1970,
      "value": 6.47367396370416
    },
    {
      "country": "SWE",
      "year": 1969,
      "value": 5.00907518225404
    },
    {
      "country": "SWE",
      "year": 1968,
      "value": 3.638505638623
    },
    {
      "country": "USA",
      "year": 2025,
      "value": 2.16138195623856
    },
    {
      "country": "USA",
      "year": 2024,
      "value": 2.79318715363841
    },
    {
      "country": "USA",
      "year": 2023,
      "value": 2.93436322440155
    },
    {
      "country": "USA",
      "year": 2022,
      "value": 2.52421385073222
    },
    {
      "country": "USA",
      "year": 2021,
      "value": 6.15202247867526
    },
    {
      "country": "USA",
      "year": 2020,
      "value": -2.081375977796
    },
    {
      "country": "USA",
      "year": 2019,
      "value": 2.58382533052225
    },
    {
      "country": "USA",
      "year": 2018,
      "value": 2.96650506701943
    },
    {
      "country": "USA",
      "year": 2017,
      "value": 2.45762230126449
    },
    {
      "country": "USA",
      "year": 2016,
      "value": 1.81945147909089
    },
    {
      "country": "USA",
      "year": 2015,
      "value": 2.94555045227337
    },
    {
      "country": "USA",
      "year": 2014,
      "value": 2.52381981757846
    },
    {
      "country": "USA",
      "year": 2013,
      "value": 2.11783009443471
    },
    {
      "country": "USA",
      "year": 2012,
      "value": 2.28911339009767
    },
    {
      "country": "USA",
      "year": 2011,
      "value": 1.56440685205419
    },
    {
      "country": "USA",
      "year": 2010,
      "value": 2.69519258673525
    },
    {
      "country": "USA",
      "year": 2009,
      "value": -2.5765002366652
    },
    {
      "country": "USA",
      "year": 2008,
      "value": 0.113587247501258
    },
    {
      "country": "USA",
      "year": 2007,
      "value": 2.0038583039496
    },
    {
      "country": "USA",
      "year": 2006,
      "value": 2.78453963674239
    },
    {
      "country": "USA",
      "year": 2005,
      "value": 3.48354993710312
    },
    {
      "country": "USA",
      "year": 2004,
      "value": 3.84777169267127
    },
    {
      "country": "USA",
      "year": 2003,
      "value": 2.79560596378604
    },
    {
      "country": "USA",
      "year": 2002,
      "value": 1.70044733078285
    },
    {
      "country": "USA",
      "year": 2001,
      "value": 0.955538337599847
    },
    {
      "country": "USA",
      "year": 2000,
      "value": 4.07758575997799
    },
    {
      "country": "USA",
      "year": 1999,
      "value": 4.78842504836746
    },
    {
      "country": "USA",
      "year": 1998,
      "value": 4.48313335499124
    },
    {
      "country": "USA",
      "year": 1997,
      "value": 4.44712793442667
    },
    {
      "country": "USA",
      "year": 1996,
      "value": 3.77277269047364
    },
    {
      "country": "USA",
      "year": 1995,
      "value": 2.68443073970295
    },
    {
      "country": "USA",
      "year": 1994,
      "value": 4.02902272637739
    },
    {
      "country": "USA",
      "year": 1993,
      "value": 2.75179586314481
    },
    {
      "country": "USA",
      "year": 1992,
      "value": 3.52249717254271
    },
    {
      "country": "USA",
      "year": 1991,
      "value": -0.108312873733027
    },
    {
      "country": "USA",
      "year": 1990,
      "value": 1.88596557755378
    },
    {
      "country": "USA",
      "year": 1989,
      "value": 3.67223784138015
    },
    {
      "country": "USA",
      "year": 1988,
      "value": 4.17698239478443
    },
    {
      "country": "USA",
      "year": 1987,
      "value": 3.45462966441372
    },
    {
      "country": "USA",
      "year": 1986,
      "value": 3.46265504522061
    },
    {
      "country": "USA",
      "year": 1985,
      "value": 4.16957535422245
    },
    {
      "country": "USA",
      "year": 1984,
      "value": 7.2364531665454
    },
    {
      "country": "USA",
      "year": 1983,
      "value": 4.58379096944093
    },
    {
      "country": "USA",
      "year": 1982,
      "value": -1.80301377321203
    },
    {
      "country": "USA",
      "year": 1981,
      "value": 2.53770127042986
    },
    {
      "country": "USA",
      "year": 1980,
      "value": -0.256775739391401
    },
    {
      "country": "USA",
      "year": 1979,
      "value": 3.16598822512103
    },
    {
      "country": "USA",
      "year": 1978,
      "value": 5.53520648057204
    },
    {
      "country": "USA",
      "year": 1977,
      "value": 4.62418650079432
    },
    {
      "country": "USA",
      "year": 1976,
      "value": 5.38803390614694
    },
    {
      "country": "USA",
      "year": 1975,
      "value": -0.205619191208058
    },
    {
      "country": "USA",
      "year": 1974,
      "value": -0.540550190362552
    },
    {
      "country": "USA",
      "year": 1973,
      "value": 5.64567975951033
    },
    {
      "country": "USA",
      "year": 1972,
      "value": 5.25550197771585
    },
    {
      "country": "USA",
      "year": 1971,
      "value": 3.29272243899894
    },
    {
      "country": "USA",
      "year": 1970,
      "value": 0.216606498143278
    },
    {
      "country": "USA",
      "year": 1969,
      "value": 3.09999999656958
    },
    {
      "country": "USA",
      "year": 1968,
      "value": 4.80000000278329
    }
  ]
}
;
const JUDGMENTS={
  "version": 1,
  "checkedAt": "2026-10-26",
  "coverage": "公开资料选集；非逐年全部演讲目录，未收录不等于没有观点",
  "speechSource": {
    "title": "2024-12-03演讲第三方听打稿（2025-05-17刊载）",
    "url": "https://www.jenniferzengblog.com/home/2025/5/17/gdp3",
    "publishedAt": "2025-05-17",
    "spokenAt": "2024-12-03"
  },
  "records": [
    {
      "id": "view-2012",
      "publishedAt": "2012-04-16",
      "spokenAt": "2012-04-15",
      "title": "短期环比可能修复，一年内仍谨慎",
      "summary": "他认为融资体系修复可支撑二季度环比回升，但房地产库存与资金约束仍在，对未来一年的增长保持保守。",
      "horizon": "二季度环比及未来一年",
      "condition": "短期资金缓解不等于货币政策已明显放松。",
      "limit": "当前图为年度实际同比，无法检验二季度环比预测；需要当时版本的季调季度序列。",
      "metrics": [
        "gdp",
        "property"
      ],
      "source": "https://news.cntv.cn/20120416/121619.shtml",
      "sourceTitle": "中国证券报报道（央视网转载）",
      "sourceType": "同期媒体报道",
      "locator": "正文“经济状况短多长空”",
      "checkedAt": "2026-10-26",
      "isQuote": false
    },
    {
      "id": "view-2014",
      "publishedAt": "2014-12-18",
      "spokenAt": "2014-12-16",
      "title": "供给收缩改善盈利，A股牛熊格局可能转变",
      "summary": "他以供给调整与企业利润率改善解释股市转强，并认为地产对经济的拖累可能在2015年二季度耗尽。",
      "horizon": "2015年及更长的市场周期",
      "condition": "仍须防范总需求意外走弱，以及监管变化带来的资金冲击。",
      "limit": "年度地产投资不能定位二季度拐点；检验牛市持续时间还需指数、回撤和盈利序列。",
      "metrics": [
        "property",
        "gdp"
      ],
      "source": "https://www.aisixiang.com/data/81507.html",
      "sourceTitle": "《2015股市楼市走势究竟会怎样》（万得演讲实录转载）",
      "sourceType": "演讲实录转载",
      "locator": "正文房地产成交与投资关系、风险提示部分",
      "checkedAt": "2026-10-26",
      "isQuote": false
    },
    {
      "id": "view-2015",
      "publishedAt": "2015-06-29",
      "spokenAt": "2015-06-25",
      "title": "认为年底前博弈行情的宏观条件未根本改变",
      "summary": "他判断市场驱动已由基本面转向资金与筹码博弈，预计年底前相关条件未根本改变；同时预期财政冲击在年底前后逐渐被吸收。",
      "horizon": "2015年底至2016年初",
      "condition": "经济恢复、红筹回归和注册制推进，可能改变后续市场环境。",
      "limit": "保留这一带有乐观时点的判断，不将其改写成事后风险预警；当前未接入可核验的指数日线，尚不能完成股市路径检验。",
      "metrics": [
        "gdp",
        "retail"
      ],
      "source": "https://chinadigitaltimes.net/chinese/396696.html",
      "sourceTitle": "《2015中期宏观经济讲演全文》（第三方留存）",
      "sourceType": "第三方演讲听录转载",
      "locator": "末尾总结第1、2点；演讲日参照作者财新博客索引",
      "checkedAt": "2026-10-26",
      "isQuote": false
    },
    {
      "id": "view-2016",
      "publishedAt": "2016-02-02",
      "spokenAt": "2016-01-20",
      "title": "年初预判出口、房地产仍有收缩压力",
      "summary": "在回顾2015年内外冲击时，他对2016年出口、房地产的展望仍偏弱，预计预算内财政更积极但增量有限。",
      "horizon": "2016年",
      "condition": "财政支出、地方融资与外部需求共同影响走势。",
      "limit": "当前销售面积与开发投资只覆盖地产部分；若年内结果相反也应保留。未接入出口与财政原口径，不把这两个判断判为已验证。",
      "metrics": [
        "property",
        "sales",
        "gdp"
      ],
      "source": "https://www.saif.sjtu.edu.cn/show-236-56.html",
      "sourceTitle": "上海高级金融学院：2016中国经济分析展望会观点摘要",
      "sourceType": "主办方活动摘要",
      "locator": "正文“在活动现场”与“观点精粹”",
      "checkedAt": "2026-10-26",
      "isQuote": false
    },
    {
      "id": "view-2017",
      "publishedAt": "2017-12-26",
      "spokenAt": null,
      "title": "三大拖累减轻，对随后两年更乐观",
      "summary": "他认为出口、地产库存与过剩产能的拖累正减轻，预期补库存支持后续经济，判断2018—2019年名义GDP增速有望保持9%或以上。",
      "horizon": "2018—2019年",
      "condition": "依赖全球复苏与地产、产能去化的延续。",
      "limit": "报道提出的是名义GDP展望，当前曲线为实际GDP；不能用它直接判定数值预测命中。全国销售增速也不能替代库存去化指标。",
      "metrics": [
        "property",
        "sales",
        "gdp"
      ],
      "source": "https://www.yicai.com/news/5386662.html",
      "sourceTitle": "第一财经：三大经济拖累因素正消除",
      "sourceType": "同期媒体报道",
      "locator": "首段名义GDP展望与正文三项拖累分析",
      "checkedAt": "2026-10-26",
      "isQuote": false
    },
    {
      "id": "view-2018",
      "publishedAt": "2018-06-21",
      "spokenAt": null,
      "title": "贸易摩擦可能长期化，需防全球化碎片化",
      "summary": "他把中美贸易纷争视为可能延续多年的竞争，提示投资、技术和人才往来分离的风险，主张维护多边规则并扩大开放。",
      "horizon": "多年",
      "condition": "双方能否形成妥协和制度安排，影响风险是否兑现。",
      "limit": "这不是某年的GDP点预测。需要关税、双向投资和贸易结构数据；当前GDP仅作背景，不能验证贸易冲突的因果影响。",
      "metrics": [
        "gdp",
        "industry"
      ],
      "source": "https://pfile.essence.com.cn/data/00/33/CgcKWFsrLySAErTNAAdnmTYiKv4430.pdf",
      "sourceTitle": "安信证券宏观研究《中美贸易战的走向》",
      "sourceType": "原机构研究报告",
      "locator": "第1—3页；报告基于4月11日演讲并进一步更新",
      "checkedAt": "2026-10-26",
      "isQuote": false
    },
    {
      "id": "view-2019",
      "publishedAt": "2019-12-08",
      "spokenAt": null,
      "title": "转型中的减速尚未结束",
      "summary": "在《知止不殆》中，他预期中长期增长中枢继续下移，并提示2020年仍有地产投资减速、去产能提振消退等压力。",
      "horizon": "2020年及其后数年",
      "condition": "资源配置改善和新产业机会可形成结构性支撑。",
      "limit": "资料为正式书面报告的第三方存档，不把演讲日期与报告日期混同。2020年后疫情是额外冲击，单年增速不足以识别长期潜在增长。",
      "metrics": [
        "gdp",
        "property",
        "industry"
      ],
      "source": "https://www.gaoshanwen.com/articles/analysis-2019-12-08-1c9smie",
      "sourceTitle": "《知止不殆》2019-12-08书面报告存档",
      "sourceType": "第三方研究报告存档",
      "locator": "内容提要及“一、中国经济转型的国际比较”",
      "checkedAt": "2026-10-26",
      "isQuote": false
    },
    {
      "id": "view-2020",
      "publishedAt": "2020-03-18",
      "spokenAt": "2020-03-15",
      "title": "疫情冲击主要体现为需求骤降",
      "summary": "他认为疫情初期多数行业承受的主要是需求冲击，供给恢复相对更快，消费与地产交易的大幅收缩需重点观察。",
      "horizon": "疫情冲击与恢复阶段",
      "condition": "少数行业仍可能存在供应短缺，恢复路径受疫情发展制约。",
      "limit": "全年社零能展示需求表现，不能独立识别供需冲击份额；2021年的高同比受2020低基数影响。",
      "metrics": [
        "retail",
        "spending",
        "gdp"
      ],
      "source": "https://www.yicai.com/news/100553628.html",
      "sourceTitle": "高善文署名《新冠疫情下的全球金融动荡》",
      "sourceType": "作者署名演讲整理稿（媒体刊载）",
      "locator": "“中国经济情况的评估和展望”",
      "checkedAt": "2026-10-26",
      "isQuote": false
    },
    {
      "id": "view-2021",
      "publishedAt": "2021-11-18",
      "spokenAt": null,
      "title": "能源转型需保留传统供给缓冲",
      "summary": "他提出新能源替代过程中应保留传统能源产能冗余，并为能耗调节保留弹性，以降低供给波动的经济成本。",
      "horizon": "能源转型的中长期",
      "condition": "大规模低成本储能尚未广泛应用时，备用产能尤为重要。",
      "limit": "这是供给与政策设计判断，当前工业和CPI只是背景；没有能源结构、缺电与煤价序列，不能完成直接检验。",
      "metrics": [
        "industry",
        "cpi"
      ],
      "source": "https://finance.sina.com.cn/money/bank/bank_hydt/2021-11-19/doc-iktzscyy6478356.shtml",
      "sourceTitle": "高善文署名《能源短缺与碳达峰》",
      "sourceType": "作者署名演讲整理稿（CF40转载）",
      "locator": "提要；页面正文发布时间为11月18日，URL日期不作发表日期",
      "checkedAt": "2026-10-26",
      "isQuote": false
    },
    {
      "id": "view-2022",
      "publishedAt": "2022-06-28",
      "spokenAt": "2022-06-28",
      "title": "仍看估值修复，中长期增长依赖制度补短板",
      "summary": "他认为4月底后的估值修复尚在延续；对2035年前提出增长可能在4.5%附近或略高的情景，同时强调制度改善与汇率等条件。",
      "horizon": "当时市场修复及2035年前",
      "condition": "长期增长情景包含汇率、生产率和制度改善等条件。",
      "limit": "短期反弹判断与长期增长情景必须分开。当前无指数日线，不能检验反弹时点；2035年尚未到达，不提前判定长期结论。",
      "metrics": [
        "gdp",
        "industry"
      ],
      "source": "https://fund.eastmoney.com/a/202206282427744346.html",
      "sourceTitle": "中国基金报：2022中期策略会《吹尽狂沙始到金》实录（东方财富转载）",
      "sourceType": "同期媒体演讲整理",
      "locator": "开篇及重要观点第1—5项",
      "checkedAt": "2026-10-26",
      "isQuote": false
    },
    {
      "id": "view-2023",
      "publishedAt": "2023-08-23",
      "spokenAt": null,
      "title": "疤痕效应与地产流动性压力相互强化",
      "summary": "他用疫情疤痕和地产融资压力的交互解释经济困难，判断地产可能已明显超调、会发生均值回归，但时间不确定。",
      "horizon": "修复过程；未给确定完成日",
      "condition": "房企流动性与居民资产负债表状况会影响修复。",
      "limit": "保留“时间不确定”的限定。全国开发投资、销售面积不能替代城市房价估值或房企现金流。",
      "metrics": [
        "property",
        "sales",
        "spending"
      ],
      "source": "https://finance.sina.com.cn/zl/china/2023-08-23/zl-imziefaf8861665.shtml",
      "sourceTitle": "高善文署名《关于当前资本市场的一些思考》",
      "sourceType": "作者署名文章（CF40专栏）",
      "locator": "开篇观点摘要与正文疤痕效应分析",
      "checkedAt": "2026-10-26",
      "isQuote": false
    },
    {
      "id": "view-2024",
      "publishedAt": "2024-12-03",
      "spokenAt": "2024-12-03",
      "title": "从周期收缩转向后泡沫的较弱增长",
      "summary": "他认为周期压力重于转型代价，2025年可能逐步转向较弱但可维持的增长，前提包括继续政策干预。",
      "horizon": "2025年及其后数年",
      "condition": "并非预测恢复此前高速增长；需要时间消化调整与政策支持。",
      "limit": "下方拆为六条判断逐年跟踪。全文来源为第三方听打稿，2025年转载时间不当作新的演讲日期。",
      "metrics": [
        "gdp",
        "retail",
        "property",
        "sales",
        "unemployment"
      ],
      "source": "https://www.jenniferzengblog.com/home/2025/5/17/gdp3",
      "sourceTitle": "《云开雾散曙光现》2024-12-03演讲听打稿",
      "sourceType": "第三方听打稿（2025-05-17发布）",
      "locator": "开篇结论及结尾2025年展望；日期与原幻灯片、路演记录交叉核对",
      "checkedAt": "2026-10-26",
      "isQuote": false,
      "sourcePublishedAt": "2025-05-17"
    }
  ],
  "theses": [
    {
      "id": "cycle",
      "title": "周期压力重于转型代价",
      "summary": "他认为转型已有进展，但近期疲弱主要有周期性成因。",
      "watch": "消费、工业与地产是否一起持续改善",
      "limit": "全国宏观指标仅作辅助；产业分类的因果识别仍需原公司底表。",
      "metrics": [
        "retail",
        "spending",
        "industry",
        "property"
      ],
      "pages": [
        4,
        5,
        6,
        7,
        8
      ],
      "horizon": "2021年以来的诊断及后续修复",
      "date": "2024-12-03",
      "source": "https://www.jenniferzengblog.com/home/2025/5/17/gdp3",
      "sourceTitle": "2024-12-03演讲第三方听打稿（2025-05-17刊载）",
      "sourceType": "第三方听打稿与原幻灯片交叉阅读",
      "condition": "保留当时估计及研究假设，不把后来公布值倒填原演讲。"
    },
    {
      "id": "consumption",
      "title": "消费疲弱与收入预期受损",
      "summary": "他把消费疲弱与就业、收入预期联系起来。",
      "watch": "社零名义增速与居民消费实际增速分别变化",
      "limit": "两项口径不同，不相减排名；年龄和房价回归不能用全国序列替代。",
      "metrics": [
        "retail",
        "spending",
        "income"
      ],
      "pages": [
        10,
        11,
        12,
        13,
        14
      ],
      "horizon": "疫情后需求修复",
      "date": "2024-12-03",
      "source": "https://www.jenniferzengblog.com/home/2025/5/17/gdp3",
      "sourceTitle": "2024-12-03演讲第三方听打稿（2025-05-17刊载）",
      "sourceType": "第三方听打稿与原幻灯片交叉阅读",
      "condition": "保留当时估计及研究假设，不把后来公布值倒填原演讲。"
    },
    {
      "id": "employment",
      "title": "就业人数比失业率提供更多线索",
      "summary": "他认为失业率不足以反映就业与参与率的压力。",
      "watch": "调查失业率仅作交叉观察，并回看就业人数图",
      "limit": "比率下降不等于人数恢复；原稿4709万是年度存量缺口之和，不能当去重失业人数。",
      "metrics": [
        "unemployment",
        "income"
      ],
      "pages": [
        16,
        17,
        18,
        19,
        20,
        21,
        22
      ],
      "horizon": "2021年以来的就业变化",
      "date": "2024-12-03",
      "source": "https://www.jenniferzengblog.com/home/2025/5/17/gdp3",
      "sourceTitle": "2024-12-03演讲第三方听打稿（2025-05-17刊载）",
      "sourceType": "第三方听打稿与原幻灯片交叉阅读",
      "condition": "保留当时估计及研究假设，不把后来公布值倒填原演讲。"
    },
    {
      "id": "statistics",
      "title": "增长统计与价格、就业需交叉核对",
      "summary": "他据就业、价格等关系推测，疫情后经济增速可能被高估约3个百分点。",
      "watch": "GDP实际增长、CPI及就业的并行变化",
      "limit": "不能用CPI替代核心CPI，也不自动将GDP减3个百分点；需识别潜在增速与模型误差。",
      "metrics": [
        "gdp",
        "cpi",
        "unemployment"
      ],
      "pages": [
        24,
        25,
        26,
        27
      ],
      "horizon": "疫情后的统计解释",
      "date": "2024-12-03",
      "source": "https://www.jenniferzengblog.com/home/2025/5/17/gdp3",
      "sourceTitle": "2024-12-03演讲第三方听打稿（2025-05-17刊载）",
      "sourceType": "第三方听打稿与原幻灯片交叉阅读",
      "condition": "保留当时估计及研究假设，不把后来公布值倒填原演讲。"
    },
    {
      "id": "turning",
      "title": "2025年可能转向较弱但稳定的增长",
      "summary": "他对2025年的转折判断有政策支持与调整消化的前提。",
      "watch": "2025年之后消费、就业、地产能否持续交叉印证",
      "limit": "未给统一数值门槛；一年GDP达标或股市上涨都不足以证明转折完成。",
      "metrics": [
        "gdp",
        "retail",
        "spending",
        "unemployment",
        "property",
        "sales"
      ],
      "pages": [
        28,
        29
      ],
      "horizon": "2025年及之后；长期恢复尚需等待",
      "date": "2024-12-03",
      "source": "https://www.jenniferzengblog.com/home/2025/5/17/gdp3",
      "sourceTitle": "2024-12-03演讲第三方听打稿（2025-05-17刊载）",
      "sourceType": "第三方听打稿与原幻灯片交叉阅读",
      "condition": "保留当时估计及研究假设，不把后来公布值倒填原演讲。"
    },
    {
      "id": "property",
      "title": "地产冲击的修复需要时间与干预",
      "summary": "他以国际经验区分约3—4年的稳定化与8—9年的较完整修复，推测中国或到2030年前后更正常。",
      "watch": "地产投资、销售与国际事件路径分别观察",
      "limit": "国际均值不是中国倒计时；原稿估计保持冻结，当前WDI修订另列复算。",
      "metrics": [
        "property",
        "sales",
        "gdp"
      ],
      "pages": [
        28,
        29
      ],
      "horizon": "2025年的稳定化与约2030年的较长期修复分别观察",
      "date": "2024-12-03",
      "source": "https://www.jenniferzengblog.com/home/2025/5/17/gdp3",
      "sourceTitle": "2024-12-03演讲第三方听打稿（2025-05-17刊载）",
      "sourceType": "第三方听打稿与原幻灯片交叉阅读",
      "condition": "保留当时估计及研究假设，不把后来公布值倒填原演讲。"
    }
  ]
}
;
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
