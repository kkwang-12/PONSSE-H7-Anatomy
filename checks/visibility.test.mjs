import assert from 'node:assert/strict';
import {visibilityMath as m} from '../src/visibility.mjs';

const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const sum=polys=>polys.reduce((s,p)=>s+Math.abs(m.area(p)),0);
assert.equal(sum(m.subtract(rect(0,0,10,10),rect(2,2,5,5))),75);
assert.equal(sum(m.subtract(rect(0,0,10,10),rect(10,0,5,5))),100);
assert.equal(m.subtract(rect(0,0,10,10),rect(-1,-1,12,12)).length,0);
assert.equal(m.subtract(rect(0,0,10,10),rect(20,20,1,1)).length,1);
let seed=1234567;
const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
for(let i=0;i<500;i++){
  const x=random()*20-5,y=random()*20-5,w=random()*8+.01,h=random()*8+.01;
  const overlap=Math.max(0,Math.min(10,x+w)-Math.max(0,x))*Math.max(0,Math.min(10,y+h)-Math.max(0,y));
  assert.ok(Math.abs(sum(m.subtract(rect(0,0,10,10),rect(x,y,w,h)))-(100-overlap))<1e-6);
}
let fragments=[rect(0,0,100,100)];
for(let i=0;i<50;i++)fragments=fragments.flatMap(p=>m.subtract(p,rect(1+i%10*9,1+Math.floor(i/10)*18,2,2)));
assert.ok(Math.abs(sum(fragments)-9800)<1e-6);
assert.ok(fragments.length<500,'Disjoint cutouts must not cause redundant polygon fragmentation');
console.log('Visibility math passed · 500 area-conservation cases, touching edges, complete cover, disjoint cutouts');
