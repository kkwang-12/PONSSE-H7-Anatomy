// Model units are illustrative, not millimetres or manufacturer specifications.
export const PROCESS = Object.freeze({duration:31,length:790,diameter:80,lengths:[240,200],remainder:350,centreY:90,sawPivot:[-69,35,1.5],stowed:-95*Math.PI/180,through:75*Math.PI/180});
export const PROCESS_STEPS = [
  {id:'place',name:'张开入位',start:0,end:3,at:2.1,text:'刀组和送料摆臂张开，树干从上方进入夹持区；此时辊轮不驱动木材。'},
  {id:'grip',name:'夹紧',start:3,end:5,at:4.7,text:'活动刀和送料摆臂收拢，油缸随连接点伸缩，各机构贴合所在位置的树干表面。'},
  {id:'feed1',name:'第一轮送料',start:5,end:10,at:8.4,text:'送料辊与测长轮随实际送料距离转动，枝条经过前刀或固定刀刃后被去除。'},
  {id:'stop1',name:'减速停车',start:10,end:12,at:11.6,text:'树干和辊轮同步减速，完全停止后才允许锯板切入。'},
  {id:'cut1',name:'第一段锯切',start:12,end:15,at:14.1,text:'保持夹持，锯链启动，锯板扫过截面；切穿时第一段木材立即独立。'},
  {id:'return1',name:'回锯分离',start:15,end:17,at:16.1,text:'第一段木材先离开切口，再向旁下方移开；锯板收回后才恢复送料。'},
  {id:'feed2',name:'第二轮送料',start:17,end:23,at:21.6,text:'保持夹持继续送料，已去枝区域保持光净，第二次送料在本步骤内减速至零。'},
  {id:'cut2',name:'第二段锯切',start:23,end:28,at:25.1,text:'再次停车锯切，切穿后第二段分离，本步骤末完成回锯。'},
  {id:'release',name:'释放余料',start:28,end:31,at:31,text:'确认锯板已收回，打开刀辊，余料先移出机构再落下；完成后停在此处。'}
];
export const processClamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function processEase(a,b,t){const u=processClamp((t-a)/(b-a));return u*u*(3-2*u);}
export function woodRadius(u){return 40-6*processClamp(u/PROCESS.length);}
export function feedAt(t){
  const v1=240/5.5,v2=200/4.5;
  let f=0,v=0;
  if(t>=5&&t<6){const q=t-5;f=v1*q*q/2;v=v1*q;}
  else if(t>=6&&t<10){f=v1*(.5+t-6);v=v1;}
  else if(t>=10&&t<12){const q=t-10;f=v1*(4.5+q-q*q/4);v=v1*(1-q/2);}
  else if(t>=12)f=240;
  if(t>=17&&t<18){const q=t-17;f+=v2*q*q/2;v=v2*q;}
  else if(t>=18&&t<21){f+=v2*(.5+t-18);v=v2;}
  else if(t>=21&&t<23){const q=t-21;f+=v2*(3.5+q-q*q/4);v=v2*(1-q/2);}
  else if(t>=23)f=440;
  return {distance:f,velocity:v};
}
export function timeForFeed(distance){if(distance<0||distance>440)return Infinity;let a=5,b=23;for(let i=0;i<60;i++){const m=(a+b)/2;if(feedAt(m).distance<distance)a=m;else b=m;}return (a+b)/2;}
export function sideRollerAngle(distance){const k=.6/790,a=38-k*170;return Math.log(a/(a-k*distance))/k;}
export const PROCESS_BRANCHES=[290,328,370,418,462,505,550,602,660,725].map((u,i)=>{
  const angle=[.6,2.4,1.1,2.05,4.71,.8,2.7,1.65,4.67,Math.PI/2][i];
  const knife=Math.sin(angle)<0?'fixed':Math.cos(angle)<0?'frontL':'frontR';
  const station={fixed:277,frontL:254,frontR:236}[knife];
  return {id:'branch'+i,u,angle,knife,station,length:38+(i%3)*8,cutFeed:u-station,cutTime:timeForFeed(u-station)};
});
function sawAt(t){
  if(t<12.3)return 0;
  if(t<14.75)return processEase(12.3,14.75,t);
  if(t<15)return 1;
  if(t<16.8)return 1-processEase(15,16.8,t);
  if(t<23.3)return 0;
  if(t<25.75)return processEase(23.3,25.75,t);
  if(t<26)return 1;
  if(t<27.8)return 1-processEase(26,27.8,t);
  return 0;
}
function logOffset(t,cutTime,side){const q=t-cutTime;
  return [side*140*processEase(.35,1.5,q),-180*processEase(.8,2.2,q),-65*processEase(0,.7,q)];
}
export function processingStateAt(time){
  const t=processClamp(Number.isFinite(time)?time:0,0,31),feed=feedAt(t);
  const stepIndex=Math.min(8,PROCESS_STEPS.findIndex(s=>t<s.end)===-1?8:PROCESS_STEPS.findIndex(s=>t<s.end));
  const open=t<3?1:t<5?1-processEase(3,5,t):t<28?0:processEase(28,29.4,t);
  const first=t>=14.75,second=t>=25.75,saw=sawAt(t);
  const chainOn=(t>=12&&t<16.8)||(t>=23&&t<27.8);
  const chainTravel=processClamp(t-12,0,4.8)*210+processClamp(t-23,0,4.8)*210;
  const branches=PROCESS_BRANCHES.map(b=>({...b,cut:t>=b.cutTime,age:Math.max(0,t-b.cutTime)}));
  const pieces=[];
  if(first)pieces.push({id:'log1',from:0,to:240,feed:240,centreY:50+woodRadius(240+277),offset:logOffset(t,14.75,-1)});
  if(second)pieces.push({id:'log2',from:240,to:440,feed:440,centreY:50+woodRadius(440+277),offset:logOffset(t,25.75,1)});
  const remainingFrom=second?440:first?240:0;
  // Clear the upright suspension along the open channel before dropping.
  // This free release trajectory is distinct from powered feed distance.
  const releaseOffset=[0,-180*processEase(30.2,31,t),-380*processEase(29.45,30.2,t)];
  const placement=35*(1-processEase(1.1,3,t));
  const localRadius=z=>woodRadius(feed.distance+z);
  return {time:t,duration:31,step:stepIndex,stage:PROCESS_STEPS[stepIndex].id,ended:t===31,centreY:50+localRadius(277),
    feed:feed.distance,velocity:feed.velocity,open,placement,clamped:t>=5&&t<=28,
    sawShare:saw,sawAngle:PROCESS.stowed+(PROCESS.through-PROCESS.stowed)*saw,
    sawHome:saw===0,chainOn,chainTravel,cutting:(t>=12.3&&t<14.75)||(t>=23.3&&t<25.75),
    cuts:Number(first)+Number(second),pieces,remaining:{id:'remaining',from:remainingFrom,to:790,feed:feed.distance,offset:releaseOffset},
    branches,radii:{frontL:localRadius(254),frontR:localRadius(236),rearL:localRadius(78),rearR:localRadius(62),feed:localRadius(170),upper:localRadius(198),lower:localRadius(104),measure:localRadius(159)},
    wheels:{left:sideRollerAngle(feed.distance),right:-sideRollerAngle(feed.distance),upper:-feed.distance/16,lower:-feed.distance/20,measure:-feed.distance/15}};
}
