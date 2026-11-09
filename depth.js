/* Shared depth rules, also executable by the Node regression tests. */
((root) => {
  "use strict";
  const FAR = 56;
  const FADE_START = 38;
  const NEAR = 0.06;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const smooth = (x) => {
    x = clamp(x);
    return x * x * (3 - 2 * x);
  };
  // Spectral type color table (normalized RGB ~0-255).
  // Index by spectral parameter in [0,1): 0=blue O-type → 1=red M-type.
  const spectralTable = [
    { t: 0.00, rgb: [174, 200, 255] },   // O blue-white
    { t: 0.08, rgb: [166, 190, 255] },   // B blue
    { t: 0.18, rgb: [200, 215, 255] },   // A white-blue
    { t: 0.30, rgb: [240, 245, 255] },   // A white
    { t: 0.42, rgb: [255, 250, 238] },   // F yellow-white
    { t: 0.52, rgb: [255, 242, 180] },   // G yellow (Sun-like)
    { t: 0.65, rgb: [255, 210, 128] },   // K orange
    { t: 0.78, rgb: [255, 175, 80] },    // K-M orange-red
    { t: 0.90, rgb: [255, 130, 60] },    // M red dwarf
    { t: 1.00, rgb: [255, 85, 40] },     // deep M red
  ];

  function spectralColor(t) {
    t = ((t % 1) + 1) % 1;
    for (let i = 0; i < spectralTable.length - 1; i++) {
      const a = spectralTable[i], b = spectralTable[i + 1];
      if (t >= a.t && t <= b.t) {
        const f = (t - a.t) / (b.t - a.t);
        return [
          Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * f),
          Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * f),
          Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * f),
        ];
      }
    }
    return spectralTable[spectralTable.length - 1].rgb;
  }

  // Power-law magnitude distribution. Most stars are dim, few are bright.
  function magnitudes(random) {
    const u = random();
    return 1 - Math.pow(1 - u, 2.8);
  }

  function visibility(z, age) {
    const base = smooth((FAR - z) / (FAR - FADE_START)) * smooth(age / 1.6);
    return base;
  }
  function create(random, width, height, initial = false) {
    // Z distribution: denser near camera for immersion, sparser at distance.
    const z = initial
      ? 0.2 + (1 - Math.pow(1 - random(), 0.7)) * (FAR - 0.2)
      : FAR;

    const focal = Math.max(1, Math.min(width, height) * 0.9);

    // Magnitude (brightness) follows power law — few bright, many dim.
    const mag = magnitudes(random);

    // Spectral type: correlated with brightness.
    // Bright stars → blue/white; most dim stars → red dwarfs.
    let specT;
    if (mag > 0.85) {
      specT = random() < 0.35 ? random() * 0.18
            : random() < 0.7 ? 0.18 + random() * 0.24
            : 0.52 + random() * 0.05;
    } else if (mag > 0.5) {
      specT = 0.38 + random() * 0.35;
    } else {
      specT = 0.55 + random() * 0.42;
    }

    const rgb = spectralColor(specT);

    // Size from magnitude with variance.
    const size = Math.max(0.25, Math.min(3.5, 0.3 + mag * 1.6 + (random() - 0.5) * 0.2));

    return {
      x: (((random() - 0.5) * width) / focal) * z * 1.6,
      y: (((random() - 0.5) * height) / focal) * z * 1.6,
      z,
      age: initial ? (2 + random() * 3) : 0,
      rgb,
      mag,
      specT,
      size,
      twinklePhase: random() * Math.PI * 2,
      twinkleSpeed: 1.5 + random() * 4.5,
      twinkleDepth: 0.08 + mag * 0.22,
    };
  }
  function rayDensity(cloud, x, y, limit = Infinity, offsetX = 0, offsetY = 0) {
    // Integral of a compact Gaussian-like cloud along a camera-to-star ray.
    // Offsets avoid constructing a translated cloud for every star/cloud pair.
    const cx = cloud.x - offsetX, cy = cloud.y - offsetY;
    const norm = 1 + x * x + y * y;
    const t = Math.max(
      0,
      Math.min(limit, (cx * x + cy * y + cloud.z) / norm),
    );
    const distance2 =
      (x * t - cx) ** 2 + (y * t - cy) ** 2 + (t - cloud.z) ** 2;
    if (distance2 >= cloud.radius ** 2) return 0;
    const inside = 1 - distance2 / cloud.radius ** 2;
    return (
      inside *
      inside *
      cloud.density *
      Math.min(1, Math.max(0, cloud.z + cloud.radius) / cloud.radius)
    );
  }
  const api = Object.freeze({
    FAR,
    FADE_START,
    NEAR,
    clamp,
    smooth,
    spectralColor,
    magnitudes,
    visibility,
    create,
    rayDensity,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.StarfieldDepth = api;
})(typeof window === "undefined" ? globalThis : window);
