let judgmentMode='speech',judgmentSelection='turning',judgmentYear=2024;
function je(x){return escapeHTML(x);}
function judgmentCard(r,compact=false){return '<div class="judgment-card"><div class="eyebrow">'+je(r.date||r.publishedAt)+' · '+je(r.sourceType)+'</div><h3>'+je(r.title)+'</h3><p><span class="tag">本站转述</span>'+je(r.summary)+'</p>'+(r.id==='turning'?'<blockquote>“2025年很可能就是这样的转折点”</blockquote><p class="fine">第三方听打稿所记原话；“转折”指向较弱而可维持的增长，并非恢复原有高速增长。</p>':'')+'<div class="judgment-facts"><div><strong>时间范围与条件</strong><p>'+je(r.horizon)+'</p><p>'+je(r.condition)+'</p></div><div><strong>怎样核对</strong><p>'+je(r.watch||r.limit)+'</p></div></div><p class="fine">核对边界：'+je(r.limit)+'</p>'+(!r.date?'<p class="fine">演讲日：'+je(r.spokenAt||'未核实到具体日期')+'；观点 / 报告公开日：'+je(r.publishedAt)+(r.sourcePublishedAt?'；本存档刊载：'+je(r.sourcePublishedAt):'')+'。定位：'+je(r.locator)+'</p>':'')+'<a href="'+je(r.source)+'" target="_blank" rel="noopener">'+je(r.sourceTitle)+' ↗</a>'+(r.pages&&!compact?'<p class="fine">关联原图：'+r.pages.map(p=>'<button class="judgment-page" data-page="'+p+'">P'+p+'</button>').join(' ')+'</p>':'')+'</div>';}
function activeJudgment(){return judgmentMode==='speech'?judgmentData.theses.find(r=>r.id===judgmentSelection):judgmentsForYear(judgmentData,judgmentYear)[0];}
function setJudgmentMode(mode){judgmentMode=mode;renderJudgments();}
function renderJudgments(){
 if(!document.getElementById('judgments'))return;
 const speechMode=judgmentMode==='speech',list=currentReports(),latestYear=Math.max(new Date().getFullYear(),...list.map(r=>r.year));
 for(const mode of ['speech','history']){const b=$('judgment-mode-'+mode);b.classList.toggle('active',judgmentMode===mode);b.setAttribute('aria-pressed',String(judgmentMode===mode));}
 $('judgment-select-label').textContent=speechMode?'选择演讲中的一项判断':'选择观点年份';
 $('judgment-select').innerHTML=speechMode?judgmentData.theses.map(r=>'<option value="'+r.id+'" '+(r.id===judgmentSelection?'selected':'')+'>'+je(r.title)+'</option>').join(''):Array.from({length:latestYear-2011},(_,i)=>i+2012).reverse().map(y=>'<option value="'+y+'" '+(y===judgmentYear?'selected':'')+'>'+y+' · '+(judgmentsForYear(judgmentData,y).length?'已有来源':'待补来源')+'</option>').join('');
 $('judgment-year-strip').style.display=speechMode?'none':'grid';
 $('judgment-year-strip').innerHTML=Array.from({length:latestYear-2011},(_,i)=>i+2012).map(y=>'<button data-year="'+y+'" data-empty="'+!judgmentsForYear(judgmentData,y).length+'" '+(y===judgmentYear?'class="active"':'')+'>'+y+'</button>').join('');
 $('judgment-coverage').textContent='本次收录 '+judgmentData.records.length+' 个年份的公开资料，核对于 '+judgmentData.checkedAt+'。选集不代表当年所有观点。2013年及此后尚未收录的年份明确待补。';
 const r=activeJudgment();$('judgment-detail').innerHTML=r?judgmentCard(r):'<div class="judgment-empty"><h3>'+judgmentYear+'年 · 尚未收录已核实的观点</h3><p>本次来源集中未补齐该年资料，不能由后来演讲倒推当年判断。下方仍可查看官方历史数据。</p></div>';
 const metrics=r?.metrics||['gdp','retail','property'],old=$('judgment-metric').value;
 const defs=list.find(x=>x.kind==='annual')?.metrics||[];
 $('judgment-metric').innerHTML=metrics.map(id=>'<option value="'+id+'">'+je(defs.find(m=>m.id===id)?.label||id)+'</option>').join('');
 if(metrics.includes(old))$('judgment-metric').value=old;
 document.querySelectorAll('#judgment-year-strip button').forEach(b=>b.onclick=()=>{judgmentYear=Number(b.dataset.year);renderJudgments()});
 document.querySelectorAll('.judgment-page').forEach(b=>b.onclick=()=>{speechSection='全部';sp('speech-section').value='全部';selectedSpeechPage=Number(b.dataset.page);renderSpeech();sp('speech').scrollIntoView({behavior:'smooth'});});
 renderJudgmentTrend();
}
function renderJudgmentTrend(){
 const r=activeJudgment(),id=$('judgment-metric').value||'gdp',rows=judgmentMetricRows(currentReports(),[id]),date=r?.date||r?.publishedAt||judgmentYear+'-12-31',year=Number(date.slice(0,4)),valid=rows.filter(p=>typeof p.values[0]?.value==='number');
 const name=rows[0]?.values[0]?.label||id;
 $('judgment-trend-title').textContent=name+' · 2012年以来';
 $('judgment-trend-note').textContent='单位：%。虚线表示判断所在年份（'+year+'），不是日级位置。窄屏可左右滑动图表。全年数据包含判断前月份；仅后续完整年度属于判断后观察。失业率为全年均值，CPI不是核心CPI。';
 if(!valid.length){$('judgment-trend').textContent='缺少同口径年度数据，保留缺项。';}else{
 const w=960,h=270,pad=42,min=Math.min(0,...valid.map(p=>p.values[0].value))-1,max=Math.max(...valid.map(p=>p.values[0].value))+1,span=max-min||1;
 const x=y=>pad+(y-rows[0].year)/(rows.at(-1).year-rows[0].year||1)*(w-pad*2),yp=v=>h-pad-(v-min)/span*(h-pad*2);
 let svg='<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+je(name)+'与判断时间的对照"><title>'+je(name)+'年度公布值趋势；判断年份'+year+'</title>';
 if(year<rows.at(-1).year)svg+='<rect x="'+Math.max(pad,x(year)+1)+'" y="25" width="'+Math.max(0,w-pad-Math.max(pad,x(year)+1))+'" height="'+(h-pad-25)+'" fill="#e6eed9"/>';
 for(let j=0;j<=4;j++){const n=min+span*j/4;svg+='<line x1="'+pad+'" y1="'+yp(n)+'" x2="'+(w-pad)+'" y2="'+yp(n)+'" stroke="#d8ded3"/><text x="2" y="'+(yp(n)+4)+'" font-size="11" fill="#737d73">'+n.toFixed(1)+'</text>';}
 let segment=[];const draw=()=>{if(segment.length)svg+='<polyline fill="none" stroke="#406b4f" stroke-width="2.5" points="'+segment.map(p=>x(p.year)+','+yp(p.values[0].value)).join(' ')+'"/>';segment=[];};
 for(const p of rows){if(typeof p.values[0]?.value==='number')segment.push(p);else draw();}draw();
 if(year>=rows[0].year&&year<=rows.at(-1).year)svg+='<line x1="'+x(year)+'" y1="22" x2="'+x(year)+'" y2="'+(h-pad)+'" stroke="#9b7a30" stroke-dasharray="5 4"/><text x="'+Math.min(w-200,Math.max(pad,x(year)+8))+'" y="16" font-size="12" fill="#806329">'+je(date)+' 判断时点</text>';
 for(const p of rows){if(typeof p.values[0]?.value==='number')svg+='<circle cx="'+x(p.year)+'" cy="'+yp(p.values[0].value)+'" r="4" fill="'+(p.year>year?'#295b45':'#8a9c87')+'"><title>'+p.year+'：'+number(p.values[0].value)+'% · '+judgmentPhase(p.year,date)+'</title></circle>';svg+='<text x="'+x(p.year)+'" y="'+(h-15)+'" text-anchor="middle" font-size="11" fill="#737d73">'+p.year+'</text>';}
 $('judgment-trend').innerHTML=svg+'</svg>';
 }
 $('judgment-trend-table').innerHTML=rows.map(p=>{const m=p.values[0];return '<tr><td>'+p.year+'</td><td>'+number(m?.value)+(typeof m?.value==='number'?'%':'')+'</td><td>'+je(r?judgmentPhase(p.year,date):'该年观点未收录')+'</td><td>'+je(m?.basis||'缺项')+' · <a href="'+je(p.source)+'" target="_blank" rel="noopener">当年公报 ↗</a></td></tr>';}).join('');
 const post=valid.filter(p=>p.year>year),last=valid.at(-1);
 let note='本站复盘：'+(r?(post.length?'已有 '+post.length+' 个判断后的完整年度可观察。最新为 '+last.year+'年 '+number(last.values[0].value)+'%。':'当前缺少判断后的完整年度数据，不下结论。'):'本年观点尚未收录，下方仅展示数据背景。');
 if(r?.id==='turning'){
  const recent=currentReports().filter(x=>x.kind==='annual'&&x.year>=2025).at(-1);
  if(recent){const v=id=>number(recent.metrics.find(m=>m.id===id)?.value);note+=' '+recent.year+'年，GDP '+v('gdp')+'%、社零 '+v('retail')+'%、地产投资 '+v('property')+'%、销售面积 '+v('sales')+'%、调查失业率均值 '+v('unemployment')+'%。这些是不同口径的并列观察，尚不能仅凭总量增长判定转折已完成。';}
 }
 note+=' '+(r?.limit||'不以后来观点补写当年观点。')+' 各年保留当版公报公布值，统计修订和基数变化会影响可比性。当前年内进展不接到全年曲线上。';
 $('judgment-observation').textContent=note;
}
function renderAnnualJudgments(report){
 const root=$('annual-judgments');if(!root)return;const records=judgmentsForYear(judgmentData,report.year);
 root.innerHTML='<h3>当时的判断与年度回看</h3><p class="fine">观点是公开资料选集；数据与复盘由本站整理，不是高善文本人撰写的报告。</p>'+(records.length?records.map(r=>judgmentCard(r,true)).join(''):'<p>'+report.year+'年尚未收录已核实的当年观点，不用2024年的演讲倒推。</p>')+(report.year>=2024?'<p>'+ (report.year===2024?'2024全年属于判断形成背景，不能当作后验验证。':'持续跟踪的是2024年的观点，并不代表讲者在'+report.year+'年重新发表相同判断。')+'</p>':'<p class="fine">本年数据是后来2024年研究的历史背景，不属于该次演讲的事后验证。</p>')+'<a href="#judgments" id="annual-to-judgment">打开判断与年度趋势 ↗</a>';
 $('annual-to-judgment').onclick=()=>{judgmentMode='history';judgmentYear=report.year;renderJudgments()};
}
$('judgment-mode-speech').onclick=()=>setJudgmentMode('speech');$('judgment-mode-history').onclick=()=>setJudgmentMode('history');
$('judgment-select').onchange=e=>{if(judgmentMode==='speech')judgmentSelection=e.target.value;else judgmentYear=Number(e.target.value);renderJudgments()};$('judgment-metric').onchange=renderJudgmentTrend;
renderJudgments();

window.judgmentsReady=true;
