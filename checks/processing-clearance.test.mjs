import assert from 'node:assert/strict';
import {buildGeometry} from '../src/geometry.mjs';
import {buildProcessingGeometry} from '../src/processing-geometry.mjs';
import {processingStateAt,woodRadius} from '../src/processing-model.mjs';
import {processingPoses,rigPoint} from '../src/processing-rig.mjs';
const data=buildProcessingGeometry(buildGeometry().parts);
const meshes=data.meshes.filter(m=>m.assembly!=='wood');
// Use exact byte offsets rather than the Node buffer pool when decoding floats.
for(const m of meshes){const b=Buffer.from(m.vertices,'base64');m.v=new Float32Array(b.buffer,b.byteOffset,b.byteLength/4);}
const failureMap=new Map();let samples=0;
const times=[0,1.5,3,4.5,5,8.4,12,14.75,16.8,19,23,25.75,27.8,28,29.4,29.8,30.2,30.6,31];
for(const time of times){const s=processingStateAt(time),rig=processingPoses(data.joints,s),woods=[...s.pieces,{...s.remaining,centreY:s.centreY}];
 for(const m of meshes){const def=data.joints[m.group];if(['wood','branch','chain'].includes(def.kind))continue;
  const tolerance=m.material==='tooth'?6.2:def.kind==='wheel'?3:def.kind==='knife'?1.5:.6;
  for(let i=0;i<m.v.length;i+=18){const w=rigPoint(rig.poses[m.group],Array.from(m.v.slice(i,i+3))),p=[w[0],w[2]-134,22-w[1]];
   for(const wood of woods){const u=p[2]+wood.feed-wood.offset[2],start=wood.from+(wood.from>0?5.2:0),end=wood.to-(wood.to<790?5.2:0);if(u<=start+.1||u>=end-.1)continue;
    if(m.group==='sawBlade'&&s.sawShare>0&&Math.abs(p[2])<6)continue;
    const radius=woodRadius(u),distance=Math.hypot(p[0]-wood.offset[0],p[1]-wood.centreY-s.placement-wood.offset[1]);samples++;
    if(distance<radius-tolerance){const key=m.group+'|'+m.material,penetration=radius-distance;if(!failureMap.has(key)||failureMap.get(key).penetration<penetration)failureMap.set(key,{time,group:m.group,assembly:m.assembly,material:m.material,penetration,point:p,wood:wood.id});}
   }
  }
 }
}
const failures=[...failureMap.values()];console.log(JSON.stringify({sampledVertices:samples,failures},null,2));
assert.equal(failures.length,0,'forbidden machine/stem penetration');
