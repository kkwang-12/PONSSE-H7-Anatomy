function createProcessingRenderer(canvas,data,onResize) {
  const {rigIdentity:I,rigMultiply:mul,rigPoint:point,rigTranslate:translate,rigRotation:rotation,BODY_POSE,processingPoses}=H7ProcessingRig;
  const {processingStateAt,woodRadius,PROCESS_BRANCHES}=H7ProcessingModel;
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,preserveDrawingBuffer:true});
  if(!gl)throw new Error('当前浏览器未启用 WebGL2；请使用支持 WebGL2 的浏览器。结构展示仍可使用。');
  const light=document.body.dataset.theme==='light';
  const vertex=`#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aNormal;
  uniform mat4 uModel,uWork,uVP;uniform vec2 uPixels;uniform float uOutline,uLine;
  out vec3 vNormal,vOriginalNormal,vWork;
  void main(){vec4 world=uModel*vec4(aPosition,1.);vNormal=normalize(transpose(inverse(mat3(uModel)))*aNormal);vOriginalNormal=aNormal;vWork=(uWork*vec4(aPosition,1.)).xyz;
    gl_Position=uVP*world;
    if(uOutline>0.){vec2 n=(uVP*vec4(vNormal,0.)).xy;gl_Position.xy+=normalize(n+vec2(.000001))*uOutline*2./uPixels;}
    if(uLine>0.)gl_Position.z-=.000015;
  }`;
  const fragment=`#version 300 es
  precision highp float;
  in vec3 vNormal,vOriginalNormal,vWork;out vec4 color;
  uniform float uLight,uLine,uOutline,uWood,uRecess,uMetal,uSelected,uPicking,uCut,uSawAngle;
  uniform vec3 uPick;
  void main(){
    if(uWood>.5&&uCut>.5&&abs(vWork.z)<5.2&&atan(vWork.y-35.,vWork.x+69.)<uSawAngle)discard;
    if(uPicking>.5){color=vec4(uPick,1.);return;}
    float q=floor(clamp(dot(normalize(vNormal),normalize(vec3(.4,-.25,.88)))*.5+.5,0.,.9999)*4.)/3.;
    float value=mix(.067+.055*q,.79+.19*q,uLight);
    if(uMetal>.5)value+=mix(.025,.025,uLight);
    if(uWood>.5){float cap=step(.8,abs(vOriginalNormal.z));value=mix(.12+.07*q+.07*cap,.64+.13*q+.15*cap,uLight);}
    if(uRecess>.5)value=mix(.045,.49,uLight);
    if(uLine>.5||uOutline>.5)value=mix(.43,.46,uLight);
    if(uSelected>.5&&uSelected<1.5)value=(uLine>.5||uOutline>.5)?mix(.94,.12,uLight):value+mix(.035,.015,uLight);
    if(uSelected>1.5)value=mix(value,mix(.067,.985,uLight),.22);
    color=vec4(vec3(clamp(value,0.,1.)),1.);
  }`;
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
  const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const names=['Model','Work','VP','Pixels','Outline','Line','Light','Wood','Recess','Metal','Selected','Picking','Cut','SawAngle','Pick'];
  const uniform=Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(program,'u'+n)]));
  const unpack=b64=>{const binary=atob(b64),bytes=new Uint8Array(binary.length);for(let i=0;i<bytes.length;i++)bytes[i]=binary.charCodeAt(i);return new Float32Array(bytes.buffer);};
  const meshes=data.meshes.map(m=>{
    const vertices=unpack(m.vertices),edges=unpack(m.edges),bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
    for(let i=0;i<vertices.length;i+=6)for(let j=0;j<3;j++){bounds.min[j]=Math.min(bounds.min[j],vertices[i+j]);bounds.max[j]=Math.max(bounds.max[j],vertices[i+j]);}
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
    const edgeBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,edgeBuffer);gl.bufferData(gl.ARRAY_BUFFER,edges,gl.STATIC_DRAW);
    return {...m,buffer,edgeBuffer,bounds};
  });
  const path=data.chain,dist=[0];for(let i=1;i<=path.length;i++){const a=path[i-1],b=path[i%path.length];dist.push(dist[i-1]+Math.hypot(...a.map((v,j)=>v-b[j])));}const perimeter=dist.at(-1);
  function chainPoint(s){s=((s%perimeter)+perimeter)%perimeter;let i=0;while(i<path.length-1&&dist[i+1]<s)i++;const a=path[i],b=path[(i+1)%path.length],t=(s-dist[i])/(dist[i+1]-dist[i]);return {p:a.map((v,j)=>v+(b[j]-v)*t),angle:Math.atan2(b[1]-a[1],b[0]-a[0])};}
  function woodMatrix(piece,state){const offset=piece.offset||[0,0,0],cy=piece.centreY??state.centreY;return translate([offset[0],cy+state.placement+offset[1],-piece.feed+offset[2]]);}
  function objectsAt(state){
    const rig=processingPoses(data.joints,state),objects=[];
    const woodPose=id=>id==='log1'||id==='log2'?state.pieces.find(p=>p.id===id):state.remaining;
    const woodGroup=state.cuts===0?'woodWhole':state.cuts===1?'woodRest1':'woodRest2';
    for(const m of meshes){const def=data.joints[m.group];let local=rig.local[m.group],model=rig.poses[m.group];
      if(def.kind==='actuator')continue;
      if(def.kind==='wood'){
        if(m.group!==woodGroup&&!state.pieces.some(p=>p.id===m.group))continue;
        const piece=woodPose(m.group);local=woodMatrix(piece,state);model=mul(BODY_POSE,local);
      }else if(def.kind==='branch'){
        const b=state.branches.find(b=>b.id===def.branch),owner=state.pieces.find(p=>b.u>=p.from&&b.u<p.to)||state.remaining;
        if(def.stump&&!b.cut)continue;
        if(!def.stump&&b.cut){
          if(b.age>2.2)continue;
          const e=H7ProcessingModel.processEase(0,1,b.age),side=Math.cos(b.angle)<0?-1:1;
          const offset=[side*110*e,-135*H7ProcessingModel.processEase(.65,2.2,b.age),18*e];
          local=translate([offset[0],50+woodRadius(b.cutFeed+277)+offset[1],-b.cutFeed+offset[2]]);
        }else local=woodMatrix(owner,state);
        model=mul(BODY_POSE,local);
      }else if(def.kind==='chain'){
        for(let i=0;i<56;i++){const cp=chainPoint(state.chainTravel+i*perimeter/56),lm=mul(rig.local.sawBlade,mul(translate(cp.p),rotation([0,0,1],cp.angle)));
          objects.push({mesh:m,local:lm,model:mul(BODY_POSE,lm)});
        }continue;
      }
      objects.push({mesh:m,local,model});
    }
    return {objects,rig};
  }
  let width=1,height=1,vp=I(),camera=null,lastState=null,lastSelected=null,lastObjects=null,pickTarget=null,contextLost=false;
  function projection(){
    const narrow=matchMedia('(max-width:640px)').matches,a=25*Math.PI/180,e=32*Math.PI/180;
    const baseR=[Math.sin(a),-Math.cos(a),0],baseU=[-Math.cos(a)*Math.sin(e),-Math.sin(a)*Math.sin(e),Math.cos(e)],V=[Math.cos(a)*Math.cos(e),Math.sin(a)*Math.cos(e),Math.sin(e)];
    const roll=narrow?35*Math.PI/180:0;
    const R=baseR.map((v,i)=>v*Math.cos(roll)-baseU[i]*Math.sin(roll)),U=baseR.map((v,i)=>v*Math.sin(roll)+baseU[i]*Math.cos(roll));
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const t of [0,5,14.76,17,25.76,28,31])for(const o of objectsAt(processingStateAt(t)).objects){
      const m=o.mesh;if(data.joints[m.group].kind==='branch'||data.joints[m.group].kind==='chain')continue;
      for(let i=0;i<8;i++){const p=point(o.model,[0,1,2].map(j=>i&(1<<j)?m.bounds.max[j]:m.bounds.min[j]));const x=p.reduce((s,v,j)=>s+v*R[j],0),y=p.reduce((s,v,j)=>s+v*U[j],0);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    }
    const cx=(minX+maxX)/2,cy=(minY+maxY)/2,aspect=width/height;
    let sx=(maxX-minX)/2+45,sy=(maxY-minY)/2+45;if(sx/sy<aspect)sx=sy*aspect;else sy=sx/aspect;
    vp=[R[0]/sx,U[0]/sy,-V[0]/1800,0,R[1]/sx,U[1]/sy,-V[1]/1800,0,R[2]/sx,U[2]/sy,-V[2]/1800,0,-cx/sx,-cy/sy,0,1];camera={R,U,V,cx,cy,sx,sy};
  }
  function resize(){
    const ratio=Math.min(devicePixelRatio||1,2);width=Math.max(1,Math.round(canvas.clientWidth*ratio));height=Math.max(1,Math.round(canvas.clientHeight*ratio));canvas.width=width;canvas.height=height;projection();
    if(pickTarget){gl.deleteFramebuffer(pickTarget.fb);gl.deleteTexture(pickTarget.texture);gl.deleteRenderbuffer(pickTarget.depth);}
    const fb=gl.createFramebuffer(),texture=gl.createTexture(),depth=gl.createRenderbuffer();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,width,height);gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);gl.bindFramebuffer(gl.FRAMEBUFFER,null);pickTarget={fb,texture,depth};
  }
  const ownerIndex=id=>CONFIG.assemblies.findIndex(a=>a.id===id)+1;
  function setObject(o,selected,picking){
    const m=o.mesh;gl.uniformMatrix4fv(uniform.Model,false,o.model);gl.uniformMatrix4fv(uniform.Work,false,o.local);
    gl.uniform1f(uniform.Wood,m.material==='wood'?1:0);gl.uniform1f(uniform.Recess,m.material==='recess'?1:0);gl.uniform1f(uniform.Metal,['metal','chrome','tooth'].includes(m.material)?1:0);
    gl.uniform1f(uniform.Selected,selected?(m.assembly===selected?1:2):0);gl.uniform3f(uniform.Pick,ownerIndex(m.assembly)/255,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);gl.enableVertexAttribArray(0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
  }
  function render(objects,state,selected,picking=false){
    if(contextLost)return;
    gl.bindFramebuffer(gl.FRAMEBUFFER,picking?pickTarget.fb:null);gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);gl.frontFace(gl.CW);gl.cullFace(gl.BACK);
    gl.uniformMatrix4fv(uniform.VP,false,vp);gl.uniform2f(uniform.Pixels,width,height);gl.uniform1f(uniform.Light,light?1:0);gl.uniform1f(uniform.Picking,picking?1:0);gl.uniform1f(uniform.Cut,state.cutting?1:0);gl.uniform1f(uniform.SawAngle,state.sawAngle);gl.uniform1f(uniform.Line,0);gl.uniform1f(uniform.Outline,0);
    for(const o of objects){setObject(o,selected,picking);gl.drawArrays(gl.TRIANGLES,0,o.mesh.count);}
    if(!picking){
      gl.uniform1f(uniform.Line,1);gl.disable(gl.CULL_FACE);
      for(const o of objects){setObject(o,selected,false);gl.bindBuffer(gl.ARRAY_BUFFER,o.mesh.edgeBuffer);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);gl.disableVertexAttribArray(1);gl.vertexAttrib3f(1,0,0,1);gl.drawArrays(gl.LINES,0,o.mesh.edgeCount);}
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  function draw(state,selected=null){lastState=state;lastSelected=selected;const out=objectsAt(state);lastObjects=out.objects;render(lastObjects,state,selected);return out.rig;}
  function hit(x,y){if(!lastState||contextLost)return null;const r=canvas.getBoundingClientRect(),px=Math.floor((x-r.left)/r.width*width),py=Math.floor((r.bottom-y)/r.height*height);if(px<0||py<0||px>=width||py>=height)return null;
    render(lastObjects,lastState,lastSelected,true);const pixel=new Uint8Array(4);gl.bindFramebuffer(gl.FRAMEBUFFER,pickTarget.fb);gl.readPixels(px,py,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);gl.bindFramebuffer(gl.FRAMEBUFFER,null);return CONFIG.assemblies[pixel[0]-1]?.id||null;
  }
  resize();let pending=0;const observer=new ResizeObserver(()=>{if(!pending)pending=requestAnimationFrame(()=>{pending=0;resize();onResize();});});observer.observe(canvas);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;canvas.dispatchEvent(new CustomEvent('processing-error',{detail:'三维画面连接已中断，请刷新页面恢复。'}));});
  return {draw,hit,stats:{...data.stats,renderer:'WebGL2'},project(p){const world=point(BODY_POSE,p),q=point(vp,world),r=canvas.getBoundingClientRect();return [r.left+(q[0]+1)*r.width/2,r.top+(1-q[1])*r.height/2];},getCamera:()=>camera};
}
