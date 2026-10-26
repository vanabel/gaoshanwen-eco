import http from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,resolve} from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import worker from '../worker/index.js';
import {FileBucket,seedArchive} from './storage.mjs';

export const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function loadConfig(){
 try{process.loadEnvFile(resolve(root,'.env'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const port=Number(process.env.PORT||19927),hours=Number(process.env.REFRESH_HOURS||6);
 if(!Number.isInteger(port)||port<1||port>65535||!Number.isFinite(hours)||hours<0)throw Error('invalid_server_configuration');
 const user=process.env.BASIC_AUTH_USER||'',password=process.env.BASIC_AUTH_PASSWORD||'';
 if(!!user!==!!password)throw Error('both_basic_auth_fields_required');
 return {host:process.env.HOST||'0.0.0.0',port,hours,dataDir:resolve(root,process.env.DATA_DIR||'var/archive'),stateDir:resolve(root,process.env.STATE_DIR||'var'),user,password};
}
function equal(a,b){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);}
export async function getAdminToken(config){
 if(process.env.ADMIN_TOKEN)return process.env.ADMIN_TOKEN;
 await mkdir(config.stateDir,{recursive:true,mode:0o700});const path=resolve(config.stateDir,'admin-token');
 try{return (await readFile(path,'utf8')).trim();}catch(e){if(e.code!=='ENOENT')throw e;}
 const token=randomBytes(32).toString('hex');try{await writeFile(path,token+'\n',{flag:'wx',mode:0o600});return token;}catch(e){if(e.code==='EEXIST')return (await readFile(path,'utf8')).trim();throw e;}
}
export async function createApplication(config,{application=worker}={}){
 const bucket=new FileBucket(config.dataDir);await seedArchive(bucket,root);const env={BUCKET:bucket},token=await getAdminToken(config),pending=new Set();let refreshInFlight=null;
 const ctx={waitUntil(p){pending.add(p);p.catch(e=>console.error('background:',e.message)).finally(()=>pending.delete(p));}};
 async function refresh(){
  if(refreshInFlight)return refreshInFlight;
  refreshInFlight=(async()=>{const startedAt=new Date().toISOString();try{const response=await application.fetch(new Request('http://localhost:'+config.port+'/api/refresh',{method:'POST'}),env,ctx),result=await response.json();await bucket.put('runtime/refresh.json',JSON.stringify({startedAt,finishedAt:new Date().toISOString(),...result}));console.log(JSON.stringify({event:'scheduled_refresh',...result}));return result;}catch(e){await bucket.put('runtime/refresh.json',JSON.stringify({startedAt,finishedAt:new Date().toISOString(),ok:false,error:e.message}));throw e;}finally{refreshInFlight=null;}})();return refreshInFlight;
 }
 const server=http.createServer(async(req,res)=>{
  try{
   if(config.user){const expected='Basic '+Buffer.from(config.user+':'+config.password).toString('base64');if(!equal(req.headers.authorization||'',expected)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Economy Observatory", charset="UTF-8"'});return res.end('Authentication required');}}
   const url=new URL(req.url,'http://'+(req.headers.host||'localhost:'+config.port));
   if(url.pathname==='/api/runtime'&&req.method==='GET'){
    const state=await bucket.get('runtime/refresh.json');res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(JSON.stringify({runtime:'node',storage:'filesystem',backgroundRefreshHours:config.hours,lastRefresh:state?await state.json():null}));
   }
   const mutation=['/api/refresh','/api/update'].includes(url.pathname)&&req.method==='POST';
   if(mutation&&!equal(req.headers['x-admin-token']||'',token)){res.writeHead(401,{'Content-Type':'application/json'});return res.end('{"error":"admin_token_required"}');}
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>100000){res.writeHead(413,{'Connection':'close'});res.end('{"error":"too_large"}');return;}chunks.push(chunk);}
   const options={method:req.method,headers:req.headers};if(!['GET','HEAD'].includes(req.method))options.body=Buffer.concat(chunks);
   const response=await application.fetch(new Request(url,options),env,ctx);
   res.writeHead(response.status,{...Object.fromEntries(response.headers),'X-Content-Type-Options':'nosniff'});res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){console.error('http_request:',e.message);if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":"request_failed"}');}
 });
 server.requestTimeout=30000;server.headersTimeout=15000;
 let timer,startTimer;
 function startSchedule(){if(config.hours>0){startTimer=setTimeout(()=>refresh().catch(e=>console.error('refresh:',e.message)),15000);timer=setInterval(()=>refresh().catch(e=>console.error('refresh:',e.message)),config.hours*3600000);timer.unref();startTimer.unref();}}
 async function close(){clearInterval(timer);clearTimeout(startTimer);server.closeIdleConnections();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await Promise.allSettled([...pending,...(refreshInFlight?[refreshInFlight]:[])]);}
 return {server,bucket,refresh,startSchedule,close};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const config=loadConfig(),app=await createApplication(config);
 await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(config.port,config.host,resolve);});
 console.log(JSON.stringify({event:'listening',host:config.host,port:config.port,dataDir:config.dataDir,refreshHours:config.hours}));app.startSchedule();process.send?.('ready');
 let stopping=false;for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{if(stopping)return;stopping=true;const deadline=setTimeout(()=>process.exit(1),55000);deadline.unref();await app.close();clearTimeout(deadline);process.exit(0);});
}
