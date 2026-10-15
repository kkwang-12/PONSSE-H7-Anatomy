// Rasterise each rigid assembly once; the animation only composites 11 images.
// SVG remains the source of truth and the fallback if decoding is unavailable.
async function createAssemblyRenderer({stage,svg,units,onResize}) {
  const light=document.body.dataset.theme==='light';
  const css=document.querySelector('head style').textContent.replace(/body\.iso/g,'.iso');
  const width=stage.clientWidth,height=stage.clientHeight;
  const baseScale=Math.min(width/(matchMedia('(max-width:640px)').matches?400:500),height/510);
  const edgeWidth=parseFloat(getComputedStyle(svg.querySelector('.iso-solid>.iso-edge')).strokeWidth);
  const records=units.map(unit=>{
    const box=unit.el.getBBox(),pad=3;
    const bounds={x:box.x-pad,y:box.y-pad,w:box.width+pad*2,h:box.height+pad*2};
    return {piece:unit.piece,key:unit.key,depth:unit.depth,screen:unit.screen,bounds,source:unit.el.outerHTML.replace(/class="assembly[^"]*"/,'class="assembly"').replace(/ transform="translate\([^"]*\)"/,'')};
  });
  // Two appearances per assembly. Bound decoded textures to about 48 MiB.
  const area=records.reduce((sum,r)=>sum+r.bounds.w*r.bounds.h,0)*baseScale*baseScale*2;
  // Keep a 2x source even on a 1x screen so fractional movement stays crisp.
  const density=Math.max(.75,Math.min(2,Math.sqrt(12_000_000/area)));
  const pixelScale=baseScale*density;
  // Non-scaling strokes are expressed in CSS pixels, while our source is HiDPI.
  // An individual SVG image has a small viewport: preserve the host page's
  // responsive stroke width instead of accidentally applying its mobile rule.
  const imageCSS=css.replace(/((?:stroke-width|--anatomy-weight)\s*:)\s*(\d*\.?\d+)(px)?/g,(_,prefix,n,px)=>`${prefix}${Number(n)*density}${px||''}`)+`.iso-solid>.iso-edge{stroke-width:${edgeWidth*density}}`;
  async function texture(record,selected) {
    const b=record.bounds,w=Math.max(1,Math.ceil(b.w*pixelScale)),h=Math.max(1,Math.ceil(b.h*pixelScale));
    const source=selected?record.source.replace('class="assembly"','class="assembly selected"'):record.source;
    const markup=`<svg xmlns="http://www.w3.org/2000/svg" class="iso iso-svg" data-theme="${light?'light':'dark'}" width="${w}" height="${h}" style="width:${w}px;height:${h}px;background:transparent" viewBox="${b.x} ${b.y} ${b.w} ${b.h}"><style><![CDATA[${imageCSS}]]></style>${source}</svg>`;
    const url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml'})),image=new Image();
    try {
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Assembly image could not be decoded'));image.src=url;});
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');
      context.drawImage(image,0,0,w,h);return canvas;
    } finally {URL.revokeObjectURL(url);image.src='';}
  }
  let next=0;
  async function worker(){while(next<records.length){const r=records[next++];r.normal=await texture(r,false);r.selectedImage=await texture(r,true);
    const mask=document.createElement('canvas');mask.width=Math.ceil(r.bounds.w*2);mask.height=Math.ceil(r.bounds.h*2);
    const context=mask.getContext('2d',{willReadFrequently:true});context.drawImage(r.normal,0,0,mask.width,mask.height);
    const rgba=context.getImageData(0,0,mask.width,mask.height).data;
    r.mask={w:mask.width,h:mask.height,alpha:Uint8Array.from({length:mask.width*mask.height},(_,i)=>rgba[i*4+3])};
    mask.width=mask.height=1;
  }}
  await Promise.all([worker(),worker(),worker()]);
  for(const r of records)delete r.source;
  const canvas=document.createElement('canvas');canvas.id='machine-canvas';canvas.className='h7-canvas';
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label','PONSSE H7 采伐头结构拆解，11 个机械总成。');
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');
  let cssWidth=width,cssHeight=height,ratio=1,view=null,drawn=[],disposed=false;
  const size=()=>{
    cssWidth=stage.clientWidth;cssHeight=stage.clientHeight;ratio=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.max(1,Math.round(cssWidth*ratio));canvas.height=Math.max(1,Math.round(cssHeight*ratio));
  };
  size();
  // Detach the heavy tree entirely so it never participates in style/layout.
  svg.replaceWith(canvas);stage.dataset.renderer='canvas';
  function draw({progress,selected,narrow,poseAt}) {
    if(disposed)return;
    const w=narrow?400+460*progress:500+420*progress,h=510+330*progress;
    const scale=Math.min(cssWidth/w,cssHeight/h),x=500-w/2,y=440-h/2;
    view={scale,ox:(cssWidth-w*scale)/2-x*scale,oy:(cssHeight-h*scale)/2-y*scale};
    context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,cssWidth,cssHeight);
    context.translate(view.ox,view.oy);context.scale(scale,scale);
    context.save();context.translate(500,632);context.scale(140,25);
    const gradient=context.createRadialGradient(0,0,0,0,0,1);
    gradient.addColorStop(0,light?'rgba(0,0,0,.12)':'rgba(255,255,255,.035)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    context.globalAlpha=1-.7*progress;context.fillStyle=gradient;context.fillRect(-1,-1,2,2);context.restore();
    drawn=records.map(r=>{const t=poseAt(progress,r.piece);r.dx=r.screen[0]*t;r.dy=r.screen[1]*t;r.currentKey=r.key+r.depth*t;return r;}).sort((a,b)=>a.currentKey-b.currentKey);
    for(const r of drawn){const b=r.bounds;context.globalAlpha=selected&&selected!==r.piece ? .48:1;
      context.drawImage(selected===r.piece?r.selectedImage:r.normal,b.x+r.dx,b.y+r.dy,b.w,b.h);
    }
    context.globalAlpha=1;
  }
  function hit(clientX,clientY) {
    if(!view)return null;
    const rect=canvas.getBoundingClientRect(),x=(clientX-rect.left-view.ox)/view.scale,y=(clientY-rect.top-view.oy)/view.scale;
    for(let i=drawn.length-1;i>=0;i--){const r=drawn[i],b=r.bounds,m=r.mask;
      const u=Math.floor((x-b.x-r.dx)/b.w*m.w),v=Math.floor((y-b.y-r.dy)/b.h*m.h);
      if(u>=0&&v>=0&&u<m.w&&v<m.h&&m.alpha[v*m.w+u]>24)return r.piece;
    }return null;
  }
  let resizeFrame=0;
  const observer=new ResizeObserver(()=>{if(!resizeFrame)resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;size();onResize();});});observer.observe(stage);
  const opaqueCorners=records.reduce((sum,r)=>{const m=r.mask;return sum+[0,m.w-1,(m.h-1)*m.w,m.h*m.w-1].filter(i=>m.alpha[i]>0).length;},0);
  return {draw,hit,canvas,stats:{assemblies:records.length,texturePixels:records.reduce((sum,r)=>sum+r.normal.width*r.normal.height*2,0),density,opaqueCorners},dispose(){disposed=true;observer.disconnect();cancelAnimationFrame(resizeFrame);for(const r of records){r.normal.width=r.selectedImage.width=1;}}};
}
