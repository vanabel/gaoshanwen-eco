const speech=JSON.parse(document.getElementById('speech-initial').textContent);
let customCompanyResult=null;
let international=JSON.parse(document.getElementById('worldbank-initial').textContent),selectedSpeechPage=4,speechSection='全部';
const sp=id=>document.getElementById(id);const se=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sf=(v,n=2)=>Number.isFinite(v)?Number(v).toFixed(n):'缺失';
function downloadSpeech(name,text,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function currentSpeechChart(){return speech.charts.find(c=>c.page===selectedSpeechPage);}
function renderSpeech(){
 const charts=speech.charts.filter(c=>speechSection==='全部'||c.section===speechSection);if(!charts.some(c=>c.page===selectedSpeechPage))selectedSpeechPage=charts[0].page;
 sp('speech-count').textContent='1 张分类表 + '+speech.charts.length+' 张统计图 · 演讲时点 2024-12-03';
 sp('speech-nav').innerHTML=charts.map(c=>'<button class="speech-step '+(c.page===selectedSpeechPage?'active':'')+'" data-page="'+c.page+'"><span>P'+c.page+'</span> '+se(c.title)+'</button>').join('');
 document.querySelectorAll('.speech-step').forEach(b=>b.onclick=()=>{selectedSpeechPage=Number(b.dataset.page);renderSpeech();});
 const c=currentSpeechChart();sp('speech-title').textContent=c.title;sp('speech-category').textContent=c.section+' · 原稿第 '+c.page+' 页 · '+c.fidelity;
 sp('speech-source').href=c.source;sp('speech-svg-download').href='/api/speech/charts/'+c.page+'.svg';
 sp('speech-method').textContent=c.method;sp('speech-limits').innerHTML=c.limits.map(x=>'<li>'+se(x)+'</li>').join('');
 let computedFit=null;
 if(c.kind==='scatter'){
  let points=c.series[0].points.filter(p=>!(c.page===24&&['2023','2024（原图估计）'].includes(p.label))&&!(c.page===25&&['2022','2023'].includes(p.label)));
  if(c.page===25&&sp('speech-exclude-2020').checked)points=points.filter(p=>p.label!=='2020');
  const fit=speechOLS(points);computedFit=sp('speech-ols').checked?fit:null;
  const printed=c.regression? '原稿标注：y='+sf(c.regression.slope)+'x '+(c.regression.intercept>=0?'+ ':'− ')+sf(Math.abs(c.regression.intercept))+(c.regression.r2!==undefined?'；R²='+sf(c.regression.r2):'')+(c.regression.p!==undefined?'；p='+sf(c.regression.p):c.regression.pText?'；'+c.regression.pText:''):'原稿未列方程';
  sp('speech-regression').textContent=printed+'。恢复点复算：n='+fit.n+'，y='+sf(fit.slope,3)+'x '+(fit.intercept>=0?'+ ':'− ')+sf(Math.abs(fit.intercept),3)+'，R²='+sf(fit.r2,3)+'。复算用于核对图形，未当作原始数据库结果。';
 }else sp('speech-regression').textContent=c.axis.right?'该图保留左右两个坐标轴。右轴系列有单独单位标识，不能从线条高低直接比较数值。':'数值来自原图矢量坐标标定；不是实时行情，不是逐公司原始财务数据库。';
 sp('speech-ols-controls').style.display=c.kind==='scatter'?'flex':'none';sp('speech-2020-control').style.display=c.page===25?'inline':'none';
 sp('speech-chart').innerHTML=speechChartSVG(c,{showFit:sp('speech-fit').checked,computedFit});
 sp('speech-legend').innerHTML=c.series.map(s=>'<span><i style="background:'+(s.color||'#4f81bd')+'"></i>'+se(s.name)+(s.axis==='right'?'（右轴）':'')+'</span>').join('');
 sp('speech-values').innerHTML=c.series.flatMap(s=>s.points.map(p=>'<tr><td>'+se(s.name)+'</td><td>'+se(p.label||p.x)+'</td><td>'+sf(p.x,3)+'</td><td>'+sf(p.y)+'</td><td>'+se(s.axis==='right'?'右轴':'左轴')+'</td></tr>')).join('');
 sp('speech-position').textContent=(charts.indexOf(c)+1)+' / '+charts.length;
}
function moveSpeech(delta){const list=speech.charts.filter(c=>speechSection==='全部'||c.section===speechSection);const i=list.findIndex(c=>c.page===selectedSpeechPage);selectedSpeechPage=list[(i+delta+list.length)%list.length].page;renderSpeech();}
function renderClassification(){sp('speech-classification').innerHTML=speech.classification.map(g=>'<tr><td><strong>'+se(g.name)+'</strong></td><td>'+g.count+'</td><td>'+se(g.industries.join('、'))+'</td><td>'+se(g.countDetail||'原表合计，未附完整证券名单')+'</td></tr>').join('');}
function renderEmploymentScenario(){
 const c=speech.charts.find(c=>c.page===19),actual=c.series[0].points,baseline=actual.find(p=>p.label==='2020').y,rate=Number(sp('employment-growth').value)/100;
 const gaps=[2021,2022,2023].map(year=>{const observed=actual.find(p=>p.label===String(year)).y,forecast=baseline*(1+rate)**(year-2020);return {year,observed,forecast,gap:forecast-observed};});
 sp('employment-growth-value').textContent=sf(rate*100,1)+'%';
 sp('employment-result').innerHTML='<p>按2020年图中存量起算，假定每年增长 '+sf(rate*100,1)+'%，三年相对该路径的存量差之和为 <strong>'+sf(gaps.reduce((s,g)=>s+g.gap,0),0)+' 万人年</strong>。</p><p class="fine">原图给出的三项差值为472、2236、2001，合计4709。它们不是4709万个已去重的个人；更换基准增长率会改变结果。此滑块是独立敏感性演示，未冒充作者趋势模型。</p>';
 sp('employment-details').innerHTML=gaps.map(g=>'<tr><td>'+g.year+'</td><td>'+sf(g.observed,0)+'</td><td>'+sf(g.forecast,0)+'</td><td>'+sf(g.gap,0)+'</td></tr>').join('');
}
function renderInflationScenario(){
 const c=speech.charts.find(c=>c.page===24),fit=speechOLS(c.series[0].points.filter(p=>p.label.startsWith('2013'))),year=sp('inflation-year').value,point=c.series[0].points.find(p=>p.label.startsWith(year)),adjustment=Number(sp('growth-adjustment').value),gap=point.x-adjustment,prediction=fit.slope*gap+fit.intercept;
 sp('growth-adjustment-value').textContent=sf(adjustment,1)+' 个百分点';
 sp('inflation-result').innerHTML='<p>使用恢复的2013—2019点拟合：核心CPI ≈ '+sf(fit.slope,3)+' × 产出缺口 + '+sf(fit.intercept,3)+'。</p><p>原图该年x≈'+sf(point.x)+'，核心CPI≈'+sf(point.y)+'%；按滑块调整后，模型预测 '+sf(prediction)+'%，与图中通胀差 '+sf(prediction-point.y)+' 个百分点。</p><p class="fine">这只是给定潜在增长假设后的回归外推。该单一关系所隐含的增长调整约 '+sf((fit.slope*point.x+fit.intercept-point.y)/fit.slope)+' 个百分点；不能由此证明每年统一下修3个百分点。原图年份位置与脚注顺序还存在冲突。</p>';
}
function renderInternational(){
 const model=worldbankEvents(international,sp('event-window').value),original=speech.charts.find(c=>c.page===28),comparison={id:'worldbank-events',title:'公开WDI数据的事件窗口复算',kind:'bar',unit:'百分点',labels:model.events.map(e=>e.label),axis:{left:[-8,1]},series:[{name:'原图恢复值（当时估计）',color:'#9bada0',points:original.series[0].points},{name:'WDI 当前版本独立复算',color:'#315f48',points:model.events.map((e,i)=>({x:i,label:e.label,y:e.difference}))}]};
 sp('international-chart').innerHTML=speechChartSVG(comparison);
 const originalChina=speech.charts.find(c=>c.page===29).series[1].points,mean=a=>a.reduce((t,p)=>t+p.y,0)/a.length,post=mean(originalChina.slice(11,14)),included=post-mean(originalChina.slice(8,11)),excluded=post-mean(originalChina.slice(7,10));
 sp('event-window-audit').textContent='原图内部核对：中国路径前窗含0时（2019—2021对2022—2024），差值约 '+sf(included,3)+' 个百分点，与原图柱值−0.18接近；前窗不含0（2018—2020）则为 '+sf(excluded,3)+'。这只验证中国路径的窗口敏感性，不能据此认定所有历史事件的原始计算规则。';
 sp('international-status').textContent='WDI 数据更新 '+international.lastUpdated+' · 抓取 '+new Date(international.retrievedAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Singapore'})+' · '+(international.status==='live'?'在线核验成功':'核验存档');
 sp('international-values').innerHTML=model.events.map(e=>'<tr><td>'+e.label+'</td><td>'+e.preYears.join('、')+'</td><td>'+sf(e.before)+'</td><td>'+e.postYears.join('、')+'</td><td>'+sf(e.after)+'</td><td>'+sf(e.difference)+'</td></tr>').join('');
 const p={id:'worldbank-path',title:'事件时间路径：当前WDI版本',kind:'line',unit:'%',labels:Array.from({length:21},(_,i)=>String(i-10)),axis:{left:[-4,10]},series:[{name:'七次危机等权平均',color:'#b5523f',points:model.averagePath},{name:'中国（2021=0）',color:'#315f48',points:model.events[0].path}]};
 sp('international-path').innerHTML=speechChartSVG(p);sp('worldbank-source').href=international.source;
}
async function refreshInternational(force=false){sp('worldbank-refresh').disabled=true;try{const r=await fetch('/api/worldbank'+(force?'?refresh=1':''),{cache:'no-store'});if(!r.ok)throw Error();const d=await r.json();if(!d.observations?.length)throw Error();international=d;renderInternational();}catch{sp('international-status').textContent+=' · 本次在线检查失败，继续使用核验存档';}finally{sp('worldbank-refresh').disabled=false;}}
sp('speech-section').onchange=()=>{speechSection=sp('speech-section').value;renderSpeech()};sp('speech-prev').onclick=()=>moveSpeech(-1);sp('speech-next').onclick=()=>moveSpeech(1);
sp('speech-fit').onchange=renderSpeech;sp('speech-ols').onchange=renderSpeech;sp('speech-exclude-2020').onchange=renderSpeech;
sp('speech-csv').onclick=()=>{const c=currentSpeechChart();const rows=['series,observation,x,y,axis,source_page'];for(const s of c.series)for(const p of s.points)rows.push([s.name,p.label||p.x,p.x,p.y,s.axis||'left',c.page].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(','));downloadSpeech('speech-page-'+c.page+'.csv','\uFEFF'+rows.join('\n'),'text/csv;charset=utf-8')};
sp('speech-all-download').onclick=()=>downloadSpeech('speech-reconstruction.json',JSON.stringify(speech,null,2),'application/json');
sp('employment-growth').oninput=renderEmploymentScenario;sp('inflation-year').onchange=renderInflationScenario;sp('growth-adjustment').oninput=renderInflationScenario;
sp('event-window').onchange=renderInternational;sp('worldbank-refresh').onclick=()=>refreshInternational(true);sp('worldbank-download').onclick=()=>downloadSpeech('worldbank-event-recalculation.json',JSON.stringify({data:international,calculation:worldbankEvents(international,sp('event-window').value)},null,2),'application/json');
sp('company-template').onclick=()=>downloadSpeech('company-fixed-sample-template.csv','company_id,security_id,market,group,period,revenue_cny,market_cap_cny,employees\n','text/csv;charset=utf-8');
sp('company-file').onchange=async()=>{const f=sp('company-file').files[0];if(!f)return;try{if(f.size>10000000)throw Error('文件最大10MB');const result=sampleAggregation(parseCompanyCSV(await f.text()));customCompanyResult=result;sp('company-result-metric').style.display='inline-block';renderCompanyChart();sp('company-output').textContent='计算成功：'+result.companies+'家公司，'+result.periods.length+'期。'+result.scope+'。记录中只计算可核验的营收/市值占比及同口径增速，不构造缺少原权重的股价指数。';sp('company-result-table').innerHTML='<table><thead><tr><th>期间</th><th>类别</th><th>营收占比</th><th>市值占比</th><th>营收同比</th><th>员工同比</th></tr></thead><tbody>'+result.rows.map(r=>'<tr><td>'+se(r.period)+'</td><td>'+se(r.group)+'</td><td>'+sf(r.revenueShare)+'%</td><td>'+sf(r.capShare)+'%</td><td>'+sf(r.revenueYoY)+(r.revenueYoY===null?'':'%')+'</td><td>'+sf(r.employeeYoY)+(r.employeeYoY===null?'':'%')+'</td></tr>').join('')+'</tbody></table>';}catch(e){sp('company-output').textContent='未计算：'+e.message;sp('company-result-table').innerHTML='';sp('company-result-chart').innerHTML='';sp('company-result-metric').style.display='none';}};
renderClassification();renderSpeech();renderEmploymentScenario();renderInflationScenario();renderInternational();refreshInternational();

function renderCompanyChart(){if(!customCompanyResult)return;const id=sp('company-result-metric').value||'revenueShare',names={revenueShare:'自定义样本营业收入占比',capShare:'自定义样本市值占比',revenueYoY:'自定义样本营收同比',employeeYoY:'自定义样本员工同比'},result=customCompanyResult;const chart={id:'custom-company',title:names[id],provenance:'用户导入的自定义固定样本；未与原作者名单核对',kind:'line',unit:'%',labels:result.periods,axis:{left:id.endsWith('Share')?[0,100]:[-10,30]},series:['支持','中性','限制'].map((group,j)=>({name:group,color:['#cc5147','#649455','#2478ac'][j],points:result.periods.map((period,i)=>({x:i,label:period,y:result.rows.find(r=>r.period===period&&r.group===group)?.[id]??null}))}))};sp('company-result-chart').innerHTML=speechChartSVG(chart);}
sp('company-result-metric').onchange=renderCompanyChart;
