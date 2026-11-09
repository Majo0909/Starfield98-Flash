"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const D = require("./depth.js");
const passed = [];
function test(name, run) {
  run();
  passed.push(name);
}
let seed = 98;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
  return (seed >>> 0) / 4294967296;
}
test("Stars spawn 5.6 times farther away than the original plane", () =>
  assert(D.FAR > 5 * 5));
test("New stars are invisible regardless of age at spawn plane", () => {
  for (const age of [0, 0.1, 1, 100]) assert.equal(D.visibility(D.FAR, age), 0);
});
test("Distant fade-in is continuous and monotonic", () => {
  let previous = 0;
  for (let z = D.FAR; z >= D.FADE_START; z -= 0.01) {
    const a = D.visibility(z, 2);
    assert(a >= previous - 1e-10);
    assert(a - previous < 0.002);
    previous = a;
  }
  assert.equal(D.visibility(D.FADE_START, 2), 1);
});
test("Age fade prevents density-control pop-in", () => {
  assert.equal(D.visibility(3, 0), 0);
  assert.equal(D.visibility(3, 1.6), 1);
  assert(D.visibility(3, 0.01) < 0.001);
});
test("All recycled stars have zero birth opacity", () => {
  for (let i = 0; i < 10000; i++) {
    const s = D.create(random, 1920, 1080);
    assert.equal(s.z, D.FAR);
    assert.equal(s.age, 0);
    assert.equal(D.visibility(s.z, s.age), 0);
  }
});
test("Initial stars remain within the depth range in portrait and landscape", () => {
  for (const [w, h] of [
    [390, 844],
    [1920, 1080],
  ])
    for (let i = 0; i < 1000; i++) {
      const s = D.create(random, w, h, true);
      assert(s.z >= 0.2 && s.z <= D.FAR);
      assert(Number.isFinite(s.x + s.y));
    }
});
test("Gas attenuates rays through cloud, not empty space", () => {
  const c = { x: 0, y: 0, z: 3, radius: 2, density: 1 };
  assert(D.rayDensity(c, 0, 0, 20) > 0.9);
  assert.equal(D.rayDensity(c, 5, 5, 20), 0);
});
test("Gas behind star or behind camera does not occlude it", () => {
  assert.equal(
    D.rayDensity({ x: 0, y: 0, z: 10, radius: 2, density: 1 }, 0, 0, 2),
    0,
  );
  assert.equal(
    D.rayDensity({ x: 0, y: 0, z: -4, radius: 2, density: 1 }, 0, 0, 20),
    0,
  );
});
// No rendering mocks are used as visual evidence: these only test volume lifecycle.
const sandbox = {
  window: { StarfieldDepth: D },
  Math,
  document: {
    createElement() {
      return {
        getContext() {
          return {};
        },
      };
    },
  },
};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "gases.js"), "utf8"),
  sandbox,
);
const Gas = sandbox.window.GasClouds;
Gas.prototype.texture = () => ({});
test("Clouds move by exactly the travelled world distance", () => {
  const g = new Gas(random, () => 0);
  const before = g.clouds.map((c) => c.z);
  g.advance(0.25);
  g.clouds.forEach((c, i) => {
    const moved = before[i] - 0.25;
    const expected = moved < -48 ? moved + 240 : moved;
    assert(Math.abs(c.z - expected) < 1e-10, 'exact travel including recycle overshoot');
  });
});
test("Clouds are recycled only behind camera and outside visible far range", () => {
  const g = new Gas(random, () => 0);
  const count = g.clouds.length;
  for (let i = 0; i < 1000; i++) {
    const previousPassed = g.passed;
    g.advance(0.05);
    if (g.passed > previousPassed)
      assert(Math.max(...g.clouds.map((c) => c.z)) >= 48);
    assert.equal(g.clouds.length, count);
    assert(g.clouds.every((c) => Number.isFinite(c.z)));
  }
  assert(g.passed > 0);
});
test("Inside cloud substantially obscures stars", () => {
  const g = new Gas(random, () => 0);
  g.clouds = [{ x: 0, y: 0, z: 0, radius: 2, density: 1 }];
  // A camera inside the cloud integrates the forward half, not a discontinuous zero.
  assert(g.transmission(0, 0, 10, 0, 0, 1) < 0.2);
});
test("Reset randomizes space without restoring a guaranteed corridor and clears travel", () => {
  const g = new Gas(random, () => 0);
  g.advance(6);
  g.reset();
  assert.equal(g.distance, 0);
  assert.equal(g.passed, 0);
  assert.notEqual(g.clouds[0].z, 3);
  assert(g.clouds.every(c=>c.z>=-48 && c.z<=192));
});
console.log(JSON.stringify({ passed: passed.length, tests: passed }, null, 2));
