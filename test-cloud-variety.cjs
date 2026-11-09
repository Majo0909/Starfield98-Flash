'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('./depth.js');
const window = {StarfieldDepth:D};
const document = {createElement(){const c={}; c.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:i=>c.pixels=i.data}); return c;}};
new Function('window','document',fs.readFileSync(path.join(__dirname,'gases.js'),'utf8'))(window,document);
const Gas=window.GasClouds;
let seed=821;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)|0)>>>0)/4294967296;
const gas=Object.create(Gas.prototype); gas.random=random;
const samples=[]; let emptyRoutes=0, occupiedRoutes=0;
for(let i=0;i<1000;i++) {
 gas.reset(); samples.push(...gas.clouds);
 const route=gas.clouds.some(c=>c.z>0 && Math.hypot(c.x,c.y)<c.radius);
 route?occupiedRoutes++:emptyRoutes++;
 assert.notEqual(gas.clouds[0].z,3,'no forced first cloud');
}
assert(emptyRoutes>20 && occupiedRoutes>20,'chance encounters AND genuine empty routes');
for(const axis of ['x','y']) {
 const positive=samples.filter(c=>c[axis]>0).length/samples.length;
 assert(positive>.48 && positive<.52,'unbiased signs '+axis);
 const central=samples.filter(c=>Math.abs(c[axis])<2).length/samples.length;
 assert(central>.07 && central<.12,'uniform box, no corridor weighting '+axis);
}
assert(samples.some(c=>c.z < -20) && samples.some(c=>c.z>150),'expanded depth for giants');
const radii=samples.map(c=>c.radius).sort((a,b)=>a-b);
assert(radii[0]<.3 && radii.at(-1)>60,'sizes from dust wisps to colossal complexes');
const giants=radii.filter(r=>r>=12).length/radii.length;
assert(giants>.03 && giants<.10,'giants uncommon, not constantly engulfing');
const colossal=radii.filter(r=>r>=40).length/radii.length;
assert(colossal>.002 && colossal<.02,'colossal complexes rare and solitary');
assert(radii.at(-1)/radii[radii.length>>1]>25,'largest colossals ~50x the typical cloud');
// Independence from slot index: no every-third corridor population.
for(let slot=0;slot<3;slot++) {
 const s=samples.filter((_,i)=>i%3===slot);
 assert(s.filter(c=>Math.hypot(c.x,c.y)<2).length/s.length<.02);
}
console.log('PASS random spatial distribution, gaps, independent slots, broad rare-giant sizes');
const textured=new Gas(random,()=>0.6);
assert.equal(textured.textures.length,50,'finite atlas with five morphologies and ten palette variants');
const masks=[];
for(let shape=0;shape<5;shape++) {
 const pixels=textured.textures[shape].pixels;
 const mask=[]; let count=0;
 for(let y=0;y<192;y++) for(let x=0;x<192;x++) {
  const a=pixels[(y*192+x)*4+3];
  if(x===0 || y===0 || x===191 || y===191) assert.equal(a,0,'soft transparent atlas boundaries');
  mask.push(a>10); count+=a>10;
 }
 assert(count>500 && count<24000,'nonempty, bounded silhouette'); masks.push(mask);
}
for(let i=0;i<5;i++) for(let j=0;j<i;j++) {
 const difference=masks[i].filter((v,k)=>v!==masks[j][k]).length;
 assert(difference>1800,'distinct physical silhouettes, not just tints: '+i+','+j);
}
const textures=textured.textures.slice(); textured.advance(10000);
assert(textured.textures.every((t,i)=>t===textures[i]),'recycling must never bake textures');
assert(samples.every(c=>Number.isInteger(c.shape) && c.shape>=0 && c.shape<5),'cloud morphology assigned independently');
console.log('PASS five distinct silhouettes, transparent edges, finite atlas retained during recycling');
let drawCalls=[];
const context={clearRect(){},save(){},restore(){},translate(...a){assert(a.every(Number.isFinite));},rotate(a){assert(Number.isFinite(a));},drawImage(...a){assert(a.slice(1).every(Number.isFinite)); drawCalls.push({alpha:this.globalAlpha,args:a.slice(1)});},fillRect(){}};
textured.context=context;
const cloud={x:0,y:0.8,z:0,radius:1,density:1,color:0,texture:3,shape:3,angle:0,stretch:1};
textured.clouds=[cloud];
textured.render({drawImage(){}},1280,720,0,0,0,1);
assert.equal(textured.inside,0,'no immersion veil in the empty space between/outside filaments');
// Sampling transitions tests geometry/alpha only, NOT real browser appearance.
for(const radius of [.35,2,16,100]) {
 cloud.radius=radius; cloud.x=0; cloud.y=0; cloud.shape=0; cloud.texture=0;
 let previous=null;
 for(let iz=1940;iz>=-490;iz--) {
  const z=iz/10;
  cloud.z=z; drawCalls=[];
  textured.render({drawImage(){}},1280,720,0,0,0,1);
  const alpha=drawCalls[0]?.alpha || 0;
  assert(alpha>=0 && alpha<=1);
  if(z>=184 + Math.max(0,radius-5)*1.35 || z<=0) assert.equal(alpha,0);
  if(previous!==null && z>140) assert(Math.abs(alpha-previous)<.01,'smooth far boundary');
  previous=alpha;
  for(const d of drawCalls) assert(Math.abs(d.args[2])<=1280*.6*6.5 && Math.abs(d.args[3])<=1280*.6*5,'finite bounded giant drawing');
 }
}
console.log('PASS shape-aware immersion, finite giant draw bounds, smooth far/eye/recycle boundaries');
const warped=textured.texture([78,149,235],7,()=>0.8);
let displaced=0;
for(let y=0;y<192;y++) for(let x=0;x<192;x++) if(textured.silhouette(2,(x/191-.5)*2,(y/191-.5)*2)===0 && warped.pixels[(y*192+x)*4+3]>10) displaced++;
assert(displaced>100,'noise must deform silhouette edges, not only interior brightness');
console.log('PASS noise-warped natural silhouette edges');
const report={samples:samples.length,emptyRoutes,occupiedRoutes,giantFraction:giants,radiusMin:radii[0],radiusMedian:radii[radii.length>>1],radiusMax:radii.at(-1)};
fs.writeFileSync(path.join(__dirname,'verification-cloud-statistics.json'),JSON.stringify(report,null,2));
