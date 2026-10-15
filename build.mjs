import { readFileSync, writeFileSync, mkdirSync,existsSync } from 'node:fs';
import {createHash} from 'node:crypto';
import * as k from './vendor/kit/iso-kit.mjs';
import * as A from './vendor/kit/audit.mjs';
import { buildGeometry } from './src/geometry.mjs';
import { order, poseAt } from './src/model.mjs';
import {visibleClips} from './src/visibility.mjs';
import {renderPage} from './src/page.mjs';
import {buildProcessingGeometry} from './src/processing-geometry.mjs';

const { P,W,H,R,parts,assemblies,at }=buildGeometry();
const light=!process.argv.includes('--dark');
mkdirSync('checks',{recursive:true});
const signature=createHash('sha256').update(JSON.stringify({P,shapes:parts.map(p=>p.shapes)})).update(readFileSync('src/visibility.mjs')).digest('hex');
const cacheFile='checks/visibility-cache.json';
let visibility=existsSync(cacheFile)?JSON.parse(readFileSync(cacheFile,'utf8')):null;
if(visibility?.signature!==signature){const result=visibleClips(parts,P);visibility={signature,clips:Object.fromEntries(result.clips),stats:result.stats};writeFileSync(cacheFile,JSON.stringify(visibility));}
for(const [i,p] of parts.entries())p.svg=`<defs><clipPath id="surface-${i}" clipPathUnits="userSpaceOnUse"><path d="${visibility.clips[i]??''}"/></clipPath></defs><g clip-path="url(#surface-${i})">${p.svg}</g>`;
const C=A.recorder(P,{order,ground:R.ground});
C.solids=R.solids;
for(const a of assemblies){
  const group=parts.filter(p=>p.piece===a.id);
  C.put({name:a.id,piece:a.id,at:a.anchor,move:a.move,svg:group.map(p=>p.svg).join(''),shapes:group.flatMap(p=>p.shapes)});
}
const depthStates=[0,.25,.5,.75,1].map(p=>({shares:Object.fromEntries(assemblies.map(a=>[a.id,poseAt(p,a.id)]))}));
A.settle(C,P,{states:depthStates,step:.25});
for(const p of parts)p.key=C.items.find(g=>g.piece===p.piece).key;
if(process.argv.includes('--audit')) {
  console.log(`Checking ${parts.length} solid parts in ${assemblies.length} assemblies`);
  const frames=Array.from({length:21},(_,i)=>({shares:Object.fromEntries(assemblies.map(a=>[a.id,poseAt(i/20,a.id)]))}));
  A.auditOrExit(C,P,{frames});
}
parts.sort((a,b)=>a.key-b.key);
const renderParts=C.items.slice().sort((a,b)=>a.key-b.key).map(g=>`<g class="assembly" data-assembly="${g.piece}">${parts.filter(p=>p.piece===g.piece).map(p=>`<g class="part" data-piece="${p.piece}">${p.svg}</g>`).join('')}</g>`).join('');
const data=parts.map(p=>({ piece:p.piece,key:p.key,move:p.move, screen:[at(p.move)[0]-P.origin[0],at(p.move)[1]-P.origin[1]],depth:k.depthOf(p.move,P) }));
const processing=buildProcessingGeometry(parts);
const css=readFileSync('src/style.css','utf8')+'\n'+readFileSync('src/processing.css','utf8');
const namespace=(file,name,exports)=>`const ${name}=(()=>{${readFileSync(file,'utf8').replace(/export /g,'')}\nreturn {${exports}};})();`;
const modelRuntime=namespace('src/processing-model.mjs','H7ProcessingModel','PROCESS,PROCESS_STEPS,PROCESS_BRANCHES,processClamp,processEase,woodRadius,feedAt,timeForFeed,sideRollerAngle,processingStateAt');
const rigRuntime=namespace('src/processing-rig.mjs','H7ProcessingRig','rigIdentity,rigMultiply,rigPoint,rigTranslate,rigRotation,rigHinge,rigLink,BODY_POSE,knifeContactAngle,processingPoses');
const runtime=[modelRuntime,rigRuntime,...['src/raster.js','src/processing-renderer.js','src/live.js','src/processing-ui.js'].map(f=>readFileSync(f,'utf8'))].join('\n');
const html=renderPage({light,renderParts,config:{P,W,H,assemblies,order,parts:data,processing},kitCSS:k.ISO_CSS,css,runtime});
writeFileSync(light?'index.html':'index-dark.html',html);
mkdirSync('checks',{recursive:true});
writeFileSync('checks/geometry-manifest.json',JSON.stringify({assemblies:assemblies.map(({id,name,move})=>({id,name,move})),solids:parts.length,projection:P,partsByAssembly:Object.fromEntries(assemblies.map(a=>[a.id,parts.filter(p=>p.piece===a.id).length]))},null,2));
console.log(`Built ${light?'index.html':'index-dark.html'} · ${assemblies.length} assemblies · ${parts.length} solid parts · ${(Buffer.byteLength(html)/1024).toFixed(0)} KiB`);
console.log(`Visibility · ${visibility.stats.faces} mesh faces · ${visibility.stats.fragments} exposed polygons · ${C.settled.solved.cycles.length} interlocked assembly pairs`);
console.log('Processing · '+JSON.stringify(processing.stats));
