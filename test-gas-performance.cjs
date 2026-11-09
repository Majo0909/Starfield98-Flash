"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const D = require("./depth.js");
// Load both implementations in the same Node realm for fair JIT benchmarking.
const window = { StarfieldDepth: D };
new Function("window", fs.readFileSync(path.join(__dirname, "gases.js"), "utf8"))(window);
const Gas = window.GasClouds;
let seed = 98;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
  return (seed >>> 0) / 4294967296;
}
// Frozen pre-optimization formula: independent oracle, including operation order.
function legacyRay(cloud, x, y, limit = Infinity) {
  const norm = 1 + x * x + y * y;
  const t = Math.max(0, Math.min(limit, (cloud.x * x + cloud.y * y + cloud.z) / norm));
  const distance2 = (x * t - cloud.x) ** 2 + (y * t - cloud.y) ** 2 + (t - cloud.z) ** 2;
  if (distance2 >= cloud.radius ** 2) return 0;
  const inside = 1 - distance2 / cloud.radius ** 2;
  return inside * inside * cloud.density * Math.min(1, Math.max(0, cloud.z + cloud.radius) / cloud.radius);
}
function legacyTransmission(x, y, z, cameraX, cameraY, amount) {
  let opticalDepth = 0;
  const rx = (x - cameraX * 0.13) / z, ry = (y - cameraY * 0.1) / z;
  for (const c of this.clouds) {
    opticalDepth += legacyRay({ ...c, x: c.x - cameraX * 0.13, y: c.y - cameraY * 0.1 }, rx, ry, z);
  }
  return Math.exp(-opticalDepth * amount * 1.8);
}
const gas = Object.create(Gas.prototype);
gas.random = random;
gas.reset();
const stars = Array.from({ length: 40000 }, () => D.create(random, 1920, 1080, true));
function benchmark() {
  function frame(fn) {
    let checksum = 0;
    for (const s of stars) checksum += fn.call(gas, s.x, s.y, s.z, 0.7, -0.4, 0.8);
    return checksum;
  }
  for (let i = 0; i < 8; i++) { frame(legacyTransmission); frame(Gas.prototype.transmission); }
  const legacy = [], current = [];
  let checksum;
  for (let i = 0; i < 15; i++) {
    // Alternate order to limit systematic warmup/thermal bias.
    const cases = i % 2 ? [[Gas.prototype.transmission, current], [legacyTransmission, legacy]] : [[legacyTransmission, legacy], [Gas.prototype.transmission, current]];
    for (const [fn, samples] of cases) {
      const start = performance.now();
      const result = frame(fn);
      samples.push(performance.now() - start);
      if (checksum === undefined) checksum = result;
      assert.equal(result, checksum);
    }
  }
  const median = xs => [...xs].sort((a, b) => a - b)[7];
  console.log(JSON.stringify({ node: process.version, stars: stars.length, clouds: gas.clouds.length, warmupFrames: 8, measuredFrames: 15, legacyMedianMs: median(legacy), currentMedianMs: median(current), speedup: median(legacy) / median(current), checksum }, null, 2));
}
if (process.argv.includes("--benchmark")) { benchmark(); process.exit(0); }
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
test("rayDensity accepts camera offsets without copying the cloud", () => {
  const c = Object.freeze({ x: 1, y: 0.5, z: 2, radius: 2, density: 1.2 });
  assert.equal(D.rayDensity(c, 0.2, -0.1, 10, 0.8, 0.3), legacyRay({ ...c, x: c.x - 0.8, y: c.y - 0.3 }, 0.2, -0.1, 10));
  assert.equal(D.rayDensity(c, 0.2, -0.1), legacyRay(c, 0.2, -0.1));
});
test("transmission never enumerates/copies cloud objects", () => {
  let enumerations = 0;
  const g = Object.create(Gas.prototype);
  g.clouds = [new Proxy({ x: 0, y: 0, z: 2, radius: 2, density: 1 }, { ownKeys(target) { enumerations++; return Reflect.ownKeys(target); } })];
  assert(g.transmission(0, 0, 10, 0.5, -0.3, 1) < 1);
  assert.equal(enumerations, 0);
});
test("40000 seeded stars match original transmission exactly", () => {
  const before = JSON.stringify(gas.clouds);
  for (const s of stars) {
    const args = [s.x, s.y, s.z, (random() - 0.5) * 8, (random() - 0.5) * 8, random()];
    assert.equal(gas.transmission(...args), legacyTransmission.call(gas, ...args));
  }
  assert.equal(JSON.stringify(gas.clouds), before);
});
test("boundary, immersion, tangent, behind-camera and beyond-star rays remain exact", () => {
  const g = Object.create(Gas.prototype);
  for (const radius of [0.001, 1, 2.2, 100]) {
    for (const limit of [0.06, 1, 28]) {
      for (const z of [-radius - 1e-12, -radius, -radius + 1e-12, 0, limit - radius, limit + radius - 1e-12, limit + radius, limit + radius + 1e-12]) {
        for (const x of [0, radius - 1e-12, radius, radius + 1e-12]) {
          g.clouds = [Object.freeze({ x, y: 0, z, radius, density: 1.2 })];
          for (const amount of [0, 0.5, 1]) {
            for (const camera of [0, -1, 1]) {
              const args = [0, 0, limit, camera, -camera, amount];
              assert.equal(g.transmission(...args), legacyTransmission.call(g, ...args));
            }
          }
        }
      }
    }
  }
  g.clouds = [];
  assert.equal(g.transmission(1, 2, 3, 1, 1, 1), 1);
});
test("noncontributing depth slabs skip ray coordinate work", () => {
  const g = Object.create(Gas.prototype);
  let coordinateReads = 0;
  g.clouds = [-3, 12, 50].map(z => ({
    get x() { coordinateReads++; return 0; },
    get y() { coordinateReads++; return 0; },
    z, radius: 2, density: 1,
  }));
  assert.equal(g.transmission(0, 0, 10, 0, 0, 1), 1);
  assert.equal(coordinateReads, 0);
});
console.log(`${passed} gas performance regression tests passed`);
