import {mkdir,readFile,writeFile,rename,readdir,unlink} from 'node:fs/promises';
import {resolve,dirname,relative,sep} from 'node:path';
import {randomUUID} from 'node:crypto';

// The application uses only this small subset of the R2 interface.
export class FileBucket {
 constructor(directory){this.directory=resolve(directory);}
 path(key){
  if(typeof key!=='string'||!key||key.includes('\\')||key.startsWith('/')||key.split('/').some(s=>!s||s==='.'||s==='..'))throw Error('invalid_archive_key');
  const target=resolve(this.directory,key);if(!target.startsWith(this.directory+sep))throw Error('invalid_archive_key');return target;
 }
 async get(key){try{const text=await readFile(this.path(key),'utf8');return {json:async()=>JSON.parse(text),text:async()=>text};}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 async put(key,value){
  const target=this.path(key);await mkdir(dirname(target),{recursive:true,mode:0o700});const tmp=target+'.tmp-'+randomUUID();
  try{await writeFile(tmp,value,{mode:0o600,flag:'wx'});await rename(tmp,target);}finally{await unlink(tmp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 }
 async list({prefix='',cursor,limit=100}={}){
  const keys=[];
  const walk=async directory=>{let entries;try{entries=await readdir(directory,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return;throw e;}
   for(const e of entries){const path=resolve(directory,e.name);if(e.isDirectory())await walk(path);else if(e.isFile()&&!e.name.includes('.tmp-')){const key=relative(this.directory,path).split(sep).join('/');if(key.startsWith(prefix))keys.push(key);}}
  };await walk(this.directory);keys.sort();const start=cursor?keys.findIndex(k=>k>cursor):0;
  const page=start<0?[]:keys.slice(start,start+limit),truncated=start>=0&&start+limit<keys.length;
  return {objects:page.map(key=>({key})),truncated,cursor:truncated?page.at(-1):undefined};
 }
}

export async function seedArchive(bucket,root){
 const seed=JSON.parse(await readFile(resolve(root,'data/archive.json'),'utf8'));
 for(const [key,value]of [['latest.json',seed.latest],...seed.annual.map(a=>['annual/'+a.year+'.json',a]),['worldbank.json',JSON.parse(await readFile(resolve(root,'data/worldbank.json'),'utf8'))]]){
  if(!await bucket.get(key))await bucket.put(key,JSON.stringify(value));
 }
}
