import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {FileBucket,seedArchive} from '../server/storage.mjs';
import {createApplication,root} from '../server/index.mjs';
const dir=await mkdtemp(resolve(tmpdir(),'economy-node-'));
try{
 const bucket=new FileBucket(resolve(dir,'archive'));
 for(const key of ['../outside','/absolute','a/../outside','a\\b','a//b'])await assert.rejects(()=>bucket.put(key,'bad'));
 await bucket.put('annual/2024.json','{"value":1}');await bucket.put('annual/2025.json','{"value":2}');
 assert.equal((await (await bucket.get('annual/2024.json')).json()).value,1);
 let page=await bucket.list({prefix:'annual/',limit:1});assert.equal(page.objects.length,1);assert.equal(page.truncated,true);assert.equal((await bucket.list({prefix:'annual/',limit:1,cursor:page.cursor})).objects[0].key,'annual/2025.json');
 await bucket.put('annual/2024.json','{"value":3}');assert.equal((await (await bucket.get('annual/2024.json')).json()).value,3);
 await seedArchive(bucket,root);assert.equal((await (await bucket.get('annual/2024.json')).json()).value,3);assert(await bucket.get('annual/2012.json'));
 const config={host:'127.0.0.1',port:19927,hours:0,dataDir:resolve(dir,'real-archive'),stateDir:resolve(dir,'state'),user:'',password:''};
 let app=await createApplication(config);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let base='http://127.0.0.1:'+app.server.address().port;
 let r=await fetch(base+'/api/health');assert.equal((await r.json()).archiveAvailable,true);
 r=await fetch(base+'/api/refresh',{method:'POST'});assert.equal(r.status,401);
 r=await fetch(base+'/api/update',{method:'POST',headers:{'X-Admin-Token':(await readFile(resolve(config.stateDir,'admin-token'),'utf8')).trim(),'content-type':'application/json','Origin':'https://untrusted.invalid'},body:'{}'});assert.equal(r.status,403);
 for(const path of ['/','/api/speech','/api/judgments','/api/speech/charts/24.svg']){r=await fetch(base+path);assert.equal(r.status,200);}
 const seed=JSON.parse(await readFile(resolve(root,'data/archive.json'),'utf8')),snapshot=structuredClone(seed.annual[0]);snapshot.notes=['Node persistence integration test'];
 const token=(await readFile(resolve(config.stateDir,'admin-token'),'utf8')).trim();
 r=await fetch(base+'/api/update',{method:'POST',headers:{'X-Admin-Token':token,'content-type':'application/json'},body:JSON.stringify({annual:[snapshot]})});assert.equal(r.status,200);assert((await r.json()).ok);
 await app.close();
 app=await createApplication(config);assert((await (await app.bucket.get('annual/2012.json')).json()).notes.includes('Node persistence integration test'));await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;
 r=await fetch(base+'/api/runtime');assert.equal((await r.json()).backgroundRefreshHours,0);await app.close();
 let calls=0;app=await createApplication({...config,user:'tester',password:'secret'},{application:{async fetch(){calls++;await new Promise(r=>setTimeout(r,10));return Response.json({ok:true,latestStatus:'live',annualStatus:'stored:2025',worldbankStatus:'live'});}}});
 const results=await Promise.all([app.refresh(),app.refresh()]);assert.equal(calls,1);assert.equal(results[0].ok,true);assert.equal((await (await app.bucket.get('runtime/refresh.json')).json()).ok,true);
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;r=await fetch(base+'/');assert.equal(r.status,401);r=await fetch(base+'/',{headers:{Authorization:'Basic '+Buffer.from('tester:secret').toString('base64')}});assert.equal(r.status,200);await app.close();
 console.log('PASS: disk persistence after restart, seed preservation, key containment, pagination, Node routes, admin token/origin protection, optional login, scheduled refresh deduplication and state');
}finally{await rm(dir,{recursive:true,force:true});}
