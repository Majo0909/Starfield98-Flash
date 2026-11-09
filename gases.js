/* Local, traversable gas volumes. Low-resolution compositing bounds fill cost. */
(() => {
  "use strict";
  const D = window.StarfieldDepth;
  const palette = [
    [78, 149, 235],     // classic blue
    [178, 65, 193],     // purple
    [34, 171, 151],     // teal/cyan
    [229, 100, 71],     // red-orange
    [121, 95, 224],     // indigo
    [255, 110, 130],    // pink nebula
    [60, 200, 170],     // mint green (emission nebula)
    [200, 180, 100],    // golden haze
    [100, 150, 255],    // bright sapphire
    [255, 160, 70],     // amber/golden star-forming region
  ];
  class GasClouds {
    constructor(random, fbm, deferAtlas = false) {
      this.random = random;
      this.fbm = fbm;
      // Adjustable nebula field: total cloud count and what share of clouds
      // falls into the giant bands (0..0.3). The settings sliders drive these
      // through setCount() and giantChance; recycled clouds pick up the new
      // frequency, existing clouds keep their baked size.
      this.count = 48;
      this.giantChance = 0.065;
      this.layer = document.createElement("canvas");
      this.context = this.layer.getContext("2d");
      // deferAtlas: bake the atlas one texture-row per pump (see bakeStep)
      // so startup never blocks the first paint. Eager callers still route
      // through texture(), preserving the seam tests stub that method on.
      if (deferAtlas) {
        this.textures = new Array(50);
        this.bake = { index: 0, gen: null };
      } else {
        this.bake = null;
        this.textures = Array.from({ length: 50 }, (_, index) =>
          this.texture(palette[index % palette.length], index, this.fbm),
        );
      }
      this.reset();
    }
    bakeStep() {
      const b = this.bake;
      if (!b) return true;
      if (!b.gen)
        b.gen = this.textureRows(
          palette[b.index % palette.length],
          b.index,
          this.fbm,
        );
      const done = b.gen.next();
      if (done.done) {
        this.textures[b.index] = done.value;
        b.index++;
        b.gen = null;
        if (b.index >= this.textures.length) this.bake = null;
      }
      return !this.bake;
    }
    bakeAll() {
      while (!this.bakeStep());
    }
    // Compact analytic masks are baked into the atlas, not evaluated per pixel/frame.
    // All shapes fit inside the same unit box; stretching alone cannot create these.
    silhouette(shape, u, v) {
      const ellipse = (x, y, a, b) => Math.max(0, 1 - Math.hypot((u-x)/a, (v-y)/b));
      let edge;
      if (shape === 1) { // Lobed bank, deep asymmetric bays.
        edge = Math.max(ellipse(-0.38,0.2,0.48,0.42), ellipse(0.15,0.03,0.43,0.6), ellipse(0.52,0.26,0.34,0.3));
      } else if (shape === 2) { // Swept wisp with tapered curling tail.
        const spine = 0.29*Math.sin(u*3.7) - 0.12;
        edge = Math.min(1-Math.abs(u)/0.94, 1-Math.abs(v-spine)/(0.09+0.29*(u+1)/2));
      } else if (shape === 3) { // Two branching filaments, not an ellipse.
        const a = 0.28*Math.sin(u*4.5), b = -0.34-u*0.24;
        edge = Math.min(1-Math.abs(u)/0.94, Math.max(1-Math.abs(v-a)/0.13,1-Math.abs(v-b)/0.09));
      } else if (shape === 4) { // Ragged elongated complex with unequal lobes.
        const angle = Math.atan2(v/0.6,u), radius = Math.hypot(u,v/0.6);
        edge = (0.74+0.13*Math.sin(angle*3+0.5)+0.08*Math.sin(angle*7))-radius;
      } else edge = 0.87-Math.hypot(u,v); // Round, soft-edged knot.
      return D.smooth(edge*3) * D.smooth((1-Math.max(Math.abs(u),Math.abs(v)))*12);
    }
    *textureRows(color, index, fbm) {
      const c = document.createElement("canvas");
      c.width = c.height = 192;
      const g = c.getContext("2d"),
        image = g.createImageData(192, 192);
      for (let y = 0; y < 192; y++) {
        for (let x = 0; x < 192; x++) {
          const u = (x / 191 - 0.5) * 2,
            v = (y / 191 - 0.5) * 2;
          const n = fbm(u * 3.1 + index * 17 + 61, v * 3.1 + 31);
          const fine = fbm(u * 7 + n * 2 + 54, v * 7 + index * 13);
          // Domain-warp the outline as well as the interior: natural torn edges
          // rather than a mathematically clean ribbon with noisy paint on top.
          const edge = this.silhouette(index % 5, u + (n - 0.5) * 0.36, v + (fine - 0.5) * 0.3)
            * D.smooth((1 - Math.max(Math.abs(u), Math.abs(v))) * 12);
          const density = Math.max(0, n * 0.85 + fine * 0.45 - 0.24);
          const alpha = edge * density * 0.9;
          const lighting = 0.55 + fine * 0.65 + (n * 0.15 | 0);
          const i = (y * 192 + x) * 4;
          // Multi-level mixing for richer nebula colors: blend with 2 nearest
          // palettes, but every other texture stays a dominant single hue so
          // the field keeps coherent plain-colored clouds next to the blends.
          const primary = palette[index % palette.length];
          const nextIdx = (index + 3) % palette.length;
          const mix = (index & 1) === 0 ? 0 : D.smooth(0.5 + u * 1.15 + v * 0.45 + (n - 0.5) * 1.1);
          image.data[i]     = Math.min(255, primary[0] * (1 - mix) + palette[nextIdx][0] * mix) * lighting;
          image.data[i + 1] = Math.min(255, primary[1] * (1 - mix) + palette[nextIdx][1] * mix) * lighting;
          image.data[i + 2] = Math.min(255, primary[2] * (1 - mix) + palette[nextIdx][2] * mix) * lighting;
          image.data[i + 3] = alpha * 255;
        }
        yield;
      }
      g.putImageData(image, 0, 0);
      return c;
    }
    texture(color, index, fbm) {
      let last;
      const rows = this.textureRows(color, index, fbm);
      while (!(last = rows.next()).done);
      return last.value;
    }
    make(z, index) {
      const r = this.random;
      // Independent uniform coordinates: no preferred axis, route, or slot.
      // A bounded mixture spans small knots through rare giant complexes.
      const sizeClass = r(), size = r();
      // Six decades of spread: dust wisps through giants to rare colossal
      // complexes ~50x the typical cloud. The giantChance slider sets what
      // share falls into the two top bands; the colossal slice stays ~1/8 of
      // the giants, so the extremes remain rare and solitary.
      const gc = this.giantChance == null ? 0.065 : this.giantChance;
      const giantEdge = 1 - gc;
      const colossalEdge = 1 - gc * 0.12;
      const midEdge = Math.min(0.82, giantEdge);
      const radius = sizeClass < 0.50 ? 0.12 + size * 1.5
        : sizeClass < midEdge ? 1.6 + size * 3.4
        : sizeClass < giantEdge ? 5 + size * 7
        : sizeClass < colossalEdge ? 12 + size * 23
        : 40 + size * 60;
      const shape = Math.floor(r() * 5), color = Math.floor(r() * palette.length);
      return {
        x: (r() - 0.5) * 52,
        y: (r() - 0.5) * 52,
        z,
        radius,
        density: 0.8 + r() * 0.7,
        shape,
        color,
        texture: (color % palette.length) * 5 + shape,
        angle: r() * Math.PI * 2,
        stretch: 0.9 + r() * 0.4,
      };
    }
    reset() {
      this.passed = 0;
      this.distance = 0;
      this.inside = 0;
      if (!this.count) this.count = 48;
      this.clouds = Array.from({ length: this.count }, (_, i) =>
        this.make(-48 + this.random() * 240, i),
      );
    }

    // Count slider: grow spawns only beyond each new cloud's far fade edge so
    // nothing pops in mid-view; shrink keeps the nearest clouds and trims the
    // distant tail.
    setCount(count) {
      count = Math.max(4, Math.min(200, Math.round(count) || 48));
      this.count = count;
      if (this.clouds.length > count) {
        this.clouds.sort(
          (a, b) =>
            Math.hypot(a.x, a.y, Math.max(0.1, a.z + this.distance)) -
            Math.hypot(b.x, b.y, Math.max(0.1, b.z + this.distance)),
        );
        this.clouds.length = count;
      }
      while (this.clouds.length < count) {
        const cloud = this.make(
          200 + this.distance + this.random() * 600,
          this.distance,
        );
        cloud.z += cloud.radius * 1.35;
        this.clouds.push(cloud);
      }
    }
    advance(travel) {
      this.distance += travel;
      for (const c of this.clouds) c.z -= travel;
      for (let i = 0; i < this.clouds.length; i++) {
        const c = this.clouds[i];
        // Radius-aware rear cutoff: a colossal complex still veils the camera
        // long after the old fixed plane, so recycle only once the entire
        // volume is clearly behind, at its own scale.
        const cutoff = -48 - c.radius * 1.35;
        if (c.z < cutoff) {
          // Preserve overshoot, including long frames/warp, without an unbounded loop.
          const wraps = Math.ceil((cutoff - c.z) / 240);
          const replacement = this.make(c.z + wraps * 240, i + this.passed * 8);
          // The replacement's nearest edge must start beyond the entire
          // radius-aware far fade, including rare giant complexes.
          replacement.z +=
            Math.max(0, Math.ceil((184 + replacement.radius * 1.35 - replacement.z) / 240)) *
            240;
          this.clouds[i] = replacement;
          this.passed += wraps;
        }
      }
    }
    transmission(x, y, z, cameraX, cameraY, amount) {
      let opticalDepth = 0;
      const offsetX = cameraX * 0.13, offsetY = cameraY * 0.1;
      const rx = (x - offsetX) / z,
        ry = (y - offsetY) / z;
      for (const c of this.clouds) {
        // For finite world coordinates, t lies in [0, z]. Its z-distance
        // alone can exclude a cloud. Compare squared distances just like
        // rayDensity: no approximate cutoff, including tangent boundaries.
        if (c.z < 0 && c.z ** 2 >= c.radius ** 2) continue;
        if (z >= 0 && c.z > z && (z - c.z) ** 2 >= c.radius ** 2) continue;
        opticalDepth += D.rayDensity(c, rx, ry, z, offsetX, offsetY);
      }
      return Math.exp(-opticalDepth * amount * 1.8);
    }
    render(ctx, width, height, cameraX, cameraY, time, amount) {
      if (this.bake) this.bakeAll();
      // Scale by the longer viewport edge so extreme portrait displays cannot
      // create an unbounded offscreen layer while preserving aspect ratio.
      const resolution = Math.min(0.6, 960 / Math.max(width, height));
      const w = Math.max(1, Math.round(width * resolution));
      const h = Math.max(1, Math.round(height * resolution));
      if (this.layer.width !== w || this.layer.height !== h) {
        this.layer.width = w;
        this.layer.height = h;
      }
      const g = this.context,
        focal = Math.min(w, h) * 0.9;
      g.clearRect(0, 0, w, h);
      this.inside = 0;
      const ordered = [...this.clouds].sort((a, b) => b.z - a.z);
      for (const c of ordered) {
        const dx = c.x - cameraX * 0.13,
          dy = c.y - cameraY * 0.1;
        const centerDistance = Math.hypot(dx, dy, c.z);
        // One shape sample per cloud, never a per-star raymarch. The local
        // veil follows the rotated silhouette instead of filling empty bays.
        const rotation = c.angle + time * 0.006;
        const u = (-dx*Math.cos(rotation)-dy*Math.sin(rotation))/(c.radius*c.stretch);
        const v = (dx*Math.sin(rotation)-dy*Math.cos(rotation))/c.radius;
        const immersion = D.smooth(1 - centerDistance / c.radius) * this.silhouette(c.shape || 0,u,v);
        this.inside = Math.max(this.inside, immersion);
        // Small clouds retain the original far plane; only giant complexes
        // begin fading from their front edge so they cannot pop in.
        const giantFrontExtension = Math.max(0, c.radius - 5) * 1.35;
        const farFade = D.smooth((184 - (c.z - giantFrontExtension)) / 40);
        const behindFade = D.smooth(
          (c.z + c.radius * 1.35) / (c.radius * 0.85),
        );
        const fade = farFade * behindFade * amount;
        if (fade <= 0) continue;
        const z = Math.max(0.65, c.z + c.radius * 0.25);
        const cx = w * (0.5 + cameraX * 0.065) + (dx * focal) / z;
        const cy = h * (0.5 + cameraY * 0.065) + (dy * focal) / z;
        const size = Math.min(Math.max(w, h) * 5, (c.radius * 2 * focal) / z);
        // Avoid three draws for a cloud whose expanded, drifting sprite cannot
        // touch the compositing canvas.
        const halfWidth = size * c.stretch * 0.7;
        const halfHeight = size * 0.65;
        if (
          cx + halfWidth < 0 ||
          cx - halfWidth > w ||
          cy + halfHeight < 0 ||
          cy - halfHeight > h
        ) continue;
        // Three correlated cross-sections give depth, not a single flat fog card.
        for (let slice = 0; c.z > 0 && slice < 3; slice++) {
          const drift = Math.sin(time * 0.04 + c.angle + slice) * 0.08;
          g.save();
          g.translate(
            cx + drift * size,
            cy + Math.cos(c.angle + slice) * size * 0.025,
          );
          g.rotate(c.angle + slice * 0.06 + time * 0.006);
          // Fade the projected slices before the center crosses the eye plane.
          // Only the local immersion veil remains behind it, never a mirrored sprite.
          g.globalAlpha = fade * D.smooth(c.z / (c.radius * 0.5)) * (0.72 + immersion * 0.5);
          g.drawImage(
            this.textures[c.texture],
            (-size * c.stretch) / 2,
            -size / 2,
            size * c.stretch,
            size,
          );
          g.restore();
        }
        // While inside: a continuous near-camera veil, fading at both boundaries.
        if (immersion > 0) {
          const color = palette[c.color];
          g.globalAlpha = immersion * amount * 0.23;
          g.fillStyle = `rgb(${color.join(",")})`;
          g.fillRect(0, 0, w, h);
          g.globalAlpha = 1;
        }
      }
      ctx.drawImage(this.layer, 0, 0, width, height);
    }
    get state() {
      return {
        count: this.clouds.length,
        passed: this.passed,
        distance: this.distance,
        immersion: this.inside,
        nearest: Math.min(...this.clouds.map((c) => Math.abs(c.z))),
        depths: this.clouds.map((c) => Number(c.z.toFixed(3))),
      };
    }
  }
  window.GasClouds = GasClouds;
})();
