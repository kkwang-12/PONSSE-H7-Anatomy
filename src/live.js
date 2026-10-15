(() => {
  const $=s=>document.querySelector(s);
  const stage=$('#stage'),svg=$('#machine'),layer=$('#parts'),toggle=$('#toggle');
  const groups=CONFIG.assemblies;
  const units=groups.map(g=>({...CONFIG.parts.find(p=>p.piece===g.id),el:document.querySelector(`[data-assembly="${g.id}"]`)}));
  const buttons=[...document.querySelectorAll('[data-part]')];
  const calm=matchMedia('(prefers-reduced-motion: reduce)'),coarse=matchMedia('(hover: none), (pointer: coarse)');
  const narrow=matchMedia('(max-width:640px)');
  const caption=$('#caption'),defaultCaption=caption.textContent;
  const state={target:0,progress:0,selected:null,manualOpen:false,inside:false,visible:true,frame:0,last:0};
  const readout=$('#readout'),toggleLabel=$('#toggle-label'),shadow=$('#ground-shadow');
  let leaveTimer=0,priorOrder='',touch=null,renderer=null,preparing=true,visualKey='';
  function text(el,value){if(el.textContent!==value)el.textContent=value;}
  function poseAt(p,id) {
    if(id==='frame')return 0;
    const start=CONFIG.order.indexOf(id)*.016,t=Math.max(0,Math.min(1,(p-start)/(1-start)));
    return t*t*(3-2*t);
  }
  function draw(force=false) {
    if(state.mode==='processing')return;
    const p=state.progress,key=`${p}:${state.selected}:${narrow.matches}`;
    if(force||key!==visualKey){
      if(renderer)renderer.draw({progress:p,selected:state.selected,narrow:narrow.matches,poseAt});
      else{
        for(const unit of units){const t=poseAt(p,unit.piece);unit.el.setAttribute('transform',`translate(${(unit.screen[0]*t).toFixed(2)} ${(unit.screen[1]*t).toFixed(2)})`);unit.currentKey=unit.key+unit.depth*t;}
        const sorted=[...units].sort((a,b)=>a.currentKey-b.currentKey),order=sorted.map(unit=>unit.piece).join(',');
        if(order!==priorOrder){const fragment=document.createDocumentFragment();for(const unit of sorted)fragment.append(unit.el);layer.append(fragment);priorOrder=order;}
        const w=narrow.matches?400+460*p:500+420*p,h=510+330*p;
        svg.setAttribute('viewBox',`${500-w/2} ${440-h/2} ${w} ${h}`);shadow.setAttribute('opacity',String(1-.7*p));
      }
      visualKey=key;
    }
    const moving=Math.abs(state.target-p)>.003,a=groups.find(g=>g.id===state.selected);
    text(readout,a?`${String(groups.indexOf(a)+1).padStart(2,'0')} ${a.name}`:moving?`${state.target>p?'正在展开':'正在复位'} · ${Math.round(p*100)}%`:p>.995?'已展开 · 11 个总成':'已组装 · 11 个总成');
    if(toggle.getAttribute('aria-pressed')!==String(state.target>.5))toggle.setAttribute('aria-pressed',String(state.target>.5));text(toggleLabel,state.target>.5?'复位':'展开');
    stage.dataset.progress=p.toFixed(4);stage.dataset.settled=String(!moving);
  }
  function tick(now) {
    // Exponential easing is stable for real elapsed time, including a dropped frame.
    // Hidden/offscreen time is excluded by run() resetting the timestamp.
    state.frame=0;const dt=state.last?Math.max(0,(now-state.last)/1000):1/60;state.last=now;
    state.progress=calm.matches?state.target:state.progress+(state.target-state.progress)*(1-Math.exp(-dt/.24));
    if(Math.abs(state.target-state.progress)<.0002)state.progress=state.target;
    draw();if(state.visible&&!document.hidden&&state.progress!==state.target)state.frame=requestAnimationFrame(tick);
  }
  function run(){if(state.mode!=='processing'&&!preparing&&state.progress!==state.target&&!state.frame&&state.visible&&!document.hidden){state.last=0;state.frame=requestAnimationFrame(tick);}}
  function target(p){state.target=Math.max(0,Math.min(1,p));run();}
  function select(id){
    if(state.mode==='processing'){window.h7Demo.processing?.select(id);return;}
    const a=groups.find(g=>g.id===id),next=a?id:null;if(state.selected===next)return;state.selected=next;
    if(!renderer)for(const p of units){p.el.classList.toggle('selected',p.piece===state.selected);p.el.classList.toggle('muted',Boolean(a)&&p.piece!==a.id);}
    for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.part===state.selected));
    caption.textContent=a?`${a.name}：${a.text}`:defaultCaption;
    $('#announcement').textContent=a?`${a.name}。${a.text}`:state.target>.5?'机头已展开':'完整机头';draw();
  }
  function cancelLeave(){clearTimeout(leaveTimer);}
  function scheduleLeave(){cancelLeave();if(state.mode==='processing')return;leaveTimer=setTimeout(()=>{if(state.mode==='processing'||state.inside||buttons.some(b=>b.matches(':hover, :focus-visible'))||state.manualOpen)return;select(null);target(0);},260);}
  function show(id){cancelLeave();if(state.mode==='processing'){select(id);return;}target(1);select(id);}
  const assemblyAt=e=>renderer?renderer.hit(e.clientX,e.clientY):e.target.closest('[data-piece]')?.dataset.piece??null;
  stage.addEventListener('pointerenter',e=>{if(state.mode==='processing'||e.pointerType==='touch')return;state.inside=true;cancelLeave();target(1);});
  stage.addEventListener('pointermove',e=>{if(state.mode==='processing'||e.pointerType==='touch')return;state.inside=true;cancelLeave();target(1);const id=assemblyAt(e);if(state.selected!==id)select(id);});
  stage.addEventListener('pointerleave',e=>{if(state.mode==='processing'||e.pointerType==='touch')return;state.inside=false;scheduleLeave();});
  stage.addEventListener('pointerdown',e=>{if(state.mode!=='processing'&&e.pointerType==='touch')touch={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now()};});
  stage.addEventListener('pointercancel',()=>touch=null);
  stage.addEventListener('pointerup',e=>{
    if(state.mode==='processing'||e.pointerType!=='touch'||!touch||touch.id!==e.pointerId)return;
    const tap=Math.hypot(e.clientX-touch.x,e.clientY-touch.y)<8&&performance.now()-touch.time<600;touch=null;
    if(!tap)return;cancelLeave();const id=assemblyAt(e);
    if(id){state.manualOpen=true;show(id);}else{state.manualOpen=state.target<.5;select(null);target(state.manualOpen?1:0);}
  });
  toggle.addEventListener('click',()=>{cancelLeave();state.manualOpen=state.target<.5;select(null);target(state.manualOpen?1:0);});
  for(const b of buttons){
    b.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')show(b.dataset.part);});
    b.addEventListener('pointerleave',scheduleLeave);b.addEventListener('focus',()=>show(b.dataset.part));b.addEventListener('blur',scheduleLeave);
    b.addEventListener('click',()=>{if(state.mode!=='processing'&&coarse.matches)state.manualOpen=true;show(b.dataset.part);});
    b.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(state.mode==='processing'){window.h7Demo.processing?.pause();select(null);return;}cancelLeave();state.manualOpen=false;select(null);target(0);}});
  }
  stage.addEventListener('keydown',e=>{
    if(state.mode==='processing')return;
    if(![' ','Enter','ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End','Escape'].includes(e.key))return;
    e.preventDefault();cancelLeave();
    if(e.key==='Escape'){state.manualOpen=false;select(null);target(0);return;}
    if(e.key===' '||e.key==='Enter'){state.manualOpen=state.target<.5;if(!state.manualOpen)select(null);target(state.manualOpen?1:0);return;}
    const i=groups.findIndex(g=>g.id===state.selected);
    const next=e.key==='Home'?0:e.key==='End'?groups.length-1:['ArrowLeft','ArrowUp'].includes(e.key)?Math.max(0,i-1):Math.min(groups.length-1,i+1);
    state.manualOpen=true;show(groups[next].id);
  });
  const wording=()=>$('#hint').textContent=coarse.matches?'轻点机头或标签，查看展开结构':'悬停机头，查看展开结构';wording();coarse.addEventListener('change',wording);
  calm.addEventListener('change',run);
  narrow.addEventListener('change',()=>draw(true));
  new IntersectionObserver(entries=>{state.visible=entries[entries.length-1].isIntersecting;if(state.visible)run();else{cancelAnimationFrame(state.frame);state.frame=0;}},{rootMargin:'120px'}).observe(stage);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(state.frame);state.frame=0;}else run();});
  window.h7Demo={state,target,select,draw,assemblies:groups,hitTest:(x,y)=>renderer?.hit(x,y)??null};draw();
  const started=performance.now();
  window.h7Demo.ready=createAssemblyRenderer({stage,svg,units,onResize:()=>draw(true)}).then(value=>{
    renderer=value;preparing=false;window.h7Demo.renderer={type:'canvas',...value.stats,prepareMs:performance.now()-started};
    // Release detached SVG nodes after successful rasterisation, keeping the
    // original tree intact if preparation fails and SVG fallback is needed.
    for(const unit of units)unit.el=null;layer.replaceChildren();svg.replaceChildren();
    draw(true);run();return window.h7Demo.renderer;
  }).catch(error=>{
    preparing=false;stage.dataset.renderer='svg';window.h7Demo.renderer={type:'svg',reason:String(error)};run();return window.h7Demo.renderer;
  });
})();
