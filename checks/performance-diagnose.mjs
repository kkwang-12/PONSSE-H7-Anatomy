import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromePort} from '../vendor/scripts/chrome-port.mjs';
const profile=mkdtempSync(join(tmpdir(),'h7-perf-'));
const chrome=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--do-not-de-elevate','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--allow-file-access-from-files','about:blank']);
const results={environment:{browser:'Headless Edge',viewport:'1100x1250',deviceScaleFactor:1},runs:[]};
let ws;
try{
 const port=await chromePort(chrome,profile);
 const page=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
 ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let id=0;const pending=new Map();let trace=[];let traceDone;
 ws.onmessage=e=>{const v=JSON.parse(e.data);if(v.id){pending.get(v.id)?.(v);pending.delete(v.id);}else if(v.method==='Tracing.dataCollected')trace.push(...v.params.value);else if(v.method==='Tracing.tracingComplete')traceDone?.();};
 const send=(method,params={})=>new Promise((r,j)=>{const n=++id;pending.set(n,v=>v.error?j(Error(JSON.stringify(v.error))):r(v.result));ws.send(JSON.stringify({id:n,method,params}));});
 const ev=async expression=>{const v=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(v.exceptionDetails)throw Error(v.exceptionDetails.exception?.description??v.exceptionDetails.text);return v.result.value;};
 await send('Page.enable');await send('Performance.enable');await send('Emulation.setDeviceMetricsOverride',{width:1100,height:1250,deviceScaleFactor:1,mobile:false});
 for(const mode of (process.argv.slice(2).length?process.argv.slice(2):['baseline','fixed-viewbox','no-clips','scaling-strokes','hidden-svg','selection-churn'])){
  await send('Page.navigate',{url:pathToFileURL(resolve('checks/performance-before.html')).href});
  for(let n=0;n<100;n++){if(await ev('!!window.h7Demo'))break;await new Promise(r=>setTimeout(r,100));}
  await ev('new Promise(r=>setTimeout(r,500))');
  if(mode==='baseline')results.dom=await ev(`(()=>{const paths=[...document.querySelectorAll('svg path')];const clips=[...document.querySelectorAll('clipPath path')];return {nodes:document.querySelectorAll('*').length,svgNodes:document.querySelectorAll('svg *').length,paths:paths.length,clipPaths:clips.length,clipBytes:clips.reduce((n,p)=>n+p.getAttribute('d').length,0),clipCommands:clips.reduce((n,p)=>n+(p.getAttribute('d').match(/[MLZCQAHVST]/gi)||[]).length,0),nonScalingStrokePaths:paths.filter(p=>getComputedStyle(p).vectorEffect==='non-scaling-stroke').length,solids:document.querySelectorAll('.iso-solid').length}})()`);
  await ev(`(()=>{const svg=document.querySelector('#machine');if('${mode}'==='fixed-viewbox'){const set=svg.setAttribute.bind(svg);svg.setAttribute=(n,v)=>{if(n!=='viewBox')set(n,v)};}if('${mode}'==='no-clips')document.querySelectorAll('[clip-path]').forEach(e=>e.removeAttribute('clip-path'));if('${mode}'==='scaling-strokes'){const s=document.createElement('style');s.textContent='.iso-svg path,.iso-svg circle{vector-effect:none!important}';document.head.append(s);}if('${mode}'==='hidden-svg')svg.style.visibility='hidden';if('${mode}'==='idle-control')h7Demo.draw=()=>{};if('${mode}'==='detached-svg')document.querySelectorAll('.part').forEach(e=>e.remove());})()`);
  const before=await send('Performance.getMetrics');
  if(mode==='baseline'){trace=[];await send('Tracing.start',{categories:'devtools.timeline',transferMode:'ReportEvents'});}
  const measurement=await ev(`new Promise(resolve=>{const d=h7Demo;cancelAnimationFrame(d.state.frame);d.state.frame=0;let n=0,prev=0;const intervals=[],script=[];function frame(now){if(prev)intervals.push(now-prev);prev=now;d.state.progress=(1-Math.cos(n/89*Math.PI*2))/2;const t=performance.now();if('${mode}'==='selection-churn')d.select(d.assemblies[n%11].id);else d.draw();script.push(performance.now()-t);if(++n<90)requestAnimationFrame(frame);else{const q=(a,p)=>[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*p)];resolve({frames:n,elapsedMs:intervals.reduce((s,x)=>s+x,0),averageFps:1000/(intervals.reduce((s,x)=>s+x,0)/intervals.length),frameMedianMs:q(intervals,.5),frameP95Ms:q(intervals,.95),over33ms:intervals.filter(x=>x>33.5).length,scriptMedianMs:q(script,.5),scriptP95Ms:q(script,.95)});}}requestAnimationFrame(frame);})`);
  if(mode==='baseline'){const done=new Promise(r=>traceDone=r);await send('Tracing.end');await done;const totals={};for(const e of trace)if(e.ph==='X'&&e.dur)totals[e.name]=(totals[e.name]||0)+e.dur/1000;results.traceMs=Object.fromEntries(Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,25));}
  const after=await send('Performance.getMetrics');const old=Object.fromEntries(before.metrics.map(m=>[m.name,m.value]));const metrics=Object.fromEntries(after.metrics.filter(m=>/Duration|Count$/.test(m.name)).map(m=>[m.name,Number((m.value-(old[m.name]||0)).toFixed(4))]));
  const result={mode,...measurement,metrics};results.runs.push(result);console.log(JSON.stringify(result));
 }
 writeFileSync(process.argv.length>2?'checks/performance-control.json':'checks/performance-diagnosis.json',JSON.stringify(results,null,2));console.log(JSON.stringify({dom:results.dom,traceMs:results.traceMs}));
}finally{ws?.close();chrome.kill();}
