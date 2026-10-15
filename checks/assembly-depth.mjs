import {buildGeometry} from '../src/geometry.mjs';
import * as A from '../vendor/kit/audit.mjs';
const {R,P,assemblies}=buildGeometry();
const items=assemblies.map(a=>({name:a.id,piece:a.id,ride:a.id,move:a.move,key:0,shapes:R.items.filter(p=>p.piece===a.id).flatMap(p=>p.shapes)}));
const hits=A.overlapsOf(items,P,{states:[0,.25,.5,.75,1],step:.5});
console.log(hits.pairs.filter(p=>p.front.every(f=>f.area>=hits.least)).map(p=>({a:items[p.a].name,b:items[p.b].name,state:p.state,areas:p.front.map(f=>f.area)})));
