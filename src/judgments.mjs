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
