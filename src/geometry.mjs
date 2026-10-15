import * as k from '../vendor/kit/iso-kit.mjs';
import * as G from '../vendor/kit/lathe.mjs';
import * as A from '../vendor/kit/audit.mjs';
import { assemblies, order } from './model.mjs';

export function buildGeometry() {
  const W = 1000, H = 900;
  const P = k.fitProjection([[-280, -240, -116], [280, 260, -116], [-240, -160, 478], [240, 180, 478]], W, H, { pad: 75, azimuth: 66, elevation: 22 });
  const R = A.recorder(P, { order, ground: s => s.owner === 'frame' });
  const byId = Object.fromEntries(assemblies.map(a => [a.id, a]));
  const offsets={knifeL:[0,22,0],knifeR:[0,22,0],lower:[0,22,0],feedL:[0,28,0],feedR:[0,28,0],measure:[0,7,0],cover:[0,-48,0],rotator:[0,0,2],saw:[0,25,-21]};
  const fz = (o = [0,0,0]) => G.frameOf(o, [0,0,1], [1,0,0], [0,1,0]);
  const fy = (o = [0,0,0]) => G.frameOf(o, [0,1,0], [1,0,0], [0,0,-1]);
  const front = (o = [0,0,0]) => G.frameOf(o, [0,1,0], [1,0,0], [0,0,1]);
  const at = p => k.iso(p, P);
  const meta = (id, name) => ({ name: `${id}.${name}`, owner: id });
  function put(id, name, shape, paths, centre, material = 'steel', inner = '') {
    const unique = R.nameFor(`${id}.${name}`);
    const offset=offsets[id]??[0,0,0],delta=at(offset),origin=at([0,0,0]);
    shape=A.moved(shape,offset);shape.name=unique;
    const svg=`<g transform="translate(${delta[0]-origin[0]} ${delta[1]-origin[1]})">${k.solidSvg(paths, { className: `mat-${material}`, crease: 'lo', inner })}</g>`;
    R.put({ name: unique, piece: id, at: G.add3(centre,offset), move: byId[id].move, svg, shapes: [R.solid(shape)] });
  }
  function slab(id, name, x, y, w, d, z, h, mat = 'steel', r = 1.5) {
    const plan = { x,y,w,d,r };
    put(id, name, A.slab(plan,z,h,meta(id,name)), k.slabOf(plan,z,h,P,5,.5), [x+w/2,y+d/2,z+h/2], mat);
  }
  function prism(id, name, F, poly, s0, s1, mat = 'steel') {
    const paths = G.prismOf(F, poly,s0,s1,P);
    const mean = poly.reduce((s,p) => [s[0]+p[0]/poly.length,s[1]+p[1]/poly.length],[0,0]);
    const mid = G.add3(F.o,G.add3(G.mul3(F.a,(s0+s1)/2),G.add3(G.mul3(F.u,mean[0]),G.mul3(F.v,mean[1]))));
    put(id,name,A.prism(F,poly,s0,s1,meta(id,name)),paths,mid,mat);
  }
  function round(id, name, o, axis, r, len, mat = 'steel', r1 = r) {
    const F = G.frameAlong(o,axis);
    const profile = [[0,r],[len,r1]];
    put(id,name,A.solid(F,profile,meta(id,name)),G.solidOf(profile,F,P,{ bevel:.3 }),G.add3(o,G.mul3(F.a,len/2)),mat);
    return F;
  }
  function ring(id,name,F,s0,s1,ri,ro,mat='metal') {
    put(id,name,A.ring(F,s0,s1,ri,ro,meta(id,name)),G.ringBand(s0,s1,ri,ro,F,P),G.add3(F.o,G.mul3(F.a,(s0+s1)/2)),mat);
  }
  function boltFace(id,name,o,axis,r=2.3) {
    const F=G.frameAlong(o,axis);
    const hex=Array.from({length:6},(_,i)=>[r*Math.cos(i*Math.PI/3),r*Math.sin(i*Math.PI/3)]);
    prism(id,name,F,hex,0,1.7,'metal');
  }
  function bolts(id,F,s,r,n,head=1.7) {
    for(let i=0;i<n;i++) boltFace(id,'bolt',G.pointOf(F,s,r,i*2*Math.PI/n),F.a,head);
  }
  function faceMark(F,s,poly,cls='recess') {
    const pts=poly.map(([x,y])=>at(G.add3(F.o,G.add3(G.mul3(F.a,s),G.add3(G.mul3(F.u,x),G.mul3(F.v,y))))));
    return `<path class="${cls}" d="${k.pathOf(pts,true)}"/>`;
  }
  function attachToLast(markup) { const last=R.items[R.items.length-1],o=offsets[last.piece]??[0,0,0],d=at(o),zero=at([0,0,0]);last.svg += `<g transform="translate(${d[0]-zero[0]} ${d[1]-zero[1]})">${markup}</g>`; }
  function link(id,name,a,b,width,thick,mat='steel') {
    const axis=G.unit3(G.sub3(b,a)),F=G.frameAlong(a,axis),len=G.len3(G.sub3(b,a));
    prism(id,name,F,[[-width/2,-thick/2],[width/2,-thick/2],[width/2,thick/2],[-width/2,thick/2]],0,len,mat);
  }
  function cylinder(id,a,b,rad=6) {
    const axis=G.unit3(G.sub3(b,a)),L=G.len3(G.sub3(b,a)),body=L*.63;
    round(id,'actuator barrel',a,axis,rad,body,'steel');
    const sleeve=G.frameAlong(a,axis);
    ring(id,'barrel end collar',sleeve,0,1.5,rad,rad+.7,'metal');
    ring(id,'gland retaining ring',sleeve,body-2,body,rad,rad+.8,'metal');
    round(id,'gland',G.add3(a,G.mul3(axis,body)),axis,rad+.7,2,'metal');
    round(id,'rod',G.add3(a,G.mul3(axis,body+2)),axis,rad*.42,L-body-2,'chrome');
    for(const p of [a,b]) {
      round(id,'clevis pin',G.add3(p,[0,-3,0]),[0,1,0],rad*.65,6,'metal');
      round(id,'clevis retaining washer',G.add3(p,[0,3,0]),[0,1,0],rad*.78,1.2,'metal');
      boltFace(id,'clevis locking screw',G.add3(p,[0,4.2,0]),[0,1,0],rad*.43);
    }
  }
  const cheek=[[-17,36],[15,36],[24,65],[18,105],[26,130],[21,190],[28,220],[22,275],[5,291],[-17,270]];
  for(const sign of [-1,1]) {
    const poly=cheek.map(([x,z])=>[sign*(x+47),z]);
    prism('frame','sculpted cheek',front(),poly,-16,3);
    slab('frame','bearing boss',sign<0?-67:47,3,20,12.5,150,42);
    for(const z of [58,112,206,266]) boltFace('frame','cheek fastener',[sign*53,4,z],[0,1,0],2.6);
    slab('frame','lower foot',sign<0?-75:45,-22,30,47,29,10);
    prism('frame','triangular gusset',front(),[[sign*45,135],[sign*70,150],[sign*45,168]],-26,-16);
  }
  slab('frame','upper crossmember',-61,-25,122,25,267,21);
  slab('frame','middle bridge',-48,-22,96,13,177,14);
  slab('frame','lower bridge',-51,-22,102,28,35,17);
  slab('frame','rear spine',-19,-37,38,13,51,215);
  for(const z of [88,136,225]) slab('frame','rear mounting plate',-38,-40,76,4,z,14);
  for(const side of [-1,1]) {
    const upperZ=side<0?228:210,lowerZ=side<0?52:36;
    round('frame','upper knife pedestal',[side*56,24,upperZ],[0,0,1],10,8);
    round('frame','lower knife pedestal',[side*56,24,lowerZ],[0,0,1],10,8);
    slab('frame','upper knife mounting lug',side*56-10,3,20,21,upperZ,8);
    slab('frame','lower knife mounting lug',side*56-10,3,20,21,lowerZ,8);
  }
  prism('frame','fixed top knife',fz(),[[-40,8],[40,8],[37,28],[18,44],[-18,44],[-37,28]],274,280,'metal');
  for(let z=60;z<265;z+=28) {
    slab('frame','spine rib',-24,-38,48,13,z,3.5);
  }
  for(const side of [-1,1]) for(const z of [94,130,214,260]) {
    const F=front([side*53,0,z]);
    prism('frame','inspection flange',F,[[-7,-7],[5,-7],[8,-3],[8,6],[-7,6]],3,4.5,'steel');
    const inset=Array.from({length:16},(_,i)=>[3.5*Math.cos(i*Math.PI/8),3.5*Math.sin(i*Math.PI/8)]);
    attachToLast(faceMark(F,4.55,inset,'recess'));
    for(const dx of [-5,5]) boltFace('frame','flange screw',[side*53+dx,4.5,z+4],[0,1,0],1);
  }
  slab('frame','hydraulic manifold',-15,-24,30,10,222,24,'steel');
  for(const x of [-8,8]) for(const z of [228,240]) {
    const F=round('frame','manifold port',[x,-14,z],[0,1,0],3.7,3,'metal');
    ring('frame','port collar',F,1,3,3.7,4.5,'metal');
    boltFace('frame','port plug',[x,-11,z],[0,1,0],2.4);
  }
  for(const x of [-10,10]) boltFace('frame','manifold mount',[x,-14,224],[0,1,0],1.6);
  for(const side of [-1,1]) {
    const poly=[[side*57,63],[side*75,85],[side*75,305],[side*58,329],[side*49,310],[side*55,288]];
    prism('tilt','tilt upright',front(),poly,-69,-55);
    round('tilt','lower tilt pivot',[side*57,-56,78],[0,1,0],10,40,'metal');
    boltFace('tilt','pivot cap',[side*57,-56,78],[0,-1,0],5);
    cylinder('tilt',[side*68,-51,112],[side*63,-41,278],6);
    for(const z of [98,292]) boltFace('tilt','frame fastener',[side*65,-55,z],[0,1,0],3);
  }
  prism('tilt','arched upper crossbar',front(),[[-75,304],[-53,333],[53,333],[75,304],[52,308],[39,319],[-39,319],[-52,308]],-69,-55);
  slab('tilt','lower cross tie',-57,-69,114,14,66,11);
  round('rotator','lower flange',[0,-62,331],[0,0,1],27,6,'metal');
  round('rotator','rotator body',[0,-62,337],[0,0,1],22,33,'steel');
  for(const z of [341,349,366]) ring('rotator','body band',fz([0,-62,0]),z,z+2.3,22,23,'metal');
  bolts('rotator',fz([0,-62,0]),370,18,10,1.8);
  round('rotator','upper neck',[0,-62,370],[0,0,1],14,13,'metal');
  for(const side of [-1,1]) {
    prism('rotator','suspension ear',front(),[[side*5,382],[side*15,382],[side*18,401],[side*14,411],[side*6,411]],-67,-57);
  }
  round('rotator','top cross pin',[-18,-62,402],[1,0,0],4.2,36,'chrome');
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6;
    slab('rotator','motor fin',Math.cos(a)*23-1,-62+Math.sin(a)*23-1,2,2,350,12,'metal',.2);
  }
  const rotaryFace=front([0,-39,353]);
  prism('rotator','rotator inspection plate',rotaryFace,[[-7,-5],[7,-5],[7,5],[-7,5]],0,1,'steel');
  for(const x of [-5,5]) boltFace('rotator','inspection plate screw',[x,-38,353],[0,1,0],1.1);
  const hoodPoly=[[-68,235],[-68,277],[-49,302],[33,301],[59,281],[68,245],[57,235]];
  prism('cover','back service shell',front(),hoodPoly,-85,-75,'yellow');
  const vents=[];
  for(let i=0;i<7;i++) {
    const x=-34+i*10;
    vents.push(faceMark(front(),-74.95,[[x+.6,278],[x+5.4,278],[x+6,278.6],[x+6,288.4],[x+5.4,289],[x+.6,289],[x,288.4],[x,278.6]],'recess'));
  }
  attachToLast(vents.join(''));
  for(const side of [-1,1]) {
    const F=G.frameOf([side*65,0,0],[side,0,0],[0,1,0],[0,0,1]);
    prism('cover','side shell',F,[[-75,235],[-75,277],[-49,300],[-26,282],[-24,247]],0,3.5,'yellow');
    const inset=[[-70,246],[-69,272],[-49,287],[-32,276],[-32,251]];
    attachToLast(faceMark(F,3.55,inset,'panel-inset'));
    for(const y of [-65,-37]) boltFace('cover','cover screw',[side*68.5,y,249],[side,0,0],1.8);
    slab('cover','cover mounting tab',side*65-4,-24,8,3,249,12,'yellow');
  }
  slab('cover','top ridge',-45,-75,86,30,299,3,'yellow');
  const BF=front([0,-74.8,0]);
  const tp=at([0,-74.6,260]);
  attachToLast(`<text class="machine-label" x="${tp[0]}" y="${tp[1]}" transform="rotate(9 ${tp[0]} ${tp[1]})">PONSSE H7</text>`);
  function roller(id,sign) {
    const x=sign*98,z=170;
    const F=fy([x,18,z]);
    link(id,'swing arm',[sign*58,-1,188],[x,12,z],23,15);
    round(id,'drive motor',[x,-6,z],[0,1,0],19,24,'steel');
    const rear=G.frameAlong([x,-6,z],[0,-1,0]);
    ring(id,'drive end cover',rear,0,1.5,5,19,'metal');
    bolts(id,rear,1.5,14,8,1.6);
    ring(id,'motor end flange',F,0,4,6,24,'metal');
    round(id,'roller drum',[x,22,z],[0,1,0],39,30,'rubber',37);
    for(const s of [5,30]) ring(id,'drum lip',F,s,s+2.8,32,40.5,'metal');
    round(id,'roller face',[x,52,z],[0,1,0],33.5,3,'steel');
    const near=fy([x,55,z]);
    let holes='';
    for(let i=0;i<10;i++) {
      const a=i*Math.PI/5;
      const poly=Array.from({length:8},(_,j)=>[Math.cos(a)*24+Math.cos(j*Math.PI/4)*4.8,Math.sin(a)*24+Math.sin(j*Math.PI/4)*5.7]);
      holes+=faceMark(near,.1,poly,'recess');
    }
    attachToLast(holes);
    ring(id,'face hub ring',near,0,3.5,7,15,'metal');
    ring(id,'rim wear ring',near,0,.7,32,33.5,'metal');
    round(id,'axle cap',[x,58.5,z],[0,1,0],7,2.5,'steel');
    ring(id,'hub dust seal',near,3.5,4.2,7,9,'rubber');
    for(let i=0;i<4;i++) boltFace(id,'hub cap screw',[x+4*Math.cos(i*Math.PI/2),61,z+4*Math.sin(i*Math.PI/2)],[0,1,0],.85);
    bolts(id,near,.05,18,8,1.7);
    for(let row=0;row<3;row++) for(let i=0;i<20;i++) {
      const a=(i+row*.45)*Math.PI/10;
      const radial=[Math.cos(a),0,Math.sin(a)];
      const radius=39-(4+row*10)/15;
      const o=[x+radius*radial[0],26+row*10,z+radius*radial[2]];
      round(id,'traction tooth',o,radial,2.9,5.8,'metal',.6);
    }
    const guard=front([x,0,z]);
    const start=sign>0?-76:104,stop=sign>0?76:256;
    for(let a=start;a<stop;a+=19) {
      const b=Math.min(a+19,stop),R0=45,R1=48;
      const c=t=>Math.cos(t*Math.PI/180),s=t=>Math.sin(t*Math.PI/180);
      prism(id,'roller guard',guard,[[R0*c(a),R0*s(a)],[R1*c(a),R1*s(a)],[R1*c(b),R1*s(b)],[R0*c(b),R0*s(b)]],12,18,'yellow');
    }
    for(const angle of (sign>0?[-45,45]:[135,225])) {
      const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
      link(id,'guard support',[x+17*c,15,z+17*s],[x+46*c,15,z+46*s],4,4,'yellow');
      boltFace(id,'guard fastener',[x+46*c,18,z+46*s],[0,1,0],2.3);
    }
    cylinder(id,[sign*95,-4,220],[sign*105,4,185],5);
    link(id,'actuator support',[sign*95,-4,220],[sign*98,12,170],8,8,'steel');
  }
  roller('feedL',-1); roller('feedR',1);
  function knife(id,sign,z,lower=false) {
    const x=sign*56;
    round(id,'knife pivot',[x,2,z-12],[0,0,1],9,25,'yellow');
    ring(id,'knife bearing',fz([x,2,0]),z+13,z+15,3,10,'metal');
    round(id,'pin cap',[x,2,z+15],[0,0,1],4.6,2.5,'metal');
    ring(id,'pivot foot collar',fz([x,2,0]),z-12,z-9,9,10.6,'metal');
    round(id,'grease nipple',[x,2,z+17.5],[0,0,1],1.25,2.5,'metal',.8);
    boltFace(id,'pivot locking screw',[x+5,2,z+15],[0,0,1],1.3);
    const inner=[],outer=[];
    const cx=sign*8,cy=18;
    const a0=sign>0?-16:196,a1=sign>0?84:84;
    const n=16;
    for(let i=0;i<=n;i++) {
      const a=(a0+(a1-a0)*i/n)*Math.PI/180;
      const r=47-i*.7;
      outer.push([cx+(r+10-i*.35)*Math.cos(a),cy+(r+10-i*.35)*Math.sin(a)]);
      inner.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);
    }
    const blade=[...outer,...inner.slice().reverse()];
    put(id,'curved knife',A.extruded(blade,z,12,meta(id,'curved knife')),k.extrude(blade,z,12,P,{convex:false}),[sign*36,28,z+6],'yellow');
    const lip=[...inner,...inner.map((p,i)=>[p[0]+(outer[i][0]-p[0])*.17,p[1]+(outer[i][1]-p[1])*.17]).reverse()];
    put(id,'honed edge',A.extruded(lip,z+12,.7,meta(id,'honed edge')),k.extrude(lip,z+12,.7,P,{convex:false}),[sign*35,30,z+12.35],'metal');
    link(id,'knife root',[x,2,z+4],[sign*55,14,z+4],17,8,'yellow');
    cylinder(id,[sign*24,-5,z-8],[sign*63,5,z-7],4.2);
    slab(id,'actuator port saddle',sign*24-2.5,-9,5,4,z-10,4,'steel',.4);
    boltFace(id,'actuator coupling',[sign*24,-9,z-8],[0,-1,0],2.2);
    if(!lower) for(const y of [2,17]) boltFace(id,'blade carrier bolt',[x,y,z+10],[0,0,1],2.2);
  }
  knife('knifeL',-1,248); knife('knifeR',1,230);
  knife('lower',-1,72,true);knife('lower',1,56,true);
  for(const [z,r] of [[104,20],[198,16]]) {
    const F=G.frameAlong([-22,14,z],[1,0,0]);
    round('measure','inboard drum',[-22,14,z],[1,0,0],r,44,'rubber');
    for(let row=0;row<6;row++) for(let i=0;i<16;i++) {
      const a=i*Math.PI/8,rad=[0,Math.cos(a),Math.sin(a)];
      round('measure','inboard tooth',[-19+row*7,14+r*rad[1],z+r*rad[2]],rad,1.4,2.8,'metal',.4);
    }
    for(const s of [-1,1]) round('measure','drum shaft',[s*22,14,z],[s,0,0],5,10,'metal');
    for(const s of [-1,1]) slab('measure','drum bracket',s<0?-35:26,-2,9,18,z-13,26,'steel');
    for(const s of [-1,1]) slab('measure','bracket mounting tab',s<0?-35:26,-4,9,2,z-13,26,'steel');
  }
  round('measure','measuring wheel',[-6,30,159],[1,0,0],13,12,'metal');
  round('measure','measuring wheel bearing housing',[-15,30,159],[1,0,0],7,9,'steel');
  const wheelF=G.frameOf([-6,30,159],[1,0,0],[0,1,0],[0,0,1]);
  ring('measure','wheel bearing cover',wheelF,12,14,3,9,'metal');
  bolts('measure',wheelF,14,6.2,6,.95);
  round('measure','wheel axle end',[8,30,159],[1,0,0],3,1.7,'steel');
  for(let i=0;i<24;i++) {
    const a=i*Math.PI/12,b=a+.12;
    const poly=[[13*Math.cos(a),13*Math.sin(a)],[15*Math.cos(a+.015),15*Math.sin(a+.015)],[15*Math.cos(b-.015),15*Math.sin(b-.015)],[13*Math.cos(b),13*Math.sin(b)]];
    prism('measure','measurement wheel flute',wheelF,poly,0,12,'metal');
  }
  link('measure','measuring swing link',[-15,5,134],[-15,30,159],7,5);
  slab('measure','encoder enclosure',-24,2,15,12,135,14);
  const encoderFace=front([-16.5,0,142]);
  ring('measure','encoder end cover',encoderFace,14,16,1.5,6,'metal');
  for(let i=0;i<6;i++) boltFace('measure','encoder cover screw',[-16.5+4.8*Math.cos(i*Math.PI/3),16,142+4.8*Math.sin(i*Math.PI/3)],[0,1,0],.7);
  round('measure','encoder cable gland',[-24,8,142],[-1,0,0],2.5,4.5,'metal');
  round('measure','grease fitting',[-15,30,166],[0,0,1],1.1,2.2,'metal',.6);
  cylinder('measure',[-12,5,180],[-12,14,151],2.5);
  slab('saw','base carrier',-78,-20,156,68,13,8);
  for(const x of [-67,67]) slab('saw','lower frame tab',x-5,-20,10,68,0,13);
  slab('saw','motor housing',-91,0,42,54,21,29,'steel',4);
  const driveCover=front([-69,54,35]);
  ring('saw','saw drive bearing seat',driveCover,0,2,4,13,'metal');
  ring('saw','drive seal ring',driveCover,2,3,5,10.5,'rubber');
  round('saw','drive end cap',[-69,57,35],[0,1,0],8,1,'metal');
  bolts('saw',driveCover,2,10.7,8,1.15);
  boltFace('saw','bearing lock plug',[-69,58,35],[0,1,0],3);
  slab('saw','tensioner mounting bracket',-49,22,4,8,24,5,'steel',.6);
  round('saw','chain tension piston',[-47,26,29],[1,0,0],3.6,13,'steel');
  round('saw','tension piston rod',[-34,26,29],[1,0,0],1.5,7,'chrome');
  ring('saw','tensioner gland',G.frameAlong([-47,26,29],[1,0,0]),11,13,3.6,4.2,'metal');
  slab('saw','bar clamping shoe',-32,22,7,8,24,8.6,'steel',.6);
  for(const x of [-30,-42]) boltFace('saw','bar clamping nut',[x,26,32.6],[0,0,1],2.4);
  round('saw','saw motor',[-69,20,50],[0,0,1],13,12,'steel');
  bolts('saw',fz([-69,20,0]),62,9,6,1.8);
  const bar=[[-68,26],[-64,15],[62,15],[75,19],[80,26],[76,34],[65,38],[-64,38]];
  prism('saw','guide bar',fz(),bar,21,24,'metal');
  const chain=bar.map(([x,y])=>[x+(x<0?-1:1),y+(y<26?-1:1)]);
  const chainPath=k.pathOf(chain.map(([x,y])=>at([x,y,24.3])),true);
  attachToLast(`<path d="${chainPath}" class="chain-track"/>`);
  const v=[];
  for(let i=0;i<28;i++) v.push([-60+i*4.4,14.3]);
  for(let i=0;i<28;i++) v.push([-60+i*4.4,38.7]);
  for(const [x,y] of v) slab('saw','chain cutter',x,y-1,1.7,2,24,1.4,'steel',.1);
  round('saw','nose rivet',[71,26,24],[0,0,1],2.2,.6,'steel');
  slab('saw','saw cover',-93,-1,44,3,26,23,'steel');
  for(const x of [-85,-57]) for(const z of [30,44]) boltFace('saw','cover bolt',[x,2.3,z],[0,1,0],1.8);
  for(const x of [-45,-15,15,45]) slab('saw','lower guard rib',x,-18,5,11,2,11,'steel',.4);
  for(const x of [-35,15,55]) {
    slab('saw','carrier mounting boss',x-4,-11,8,8,21,4,'steel',.6);
    boltFace('saw','carrier mounting bolt',[x,-7,25],[0,0,1],2);
  }
  return { P,W,H,R,parts:R.items,assemblies,at };
}
