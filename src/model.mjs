export const assemblies = [
  { id: 'frame', name: '主机架', en: 'MAIN FRAME', move: [0, 0, 0], anchor: [0, 0, 170], text: '承载送料、打枝与锯切总成的结构骨架。展开后，中央送料通道与安装支座保留在原位。', evidence: '正面产品图 · 手册 §2.3', color: 'steel' },
  { id: 'rotator', name: '吊架与回转器', en: 'SUSPENSION & ROTATOR', move: [0, 0, 115], anchor: [0, -38, 344], text: '通过顶部连接件悬挂采伐头。此处拆开显示回转器外壳、法兰与吊耳；液压内部结构未展开。', evidence: '正面产品图 · 手册 §2.3：12 / 16', color: 'steel' },
  { id: 'tilt', name: '倾转架与油缸', en: 'TILT FRAME', move: [-30, -110, 50], anchor: [0, -60, 245], text: '位于机头背面，连接吊架与主体。两侧油缸和销轴支撑机头姿态变化；本演示保持悬挂姿态。', evidence: '手册 §2.3：8 / 9 · 三视角参考', color: 'steel' },
  { id: 'cover', name: '上部防护罩', en: 'SERVICE COVER', move: [90, -140, 40], anchor: [0, -48, 267], text: '上部罩壳包覆机头机构。罩壳移出后，可以观察其下方的主机架、安装边和连接区域。', evidence: '实拍侧视图 · 电机铭牌页', color: 'steel' },
  { id: 'feedL', name: '左送料辊总成', en: 'LEFT FEED MODULE', move: [-135, 25, 0], anchor: [-95, 42, 170], text: '带齿送料辊、轮毂、摆臂和驱动外壳作为一个总成向外展开。辊齿与轮毂细节为照片重建。', evidence: '正面产品图 · 手册 §2.3：3 / 7', color: 'yellow' },
  { id: 'feedR', name: '右送料辊总成', en: 'RIGHT FEED MODULE', move: [135, 25, 0], anchor: [95, 42, 170], text: '与左侧送料机构共同夹持和输送树干。这里的展开距离是展示参数，不代表油缸行程。', evidence: '三视角参考 · 手册 §3.7.2', color: 'yellow' },
  { id: 'knifeL', name: '左上打枝刀', en: 'UPPER KNIFE · LEFT', move: [-110, 85, 70], anchor: [-55, 45, 245], text: '弧形刀体沿树干外形夹持，在送料过程中去除枝条。刀刃曲线依据外观近似，非加工轮廓。', evidence: '正面产品图 · 手册 §2.3：5 / 6', color: 'yellow' },
  { id: 'knifeR', name: '右上打枝刀', en: 'UPPER KNIFE · RIGHT', move: [110, 85, 75], anchor: [55, 45, 228], text: '与另一侧上刀形成交错的包络关系。左右刀体保留照片中的高度错位，展开时沿各自方向分离。', evidence: '正面产品图 · 三视角参考', color: 'yellow' },
  { id: 'lower', name: '下部打枝刀组', en: 'LOWER KNIFE PAIR', move: [0, 135, 5], anchor: [0, 50, 65], text: '下部一对刀体、支座与销轴随同移出，露出中央辊和底部锯切机构之间的结构关系。', evidence: '正面产品图 · 手册 §2.3：14 / 15', color: 'yellow' },
  { id: 'measure', name: '中央辊与测长组件', en: 'INBOARD FEED & MEASUREMENT', move: [0, 145, 25], anchor: [0, 34, 137], text: '中央送料辊与独立测长轮合并展开，便于观察沟槽轮面、轴承盖、轮轴、摆臂和编码器外壳；它们不表示同一个可拆卸模块。', evidence: '手册 §3.9.1 · 新增测长轮与轴承分解图', color: 'steel' },
  { id: 'saw', name: '链锯总成', en: 'SAW CASSETTE', move: [-65, 15, -105], anchor: [0, 25, 22], text: '底部链锯包括导板、锯链、驱动壳体、轴承盖和张紧机构。轴承盖与张紧活塞参考 CT+ 零件图作结构示意，未模拟真实锯切动作。', evidence: '手册 §3.6.2.1 · CT+ 张紧器分解图', color: 'steel' },
];

export const order = ['knifeL', 'knifeR', 'lower', 'feedL', 'feedR', 'saw', 'measure', 'cover', 'tilt', 'rotator', 'frame'];
export const metadata = { title: 'PONSSE H7', modelUnits: 'illustrative', generation: 'user-photo reference', assemblies: assemblies.length };

export function poseAt(progress, id) {
  if (id === 'frame') return 0;
  const i = order.indexOf(id);
  const start = i * 0.016;
  const t = Math.max(0, Math.min(1, (progress - start) / (1 - start)));
  return t * t * (3 - 2 * t);
}
