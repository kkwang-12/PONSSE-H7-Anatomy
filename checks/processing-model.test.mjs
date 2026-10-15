import assert from 'node:assert/strict';
import {PROCESS,PROCESS_STEPS,PROCESS_BRANCHES,processingStateAt as state,feedAt,woodRadius} from '../src/processing-model.mjs';
import {processingPoses,rigPoint,knifeContactAngle} from '../src/processing-rig.mjs';
import {buildGeometry} from '../src/geometry.mjs';
import {buildProcessingGeometry} from '../src/processing-geometry.mjs';

assert.equal(PROCESS_STEPS.length,9);assert.equal(PROCESS.length,PROCESS.lengths.reduce((a,b)=>a+b,0)+PROCESS.remainder);
assert.equal(state(31).cuts,2);assert.equal(state(14.749).cuts,0);assert.equal(state(14.75).cuts,1);assert.equal(state(25.749).cuts,1);assert.equal(state(25.75).cuts,2);
assert.deepEqual(state(31).pieces.map(p=>[p.from,p.to]),[[0,240],[240,440]]);assert.equal(state(31).remaining.to-state(31).remaining.from,350);
assert.equal(state(5).placement,0);assert.equal(state(3).feed,0);assert.equal(state(4).wheels.left,0);
let previous=state(0),samples=0;
for(let i=0;i<=3100;i++){
 const s=state(i/100);assert.ok(s.feed>=previous.feed-1e-8);assert.ok(s.velocity>=-1e-8);
 if(s.velocity>1e-8){assert.equal(s.sawHome,true);assert.equal(s.clamped,true);}
 if(s.sawShare>0){assert.equal(s.velocity,0);assert.equal(s.clamped,true);}
 if(s.time>28){assert.equal(s.sawHome,true);assert.equal(s.feed,440);}
 const intervals=[...s.pieces,s.remaining].sort((a,b)=>a.from-b.from);let at=0;
 for(const p of intervals){assert.equal(p.from,at);assert.ok(p.to>p.from);at=p.to;}assert.equal(at,790);
 for(const b of s.branches){assert.equal(b.cut,s.time>=b.cutTime);if(b.cut)assert.ok(s.feed>=b.cutFeed-1e-8);}
 assert.deepEqual(state(s.time),s);previous=s;samples++;
}
for(const t of [5,6,10,12,17,18,21,23]){
 const a=state(t-1e-6),b=state(t+1e-6);assert.ok(Math.abs(a.feed-b.feed)<.001);assert.ok(Math.abs(a.velocity-b.velocity)<.001);
}
for(const t of [7,9,10.5,18.6,22]){
 const h=1e-5,derivative=(feedAt(t+h).distance-feedAt(t-h).distance)/(2*h);assert.ok(Math.abs(derivative-state(t).velocity)<1e-5);
}
for(const t of [12.2,13,14.75,15.8,16.8])assert.deepEqual(state(t).wheels,state(12).wheels);
assert.deepEqual(state(31),state(999));assert.equal(state(-2).time,0);assert.equal(state(NaN).time,0);
assert.ok(PROCESS_BRANCHES.some(b=>b.cutTime>31));assert.ok(state(31).branches.some(b=>b.cut));
// Every point of each cross section lies inside the saw's radial and angular sweep.
for(const time of [14.75,25.75]){
 const s=state(time),radius=woodRadius(s.feed),centre=[0,s.centreY];
 for(let i=0;i<360;i++){
   const a=i*Math.PI/180,p=[centre[0]+radius*Math.cos(a),centre[1]+radius*Math.sin(a)],dx=p[0]-PROCESS.sawPivot[0],dy=p[1]-PROCESS.sawPivot[1];
   assert.ok(Math.hypot(dx,dy)<147);assert.ok(Math.atan2(dy,dx)<PROCESS.through);assert.ok(Math.atan2(dy,dx)>PROCESS.stowed);
 }
}
const processing=buildProcessingGeometry(buildGeometry().parts);
let minExtension=Infinity;
for(let i=0;i<=124;i++){
 const s=state(i/4),r=processingPoses(processing.joints,s);
 for(const [id,a] of Object.entries(r.actuators)){
   assert.ok(a.extension>0);assert.ok(a.extension<100);minExtension=Math.min(minExtension,a.extension);
   const end=rigPoint(r.local[id+'Rod'],[0,0,1]),start=rigPoint(r.local[id+'Rod'],[0,0,0]),gland=rigPoint(r.local[id+'Barrel'],[0,0,a.barrel]);
   for(let k=0;k<3;k++){assert.ok(Math.abs(end[k]-a.B[k])<1e-8);assert.ok(Math.abs(start[k]-gland[k])<1e-8);}
 }
 for(const [id,def] of Object.entries(processing.joints)){
   assert.ok(r.poses[id].every(Number.isFinite));
   if(def.kind==='knife'){
     const pivot=rigPoint(r.local[id],def.pivot);for(let k=0;k<3;k++)assert.ok(Math.abs(pivot[k]-def.pivot[k])<1e-8);
   }
 }
}
assert.ok(state(31).remaining.to-state(31).remaining.from>280,'remainder must still span the clamp stations');
console.log(JSON.stringify({passed:true,timelineSamples:samples,branches:PROCESS_BRANCHES.length,minCylinderExtension:minExtension,...processing.stats}));
