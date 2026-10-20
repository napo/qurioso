import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url), userData=await mkdtemp(path.join(tmpdir(),'qurioso-guide-'));
const env={...process.env,QURIOSO_GUIDE_CAPTURE:path.resolve('public/guide'),QURIOSO_TEST_USER_DATA:userData};delete env.ELECTRON_RUN_AS_NODE;
try {
  const code=await new Promise((resolve,reject)=>{const child=spawn(require('electron'),['.',...(process.platform==='linux'?['--ozone-platform=headless']:[])],{env,stdio:'inherit'});child.once('error',reject);child.once('exit',resolve);});
  if(code!==0)throw new Error(`Guide capture failed (${code})`);
} finally { await rm(userData,{recursive:true,force:true}); }
