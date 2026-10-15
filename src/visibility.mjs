import * as G from '../vendor/kit/lathe.mjs';
import {iso,pathOf,cameraOf} from '../vendor/kit/iso-kit.mjs';

const EPS=1e-8;
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function half(p,A,B,C) {
  const length=Math.hypot(A,B);
  if(length<1e-12)return C>=0?p:[];
  A/=length;B/=length;C/=length;
  const out=[];
  for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length],da=A*a[0]+B*a[1]+C,db=A*b[0]+B*b[1]+C;
    if(da>=-EPS)out.push(a);
    if((da>EPS&&db<-EPS)||(da<-EPS&&db>EPS)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  const clean=out.filter((p,i)=>Math.hypot(p[0]-out[(i+out.length-1)%out.length][0],p[1]-out[(i+out.length-1)%out.length][1])>1e-7);
  return clean.length>=3&&Math.abs(area(clean))>1e-7?clean:[];
}
function subtract(poly,clip) {
  let inside=poly;const outside=[];
  const ccw=area(clip)>0?clip:clip.slice().reverse();
  let intersection=poly;
  for(let i=0;i<ccw.length&&intersection.length;i++){
    const a=ccw[i],b=ccw[(i+1)%ccw.length],A=a[1]-b[1],B=b[0]-a[0],C=-(A*a[0]+B*a[1]);
    if(Math.abs(A)+Math.abs(B)<EPS)continue;
    intersection=half(intersection,A,B,C);
  }
  if(!intersection.length)return [poly];
  for(let i=0;i<ccw.length&&inside.length;i++){
    const a=ccw[i],b=ccw[(i+1)%ccw.length],A=a[1]-b[1],B=b[0]-a[0],C=-(A*a[0]+B*a[1]);
    if(Math.abs(A)+Math.abs(B)<EPS)continue;
    const cut=half(inside,-A,-B,-C);if(cut.length)outside.push(cut);
    inside=half(inside,A,B,C);
  }
  return outside;
}
function triangulate(poly) {
  const clean=poly.filter((p,i)=>Math.hypot(p[0]-poly[(i+poly.length-1)%poly.length][0],p[1]-poly[(i+poly.length-1)%poly.length][1])>1e-7);
  const p=area(clean)>0?clean:clean.slice().reverse();
  const indices=p.map((_,i)=>i),out=[];
  let attempts=0;
  while(indices.length>3&&attempts++<p.length*p.length){
    let found=false;
    for(let j=0;j<indices.length;j++){
      const a=indices[(j+indices.length-1)%indices.length],b=indices[j],c=indices[(j+1)%indices.length];
      if(cross(p[a],p[b],p[c])<EPS)continue;
      if(indices.some(i=>i!==a&&i!==b&&i!==c&&cross(p[a],p[b],p[i])>=-EPS&&cross(p[b],p[c],p[i])>=-EPS&&cross(p[c],p[a],p[i])>=-EPS))continue;
      out.push([p[a],p[b],p[c]]);indices.splice(j,1);found=true;break;
    }
    if(!found){const j=indices.findIndex((b,j)=>Math.abs(cross(p[indices[(j+indices.length-1)%indices.length]],p[b],p[indices[(j+1)%indices.length]]))<1e-7);if(j>=0){indices.splice(j,1);continue;}throw new Error('Cannot triangulate a mechanical profile '+JSON.stringify(p));}
  }
  if(indices.length===3)out.push(indices.map(i=>p[i]));
  return out;
}
function plane(points) {
  const [a,b,c]=points,d=cross(a,b,c);
  if(Math.abs(d)<EPS)return null;
  const A=((b[2]-a[2])*(c[1]-a[1])-(c[2]-a[2])*(b[1]-a[1]))/d;
  const B=((b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]))/d;
  return [A,B,a[2]-A*a[0]-B*a[1]];
}
function mesh(shape,P) {
  const faces=[],V=G.viewOf(P),scale=cameraOf(P).k;
  const add=(points,normal)=>{if(G.dot3(normal,V)>EPS){const clean=points.filter((p,i)=>G.len3(G.sub3(p,points[(i+points.length-1)%points.length]))>1e-7);if(clean.length>=3)faces.push(clean)}};
  const {F}=shape;
  if(shape.kind==='body'){
    const poly=shape.poly,rm=Math.max(...poly.map(p=>p[1])),steps=Math.max(12,Math.min(72,Math.ceil(Math.sqrt(Math.max(1,rm*scale)))*10));
    for(let i=0;i<poly.length;i++){
      const [s0,r0]=poly[i],[s1,r1]=poly[(i+1)%poly.length];
      if(Math.hypot(s1-s0,r1-r0)<EPS||Math.max(r0,r1)<EPS)continue;
      if(Math.abs(s1-s0)<EPS&&Math.min(r0,r1)<EPS){const r=Math.max(r0,r1),n=G.mul3(F.a,r1>r0?-1:1);add(Array.from({length:steps},(_,j)=>G.pointOf(F,s0,r,j*Math.PI*2/steps)),n);continue;}
      for(let j=0;j<steps;j++){
        const a=j*Math.PI*2/steps,b=(j+1)*Math.PI*2/steps;
        const n=G.add3(G.mul3(F.a,-(r1-r0)),G.mul3(G.radialOf(F,(a+b)/2),s1-s0));
        if(G.dot3(n,V)<=EPS)continue;
        const q=[G.pointOf(F,s0,r0,a),G.pointOf(F,s1,r1,a),G.pointOf(F,s1,r1,b),G.pointOf(F,s0,r0,b)];
        add(q,n);
      }
    }
  }else if(shape.kind==='prism'){
    const poly=area(shape.poly)>0?shape.poly:shape.poly.slice().reverse();
    const p=(v,s)=>G.add3(F.o,G.add3(G.mul3(F.a,s),G.add3(G.mul3(F.u,v[0]),G.mul3(F.v,v[1]))));
    const convex=poly.every((v,i)=>cross(v,poly[(i+1)%poly.length],poly[(i+2)%poly.length])>=-EPS);
    for(const [s,n] of [[shape.s0,G.mul3(F.a,-1)],[shape.s1,F.a]])if(G.dot3(n,V)>EPS){if(convex)add(poly.map(v=>p(v,s)),n);else for(const tri of triangulate(poly))add(tri.map(v=>p(v,s)),n);}
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],n=G.add3(G.mul3(F.u,b[1]-a[1]),G.mul3(F.v,a[0]-b[0]));
      const q=[p(a,shape.s0),p(b,shape.s0),p(b,shape.s1),p(a,shape.s1)];
      add(q,n);
    }
  }else throw new Error('Visibility mesh does not support '+shape.kind);
  return faces.map(points=>{
    const projected=points.map(p=>[...iso(p,P),G.dot3(p,V)]),z=plane(projected);
    if(!z)return null;
    const poly=projected.map(p=>p.slice(0,2));
    return {poly,z,box:[Math.min(...poly.map(p=>p[0])),Math.min(...poly.map(p=>p[1])),Math.max(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[1]))]};
  }).filter(Boolean);
}

export function visibleClips(items,P) {
  const byAssembly=new Map(),clips=new Map(),stats={faces:0,fragments:0,assemblies:0};
  for(const [i,item] of items.entries()){
    if(!byAssembly.has(item.piece))byAssembly.set(item.piece,[]);
    for(const shape of item.shapes)for(const face of mesh(shape,P))byAssembly.get(item.piece).push({...face,item:i});
  }
  const size=18;
  for(const [id,faces] of byAssembly){
    const grid=new Map();
    const keys=box=>{const out=[];for(let x=Math.floor(box[0]/size);x<=Math.floor(box[2]/size);x++)for(let y=Math.floor(box[1]/size);y<=Math.floor(box[3]/size);y++)out.push(x+','+y);return out;};
    faces.forEach((f,i)=>{for(const key of keys(f.box)){if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);}});
    for(const [i,f] of faces.entries()){
      let pieces=[f.poly];
      const candidates=new Set(keys(f.box).flatMap(key=>grid.get(key)??[]));
      const sorted=[...candidates].sort((a,b)=>Math.abs(area(faces[b].poly))-Math.abs(area(faces[a].poly)));
      for(const j of sorted){
        if(j===i)continue;const g=faces[j];
        if(g.item===f.item)continue;
        if(f.box[0]>=g.box[2]||f.box[2]<=g.box[0]||f.box[1]>=g.box[3]||f.box[3]<=g.box[1])continue;
        let [A,B,C]=g.z.map((z,i)=>z-f.z[i]);
        const same=Math.abs(A)<1e-7&&Math.abs(B)<1e-7&&Math.abs(C)<.001;
        if(same){if(g.item<f.item)continue;A=0;B=0;C=1;}
        else C-=.002;
        if(g.poly.every(p=>A*p[0]+B*p[1]+C<=EPS))continue;
        const occluder=half(g.poly,A,B,C);
        if(!occluder.length)continue;
        pieces=pieces.flatMap(p=>subtract(p,occluder));
        if(pieces.length>20000)throw new Error('Excessive visibility fragments in '+id+' / '+items[f.item].name);
        if(!pieces.length)break;
      }
      if(pieces.length){if(!clips.has(f.item))clips.set(f.item,[]);clips.get(f.item).push(...pieces);stats.fragments+=pieces.length;}
    }
    stats.faces+=faces.length;stats.assemblies++;
    console.log(`visible surfaces · ${id} · ${faces.length} faces`);
  }
  return {clips:new Map([...clips].map(([i,polys])=>[i,polys.map(p=>pathOf(p,true)).join('')])),stats};
}
export const visibilityMath={half,subtract,area,triangulate};
