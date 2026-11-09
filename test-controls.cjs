"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const D = require('./depth.js');
function boot() {
  const elements = {};
  const context = new Proxy({}, {get: (o,k) => o[k] || (() => {})});
  const element = id => elements[id] ||= {value:'',type:'',min:0,max:100,step:1,style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},getContext(){return context;}};
  for (const id of ['speed','density','trail','nebula']) {
    const tag = html.match(new RegExp('<input\\s+id="'+id+'"[^>]*>'))[0];
    Object.assign(element(id), {min:+tag.match(/min="(\d+)"/)[1],max:+tag.match(/max="(\d+)"/)[1]});
  }
  const sandbox = {window:{StarfieldDepth:D},document:{getElementById:element,querySelector(){return null;},body:{classList:{add(){},remove(){},toggle(){}}},addEventListener(){},hidden:false},localStorage:{getItem(){return '{}';},setItem(){}},performance:{now:()=>0},innerWidth:1920,innerHeight:1080,devicePixelRatio:1,addEventListener(){},setTimeout(){},clearTimeout(){},requestAnimationFrame(){},console};
  let source = fs.readFileSync(path.join(__dirname,'space.js'),'utf8');
  source = source.slice(0,source.indexOf('  buildBackground("nebula");')) + `
    gas = {advance(){},render(){},transmission(){return 1;},get state(){return {};}};
    W=1920; H=1080; settings.mode='classic'; populate(true);
    window.test = {change, frame, render, get stars(){return stars;}};
  })();`;
  vm.runInNewContext(source,sandbox);
  return sandbox.window;
}
const which = process.argv[2] || 'all';
if (which === 'speed' || which === 'all') {
  assert.equal(+html.match(/id="speed"[^>]*max="(\d+)"/)[1],200);
  console.log('PASS speed maximum 200');
}
if (which === 'density' || which === 'all') {
  const app=boot();
  const start=app.test.stars.length;
  app.test.change('density',40000);
  const added=app.test.stars.slice(start);
  assert(added.filter(s=>s.z<D.FADE_START).length>added.length*0.5,'added stars must populate visible depth immediately');
  assert(added.every(s=>s.age===0),'new stars must fade in');
  app.test.render(2);
  assert(app.test.stars.filter(s=>D.visibility(s.z,s.age)>0.5).length>20000,'density must be visible after two seconds');
  console.log('PASS density visible within two seconds');
}
if (which === 'clock' || which === 'all') {
  const app=boot();
  for(let now=100;now<=1000;now+=100) app.test.frame(now);
  assert(Math.abs(app.starfield.state.time-1)<1e-9,'10 FPS must still advance one second per second');
  console.log('PASS low FPS does not slow simulation');
}
