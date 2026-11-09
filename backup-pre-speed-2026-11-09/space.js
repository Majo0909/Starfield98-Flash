(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    canvas = $("space"),
    ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    $("toast").textContent = "Prehliadač nepodporuje Canvas 2D.";
    $("toast").className = "visible";
    return;
  }
  const D = window.StarfieldDepth;
  let gas = null;
  const KEY = "space-starfield98-v2",
    defaults = {
      mode: "nebula",
      speed: 5,
      density: 2400,
      trail: 35,
      nebula: 70,
      quality: "auto",
      autopilot: true,
      glow: true,
    },
    settings = { ...defaults };
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    for (const key of Object.keys(defaults))
      if (saved && typeof saved[key] === typeof defaults[key])
        settings[key] = saved[key];
  } catch {
    storageAvailable = false;
  }
  for (const key of ["speed", "density", "trail", "nebula"]) {
    const el = $(key);
    settings[key] = Number.isFinite(settings[key])
      ? Math.max(
          +el.min,
          Math.min(
            +el.max,
            Math.round(settings[key] / (+el.step || 1)) * (+el.step || 1),
          ),
        )
      : defaults[key];
  }
  if (!["nebula", "galaxy", "classic", "gases"].includes(settings.mode))
    settings.mode = "nebula";
  if (!["auto", "high", "low"].includes(settings.quality))
    settings.quality = "auto";
  let seed = 982026;
  // Simple hash-based noise (fast, good enough for camera wandering).
  const _noiseMulA = 0x100000000 + 17 * 13, _noiseMulB = 0x100000000 + 37 * 19;
  function noise2d(x, y) {
    let n = (Math.imul(((x | 0) ^ 735483) | 0, _noiseMulA)) >>> 0;
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b) >>> 0;
    n = Math.imul(((((y | 0) ^ 427229) + n) | 0), _noiseMulB) >>> 0;
    n = (n ^ (n >>> 13)) * 0xc2b2ae35 >>> 0;
    return ((n >>> 0) / 0x100000000) * 2 - 1;
  }
  function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

let W = 0,
    H = 0,
    dpr = 1,
    stars = [],
    farStars = [],
    time = 0,
    running = true,
    warp = false,
    boost = 0;
  let cameraX = 0,
    cameraY = 0,
    targetX = 0,
    targetY = 0,
    last = performance.now(),
    frameCount = 0,
    fpsElapsed = 0,
    fps = 0;
  let qualityScale = 1,
    slowWindows = 0,
    uiTimer,
    toastTimer;
  const backgrounds = {},
    sprites = [],
    starColors = [
      "206,226,255",   // blue-white
      "240,245,255",   // white
      "255,242,180",   // yellow
      "255,175,80",    // orange
      "255,130,60",    // red
    ];
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      storageAvailable = false;
    }
  }
  function notify(text) {
    $("toast").textContent = text;
    $("toast").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 2200);
  }
  function reveal() {
    document.body.classList.add("show-ui");
    clearTimeout(uiTimer);
    uiTimer = setTimeout(() => document.body.classList.remove("show-ui"), 3200);
  }
  function syncUI() {
    for (const key of Object.keys(defaults)) {
      const el = $(key);
      if (el.type === "checkbox") el.checked = settings[key];
      else el.value = settings[key];
      const out = document.querySelector(`output[for="${key}"]`);
      if (out) out.value = settings[key];
    }
    $("modeText").textContent = warp
      ? "WARP / HYPERSPACE"
      : {
          nebula: "HMLOVINA / DEEP SPACE",
          galaxy: "GALAXIA / GOLDEN CORE",
          classic: "STARFIELD / 1998",
          gases: "FAREBNE PLYNY / CLOUD FLIGHT",
        }[settings.mode];
    $("status").textContent = running
      ? settings.autopilot
        ? "AUTOLET"
        : "RUČNÝ LET"
      : "PAUZA";
    $("pauseButton").textContent = running
      ? "Pozastaviť · P"
      : "Pokračovať · P";
    $("warpButton").textContent = warp ? "Vypnúť warp · W" : "Warp · W";
    $("warpButton").setAttribute("aria-pressed", String(warp));
  }
  function hash(x, y) {
    let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 91827;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }
  function noise(x, y) {
    const ix = Math.floor(x),
      iy = Math.floor(y);
    let fx = x - ix,
      fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    return (
      (hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx) * (1 - fy) +
      (hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx) * fy
    );
  }
  function fbm(x, y) {
    let value = 0,
      amp = 0.55;
    for (let i = 0; i < 5; i++) {
      value += noise(x, y) * amp;
      x = x * 2.07 + 17.1;
      y = y * 2.07 + 9.2;
      amp *= 0.48;
    }
    return value;
  }
  function buildBackground(mode) {
    const c = document.createElement("canvas");
    c.width = 1800;
    c.height = 1200;
    const g = c.getContext("2d"),
      image = g.createImageData(c.width, c.height),
      data = image.data;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const u = (x / c.width - 0.5) * 4,
          v = (y / c.height - 0.5) * 3,
          a = fbm(u * 1.8 + 40, v * 1.8 + 40),
          b = fbm(u * 2.6 + a * 1.5 + 90, v * 2.6 + a * 1.5 + 80),
          cNoise = fbm(u * 4.2 + 77, v * 4.2 + 55) * 0.3;
        const lane = v + u * 0.38 + Math.sin(u * 2.3) * 0.1 + cNoise,
          band = Math.exp(-lane * lane * 6),
          dust = Math.pow(Math.max(0, b - 0.22), 2.5) * 3.8,
          core = Math.exp(-((u - 0.28) ** 2 * 2.5 + (v + 0.1) ** 2 * 8)),
          bright = band * dust * (0.45 + a),
          darkDust = Math.pow(Math.max(0, fbm(u * 3.1 + 200, v * 3.1 + 180) - 0.45), 2) * 1.2;
        let r, gc, bl;
        if (mode === "galaxy") {
          const dark = Math.max(
            0.1,
            1 - Math.exp(-((lane + 0.04 + a * 0.06) ** 2) * 750) * 0.85,
          );
          r = 3 + bright * 110 * dark + core * 70 + darkDust * 8;
          gc = 5 + bright * 82 * dark + core * 50 + darkDust * 6;
          bl = 10 + bright * 70 * dark + core * 32 + darkDust * 4;
        } else {
          // Nebula mode: richer color with domain-warped channels
          const cloud = Math.max(0, a - 0.36) * 2.2;
          const warpA = fbm(u * 1.5 + b * 1.8 + 30, v * 1.5 + b * 1.2 + 25);
          const warpB = fbm(u * 1.3 + a * 1.4 + 60, v * 1.3 + a * 1.6 + 50);
          r = 2 + bright * 48 + cloud * (b * 0.7 + warpA * 0.3) * 35;
          gc = 5 + bright * 35 + cloud * ((1 - b) * 0.6 + warpB * 0.4) * 38;
          bl = 12 + bright * 98 + cloud * 62;
          const teal =
            Math.exp(-((u + 0.6) ** 2 * 1.8 + (v - 0.1) ** 2 * 4.5)) * dust;
          gc += teal * 30;
          bl += teal * 32;
          // Add warm accent patches
          const warm = Math.exp(-((u - 0.55) ** 2 * 3 + (v + 0.3) ** 2 * 6)) * cloud * 15;
          r += warm;
          gc *= 1 - warm * 0.1;
        }
        const i = (y * c.width + x) * 4;
        data[i]     = Math.min(255, r);
        data[i + 1] = Math.min(255, gc);
        data[i + 2] = Math.min(255, bl);
        data[i + 3] = 255;
      }
    g.putImageData(image, 0, 0);
    backgrounds[mode] = c;
  }
  function buildSprites() {
    for (const color of starColors) {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d"),
        grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.07, `rgba(${color},.95)`);
      grad.addColorStop(0.2, `rgba(${color},.22)`);
      grad.addColorStop(0.5, `rgba(${color},.055)`);
      grad.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      sprites.push(c);
    }
    // Build white hot core sprite for brightest stars.
    const c2 = document.createElement("canvas");
    c2.width = c2.height = 64;
    const g2 = c2.getContext("2d"),
      grad2 = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad2.addColorStop(0, "rgba(255,255,255,1)");
    grad2.addColorStop(0.04, "rgba(220,230,255,.98)");
    grad2.addColorStop(0.12, "rgba(180,200,255,.3)");
    grad2.addColorStop(0.5, "rgba(160,180,240,.06)");
    grad2.addColorStop(1, "rgba(160,180,240,0)");
    g2.fillStyle = grad2;
    g2.fillRect(0, 0, 64, 64);
    sprites.push(c2);
  }
  function newStar(initial = false) {
    return D.create(random, W || innerWidth, H || innerHeight, initial);
  }
  function populate(initial = false) {
    // Density edits fill the visible volume, not just the invisible far plane.
    // Keep ordinary flight recycling at FAR; fade additions in over 1.6 seconds.
    while (stars.length < settings.density) {
      const star = newStar(true);
      if (!initial) star.age = running ? 0 : 2;
      stars.push(star);
    }
    stars.length = settings.density;
  }
  function resize() {
    W = innerWidth;
    H = innerHeight;
    dpr =
      settings.quality === "low"
        ? 1
        : Math.min(
            devicePixelRatio || 1,
            settings.quality === "high" ? 2 : 1.5,
          ) * qualityScale;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function freshSky() {
    seed = Date.now() >>> 0 || 98;
    stars = [];
    populate(true);
    if (gas) gas.reset();
    farStars = [];
    const countFar = 1800; // More background stars for depth with 2400+ main stars
    for (let i = 0; i < countFar; i++) {
      const u = random(), mag = 1 - Math.pow(1 - u, 2.8);
      // Dim far stars: mostly red/orange dwarfs, some white.
      let specT = 0.6 + random() * 0.35;
      if (mag > 0.7) specT = 0.25 + random() * 0.25;
      const rgb = D.spectralColor(specT);
      farStars.push({
        x: random(),
        y: random(),
        r: 0.2 + mag * 0.6, // dimmer max size since they're "far"
        a: (0.12 + mag * 0.35) * (random() < 0.15 ? 1.4 : 1), // occasional brighter star
        phase: random() * Math.PI * 2,
        speed: 2 + random() * 5,
        rgb,
      });
    }
  }
  function background() {
    ctx.fillStyle = settings.mode === "classic" ? "#000" : "#02040b";
    ctx.fillRect(0, 0, W, H);
    if (settings.mode === "classic") return;
    const bg = backgrounds[settings.mode] || backgrounds.nebula,
      scale = Math.max(W / bg.width, H / bg.height) * 1.23;
    ctx.save();
    ctx.translate(W * 0.5 + cameraX * W * 0.018, H * 0.5 + cameraY * H * 0.018);
    ctx.rotate(Math.sin(time * 0.012) * 0.018);
    ctx.globalAlpha =
      (settings.nebula / 100) *
      (1 - boost * 0.55) *
      (settings.mode === "gases" ? 0.18 : 1);
    ctx.drawImage(
      bg,
      (-bg.width * scale) / 2,
      (-bg.height * scale) / 2,
      bg.width * scale,
      bg.height * scale,
    );
    ctx.restore();
    ctx.fillStyle = "#c6daff";
    for (const s of farStars) {
      const twinkle = 0.87 + Math.sin(time * s.speed + s.phase) * 0.13;
      ctx.globalAlpha = s.a * twinkle;
      ctx.fillStyle = `rgb(${s.rgb[0]},${s.rgb[1]},${s.rgb[2]})`;
      const x = (((s.x * W + cameraX * 12 + time * 0.35) % W) + W) % W,
        y = (((s.y * H + cameraY * 8) % H) + H) % H;
      ctx.fillRect(x, y, Math.max(1, Math.ceil(s.r)), Math.max(1, Math.ceil(s.r)));
    }
    ctx.globalAlpha = 1;
  }
  function drawStars(dt) {
    const focal = Math.min(W, H) * 0.9,
      velocity = settings.speed * 0.031 * (1 + boost * 10),
      travel = velocity * dt,
      cx = W * (0.5 + cameraX * 0.065),
      cy = H * (0.5 + cameraY * 0.065),
      roll = settings.mode === "classic" ? 0 : Math.sin(time * 0.12) * 0.03 + noise2d(time * 0.06, 99) * 0.04;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(roll);

    // Two-pass: dimmer background stars first (depth layering).
    const bgPass = [], mainPass = [];
    for (const s of stars) {
      if (dt > 0) {
        s.z -= travel;
        s.age += dt;
      }
      if (s.z < D.NEAR) { Object.assign(s, newStar()); continue; }
      const x = ((s.x - cameraX * 0.13) * focal) / s.z,
        y = ((s.y - cameraY * 0.1) * focal) / s.z;
      if (Math.abs(x) > W * 0.8 || Math.abs(y) > H * 0.8) {
        if (dt > 0) Object.assign(s, newStar());
        continue;
      }
      const depth = Math.max(0, 1 - s.z / D.FADE_START);
      let alpha = Math.min(1, 0.16 + depth * 0.85) * D.visibility(s.z, s.age);
      if (settings.mode === "gases")
        alpha *= gas.transmission(
          s.x, s.y, s.z, cameraX, cameraY, settings.nebula / 100,
        );
      if (alpha < 0.001) continue;

      // Twinkle: closer/brighter stars shimmer more.
      const twinkle = 1 + Math.sin(time * s.twinkleSpeed + s.twinklePhase) * s.twinkleDepth;
      const radius = Math.min(3.2, s.size * twinkle * (0.35 + 1.1 / s.z));

      // Per-star color from spectral type; map to nearest sprite index.
      const col = s.rgb || (starColors[s.color] ? starColors[s.color].split(",") : [255,255,255]).map(Number);
      ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;

      // Map per-star rgb to nearest sprite index for glow compositing.
      let si = s.color;
      if (si === undefined) {
        const [r, g, b] = col;
        let bestDist = Infinity, bestIdx = 0;
        for (let j = 0; j < starColors.length; j++) {
          const [cr, cg, cb] = starColors[j].split(",").map(Number);
          const d = Math.sqrt((r-cr)**2 + (g-cg)**2 + (b-cb)**2);
          if (d < bestDist) { bestDist = d; bestIdx = j; }
        }
        si = bestIdx;
      }

      // Trail to older Z position.
      const length = ((settings.trail / 100) * 0.035 + boost * 0.14) * velocity,
        oldZ = s.z + length,
        px = ((s.x - cameraX * 0.13) * focal) / oldZ,
        py = ((s.y - cameraY * 0.1) * focal) / oldZ;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = Math.max(0.55, radius * 0.85);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();

      // Colored body rect for the star.
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      const hw = Math.max(1, Math.round(radius / 2));
      ctx.fillRect(x - hw, y - hw, hw * 2, hw * 2);

      // Radial glow halo for bright stars (spectral tint).
      if (settings.glow && settings.mode !== "classic" && radius > 0.8) {
        const glowSize = Math.min(32, radius * 5);
        ctx.globalAlpha = alpha * 0.18;
        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.5)`;
        ctx.fill();
      }
      // Cross flare for brightest stars (spectral tint).
      if (radius > 1.6 && settings.glow && settings.mode !== "classic") {
        const flareLen = radius * 3.5, flareW = 0.7;
        ctx.globalAlpha = alpha * 0.22;
        ctx.fillStyle = `rgb(${Math.min(255,col[0]+30)},${Math.min(255,col[1]+30)},${Math.min(255,col[2]+30)})`;
        ctx.fillRect(x - flareLen, y - flareW / 2, flareLen * 2, flareW);
        ctx.fillRect(x - flareW / 2, y - flareLen, flareW, flareLen * 2);
      }

      // Background layer: draw dimmer stars once without glow for depth.
      if (s.size < 0.5) {
        ctx.globalAlpha = alpha * 0.6;
        const bh = Math.max(1, Math.round(radius / 2));
        ctx.fillRect(x - bh, y - bh, bh * 2 + 1, bh * 2 + 1);
      }
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
  function render(dt) {
    time += dt;
    const ease = 1 - Math.exp(-dt * 2.2);
    boost += (Number(warp) - boost) * (1 - Math.exp(-dt * 1.7));
    let tx, ty;
    if (settings.autopilot) {
      // Multi-octave noise-based organic camera wander.
      const t = time * 0.042;
      const nx = noise2d(t, 0.3) * 0.55 + noise2d(t * 2.1 + 7, 0.8) * 0.15;
      const ny = noise2d(0.5, t) * 0.4 + noise2d(0.7, t * 1.7 + 3) * 0.12;
      tx = nx;
      ty = ny;
    } else {
      tx = targetX;
      ty = targetY;
    }
    cameraX += (tx - cameraX) * ease;
    cameraY += (ty - cameraY) * ease;
    background();
    if (settings.mode === "gases") {
      gas.advance(settings.speed * 0.031 * (1 + boost * 10) * dt);
      gas.render(ctx, W, H, cameraX, cameraY, time, settings.nebula / 100);
    }
    drawStars(dt);
  }
  function frame(now) {
    const elapsed = Math.max(0, (now - last) / 1000);
    last = now;
    if (!document.hidden) {
      // Integrate wall time: a costly cloud frame must not slow flight itself.
      // visibilitychange and pause already reset the clock after suspension.
      if (running) render(elapsed);
      frameCount++;
      fpsElapsed += elapsed;
      if (fpsElapsed >= 1) {
        fps = Math.round(frameCount / fpsElapsed);
        $("fps").textContent = fps + " FPS";
        if (running && settings.quality === "auto") {
          slowWindows = fps < 38 ? slowWindows + 1 : 0;
          if (slowWindows >= 4 && qualityScale > 0.65) {
            qualityScale = Math.max(0.65, qualityScale - 0.15);
            resize();
            slowWindows = 0;
          }
        }
        frameCount = 0;
        fpsElapsed = 0;
      }
    }
    requestAnimationFrame(frame);
  }
  function togglePause() {
    running = !running;
    last = performance.now();
    syncUI();
    reveal();
  }
  function toggleWarp() {
    warp = !warp;
    syncUI();
    reveal();
  }
  function panel(open) {
    $("panel").hidden = !open;
    document.body.classList.toggle("panel-open", open);
    if (open) $("mode").focus();
    else $("settingsButton").focus();
    reveal();
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notify("Celá obrazovka nie je dostupná. Skús F11 v prehliadači.");
    }
  }
  function change(key, value) {
    settings[key] = value;
    if (key === "density") populate();
    if (key === "quality") {
      qualityScale = 1;
      slowWindows = 0;
      resize();
    }
    save();
    syncUI();
    if (!running) render(0);
  }
  for (const key of Object.keys(defaults)) {
    const el = $(key);
    el.addEventListener("input", () =>
      change(
        key,
        el.type === "checkbox"
          ? el.checked
          : typeof defaults[key] === "number"
            ? +el.value
            : el.value,
      ),
    );
  }
  $("settingsButton").onclick = () => panel($("panel").hidden);
  $("close").onclick = () => panel(false);
  $("pauseButton").onclick = togglePause;
  $("warpButton").onclick = toggleWarp;
  $("fullscreenButton").onclick = fullscreen;
  $("reset").onclick = () => {
    Object.assign(settings, defaults);
    warp = false;
    boost = 0;
    qualityScale = 1;
    slowWindows = 0;
    populate();
    resize();
    save();
    syncUI();
    render(0);
    notify("Predvolené nastavenia obnovené");
  };
  $("newSky").onclick = () => {
    freshSky();
    render(0);
    notify("Nové hviezdne pole");
  };
  $("snapshot").onclick = () => {
    canvas.toBlob((blob) => {
      if (!blob) {
        notify("Snímku sa nepodarilo uložiť");
        return;
      }
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "Space-Starfield-98.png";
      a.hidden = true;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, "image/png");
  };
  addEventListener("resize", () => {
    resize();
    if (!running) render(0);
  });
  addEventListener(
    "pointermove",
    (e) => {
      targetX = (e.clientX / W - 0.5) * 2;
      targetY = (e.clientY / H - 0.5) * 2;
      reveal();
    },
    { passive: true },
  );
  addEventListener("pointerdown", reveal, { passive: true });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("panel").hidden) panel(false);
      document.body.classList.remove("show-ui");
      return;
    }
    if (
      e.target.matches("input,select,button") &&
      [" ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
    )
      return;
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "p" || k === " ") {
      e.preventDefault();
      togglePause();
    }
    if (k === "s") panel($("panel").hidden);
    if (k === "w") toggleWarp();
    if (k === "a") {
      change("autopilot", !settings.autopilot);
      reveal();
    }
    if (k === "f" || k === "f11") {
      e.preventDefault();
      fullscreen();
    }
    if (["1", "2", "3", "4"].includes(k)) {
      change("mode", ["nebula", "galaxy", "classic", "gases"][+k - 1]);
      reveal();
    }
  });
  addEventListener("blur", () => {
    targetX = targetY = 0;
  });
  document.addEventListener("visibilitychange", () => {
    last = performance.now();
    frameCount = 0;
    fpsElapsed = 0;
  });
  Object.defineProperty(window, "starfield", {
    value: Object.freeze({
      get state() {
        return {
          settings: { ...settings },
          running,
          warp,
          boost,
          time,
          starCount: stars.length,
          farStarCount: farStars.length,
          starDepth: {
            spawn: D.FAR,
            fadeStart: D.FADE_START,
            birthOpacity: D.visibility(D.FAR, 0),
          },
          gas: gas.state,
          fps,
          width: W,
          height: H,
          dpr,
          storageAvailable,
        };
      },
    }),
  });
  buildBackground("nebula");
  buildBackground("galaxy");
  buildSprites();
  gas = new window.GasClouds(random, fbm);
  freshSky();
  resize();
  syncUI();
  render(0);
  reveal();
  if (!storageAvailable)
    notify("Ukladanie nie je dostupné; nastavenia platia do zatvorenia.");
  requestAnimationFrame(frame);
})();
