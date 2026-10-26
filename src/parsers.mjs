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
