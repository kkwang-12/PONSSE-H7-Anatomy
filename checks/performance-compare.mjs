import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromePort} from '../vendor/scripts/chrome-port.mjs';
const profile=mkdtempSync(join(tmpdir(),'h7-compare-'));
const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--do-not-de-elevate','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--allow-file-access-from-files','about:blank']);
let socket;const results=[];
try{
 const port=await chromePort(browser,profile),page=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
 socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>socket.onopen=r);
 let id=0;const pending=new Map();socket.onmessage=e=>{const v=JSON.parse(e.data);if(v.id){pending.get(v.id)?.(v);pending.delete(v.id);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,v=>v.error?reject(Error(JSON.stringify(v.error))):resolve(v.result));socket.send(JSON.stringify({id:n,method,params}));});
 const ev=async expression=>{const v=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(v.exceptionDetails)throw Error(v.exceptionDetails.exception?.description??v.exceptionDetails.text);return v.result.value;};
 await send('Page.enable');await send('Performance.enable');
 for(const [name,file,dpr,churn] of [
  ['before','checks/performance-before.html',1,false],
  ['after','index-dark.html',1,false],
  ['after-selection','index-dark.html',1,true],
  ['after-hidpi','index-dark.html',2,false],
  ['after-light','index.html',1,false]
 ]){
  await send('Emulation.setDeviceMetricsOverride',{width:1100,height:1250,deviceScaleFactor:dpr,mobile:false});
  await send('Page.navigate',{url:pathToFileURL(resolve(file)).href});
  for(let i=0;i<100;i++){if(await ev('!!window.h7Demo'))break;await new Promise(r=>setTimeout(r,100));}
  await ev('Promise.resolve(h7Demo.ready)');await ev('new Promise(r=>setTimeout(r,300))');
  const info=await ev(`({renderer:h7Demo.renderer||{type:'svg'},nodes:document.querySelectorAll('*').length})`);
  const before=(await send('Performance.getMetrics')).metrics;
  const timings=await ev(`new Promise(resolve=>{let n=0,last=0;const intervals=[],js=[];cancelAnimationFrame(h7Demo.state.frame);h7Demo.state.frame=0;const start=performance.now();function frame(now){if(last)intervals.push(now-last);last=now;h7Demo.state.progress=(1-Math.cos(n/119*Math.PI*2))/2;const t=performance.now();if(${churn}&&n%7===0)h7Demo.select(h7Demo.assemblies[Math.floor(n/7)%11].id);else h7Demo.draw();js.push(performance.now()-t);if(++n<120)requestAnimationFrame(frame);else{const quantile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*p)];resolve({frames:n,elapsedMs:performance.now()-start,fps:1000*intervals.length/intervals.reduce((a,b)=>a+b,0),frameMedianMs:quantile(intervals,.5),frameP95Ms:quantile(intervals,.95),over33ms:intervals.filter(n=>n>33.5).length,jsMedianMs:quantile(js,.5),jsP95Ms:quantile(js,.95)});}}requestAnimationFrame(frame);})`);
  const old=Object.fromEntries(before.map(m=>[m.name,m.value]));const metrics=Object.fromEntries((await send('Performance.getMetrics')).metrics.filter(m=>/^(LayoutDuration|RecalcStyleDuration|ScriptDuration|TaskDuration)$/.test(m.name)).map(m=>[m.name,+(m.value-old[m.name]).toFixed(4)]));
  const item={name,dpr,...info,...timings,metrics};results.push(item);console.log(JSON.stringify(item));
 }
 writeFileSync('checks/performance-comparison.json',JSON.stringify({browser:'Headless Edge',viewport:[1100,1250],method:'120 equally spaced poses over assembled/apart/assembled, requestAnimationFrame',results},null,2));
}finally{socket?.close();browser.kill();}
