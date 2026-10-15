export function renderPage({light,renderParts,config,kitCSS,css,runtime}) {
  const tags=config.assemblies.map((a,i)=>`<button type="button" class="h7-part" data-part="${a.id}" aria-pressed="false"><span class="h7-num">${String(i+1).padStart(2,'0')}</span>${a.name}</button>`).join('');
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="${light?'light':'dark'}"><title>PONSSE H7 · Anatomy</title><style>${kitCSS}\n${css}</style></head>
<body class="iso" data-theme="${light?'light':'dark'}"><main><div class="mode-bar" role="tablist" aria-label="展示模式"><button type="button" role="tab" data-mode-button="structure" aria-selected="true" aria-controls="stage">结构展示</button><button type="button" role="tab" data-mode-button="processing" aria-selected="false" aria-controls="stage" tabindex="-1">加工演示</button></div><figure class="h7 iso-figure">
<div class="h7-plate iso-plate">
<div class="h7-corner h7-fig">Fig 1</div><div class="h7-corner h7-title">PONSSE H7 · HARVESTER HEAD</div>
<div id="stage" class="h7-stage" data-mode="structure" tabindex="0" role="group" aria-label="PONSSE H7 采伐头。悬停展开，点击组件标签查看说明。空格切换展开，方向键切换总成，Escape复位。">
<svg id="machine" class="iso-svg" viewBox="250 185 500 510" role="img" aria-labelledby="machine-title machine-description"><title id="machine-title">PONSSE H7 · 采伐头结构拆解</title><desc id="machine-description">灰阶等距投影的采伐头，由吊架回转器、倾转架、主机架、送料辊、打枝刀、测长机构及链锯组成。</desc><defs><radialGradient id="ground"><stop offset="0" stop-color="${light?'#000':'#fff'}" stop-opacity="${light?'.12':'.035'}"/><stop offset="1" stop-color="${light?'#000':'#fff'}" stop-opacity="0"/></radialGradient></defs><ellipse id="ground-shadow" cx="500" cy="632" rx="140" ry="25" fill="url(#ground)"/><g id="parts">${renderParts}</g></svg>
</div>
<div class="h7-controls" id="structure-controls"><button type="button" id="toggle" class="h7-toggle" aria-pressed="false"><span class="h7-lamp" aria-hidden="true"></span><span id="toggle-label">展开</span></button><span id="hint" class="h7-hint">悬停机头，查看展开结构</span></div>
<div class="h7-controls processing-controls" id="processing-controls" hidden><button type="button" id="process-play" class="h7-toggle">播放</button><button type="button" id="process-replay" class="h7-toggle">重播</button><label class="rate-label">速度 <select id="process-rate" aria-label="播放速度"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option></select></label></div>
<p id="process-error" class="process-error" role="status" hidden></p>
<span id="readout" class="h7-corner h7-readout" data-readout aria-live="off">已组装 · 11 个总成</span><span id="announcement" class="sr-only" aria-live="polite"></span>
</div>
<figcaption class="h7-legend"><div id="process-steps" class="process-steps" aria-label="加工步骤" hidden></div><div class="h7-parts" aria-label="组件目录">${tags}</div><p id="caption" class="h7-caption">PONSSE H7 采伐头的结构示意：吊架与回转器连接倾转架，主机架承载送料辊、打枝刀、测长机构和底部链锯。悬停图形或组件标签，查看 11 个总成的展开关系。轮廓与细节参考提供的实物照片及零件图，经过适度简化；展开路径用于结构展示。</p></figcaption>
</figure></main><script>const CONFIG=${JSON.stringify(config)};\n${runtime}</script></body></html>`;
}
