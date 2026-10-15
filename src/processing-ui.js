(() => {
  const $=s=>document.querySelector(s),demo=window.h7Demo,stage=$('#stage');
  const {PROCESS_STEPS:steps,processingStateAt,PROCESS}=H7ProcessingModel;
  const modes=[...document.querySelectorAll('[data-mode-button]')],parts=[...document.querySelectorAll('[data-part]')];
  const readout=$('#readout'),caption=$('#caption'),defaultCaption=caption.textContent,title=$('.h7-title'),defaultTitle=title.textContent;
  const initialLabel=stage.getAttribute('aria-label'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const playButton=$('#process-play'),replayButton=$('#process-replay'),rateSelect=$('#process-rate'),stepList=$('#process-steps'),errorEl=$('#process-error');
  const names={knifeL:'左前打枝刀',knifeR:'右前打枝刀',lower:'后打枝刀组'};
  let renderer=null,canvas=null,error=null,time=0,rate=1,wanted=false,visible=true,frame=0,last=0,hovered=null,mode='structure',announcedStep=-1,renderedState=processingStateAt(0);
  const setText=(el,text)=>{if(el.textContent!==text)el.textContent=text;};
  stepList.innerHTML=steps.map((s,i)=>`<button type="button" class="process-step" data-step="${i}" aria-label="第 ${i+1} 步 ${s.name}"><span>${String(i+1).padStart(2,'0')}</span>${s.name}</button>`).join('');
  const stepButtons=[...stepList.querySelectorAll('[data-step]')];
  function ensureRenderer(){if(renderer||error)return;canvas=document.createElement('canvas');canvas.className='processing-canvas';canvas.id='processing-canvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','PONSSE H7 加工倒木，包含夹紧、打枝、送料及两次锯切。');stage.append(canvas);
    try{renderer=createProcessingRenderer(canvas,CONFIG.processing,()=>render());}
    catch(e){error=String(e.message||e);errorEl.textContent=error;errorEl.hidden=false;pause();}
    canvas.addEventListener('processing-error',e=>{error=e.detail;errorEl.textContent=error;errorEl.hidden=false;pause();});
  }
  function active(){return mode==='processing'&&visible&&!document.hidden&&!error;}
  function playing(){return wanted&&active();}
  function render(){
    if(mode!=='processing')return;
    renderedState=processingStateAt(time);const s=renderedState,step=steps[s.step];
    if(s.step!==announcedStep){announcedStep=s.step;setText($('#announcement'),`第 ${s.step+1} 步，${step.name}。${step.text}`);}
    if(renderer&&!error)renderer.draw(s,hovered);
    for(const [i,b] of stepButtons.entries()){if(i===s.step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');b.classList.toggle('done',i<s.step);}
    for(const b of parts)b.setAttribute('aria-pressed',String(b.dataset.part===hovered));
    const component=CONFIG.assemblies.find(a=>a.id===hovered);
    setText(caption,component?`${names[component.id]||component.name}：${component.id==='saw'?'锯盒固定，锯板绕安装轴摆动，锯链沿闭合轨道运行；木材完全停车并保持夹持后才切入。':component.id==='feedL'||component.id==='feedR'?'送料摆臂负责夹紧，辊体绕自身轴旋转；电机壳体和护罩随摆臂运动，不随辊体自转。':component.id==='measure'?'中央辊和测长轮分别自转，转角由实际送料距离推导；测长摆臂随树干表面调整。':component.id==='knifeL'||component.id==='knifeR'||component.id==='lower'?'活动刀绕销轴开合，油缸根据两端连接点伸缩，经过刀口的枝条被截断。':component.text}`:`${String(s.step+1).padStart(2,'0')} ${step.name}：${step.text} 尺寸与分离轨迹为示意。`);
    setText(readout,`${String(s.step+1).padStart(2,'0')} ${step.name} · ${time.toFixed(1)} / 31 s${s.ended?' · 完成':''}`);
    setText(playButton,reduced.matches?(s.ended?'完成':'下一步'):wanted?'暂停':s.ended?'重新播放':'播放');playButton.setAttribute('aria-pressed',String(wanted));playButton.disabled=Boolean(error)||(reduced.matches&&s.ended);replayButton.disabled=Boolean(error);
    stage.dataset.processTime=time.toFixed(4);stage.dataset.processStep=step.id;stage.dataset.processCuts=String(s.cuts);stage.dataset.processPlaying=String(playing());
  }
  function tick(now){frame=0;if(!playing())return;const dt=last?Math.max(0,(now-last)/1000):0;last=now;time=Math.min(31,time+dt*rate);if(time===31)wanted=false;render();if(playing())frame=requestAnimationFrame(tick);}
  function run(){if(playing()&&!frame){last=performance.now();frame=requestAnimationFrame(tick);}}
  function pause(){wanted=false;cancelAnimationFrame(frame);frame=0;last=0;render();}
  function play(){if(mode!=='processing')setMode('processing');ensureRenderer();if(error)return;
    if(reduced.matches){seekStep(Math.min(8,processingStateAt(time).step+1));return;}if(time>=31)time=0;wanted=true;render();run();}
  function replay(){pause();time=0;hovered=null;render();if(!reduced.matches)play();}
  function seek(t){if(!Number.isFinite(t))throw new TypeError('Time must be finite');pause();time=Math.max(0,Math.min(31,t));hovered=null;render();return getState();}
  function seekStep(id){const index=typeof id==='string'?steps.findIndex(s=>s.id===id):id;if(!Number.isInteger(index)||!steps[index])throw new RangeError('Unknown processing step');return seek(steps[index].at);}
  function setRate(value){value=Number(value);if(![.25,.5,1].includes(value))throw new RangeError('Rate must be .25, .5 or 1');rate=value;rateSelect.value=String(rate);return rate;}
  function select(id){id=CONFIG.assemblies.some(a=>a.id===id)?id:null;if(hovered===id)return;hovered=id;render();}
  function getState(){return {...processingStateAt(time),playing:playing(),requestedPlaying:wanted,rate,mode,selected:hovered,error,renderer:renderer?.stats||null};}
  function setMode(next){if(!['structure','processing'].includes(next))throw new RangeError('Unknown mode');if(next===mode)return;
    pause();cancelAnimationFrame(demo.state.frame);demo.state.frame=0;demo.state.last=0;demo.state.inside=false;
    mode=next;demo.state.mode=next;stage.dataset.mode=next;document.body.dataset.mode=next;
    for(const b of modes){const on=b.dataset.modeButton===next;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}
    $('#structure-controls').hidden=next==='processing';$('#processing-controls').hidden=next!=='processing';stepList.hidden=next!=='processing';errorEl.hidden=next!=='processing'||!error;
    if(next==='processing'){
      announcedStep=-1;
      setText(title,'PONSSE H7 · TIMBER PROCESSING');stage.setAttribute('aria-label','PONSSE H7 加工演示。空格播放或暂停，方向键切换步骤，Home 回到开始，End 查看完成状态。');
      for(const b of parts)b.innerHTML=b.innerHTML.replace(CONFIG.assemblies.find(a=>a.id===b.dataset.part).name,names[b.dataset.part]||CONFIG.assemblies.find(a=>a.id===b.dataset.part).name);
      ensureRenderer();render();
    }else{
      setText(title,defaultTitle);stage.setAttribute('aria-label',initialLabel);const selectedAssembly=CONFIG.assemblies.find(a=>a.id===demo.state.selected);caption.textContent=selectedAssembly?`${selectedAssembly.name}：${selectedAssembly.text}`:defaultCaption;
      for(const b of parts){const a=CONFIG.assemblies.find(a=>a.id===b.dataset.part);b.innerHTML=`<span class="h7-num">${String(CONFIG.assemblies.indexOf(a)+1).padStart(2,'0')}</span>${a.name}`;b.setAttribute('aria-pressed',String(a.id===demo.state.selected));}
      demo.draw(true);if(demo.state.progress!==demo.state.target)demo.target(demo.state.target);
    }
  }
  demo.state.mode='structure';
  demo.processing={play,pause,replay,seek,seekStep,setRate,getState,select,setMode,stateAt:processingStateAt,steps,project:p=>renderer?.project(p)||null};
  for(const [i,b] of modes.entries()){
    b.addEventListener('click',()=>setMode(b.dataset.modeButton));
    b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const other=modes[1-i];setMode(other.dataset.modeButton);other.focus();});
  }
  playButton.addEventListener('click',()=>wanted?pause():play());replayButton.addEventListener('click',replay);rateSelect.addEventListener('change',()=>setRate(rateSelect.value));
  for(const b of stepButtons)b.addEventListener('click',()=>seekStep(Number(b.dataset.step)));
  stage.addEventListener('pointermove',e=>{if(mode!=='processing'||e.pointerType==='touch'||!renderer||error)return;select(renderer.hit(e.clientX,e.clientY));});
  stage.addEventListener('pointerleave',()=>{if(mode==='processing')select(null);});
  let touch=null;
  stage.addEventListener('pointerdown',e=>{if(mode==='processing'&&e.pointerType==='touch')touch={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now()};});
  stage.addEventListener('pointercancel',()=>touch=null);
  stage.addEventListener('pointerup',e=>{if(mode!=='processing'||e.pointerType!=='touch'||!touch||e.pointerId!==touch.id)return;const tap=Math.hypot(e.clientX-touch.x,e.clientY-touch.y)<8&&performance.now()-touch.time<600;touch=null;if(tap&&renderer&&!error)select(renderer.hit(e.clientX,e.clientY));});
  stage.addEventListener('keydown',e=>{if(mode!=='processing'||![' ','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Escape'].includes(e.key))return;e.preventDefault();
    if(e.key===' '||e.key==='Enter'){playing()?pause():play();return;}if(e.key==='Escape'){pause();select(null);return;}if(e.key==='Home'){seek(0);return;}if(e.key==='End'){seek(31);return;}
    const direction=['ArrowLeft','ArrowUp'].includes(e.key)?-1:1;seekStep(Math.max(0,Math.min(8,processingStateAt(time).step+direction)));
  });
  const suspend=()=>{cancelAnimationFrame(frame);frame=0;last=0;render();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else{render();run();}});
  new IntersectionObserver(entries=>{visible=entries.at(-1).isIntersecting;if(!visible)suspend();else{render();run();}},{rootMargin:'120px'}).observe(stage);
  reduced.addEventListener('change',()=>{if(reduced.matches)pause();render();});
  if(location.hash==='#processing')setMode('processing');
})();
