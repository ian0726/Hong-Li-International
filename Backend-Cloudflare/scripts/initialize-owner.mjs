import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const api='https://hong-li-international-backend.ianyang-0726.workers.dev';
const privateDirectory=resolve(project,'..','private');
mkdirSync(privateDirectory,{recursive:true});
const setupPath=join(privateDirectory,'setup-key.txt');
const credentialsPath=join(privateDirectory,'owner-credentials.json');
const setupKey=existsSync(setupPath)?readFileSync(setupPath,'utf8').trim():randomBytes(32).toString('hex');
if(!existsSync(setupPath)) writeFileSync(setupPath,setupKey,{mode:0o600});
const secret=spawnSync(process.execPath,[join(project,'node_modules/wrangler/bin/wrangler.js'),'secret','put','ADMIN_SETUP_KEY'],{cwd:project,input:setupKey+'\n',encoding:'utf8'});
if(secret.status!==0) throw new Error('Could not configure the administrator setup key.');
console.log('Administrator setup key configured.');
const state=await (await fetch(api+'/api/auth/session')).json();
if(state.setupRequired) {
  const credentials={username:'ian0726',password:randomBytes(24).toString('base64url')};
  const result=await fetch(api+'/api/auth/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...credentials,setupKey})});
  if(result.status!==201) throw new Error('Could not initialize the administrator: '+result.status);
  writeFileSync(credentialsPath,JSON.stringify(credentials),{mode:0o600});
}
if(!existsSync(credentialsPath)) throw new Error('An administrator already exists. Keep the existing account.');
const credentials=JSON.parse(readFileSync(credentialsPath,'utf8'));
const login=await fetch(api+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(credentials)});
if(!login.ok) throw new Error('Administrator sign-in verification failed: '+login.status);
const setCookie=login.headers.get('set-cookie')||'';
if(!/HttpOnly/i.test(setCookie)||!/Secure/i.test(setCookie)) throw new Error('Session cookie verification failed.');
const cookie=setCookie.split(';')[0];
for(const path of ['/api/admin/users','/api/excel','/api/excel/export','/api/excel/template']) {
  const response=await fetch(api+path,{headers:{cookie}});
  if(!response.ok) throw new Error('Authenticated endpoint failed: '+path+' '+response.status);
  console.log('Verified '+path+': '+response.status);
}
await fetch(api+'/api/auth/logout',{method:'POST',headers:{cookie}});
const desktop=process.env.USERPROFILE?join(process.env.USERPROFILE,'Desktop'):privateDirectory;
const note=join(desktop,'Hong-Li-Admin-Login.txt');
writeFileSync(note,`閎麗國際有限公司 管理後台\n\n網址：${api}/admin\n帳號：${credentials.username}\n初始密碼：${credentials.password}\n\n登入後，可在「管理員帳號」編輯帳號及密碼。\n請保管這份登入資訊，勿上傳 GitHub。\n`,{encoding:'utf8',mode:0o600});
if(process.platform==='win32') spawn('notepad.exe',[note],{detached:true,stdio:'ignore'}).unref();
console.log('Administrator account created and verified; login details saved on your Desktop.');
