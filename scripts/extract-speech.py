"""Recover plotted observations from the public vector PDF; never substitute raw Wind data.
Usage: bundled-python scripts/extract-speech.py /absolute/path/slides-vector.pdf
Dependencies: pdfplumber, numpy. Output: data/speech.json.
"""
import sys,json,hashlib,datetime,math
from pathlib import Path
import pdfplumber,numpy as np
PDF_URL='https://linjunkai.com/wp-content/uploads/2024/12/%E4%BA%91%E5%BC%80%E9%9B%BE%E6%95%A3%E6%9B%99%E5%85%89%E7%8E%B0-%E7%8E%B0%E5%9C%BA3.pdf'
path=Path(sys.argv[1]);doc=pdfplumber.open(path)
R=(1.,0.,0.);B=(0.,.4392157,.7529412);G=(.4392157,.6784314,.2784314);G2=(0.,.6901961,.3137255)
def near(a,b):return isinstance(a,(tuple,list)) and len(a)==3 and max(abs(x-y)for x,y in zip(a,b))<.02
def lin(pixel,p0,v0,p1,v1):return v0+(pixel-p0)*(v1-v0)/(p1-p0)
def yfn(top,maxv,bottom,minv):return lambda y:lin(y,top,maxv,bottom,minv)
def months(start,n):
 y,m=map(int,start.split('-'));return [f'{y+(m-1+i)//12}-{(m-1+i)%12+1:02d}' for i in range(n)]
def quarters(y,q,n):return [f'{y+(q-1+i)//4}-Q{(q-1+i)%4+1}' for i in range(n)]
charts=[]
def chart(page,title,section,kind,unit='%',**kw):
 c=dict(id=f'slide-{page:02d}',page=page,title=title,section=section,kind=kind,unit=unit,source=PDF_URL+'#page='+str(page),fidelity='图中数值恢复',rawRecalculated=False,series=[],**kw);charts.append(c);return c

def line(page,title,section,labels,series,top,maxv,bottom,minv,unit='%',**kw):
 p=doc.pages[page-1];c=chart(page,title,section,'line',unit,**kw);c['labels']=labels;c['axis']={'left':[minv,maxv]};c['digitizationError']=round(abs(maxv-minv)/(bottom-top)*.25,3)
 for name,color,axis in series:
  curves=[v for v in p.curves if not v['fill'] and near(v['stroking_color'],color) and len(v['pts'])>=7]
  assert len(curves)==1,(page,name,len(curves))
  pts=curves[0]['pts']
  if page==16:pts=[(x,y)for x,y in pts if x>=139 and x<=889]
  assert len(pts)==len(labels),(page,name,len(pts),len(labels))
  yf=yfn(top,maxv,bottom,minv) if axis=='left' else kw['right_fn']
  c['series'].append({'name':name,'color':'#%02x%02x%02x'%tuple(round(v*255)for v in color),'axis':axis,'points':[{'x':i,'label':label,'y':round(yf(y),2)}for i,(label,(_,y)) in enumerate(zip(labels,pts))]})
 c.pop('right_fn',None)
 return c

def trend(c,color,axis='left'):
 p=doc.pages[c['page']-1];dots=[v for v in p.curves if v['fill']and near(v['non_stroking_color'],color)and 3<v['x1']-v['x0']<15 and v['bottom']-v['top']<12 and v['x0']>130 and v['bottom']<420 and (v['x0']>650 if c['page']==22 else v['top']>122)]
 if not dots:return
 base=next(v for v in p.curves if not v['fill']and near(v['stroking_color'],color)and len(v['pts'])==len(c['labels']))
 x0,x1=base['pts'][0][0],base['pts'][-1][0];lo,hi=c['axis'][axis];n=len(c['labels'])
 # Trend fragments are filled vector dashes in this PDF, not raw fitted model coefficients.
 tmax,tmin=({18:(112.45,404.13),19:(112.45,404.13),21:(112.45,404.13),22:(110.22,401.9)})[c['page']]
 if c['page']==22 and axis=='left':tmax,tmin,hi=148.26,401.9,63
 xy=np.array([[(v['x0']+v['x1'])/2,(v['top']+v['bottom'])/2]for v in dots]);coef=np.polyfit(xy[:,0],xy[:,1],1);xs=[float(xy[:,0].min()),float(xy[:,0].max())]
 yf=yfn(tmax,hi,tmin,lo);name=next(s['name']for s in c['series']if near(tuple(int(s['color'][i:i+2],16)/255 for i in [1,3,5]),color))+' · 原图趋势线'
 c['series'].append({'name':name,'color':'#%02x%02x%02x'%tuple(round(v*255)for v in color),'axis':axis,'dashed':True,'points':[{'x':round((float(x)-x0)/(x1-x0)*(n-1),4),'y':round(yf(float(y)),2),'label':'原图趋势片段'}for x,y in sorted(xy.tolist())]})

c=line(4,'三类公司的营业收入占比','企业与转型',[str(y)for y in range(2016,2024)]+['2024-09'],[('支持类',R,'left'),('限制类',B,'left'),('中性类',G,'right')],124.11,29,401.9,9,right_fn=yfn(110.22,70,401.9,40),method='固定公司样本；组内营业总收入之和 / 全样本营业总收入。中性类使用右轴。',limits=['固定样本和行业规则已知；逐公司证券名单、汇率和跨市场去重规则仍未取得。'])
c['axis']['right']=[40,70];c['axis']['left']=[9,30]
line(5,'三类公司的总市值占比','企业与转型',[str(y)for y in range(2016,2024)]+['2024-09'],[('支持类',R,'left'),('中性类',G,'left'),('限制类',B,'left')],110.22,60,401.9,0,method='同一固定样本，各组总市值除以全部样本总市值。',limits=['金融企业、A/H 双重上市及 ADR 的市值口径需要原始样本表核对。'])
line(6,'相对中性行业的股价表现','企业与转型',[str(y)for y in range(2009,2024)]+['2024-11-22'],[('支持类 / 中性类',R,'left'),('限制类 / 中性类',B,'left')],110.22,1.6,401.9,.4,unit='2018=1',method='先取类别组合股价相对中性类别的比值，再按 2018 年归一化。不是上证指数或未除以中性行业的绝对收益。',limits=['原稿没有给出完整的价格调整、分红和组合权重规则；此处恢复图中比值，不用行业指数冒充。'])
line(7,'中性行业营业总收入增速','企业与转型',[str(y)for y in range(2017,2024)]+['2024-09'],[('中性行业',R,'left')],110.22,30,401.9,-5,method='同一固定中性公司样本的组内营收合计同比。2024 点是截至三季度口径。',limits=['季度累计与完整年度不同；原稿样本内公司名单仍缺失。'])
line(8,'中性行业员工总数增速','企业与转型',[str(y)for y in range(2017,2024)],[('中性行业',R,'left')],110.22,9,401.9,2,method='固定样本公司披露的员工人数合计同比；原图截至 2023 年。',limits=['员工披露口径和合并范围变化可影响增长。'])
provinces=['安徽','北京','福建','甘肃','广东','广西','贵州','海南','河北','河南','黑龙江','湖北','湖南','吉林','江苏','江西','辽宁','内蒙古','宁夏','青海','山东','山西','陕西','上海','四川','天津','西藏','新疆','云南','浙江','重庆']
def scatter(page,title,section,xrange,yrange,reg=None,labels=None,**kw):
 p=doc.pages[page-1];c=chart(page,title,section,'scatter',**kw);c['axis']={'x':xrange,'left':yrange};c['regression']=reg
 x0,x1=(157.21,889.06)if page==25 else(140.12,888.02)if page==24 else(137.7,885.6)
 top,bottom=(114.64,413.76)if page==25 else(119.48,411.17)if page==24 else(112.45,404.13)
 markers=[]
 for v in p.curves:
  w,h=v['x1']-v['x0'],v['bottom']-v['top'];color=v['non_stroking_color'];cx,cy=(v['x0']+v['x1'])/2,(v['top']+v['bottom'])/2
  if not v['fill']or not(4<w<13 and 4<h<13)or not isinstance(color,(tuple,list))or max(color)-min(color)<.2:continue
  if page==24 and cy<128:continue
  markers.append((cx,cy,color))
 if page==24:
  reds=[v for v in p.rects if near(v['non_stroking_color'],(.75294,.313725,.30196))and v['top']>200];v=reds[0];markers.append(((v['x0']+v['x1'])/2,(v['top']+v['bottom'])/2,R))
 points=[]
 for i,(x,y,color) in enumerate(markers):
  name=labels[i]if labels else f'观测 {i+1}'
  if page==24:name='2024（原图估计）'if near(color,(.607843,.733333,.34902))else'2023'if near(color,R)else f'2013—2019 观测 {i+1}'
  points.append({'x':round(lin(x,x0,xrange[0],x1,xrange[1]),3),'y':round(lin(y,top,yrange[1],bottom,yrange[0]),3),'label':name,'color':'#%02x%02x%02x'%tuple(round(v*255)for v in color)})
 c['series']=[{'name':'原图散点','points':points}]
 # Recover the actually drawn fitted line separately from the printed equation.
 fitted=[l for l in p.lines if l['x1']-l['x0']>100 and l['bottom']-l['top']>1 and l['top']>120 and l['bottom']<410]
 if fitted:
  l=fitted[0];ends=l.get('pts')or[(l['x0'],l['bottom']),(l['x1'],l['top'])]
  c['drawnFit']=[{'x':round(lin(x,x0,xrange[0],x1,xrange[1]),4),'y':round(lin(y,top,yrange[1],bottom,yrange[0]),4)}for x,y in ends]
 return c
scatter(10,'人口年龄结构与消费：疫情前','消费与信心',[80,96],[-2,12],{'slope':.02,'intercept':7.20,'r2':0.,'p':.92},labels=provinces,xLabel='65岁以下人口占比，%',yLabel='2018—2019 社零同比平均，%',method='省级横截面：65岁以下人口占比与 2018—2019 社零平均同比。',limits=['恢复了图中的省份点值；人口年龄结构基准年的原稿说明仍不充分。'])
scatter(11,'人口年龄结构与消费：疫情后','消费与信心',[80,96],[-8,8],{'slope':-.47,'intercept':43.19,'r2':.22,'p':.01},labels=[p for p in provinces if p!='贵州'],xLabel='65岁以下人口占比，%',yLabel='2024 年 1—5 月社零累计同比，%',method='30 个省份的图中观测；23省用2024年1—5月，其余用最近进度，最早为1—3月。',limits=['不是同一观察窗口的严格可比面板；与疫情前图的样本量也不同。横截面相关不能直接识别年龄的因果影响。'])
scatter(12,'房价与调整后消费：疫情前','消费与信心',[-10,6],[-10,45],{'slope':.16,'intercept':6.29,'r2':0.,'p':.54},xLabel='二手住宅价格同比，%',yLabel='剔除人口等因素后的社零，%',method='将社零对常住人口增速、城镇化率及病床数对数回归，使用残差与房价增速比较。',limits=['残差化不等于消费原始增速；完整回归窗口、样本配对及控制变量底表未取得。'])
scatter(13,'房价与调整后消费：疫情后','消费与信心',[-20,25],[-20,10],{'slope':.28,'intercept':-3.41,'r2':.14,'pText':'原图显示 0.00（舍入）'},xLabel='二手住宅价格同比，%',yLabel='剔除人口等因素后的社零，%',method='沿用残差化消费与房价的横截面比较；图中每一点不擅自匹配省份。',limits=['原图显示 p=0.00 是舍入，不是概率严格为零。不能由相关关系直接推导房价下跌造成消费下降。'])
line(14,'消费者信心指数','消费与信心',months('2015-01',117),[('消费者信心',R,'left')],112.45,130,404.13,70,unit='指数',method='月度指数，原图2015年1月至2024年9月。',limits=['此为历史图中指数，不是实时调查结果。'])
line(16,'全国与31城调查失业率','就业与统计',months('2018-01',82),[('全国',R,'left'),('31个大城市',B,'left')],110.22,8,401.9,4,method='保留两条月度调查失业率。原轴以半个百分点设刻度，但文字标签重复舍入为整数。',limits=['图形实际按4—8的连续坐标恢复，不按重复整数刻度错误映射；离开劳动力市场与城乡迁移不等于被该比率完整覆盖。'])
line(17,'非私营单位制造业与服务业工资增速','就业与统计',[str(y)for y in range(2004,2024)],[('制造业',R,'left'),('服务业',B,'left')],112.45,20,404.13,0,method='原图使用非私营单位口径。',limits=['非私营不等于全部体制内或全部劳动者；不能用在岗工资均值描述离岗者收入。服务业聚合权重未披露。'])
c=line(18,'城镇就业增速与原图趋势','就业与统计',[str(y)for y in range(2011,2024)],[('城镇就业增速',R,'left')],112.45,5,404.13,-3,method='2023年使用两年复合增速；虚线恢复自原图，不宣称已复现其趋势模型。',limits=['统计定义与人口基准修订可能改变历史就业数。']);trend(c,R)
c=line(19,'城镇就业人数与原图趋势','就业与统计',[str(y)for y in range(2011,2024)],[('城镇就业人数',R,'left')],112.45,50000,404.13,34000,unit='万人',method='原图给出的2021—2023年缺口为472、2236、2001万人，合计4709。',limits=['三个年度存量缺口的相加不等于4709万个去重的失业者；须区分存量、人年与跨年重复。']);trend(c,R)
c=line(20,'第三产业增加值占比与趋势','就业与统计',quarters(2011,1,55),[('第三产业占比（4Q TTM）',R,'left')],112.45,60,404.13,40,method='滚动四季度第三产业增加值 / GDP；不以单季占比替代。',limits=['原图趋势线窗口和估计方法未披露，当前仅从其几何线恢复。'])
l=next(l for l in doc.pages[19].lines if l['x1']-l['x0']>700 and l.get('dash'));points=l.get('pts');
if not points:points=[(l['x0'],l['bottom']),(l['x1'],l['top'])]
c['series'].append({'name':'原图趋势线','color':'#ff0000','dashed':True,'axis':'left','points':[{'x':round((x-137.8)/(885.5-137.8)*54,3),'y':round(yfn(112.45,60,404.13,40)(y),2),'label':'趋势线'}for x,y in points]})
c=line(21,'城乡就业人数与原图趋势','就业与统计',[str(y)for y in range(2010,2024)],[('乡村就业人数',R,'left'),('城镇就业人数',B,'left')],112.45,55000,404.13,20000,unit='万人',method='乡村相对趋势增加474、1383、2316万人。原稿列合计4174；逐项已显示数相加为4173，保留1万的舍入差。',limits=['乡村超趋势值不能直接当作已追踪到的城镇回流人数；两条趋势都不是因果识别。']);trend(c,R);trend(c,B)
c=line(22,'就业质量：参保与公积金覆盖率','就业与统计',[str(y)for y in range(2017,2024)],[('失业保险',R,'left'),('工伤保险',B,'left'),('住房公积金',G2,'right')],148.26,63,401.9,43,right_fn=yfn(110.22,40,401.9,31),method='参保或实缴人数 / 城镇就业人数；住房公积金使用右轴。',limits=['不同制度的参保人数不可相加成独立劳动者；分母和覆盖人群变化会影响比率。']);c['axis']['right']=[31,40];c['axis']['left']=[43,66];trend(c,R);trend(c,B);trend(c,G2,'right')
scatter(24,'产出缺口与核心CPI','总量与地产',[-.6,1],[.3,2.3],{'slope':.47,'intercept':1.69,'r2':.86},xLabel='产出缺口，百分点',yLabel='核心CPI同比，%',method='基准散点为2013—2019；2020—2022被原研究排除，2024核心CPI当时估为0.4%。',limits=['原图坐标将2023画在x≈0、2024画在x≈0.2；脚注却将两年的产出缺口依次写成0.2和0，存在顺序矛盾，未擅自修正。','潜在增速属于模型估计，不能将回归外推自动当成真实GDP的精确测量。'])
scatter(25,'就业增速与实际GDP：历史关系','总量与地产',[-3,5],[0,16],{'slope':3.,'intercept':-2.,'pText':'原图显示 p=0（舍入）'},labels=[str(y)for y in range(2000,2024)],xLabel='城镇就业人员增速，%',yLabel='实际GDP同比，%',method='原图2000—2023年年度数据；2021和2023年用两年复合增速。',limits=['拟合样本是否排除2022—2023须回归核对；关系不稳定不唯一说明GDP被高估。'])
for page,title,series in [(26,'消费与名义GDP：前后五年比较',[('名义GDP同比',[8.9,5.9],B),('社零同比',[9.7,3.8],R)]),(27,'投资与名义GDP：前后五年比较',[('名义GDP同比',[8.9,5.9],B),('固定资产投资同比',[7.3,3.9],R)])]:
 c=chart(page,title,'总量与地产','bar',method='按原图明示的两个五年窗口数值重绘；2024值在演讲时属于估计。',limits=['不是截至2025年的事后年度统计；固定资产投资并不等于GDP核算中的资本形成。']);c['labels']=['2015—2019','2020—2024（当时估计）'];c['axis']={'left':[0,11]};c['fidelity']='原图明确标注值';c['series']=[{'name':name,'color':'#%02x%02x%02x'%tuple(round(v*255)for v in color),'points':[{'x':i,'label':c['labels'][i],'y':v}for i,v in enumerate(vals)]}for name,vals,color in series]
c=chart(28,'地产危机前后三年增速差','总量与地产','bar',method='危机后3年平均实际增长减危机前3年平均实际增长；中国以2021为0点，2021用两年复合，2024为当时估计。',limits=['事件包括西班牙1978、瑞典/日本/芬兰1991及美国/丹麦/西班牙2008；事件选择、财政反应和全球环境不同。差异不是因果估计。']);c['unit']='百分点';c['labels']=['中国2021','西班牙1978','瑞典1991','美国2008','丹麦2008','日本1991','西班牙2008','芬兰1991'];c['axis']={'left':[-7,0]}
bars=sorted([r for r in doc.pages[27].rects if isinstance(r['non_stroking_color'],(tuple,list))and(near(r['non_stroking_color'],R)or near(r['non_stroking_color'],B))and r['top']>130 and r['x1']-r['x0']>30],key=lambda r:r['x0']);assert len(bars)==8
c['series']=[{'name':'后3年均值 − 前3年均值','color':'#2876ab','points':[{'x':i,'y':round(yfn(133.45,0,425.13,-7)(r['bottom']),2),'label':c['labels'][i],'color':'#ff0000'if i==0 else'#0070c0'}for i,r in enumerate(bars)]}]
line(29,'地产危机前后的事件时间路径','总量与地产',[str(y)for y in range(-10,11)],[('危机国家平均',R,'left')],138.97,8,404.13,-2,method='横轴0为危机年份；七次历史事件按算术平均对齐；中国0点为2021。',limits=['平均路径隐藏国别差异；2024仍是当时估计；恢复的是原图路径，不能直接当作中国未来预测。'])
p=doc.pages[28];curve=next(v for v in p.curves if not v['fill']and near(v['stroking_color'],B));charts[-1]['series'].append({'name':'中国（2021=事件年0）','color':'#0070c0','axis':'left','points':[{'x':i,'label':str(i-10),'y':round(yfn(138.97,8,404.13,-2)(y),2)}for i,(x,y)in enumerate(curve['pts'])]})
yticks={4:[9,14,19,24,29],5:list(range(0,61,10)),6:[.4,.6,.8,1,1.2,1.4,1.6],7:list(range(-5,31,5)),8:list(range(2,10)),10:list(range(-2,13,2)),11:list(range(-8,9,2)),12:list(range(-10,46,5)),13:list(range(-20,11,5)),14:list(range(70,131,10)),16:[4+i*.5 for i in range(9)],17:list(range(0,21,2)),18:list(range(-3,6)),19:list(range(34000,50001,2000)),20:list(range(40,61,2)),21:list(range(20000,55001,5000)),22:[43,48,53,58,63],24:[round(.3+i*.2,1)for i in range(11)],25:list(range(0,17,2)),26:list(range(0,12,2)),27:list(range(0,11,2)),28:list(range(-7,1)),29:list(range(-2,9,2))}
for c in charts:
 c['axis']['yTicks']=yticks[c['page']]
 if c['page']in[10,11]:c['axis']['xTicks']=list(range(80,97,2))
 if c['page']==12:c['axis']['xTicks']=list(range(-10,7,2))
 if c['page']==13:c['axis']['xTicks']=list(range(-20,26,5))
 if c['page']==24:c['axis']['xTicks']=[round(-.6+i*.2,1)for i in range(9)]
 if c['page']==25:c['axis']['xTicks']=list(range(-3,6))
 if c['page']==4:c['axis']['rightTicks']=list(range(40,71,5))
 if c['page']==22:c['axis']['rightTicks']=list(range(31,41))
assert len(charts)==23,len(charts)
for c in charts:
 if c['kind']=='scatter':
  ps=c['series'][0]['points'];base=[p for p in ps if not(c['page']==24 and p['label']in['2023','2024（原图估计）'])and not(c['page']==25 and p['label']in['2022','2023'])]
  x=np.array([p['x']for p in base]);y=np.array([p['y']for p in base]);a,b=np.polyfit(x,y,1);r2=1-float(np.sum((y-a*x-b)**2)/np.sum((y-y.mean())**2))
  c['recoveredOLS']={'n':len(base),'slope':round(float(a),5),'intercept':round(float(b),5),'r2':round(r2,5)}
  if c['page']==10:c['limits'].append('从恢复散点复算OLS斜率约−0.018，原图却标注+0.02、截距7.20，与图中散点不一致；不把原图方程当作已通过核验的拟合结果。')
  if c['page']==25:c['limits'].append('仅排除2022—2023的恢复点回归，与原稿方程不一致；进一步排除2020的敏感性结果也不能复现原标注，具体回归样本或权重仍待确认。')

classification=[{'name':'支持','count':2341,'industries':['电力设备','电子','机械设备','国防军工','汽车','计算机','通信']},{'name':'中性','count':2638,'industries':['商贸零售','社会服务（不包括教育）','基础化工','钢铁','有色金属','建筑材料','家用电器','纺织服饰','轻工制造','农林牧渔','食品饮料','医药生物','公用事业','交通运输','煤炭','石油石化','环保','美容护理']},{'name':'限制','count':473,'countDetail':'A股342；中概股131（原表备注：没有国企）','industries':['房地产','非银金融','传媒','教育（二级）','中概股中的房地产、保险、媒体、软件与服务']}]
result={'version':1,'asOf':'2024-12-03','retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':{'url':PDF_URL,'mirror':'https://statics.biogeeker.com/obsidian/202412100302794.pdf','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'pages':30,'provenance':'第三方保存的演讲幻灯片；与公开听打稿逐项核对。'},'classification':classification,'classificationPage':3,'charts':charts,'notes':['原图的矢量位置按刻度线性标定恢复，保留绘图误差；数值小数位用于复算，不代表原始数据精度。','没有将图形恢复说成逐公司原始数据库复算；原始Wind样本、去重及公司口径仍缺失。','已有2012年起的官方年度数据为事后观察，演讲原图中2024年估计另行保留，不事后替换。']}
Path('data/speech.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
for c in charts:print(c['page'],c['title'],[(s['name'],len(s['points']))for s in c['series']])
print('saved',len(charts),'charts')
