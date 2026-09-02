/* <space-scene> — fixed full-viewport three.js backdrop for the revamp:
   a star/triangle constellation you travel through, two undulating wave grids, and the
   HM mark in brass (geometry from favicon.svg) that the camera flies straight through.
   A second, smaller mark hangs off to one side for a page with no hero to fly
   through: same geometry, same brass, passed at a distance rather than through.
   Attributes: scroll (px) · gate (px of scroll at which the camera passes through the mark)
               stars (count) · glow (0–2) · waves (0–2 amplitude) · speed (sway, rad/s)
               aside (0–1 of the side mark: full beside the opening screen, out once past it) */
(function () {
  if (window.customElements.get('space-scene')) return;
  var THREE_SRC = './vendor/three.module.min.js';
  var threeP = null;
  function loadThree() { return threeP || (threeP = import(THREE_SRC)); }

  var H = [[1,6],[5,6],[5,15],[13,15],[13,6],[17,6],[17,28],[13,28],[13,19],[5,19],[5,28],[1,28]];
  var M = [[21,6],[25,6],[25,7.45],[29.5,15.07],[34,7.45],[34,6],[38,6],[38,28],[34,28],[34,15.31],[29.5,22.93],[25,15.31],[25,28],[21,28]];
  var CX = 19.5, CY = 17, W = 37, HGT = 22, DEPTH = 6.5;
  var GAP_X = -0.5;            // the corridor between the H and the M, in mark units
  var LIFT = 9;                // the mark rides high in frame so the copy sits below it
  var SPAN = 620;              // depth of the star tube that wraps around the camera
  var A_D = 130;               // how far ahead of the camera the side mark hangs at full strength
  var A_PASS = 55;             // how much of that it closes as you scroll past it
  var A_W = 0.17, A_H = 0.22;  // its size, as a share of the frame (width, and a cap on height)
  var A_X = 0.56, A_Y = 0.2;   // where it sits, as a share of the half frame, right of and above centre
  var A_MIN = 760;             // below this viewport width there is no room beside the text
  var BRASS = 0xE5B457, BRASS_DIM = 0xB98C33, ELECTRIC = 0x3FD9C0, GROUND = 0x0A100E;
  var PALETTE = [[0.93,0.95,0.93],[0.93,0.95,0.93],[0.93,0.95,0.93],[0.25,0.85,0.75],[0.9,0.71,0.34],[0.2,0.6,0.47]];

  function num(el, name, d) { var v = parseFloat(el.getAttribute(name)); return isNaN(v) ? d : v; }
  // A full turn that lingers facing front and whips through the back.
  function turnOf(phi) { var f = phi - Math.floor(phi), f3 = f * f * f, g3 = (1 - f) * (1 - f) * (1 - f); return Math.PI * 2 * (Math.floor(phi) + f3 / (f3 + g3)); }
  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

  class SpaceScene extends HTMLElement {
    static get observedAttributes() { return ['scroll', 'gate', 'stars', 'glow', 'waves', 'speed']; }
    constructor() { super(); this._scroll = 0; this._gate = 1000; this._t = 0; this._raf = 0; this._last = 0; this._d0 = 100; this._z = 0; this._prevZ = 0; }
    connectedCallback() {
      this.style.cssText += ';display:block;position:fixed;inset:0;pointer-events:none';
      if (this._started) { this._resume(); return; }
      this._started = true;
      var self = this;
      this._init().catch(function (e) { console.warn('space-scene: WebGL unavailable', e); self.setAttribute('failed', ''); self.dispatchEvent(new CustomEvent('scene-failed')); });
    }
    disconnectedCallback() { this._pause(); }
    attributeChangedCallback(name) {
      if (name === 'scroll') this._scroll = num(this, 'scroll', 0);
      else if (name === 'gate') this._gate = Math.max(1, num(this, 'gate', 1000));
      else if (name === 'stars') { if (this._THREE) this._buildStars(); }
      else if (name === 'glow') this._applyGlow();
    }

    async _init() {
      var THREE = await loadThree();
      this._THREE = THREE;
      var self = this;
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      this.appendChild(canvas);
      var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      var scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(GROUND, 0.0056);
      var camera = new THREE.PerspectiveCamera(24, 1, 0.4, 1400);
      this._renderer = renderer; this._scene = scene; this._camera = camera; this._canvas = canvas;

      // The mark
      function shape(pts) { var s = new THREE.Shape(); pts.forEach(function (pt, i) { var x = pt[0] - CX, y = CY - pt[1]; i ? s.lineTo(x, y) : s.moveTo(x, y); }); s.closePath(); return s; }
      var geo = new THREE.ExtrudeGeometry([shape(H), shape(M)], { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 3, curveSegments: 2 });
      geo.translate(0, 0, -DEPTH / 2);
      var gold = new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.7, roughness: 0.3, emissive: BRASS_DIM, emissiveIntensity: 0.35 });
      gold.fog = false; gold.name = 'brass';
      var mark = new THREE.Mesh(geo, gold); mark.name = 'mark';
      var haloMat = new THREE.MeshBasicMaterial({ color: BRASS, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false, fog: false });
      var halo = new THREE.Mesh(geo, haloMat); halo.scale.setScalar(1.045); halo.name = 'halo';
      var glowMat = new THREE.SpriteMaterial({ map: this._glowTexture(THREE), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      var glow = new THREE.Sprite(glowMat); glow.scale.set(W * 3.2, W * 3.2, 1); glow.position.z = -DEPTH; glow.name = 'glow';
      var lamp = new THREE.PointLight(BRASS, 3200, 0, 2); lamp.position.set(0, 0, 8);
      var logo = new THREE.Group(); logo.add(mark); logo.add(halo); logo.add(glow); logo.add(lamp);
      scene.add(logo);
      this._logo = logo; this._gold = gold; this._haloMat = haloMat; this._glowMat = glowMat; this._lamp = lamp;

      // The same mark again, small and off to the side, for a page with no hero
      // to fly through. Same geometry and the same brass, but its own materials:
      // it fades as you pass it, and its halo is dialled back so a mark this
      // size does not bloom over the copy beside it.
      var aMat = gold.clone(); aMat.transparent = true; aMat.fog = false;
      var aHaloMat = haloMat.clone();
      var aGlowMat = new THREE.SpriteMaterial({ map: glowMat.map, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      var aGlow = new THREE.Sprite(aGlowMat); aGlow.scale.set(W * 3.2, W * 3.2, 1); aGlow.position.z = -DEPTH;
      var aHalo = new THREE.Mesh(geo, aHaloMat); aHalo.scale.setScalar(1.045);
      var aside = new THREE.Group();
      aside.add(new THREE.Mesh(geo, aMat)); aside.add(aHalo); aside.add(aGlow);
      aside.name = 'aside'; aside.visible = false;
      scene.add(aside);
      this._aside = aside; this._aMat = aMat; this._aHaloMat = aHaloMat; this._aGlowMat = aGlowMat;

      // Lights: a warm key, cool fill from the teal side, rim from behind
      var key = new THREE.DirectionalLight(0xfff1d6, 2.6); key.position.set(-40, 50, 70); scene.add(key);
      var fill = new THREE.DirectionalLight(ELECTRIC, 0.7); fill.position.set(60, -20, 40); scene.add(fill);
      var rim = new THREE.DirectionalLight(0xffffff, 1.4); rim.position.set(30, 40, -60); scene.add(rim);
      scene.add(new THREE.HemisphereLight(0x3a5a52, 0x05080a, 0.5));

      // Wave grids: a floor and a ceiling, lit by the mark's lamp as you pass it
      function grid(y) {
        var g = new THREE.PlaneGeometry(820, 460, 100, 56); g.rotateX(-Math.PI / 2);
        var m = new THREE.MeshStandardMaterial({ color: 0x0c332d, emissive: ELECTRIC, emissiveIntensity: 0.18, wireframe: true, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, roughness: 0.7, metalness: 0.1 });
        var mesh = new THREE.Mesh(g, m); mesh.position.y = y; mesh.userData.base = Float32Array.from(g.attributes.position.array);
        scene.add(mesh); return mesh;
      }
      this._floor = grid(-42); this._floor.material.opacity = 0.14; this._ceil = grid(44); this._ceil.material.opacity = 0.07;

      this._starTex = this._starTexture(THREE);
      this._buildStars();
      this._applyGlow();

      this._frame = function () {
        var w = window.innerWidth || 1, h = window.innerHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        var tan = Math.tan(camera.fov * Math.PI / 360);
        var dW = (W / 0.56) / (2 * tan * camera.aspect), dH = (HGT / 0.4) / (2 * tan);
        self._d0 = Math.max(dW, dH);
        // The side mark is measured off the frame too, so it keeps the same
        // corner and the same share of the screen at any size.
        var aH = A_D * tan, aW = aH * camera.aspect;
        self._aHalfW = aW; self._aHalfH = aH;
        self._aScale = Math.min((A_W * 2 * aW) / W, (A_H * 2 * aH) / HGT);
        self._aRoom = w >= A_MIN;
        camera.updateProjectionMatrix();
      };
      this._frame();
      window.addEventListener('resize', this._frame);
      this._reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.addEventListener('visibilitychange', function () { document.hidden ? self._pause() : self._resume(); });
      this._resume();
      this.setAttribute('ready', '');
      this.dispatchEvent(new CustomEvent('scene-ready'));
    }

    _glowTexture(THREE) {
      var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d');
      var r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      r.addColorStop(0, 'rgba(255,225,160,0.75)'); r.addColorStop(0.25, 'rgba(229,180,87,0.38)'); r.addColorStop(0.6, 'rgba(229,180,87,0.08)'); r.addColorStop(1, 'rgba(229,180,87,0)');
      g.fillStyle = r; g.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    }
    _starTexture(THREE) {
      // An outlined triangle with a soft core: reads as a dot far away, a glyph up close.
      var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d');
      var r = g.createRadialGradient(32, 34, 0, 32, 34, 30); r.addColorStop(0, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
      g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 4; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(32, 9); g.lineTo(55, 50); g.lineTo(9, 50); g.closePath(); g.stroke();
      return new THREE.CanvasTexture(c);
    }
    _buildStars() {
      var THREE = this._THREE, scene = this._scene;
      if (this._stars) { scene.remove(this._stars); this._stars.geometry.dispose(); }
      var n = Math.max(50, Math.round(num(this, 'stars', 2200)));
      var pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 360; pos[i * 3 + 1] = (Math.random() - 0.5) * 200; pos[i * 3 + 2] = this._z + 20 - Math.random() * SPAN;
        var c = PALETTE[Math.floor(Math.random() * PALETTE.length)], b = 0.55 + Math.random() * 0.45;
        col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      var m = new THREE.PointsMaterial({ size: 2.6, map: this._starTex, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
      this._stars = new THREE.Points(g, m); this._stars.name = 'constellation';
      scene.add(this._stars);
    }
    _applyGlow() {
      if (!this._gold) return;
      var k = num(this, 'glow', 1);
      this._gold.emissiveIntensity = 0.42 * k;
      this._haloMat.opacity = 0.2 * k;
      this._glowMat.opacity = 0.85 * k;
      if (this._aMat) this._aMat.emissiveIntensity = 0.42 * k;
      this._lamp.intensity = 3200 * k;
    }
    _wave(mesh, t, camX, camZ) {
      var A = 3.4 * num(this, 'waves', 1);
      mesh.position.x = camX; mesh.position.z = camZ - 200;
      var p = mesh.geometry.attributes.position, arr = p.array, base = mesh.userData.base, gx = mesh.position.x, gz = mesh.position.z;
      for (var i = 0; i < arr.length; i += 3) {
        var wx = base[i] + gx, wz = base[i + 2] + gz;
        arr[i + 1] = A * Math.sin(wx * 0.05 + t * 0.7) * Math.cos(wz * 0.04 - t * 1.1) + 0.6 * A * Math.sin(wz * 0.1 + wx * 0.02 + t * 1.5);
      }
      p.needsUpdate = true;
    }

    _tick(now) {
      var self = this;
      this._raf = requestAnimationFrame(function (t) { self._tick(t); });
      if (!this._renderer) return;
      var dt = this._last ? Math.min((now - this._last) / 1000, 0.05) : 0; this._last = now;
      if (!this._reduce) this._t += dt;
      var t = this._t;

      // Camera: the whole page is one push forward. Lerped so the ride is smooth.
      var target = -this._scroll * (this._d0 / this._gate);
      // First frame lands where it belongs rather than lerping in from the
      // mark: loading /portfolio directly used to fly through it on arrival.
      if (!this._placed) { this._z = target; this._placed = true; }
      this._z += (target - this._z) * 0.14;
      var camZ = this._z, cam = this._camera;
      cam.position.set(GAP_X, 0, camZ);
      cam.lookAt(GAP_X, 0, camZ - 10);
      var vel = Math.abs(camZ - this._prevZ) / Math.max(dt, 1e-3); this._prevZ = camZ;

      // The mark sways until the camera is close, then squares up so you fly clean through the gap.
      var e = smooth(-camZ / this._d0), sway = num(this, 'speed', 0.5);
      var logo = this._logo; logo.position.set(0, LIFT, -this._d0);
      // Full turns that linger facing front and whip through the back; the spin winds down
      // and freezes before the square-up begins, so the fly-through target is always stable.
      var spinGate = 1 - smooth(Math.min(1, e / 0.5));
      this._phi = (this._phi || 0) + dt * sway * 0.16 * spinGate;
      var turn = turnOf(this._phi);
      if (e > 0.5) { if (this._front == null) this._front = Math.round(turn / (Math.PI * 2)) * Math.PI * 2; } else this._front = null;
      var sq = smooth(Math.max(0, (e - 0.5) / 0.5));
      logo.rotation.y = (this._front == null ? turn : turn + (this._front - turn) * sq) + 0.35 * Math.sin(t * sway) * (1 - e);
      logo.rotation.x = (0.22 + 0.2 * Math.sin(t * sway * 0.7)) * (1 - e);
      logo.rotation.z = 0.16 * Math.sin(t * sway * 0.45 + 1.2) * (1 - e);
      logo.visible = camZ > -this._d0 - 40;

      // The side mark hangs beside the opening screen of a page with no hero,
      // turning the way the big one does, only smaller and lazier. The page
      // hands it a strength that runs out as you scroll in: it draws closer as
      // it goes, so it drifts wide of the frame and fades rather than sitting
      // over the work. Perspective does the sliding; only the distance moves.
      var aside = this._aside, ak = smooth(num(this, 'aside', 0));
      if (aside) {
        aside.visible = ak > 0.004 && this._aRoom;
        if (aside.visible) {
          var gk = num(this, 'glow', 1);
          this._aMat.opacity = ak;
          this._aHaloMat.opacity = 0.2 * gk * ak;
          this._aGlowMat.opacity = 0.5 * gk * ak;
          this._aPhi = (this._aPhi || 0) + dt * sway * 0.11;
          aside.scale.setScalar(this._aScale);
          aside.position.set(GAP_X + this._aHalfW * A_X, this._aHalfH * (A_Y + 0.045 * Math.sin(t * 0.55)), camZ - A_D + (1 - ak) * A_PASS);
          aside.rotation.y = turnOf(this._aPhi);
          aside.rotation.x = 0.16 + 0.12 * Math.sin(t * sway * 0.7);
          aside.rotation.z = 0.1 * Math.sin(t * sway * 0.45 + 1.2);
        }
      }

      // Stars drift toward you even at rest; faster travel makes them bigger, like streaks.
      var arr = this._stars.geometry.attributes.position.array, drift = this._reduce ? 0 : 7 * dt;
      var lo = camZ - SPAN + 20, hi = camZ + 20;
      for (var i = 2; i < arr.length; i += 3) {
        var z = arr[i] + drift;
        if (z > hi) z -= SPAN; else if (z < lo) z += SPAN;
        arr[i] = z;
      }
      this._stars.geometry.attributes.position.needsUpdate = true;
      this._stars.material.size = 2.6 + Math.min(5, vel * 0.03);

      this._wave(this._floor, t, GAP_X, camZ);
      this._wave(this._ceil, t * 0.8 + 2, GAP_X, camZ);
      this._renderer.render(this._scene, cam);
    }
    _resume() { if (this._raf || !this._renderer) return; this._last = 0; var self = this; this._raf = requestAnimationFrame(function (t) { self._tick(t); }); }
    _pause() { cancelAnimationFrame(this._raf); this._raf = 0; }
  }
  window.customElements.define('space-scene', SpaceScene);
})();
