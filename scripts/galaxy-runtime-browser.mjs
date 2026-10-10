import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';
import { proceduralSystemCheckpoint } from './procedural-system-browser-checkpoint.mjs';

const server=await preview({preview:{host:'127.0.0.1',port:5187,strictPort:true}});
let browser,page;const errors=[];
try {
  await mkdir('artifacts',{recursive:true});
  browser=await chromium.launch({headless:true,args:[...(process.env.DR_BROWSER_GPU?
    (process.platform==='win32'?['--use-angle=d3d11']:[]):['--use-angle=swiftshader']),'--ignore-gpu-blocklist','--enable-webgl']});
  page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const result=await proceduralSystemCheckpoint(page,{galaxy:'andromeda'});
  assert.equal(errors.length,0,errors.join('\n'));
  await writeFile('artifacts/u2-browser.json',JSON.stringify({result,errors},null,2));
  console.log('U2 Galaxy Runtime / Andromeda browser checks passed.');
}catch(error){
  await page?.screenshot({path:'artifacts/u2-failure.png'}).catch(()=>{});
  await writeFile('artifacts/u2-browser-failure.json',JSON.stringify({errors,error:String(error)},null,2));throw error;
}finally{await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));}
