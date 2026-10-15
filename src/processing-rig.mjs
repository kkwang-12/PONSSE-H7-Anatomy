export const rigIdentity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export function rigMultiply(a,b){const c=Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)c[j*4+i]+=a[k*4+i]*b[j*4+k];return c;}
export function rigPoint(m,p){return [0,1,2].map(i=>m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]+m[12+i]);}
export function rigTranslate(p){const m=rigIdentity();m[12]=p[0];m[13]=p[1];m[14]=p[2];return m;}
export function rigRotation(axis,a){const [x,y,z]=axis,c=Math.cos(a),s=Math.sin(a),v=1-c;return [x*x*v+c,y*x*v+z*s,z*x*v-y*s,0,x*y*v-z*s,y*y*v+c,z*y*v+x*s,0,x*z*v+y*s,y*z*v-x*s,z*z*v+c,0,0,0,0,1];}
export function rigHinge(p,axis,a){return rigMultiply(rigTranslate(p),rigMultiply(rigRotation(axis,a),rigTranslate(p.map(v=>-v))));}
export const BODY_POSE=[1,0,0,0,0,0,1,0,0,-1,0,0,0,22,134,1];
export function rigLink(a,b){const v=b.map((x,i)=>x-a[i]),l=Math.hypot(...v),z=v.map(x=>x/l);
  const seed=Math.abs(z[2])<.9?[0,0,1]:[0,1,0],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  let x=cross(seed,z);const n=Math.hypot(...x);x=x.map(v=>v/n);const y=cross(z,x);
  return [x[0],x[1],x[2],0,y[0],y[1],y[2],0,v[0],v[1],v[2],0,...a,1];
}
function knifeClearance(angle,sign,centre){let min=Infinity;const pivot=[sign*56,24,0];
  const m=rigHinge(pivot,[0,0,1],sign*angle);let previous=null;
  for(let i=0;i<=24;i++){
    const a=((sign<0?180:0)+((sign<0?85:95)-(sign<0?180:0))*i/24)*Math.PI/180;
    const p=rigPoint(m,[40.2*Math.cos(a),90+40.2*Math.sin(a),0]);
    if(previous){const dx=p[0]-previous[0],dy=p[1]-previous[1],u=Math.max(0,Math.min(1,(-previous[0]*dx+(centre-previous[1])*dy)/(dx*dx+dy*dy)));
      min=Math.min(min,Math.hypot(previous[0]+u*dx,previous[1]+u*dy-centre));}
    previous=p;
  }return min;
}
export function knifeContactAngle(radius,sign,centre){let a=-.2,b=.4;for(let i=0;i<30;i++){const m=(a+b)/2;if(knifeClearance(m,sign,centre)>radius)a=m;else b=m;}return (a+b)/2;}
export function processingPoses(joints,state){
  const poses={},local={},actuators={};
  for(const [id,d] of Object.entries(joints)){
    let m=rigIdentity();
    if(d.kind==='knife'){
      const closed=knifeContactAngle(state.radii[d.radiusKey],d.sign,state.centreY);
      m=rigHinge(d.pivot,[0,0,1],d.sign*(closed-state.open*1.08));
    }else if(d.kind==='feed'){
      const r=state.radii.feed,k=state.centreY-27,R=Math.hypot(58,k),beta=Math.atan2(k,58);
      const effective=38-.1*(40-r),a=Math.acos(Math.max(-1,Math.min(1,(r+effective-20)/R)))-beta-state.open*1.08;
      m=rigHinge(d.pivot,[0,0,1],d.sign*a);
    }else if(d.kind==='inboard')m=rigTranslate([0,state.centreY-state.radii[d.radiusKey]-d.r-d.openTravel*state.open,0]);
    else if(d.kind==='wheel')m=rigMultiply(local[d.parent],rigHinge(d.pivot,d.axis,state.wheels[d.wheel]));
    else if(d.kind==='saw')m=rigHinge(d.pivot,[0,0,1],state.sawAngle);
    else if(d.kind==='feedLink'){
      const parent=d.sign<0?'feedL':'feedR',A=[d.sign*58,27,188],B=rigPoint(local[parent],[d.sign*78,90,170]);m=rigLink(A,B);
    }else if(d.kind==='bracket')m=rigLink(d.A,rigPoint(local[d.parent],d.B));
    else if(d.kind==='actuator'){
      const B=rigPoint(local[d.parent],d.B),length=Math.hypot(...B.map((v,i)=>v-d.A[i]));
      actuators[id]={A:d.A,B,length,barrel:d.barrel,extension:length-d.barrel};
    }else if(d.kind==='cylinderPart'){
      const a=actuators[d.actuator],dir=a.B.map((v,i)=>(v-a.A[i])/a.length);
      if(d.part==='PinA')m=rigTranslate(a.A);else if(d.part==='PinB')m=rigTranslate(a.B);
      else if(d.part==='Barrel'){
        const end=a.A.map((v,i)=>v+dir[i]);m=rigLink(a.A,end);
      }else{const start=a.A.map((v,i)=>v+dir[i]*a.barrel);m=rigLink(start,a.B);}
    }
    local[id]=m;poses[id]=d.kind==='support'?m:rigMultiply(BODY_POSE,m);
  }
  return {poses,local,actuators};
}
