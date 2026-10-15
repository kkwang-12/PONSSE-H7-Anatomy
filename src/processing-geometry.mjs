import {visibilityMath} from './visibility.mjs';
import {PROCESS_BRANCHES,woodRadius} from './processing-model.mjs';
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/(Math.hypot(...a)||1));
function point(F,p,s){return add(F.o,add(mul(F.a,s),add(mul(F.u,p[0]),mul(F.v,p[1]))));}

// Full closed meshes, before camera clipping: rotating parts retain their backs.
export function solidMesh(shape){
  const vertices=[],edges=[];
  function polygon(points,normal){
    if(points.length<3)return;
    let q=points.filter((p,i)=>Math.hypot(...sub(p,points[(i+points.length-1)%points.length]))>1e-7);
    if(q.length<3)return;
    if(dot(cross(sub(q[1],q[0]),sub(q[2],q[0])),normal)<0)q=q.slice().reverse();
    for(let i=1;i<q.length-1;i++)for(const p of [q[0],q[i],q[i+1]])vertices.push(...p,...normal);
  }
  function edge(a,b){edges.push(...a,...b);}
  const F=shape.F;
  if(shape.kind==='prism'){
    const poly=shape.poly;
    for(const tri of visibilityMath.triangulate(poly)){
      polygon(tri.map(p=>point(F,p,shape.s0)),mul(F.a,-1));
      polygon(tri.map(p=>point(F,p,shape.s1)),F.a);
    }
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      const n=unit(add(mul(F.u,b[1]-a[1]),mul(F.v,a[0]-b[0])));
      // Profile winding is normalised independently from its cap triangulation.
      const signed=poly.reduce((s,p,j)=>s+p[0]*poly[(j+1)%poly.length][1]-poly[(j+1)%poly.length][0]*p[1],0);
      polygon([point(F,a,shape.s0),point(F,b,shape.s0),point(F,b,shape.s1),point(F,a,shape.s1)],mul(n,signed<0?-1:1));
      edge(point(F,a,shape.s0),point(F,b,shape.s0));edge(point(F,a,shape.s1),point(F,b,shape.s1));
      const before=poly[(i+poly.length-1)%poly.length],v1=unit([a[0]-before[0],a[1]-before[1],0]),v2=unit([b[0]-a[0],b[1]-a[1],0]);
      if(dot(v1,v2)<.985)edge(point(F,a,shape.s0),point(F,a,shape.s1));
    }
  }else if(shape.kind==='body'){
    const maxR=Math.max(...shape.poly.map(p=>p[1])),n=maxR>25?64:maxR>8?40:16;
    const radial=a=>add(mul(F.u,Math.cos(a)),mul(F.v,Math.sin(a)));
    const p=(s,r,a)=>add(F.o,add(mul(F.a,s),mul(radial(a),r)));
    for(let i=0;i<shape.poly.length;i++){
      const [s0,r0]=shape.poly[i],[s1,r1]=shape.poly[(i+1)%shape.poly.length];
      if(Math.hypot(s1-s0,r1-r0)<1e-8||Math.max(r0,r1)<1e-8)continue;
      for(let j=0;j<n;j++){
        const a=j*Math.PI*2/n,b=(j+1)*Math.PI*2/n;
        const normal=unit(add(mul(F.a,-(r1-r0)),mul(radial((a+b)/2),s1-s0)));
        polygon([p(s0,r0,a),p(s1,r1,a),p(s1,r1,b),p(s0,r0,b)],normal);
        if(r0>0)edge(p(s0,r0,a),p(s0,r0,b));
      }
    }
  }else throw new Error('Unsupported processing solid '+shape.kind);
  return {vertices,edges};
}
const vertical={o:[0,0,0],a:[0,0,1],u:[1,0,0],v:[0,1,0]};
function prism(poly,z,h){return {kind:'prism',F:vertical,poly,s0:z,s1:z+h};}
function cylinder(o,a,r,h,r1=r){const u=unit(cross(Math.abs(a[2])<.9?[0,0,1]:[0,1,0],a)),v=cross(a,u);return {kind:'body',F:{o,a,u,v},poly:[[0,0],[0,r],[h,r1],[h,0]]};}
function box(x,y,z,w,d,h){return prism([[x,y],[x+w,y],[x+w,y+d],[x,y+d]],z,h);}

export function buildProcessingGeometry(parts){
  const buckets=new Map(),joints={},labels={};let sourceOwner=null;
  const ownerFor=id=>id.startsWith('frontL')?'knifeL':id.startsWith('frontR')?'knifeR':id.startsWith('rear')?'lower':id.startsWith('feedL')||id==='feedArm-1'?'feedL':id.startsWith('feedR')||id==='feedArm1'?'feedR':/inboard|measure/.test(id)?'measure':id.startsWith('saw')?'saw':id==='support'||id.startsWith('tilt')?'tilt':'frame';
  const group=(id,definition)=>{joints[id]=definition;return id;};
  group('body',{kind:'static'});group('support',{kind:'support'});
  function put(shape,id='body',mat='steel',shift=[0,0,0]){
    const m=solidMesh(shape),assembly=sourceOwner||ownerFor(id),key=id+'|'+mat+'|'+assembly;
    if(!buckets.has(key))buckets.set(key,{group:id,material:mat,assembly,v:[],e:[]});const b=buckets.get(key);
    for(let i=0;i<m.vertices.length;i+=6)b.v.push(m.vertices[i]+shift[0],m.vertices[i+1]+shift[1],m.vertices[i+2]+shift[2],...m.vertices.slice(i+3,i+6));
    for(let i=0;i<m.edges.length;i+=3)b.e.push(m.edges[i]+shift[0],m.edges[i+1]+shift[1],m.edges[i+2]+shift[2]);
  }
  const baseMat=p=>p.svg.match(/mat-([a-z]+)/)?.[1]||'steel';
  const actuatorWords=/actuator barrel|barrel end collar|gland retaining ring|\.gland|\.rod|clevis|actuator port|actuator coupling/;
  const knifeDefs=[['knifeL','frontL',-1,248],['knifeR','frontR',1,230],['lower','rearL',-1,72],['lower','rearR',1,56]];
  for(const [,id,sign,z] of knifeDefs){
    group(id,{kind:'knife',sign,z,pivot:[sign*56,24,z+4],radiusKey:id});labels[id]=id.startsWith('front')?'前打枝刀':'后打枝刀';
  }
  for(const [id,sign] of [['feedL',-1],['feedR',1]]){
    group(id,{kind:'feed',sign,pivot:[sign*58,27,188]});group(id+'Spin',{kind:'wheel',parent:id,axis:[0,1,0],pivot:[sign*78,90,170],wheel:sign<0?'left':'right'});
  }
  for(const [id,z,r] of [['inboardLower',104,20],['inboardUpper',198,16],['measureWheel',159,15]]){
    group(id+'Mount',{kind:'inboard',z,r,radiusKey:id==='inboardLower'?'lower':id==='inboardUpper'?'upper':'measure',openTravel:id==='measureWheel'?16:0});
    group(id,{kind:'wheel',parent:id+'Mount',axis:[1,0,0],pivot:[0,0,z],wheel:id==='inboardLower'?'lower':id==='inboardUpper'?'upper':'measure'});
  }
  group('sawBlade',{kind:'saw',pivot:[-69,35,1.5]});
  for(const p of parts){
    sourceOwner=p.piece;
    const s=p.shapes[0],name=p.name,mat=/traction tooth|inboard tooth/.test(p.name)?'tooth':baseMat(p);
    if(p.piece==='rotator'||p.piece==='tilt'){
      if(p.piece==='tilt'&&(actuatorWords.test(name)||/lower tilt pivot|pivot cap/.test(name)))continue;
      put(s,'support',mat);continue;
    }
    if(['knifeL','knifeR','lower'].includes(p.piece)){
      if(/curved knife|honed edge|knife root|blade carrier bolt/.test(name)||actuatorWords.test(name))continue;
      put(s,'body',mat);continue;
    }
    if(p.piece==='feedL'||p.piece==='feedR'){
      const sign=p.piece==='feedL'?-1:1;
      if(/swing arm|actuator support/.test(name)||actuatorWords.test(name))continue;
      const spin=/roller drum|drum lip|roller face|face hub ring|rim wear ring|axle cap|hub dust seal|hub cap screw|traction tooth/.test(name)||(/\.bolt/.test(name)&&s.F.o[1]>65);
      put(s,p.piece+(spin?'Spin':''),mat,[-sign*20,25,0]);continue;
    }
    if(p.piece==='measure'){
      if(actuatorWords.test(name)||/measuring swing link|drum bracket|bracket mounting tab|encoder enclosure|encoder end cover|encoder cover screw|encoder cable gland|grease fitting/.test(name))continue;
      const z=s.F.o[2],lower=Math.abs(z-104)<35,upper=Math.abs(z-198)<30;
      let id=lower?'inboardLower':upper?'inboardUpper':'measureWheel';
      if(/measuring wheel|wheel bearing|wheel axle|measurement wheel flute/.test(name))id='measureWheel';
      const originalY=id==='measureWheel'?37:21;
      const spin=/inboard drum|inboard tooth|measuring wheel$|measurement wheel flute/.test(name);
      put(s,id+(spin?'':'Mount'),mat,[0,-originalY,0]);continue;
    }
    if(p.piece==='saw'){
      if(/base carrier/.test(name))continue;
      if(/chain cutter/.test(name))continue; // Individual cutters follow the closed chain path below.
      const moving=/guide bar|nose rivet|tensioner|tension piston|bar clamping/.test(name);
      const lift=!moving&&/motor housing|saw drive|drive seal|drive end|bearing lock|saw motor|saw cover|cover bolt|\.bolt/.test(name)?8:0;
      put(s,moving?'sawBlade':'body',mat,[0,moving?-16:-10,lift]);continue;
    }
    put(s,'body',mat,name==='frame.fixed top knife'?[0,6,0]:[0,0,0]);
  }
  sourceOwner='saw';
  // U carrier leaves a real opening for the stem, rather than hiding a solid plate.
  put(box(-78,-5,-8,156,30,8));
  put(cylinder([-69,35,3],[0,0,1],6,34),'body','metal');
  for(const sign of [-1,1]){
    sourceOwner=null;
    // The body pitches about the lower cross-axis; suspension stays upright.
    put(box(sign<0?-65:49,-56,68,16,40,20));
    sourceOwner='tilt';
    put(cylinder([sign<0?-73:45,-56,78],[1,0,0],10,28),'support','metal');
    put(cylinder([sign*75,-56,78],[sign,0,0],5,2),'support','metal');
    put(box(sign<0?-86:65,-59,106,21,12,12),'support');
    put(box(sign<0?-86:54,-41,273,32,16,10),'body');
    group('tiltActuator'+sign,{kind:'actuator',parent:'body',A:[sign*82,-22,73],B:[sign*82,-41,278],barrel:125});
    sourceOwner=null;
    put(box(sign<0?-78:65,25,-8,13,95,8));
    put(cylinder([sign*58,15,188],[0,1,0],8,12),'body','metal');
    put(box(sign*78-5,75,176,10,13,15),sign<0?'feedL':'feedR');
    group('feedArm'+sign,{kind:'feedLink',sign});put(box(-11.5,-7.5,0,23,15,1),'feedArm'+sign);
    for(const [s,r] of [[0,9],[1,7]])put(cylinder([sign*58,27+s,188],[0,1,0],r,2),'body','metal');
    // The original front face's ten recessed apertures, now true attached decals.
    const id=sign<0?'feedLSpin':'feedRSpin',x=sign*78;
    for(let i=0;i<10;i++){
      const a=i*Math.PI/5,poly=Array.from({length:8},(_,j)=>[x+24*Math.cos(a)+4.8*Math.cos(j*Math.PI/4),170+24*Math.sin(a)+5.7*Math.sin(j*Math.PI/4)]);
      put({kind:'prism',F:{o:[0,110.15,0],a:[0,1,0],u:[1,0,0],v:[0,0,1]},poly,s0:0,s1:.1},id,'recess');
    }
  }
  for(const [,id,sign,z] of knifeDefs){
    const a0=sign<0?180:0,a1=sign<0?85:95,inner=[],outer=[];
    for(let i=0;i<=24;i++){const a=(a0+(a1-a0)*i/24)*Math.PI/180;inner.push([40.2*Math.cos(a),90+40.2*Math.sin(a)]);outer.push([(50.2-i*.19)*Math.cos(a),90+(50.2-i*.19)*Math.sin(a)]);}
    put(prism([...outer,...inner.slice().reverse()],z,12),id);
    const lip=inner.map((p,i)=>p.map((v,k)=>v+(outer[i][k]-v)*.15));
    put(prism([...inner,...lip.slice().reverse()],z+12,.7),id,'metal');
    put(prism([[sign*64,23],[sign*48,23],[sign*43,88],[sign*54,92]],z+1,8),id);
    put(box(sign*61-4,41,z-10,8,8,12),id);
    put(box(sign<0?-44:20,3,z-13,24,15,10));
    for(const y of [43,60])put(cylinder([sign*(56-(y-24)*.2),y,z+9],[0,0,1],2.2,2),id,'metal');
    group(id+'Actuator',{kind:'actuator',parent:id,A:[sign*24,15,z-8],B:[sign*61,45,z-7],barrel:25});
  }
  for(const [id,sign] of [['feedL',-1],['feedR',1]])group(id+'Actuator',{kind:'actuator',parent:id,A:[sign*70,0,226],B:[sign*78,82,185],barrel:42});
  group('measureActuator',{kind:'actuator',parent:'measureWheelMount',A:[-12,5,180],B:[-12,-7,151],barrel:17});
  put(box(-16,-9,174,8,17,12));
  put(box(-16,-9,150,8,11,7),'measureWheelMount');
  for(const id of ['inboardLower','inboardUpper','measureWheel']){
    const d=joints[id+'Mount'];
    for(const sign of [-1,1]){
      const x=sign*(id==='measureWheel'?13:30);
      group(id+'Bracket'+sign,{kind:'bracket',parent:id+'Mount',A:[x,3,d.z-14],B:[x,0,d.z]});
      put(box(-3,-3,0,6,6,1),id+'Bracket'+sign);
    }
  }
  sourceOwner='measure';put(box(-24,2,135,15,12,14));
  for(let i=0;i<6;i++)put(cylinder([-16.5+4.8*Math.cos(i*Math.PI/3),16,142+4.8*Math.sin(i*Math.PI/3)],[0,1,0],.7,1),'body','metal');
  sourceOwner=null;
  // Render actuator barrel, gland, rod, and both pin ends as separate meshes.
  for(const [id,d] of Object.entries(joints))if(d.kind==='actuator'){
    for(const suffix of ['Barrel','Rod','PinA','PinB'])group(id+suffix,{kind:'cylinderPart',actuator:id,part:suffix});
    put(cylinder([0,0,0],[0,0,1],d.barrel>30?5:4.2,d.barrel),id+'Barrel');
    put(cylinder([0,0,d.barrel-1],[0,0,1],d.barrel>30?6:5,2),id+'Barrel','metal');
    put(cylinder([0,0,0],[0,0,1],2,1),id+'Rod','chrome');
    for(const suffix of ['PinA','PinB']){
      put(cylinder([0,-4,0],[0,1,0],3.2,8),id+suffix,'metal');
      put(cylinder([0,4,0],[0,1,0],4,1.1),id+suffix,'metal');
    }
  }
  // Chain cutters move along this same capsule as the chain, not with the shell.
  const chain=[];const x0=-61,x1=68,cy=35,r=12;
  for(let i=0;i<36;i++)chain.push([x0+(x1-x0)*i/36,cy-r,3.4]);
  for(let i=0;i<16;i++){const a=-Math.PI/2+i*Math.PI/16;chain.push([x1+r*Math.cos(a),cy+r*Math.sin(a),3.4]);}
  for(let i=0;i<36;i++)chain.push([x1-(x1-x0)*i/36,cy+r,3.4]);
  for(let i=0;i<16;i++){const a=Math.PI/2+i*Math.PI/16;chain.push([x0+r*Math.cos(a),cy+r*Math.sin(a),3.4]);}
  sourceOwner='saw';group('chainTooth',{kind:'chain'});put(box(-1,-1.7,0,2,3.4,1.6),'chainTooth','metal');
  sourceOwner='wood';
  for(const [id,from,to] of [['woodWhole',0,790],['woodRest1',240,790],['woodRest2',440,790],['log1',0,240],['log2',240,440]]){
    group(id,{kind:'wood',from,to});
    // Display the saw kerf at the two nominal cut coordinates. Material IDs and
    // measured lengths remain in the common nominal coordinate system.
    const start=from>0?from+5.2:from,end=to<790?to-5.2:to;
    put({kind:'body',F:vertical,poly:[[start,0],[start,woodRadius(start)],[end,woodRadius(end)],[end,0]]},id,'wood');
    const b=buckets.get(id+'|wood|wood');
    for(const cap of [start,end])for(const fraction of [.18,.36,.55,.76,.94])for(let j=0;j<64;j++){
      const r=woodRadius(cap)*fraction,a=j*Math.PI/32,c=(j+1)*Math.PI/32,z=cap+(cap===start?-.03:.03);
      b.e.push(r*Math.cos(a),r*Math.sin(a),z,r*Math.cos(c),r*Math.sin(c),z);
    }
    for(let j=0;j<22;j++)for(let k=0;k<24;k++){
      const u0=start+(end-start)*k/24,u1=start+(end-start)*(k+1)/24;
      const p=u=>{const a=j*Math.PI/11+.025*Math.sin(u*.037+j);return [(woodRadius(u)+.04)*Math.cos(a),(woodRadius(u)+.04)*Math.sin(a),u];};
      b.e.push(...p(u0),...p(u1));
    }
  }
  for(const b of PROCESS_BRANCHES){
    const r=woodRadius(b.u),axis=unit([Math.cos(b.angle),Math.sin(b.angle),.28]);
    const root=[r*Math.cos(b.angle),r*Math.sin(b.angle),b.u];
    for(const suffix of ['Full','Stump']){
      group(b.id+suffix,{kind:'branch',branch:b.id,stump:suffix==='Stump'});
      put(cylinder(root,axis,3.2,suffix==='Full'?b.length:2.5,suffix==='Full'?1.1:2.4),b.id+suffix,'wood');
      if(suffix==='Full'){
        const fork=add(root,mul(axis,b.length*.62));
        put(cylinder(fork,unit(add(axis,[.2,-.1,.9])),1.4,18,.3),b.id+suffix,'wood');
      }
    }
  }
  const pack=values=>Buffer.from(new Float32Array(values).buffer).toString('base64');
  const meshes=[...buckets.values()].map(b=>({group:b.group,material:b.material,assembly:b.assembly,vertices:pack(b.v),edges:pack(b.e),count:b.v.length/6,edgeCount:b.e.length/3}));
  return {joints,meshes,chain,labels,stats:{sourceSolids:parts.length,groups:Object.keys(joints).length,triangles:meshes.reduce((s,m)=>s+m.count/3,0)}};
}
