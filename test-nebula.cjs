"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const D = require('./depth.js');
const window = { StarfieldDepth: D };
const document = { createElement() { const c = { width: 0, height: 0 }; c.getContext = () => ({ createImageData: (w,h) => ({data:new Uint8ClampedArray(w*h*4)}), putImageData: image => { c.pixels = image.data; } }); return c; } };
new Function('window','document',fs.readFileSync(require('node:path').join(__dirname,'gases.js'),'utf8'))(window,document);
let seed = 98;
const random = () => ((seed = (Math.imul(seed,1664525)+1013904223)|0) >>> 0)/4294967296;
const gas = Object.create(window.GasClouds.prototype); gas.random=random; gas.reset();
assert(gas.clouds.some(c=>c.z < -3), 'clouds must inhabit space behind camera');
assert(gas.clouds.some(c=>c.x>3) && gas.clouds.some(c=>c.x< -3), 'clouds on both lateral sides');
assert(gas.clouds.some(c=>c.y>3) && gas.clouds.some(c=>c.y< -3), 'clouds above and below');
assert(new Set(gas.clouds.map(c=>Math.round(c.z*100)%450)).size>5, 'random depths, not fixed planes');
const count=gas.clouds.length;
for(let i=0;i<3000;i++) { const previous=gas.clouds.slice(); gas.advance(0.1); gas.clouds.forEach((c,j)=>{ if(c!==previous[j]) { assert(previous[j].z < -48); assert(c.z>=184); } }); assert.equal(gas.clouds.length,count); }
assert(gas.passed>count);
gas.advance(10000); assert(gas.clouds.every(c=>c.z>=184 && c.z<184+c.radius*1.35+240),'large elapsed time stays bounded');
console.log('PASS surrounding 3D distribution, random depths, bounded seamless recycling');
// Constant density isolates color variation from brightness/noise.
const textured = new window.GasClouds(random, () => 0.6);
function hueSpread(texture) {
  const ratios=[];
  for(let i=0;i<texture.pixels.length;i+=4) if(texture.pixels[i+3]>20) {
    const sum=texture.pixels[i]+texture.pixels[i+1]+texture.pixels[i+2];
    ratios.push(texture.pixels[i]/sum);
  }
  return Math.max(...ratios)-Math.min(...ratios);
}
const spreads=textured.textures.map(hueSpread);
assert(spreads.filter(s=>s>0.15).length>=3,'individual textures need spatially mixed colors');
assert(spreads.some(s=>s<0.02),'retain dominant single-hue clouds');
let draws=0;
const context={clearRect(){},save(){},restore(){},translate(){},rotate(){},drawImage(){draws++;},fillRect(){}};
textured.context=context;
textured.clouds=[{x:4,y:2,z:-1,radius:2,density:1,color:0,texture:0,angle:0,stretch:1}];
textured.render({drawImage(){}},1280,720,0,0,0,1);
assert.equal(draws,0,'behind-camera cloud center must not project as a front sprite');
console.log('PASS coherent mixed and dominant textures; no behind-camera projection');
