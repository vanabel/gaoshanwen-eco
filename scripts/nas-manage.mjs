import {spawnSync} from 'node:child_process';
import {mkdir,copyFile,cp,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,loadConfig,getAdminToken} from '../server/index.mjs';

const action=process.argv[2]||'install';process.chdir(root);
if(action==='install'&&process.env.npm_command==='install'){
 console.log('依赖安装完成。部署请显式运行 pnpm run install。');process.exit(0);
}
function run(command,args,options={}){const r=spawnSync(command,args,{cwd:root,stdio:'inherit',...options});if(r.error)throw r.error;if(r.status!==0)throw Error(command+' exited '+r.status);return r;}
function git(args){return spawnSync('git',args,{cwd:root,encoding:'utf8'});}
function pnpm(args){if(process.env.npm_execpath)return run(process.execPath,[process.env.npm_execpath,...args]);return run('pnpm',args);}
const config=loadConfig();
async function backup(){
 const target=resolve(config.stateDir,'backups',new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(target,{recursive:true,mode:0o700});
 try{await cp(config.dataDir,resolve(target,'archive'),{recursive:true,errorOnExist:true,force:false});}catch(e){if(e.code!=='ENOENT')throw e;}
 console.log('数据备份：'+target);
}
async function prepare(){
 if(Number(process.versions.node.split('.')[0])<22)throw Error('Node.js 22 or newer is required');
 try{await copyFile(resolve(root,'.env.example'),resolve(root,'.env'),(await import('node:fs')).constants.COPYFILE_EXCL);}catch(e){if(e.code!=='EEXIST')throw e;}
 // --ignore-scripts prevents the package's install lifecycle from recursing.
 pnpm(['install','--ignore-scripts','--frozen-lockfile']);
 run(process.execPath,['scripts/compile.mjs']);
 for(const file of ['test.mjs','test-speech.mjs','test-speech-routes.mjs','test-judgments.mjs','test-node.mjs'])run(process.execPath,['scripts/'+file]);
 await mkdir(resolve(root,'logs'),{recursive:true,mode:0o700});
 await getAdminToken(config);
}
async function refresh(){
 const token=await getAdminToken(config),headers={'X-Admin-Token':token};if(config.user)headers.Authorization='Basic '+Buffer.from(config.user+':'+config.password).toString('base64');
 const r=await fetch('http://127.0.0.1:'+config.port+'/api/refresh',{method:'POST',headers,signal:AbortSignal.timeout(55000)});if(!r.ok)throw Error('refresh HTTP '+r.status);console.log(JSON.stringify(await r.json()));
}
if(action==='refresh'){await refresh();}
else if(['install','update'].includes(action)){
 if(action==='update'){
  await backup();
  const upstream=git(['rev-parse','--abbrev-ref','--symbolic-full-name','@{u}']);
  if(upstream.status===0){const dirty=git(['status','--porcelain','--untracked-files=no']);if(dirty.status!==0||dirty.stdout.trim())throw Error('Tracked local changes exist; refusing to overwrite them.');run('git',['pull','--ff-only']);}
  else console.log('尚未配置 Git 上游：使用当前目录代码重建；配置上游后将自动 git pull --ff-only。');
 }
 await prepare();const cli=resolve(root,'node_modules/pm2/bin/pm2');
 run(process.execPath,[cli,'startOrRestart','ecosystem.config.cjs','--only','economy-observatory','--update-env']);
 const headers=config.user?{Authorization:'Basic '+Buffer.from(config.user+':'+config.password).toString('base64')}:{};
 let healthy=false;for(let attempt=0;attempt<20;attempt++){try{const r=await fetch('http://127.0.0.1:'+config.port+'/api/health',{headers,signal:AbortSignal.timeout(2000)});const d=await r.json();if(r.ok&&d.ok&&d.archiveAvailable){healthy=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
 if(!healthy)throw Error('Service health check failed; inspect logs/pm2-error.log');
 run(process.execPath,[cli,'save']);
 console.log('服务已就绪：http://NAS-IP:'+config.port+'/#judgments');
}else throw Error('Unknown action: '+action);
