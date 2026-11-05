import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { SKY_HEX, binHeight, formatId, inkForLuminance, skyClassFor, wdthFor, type SkyClass } from '../../lib/sky';
import { binUnique } from '../../lib/unique';
import type { Hotspot, HistoryFile } from '../../lib/types';

/**
 * The /kisah/ 3D scene, plain class outside React. One instance per page,
 * mounted from a single effect, fully disposed on unmount.
 *
 * - Indonesia as equirectangular dot-field (x = lon - 118, y = lat).
 * - Hotspots as instanced thin columns per 0.25° bin, height ∝ log1p(count),
 *   morphing between two column states via two attributes + a uMix uniform.
 *   States: each story year, the 'all' aggregate, and 'live' (FIRMS, last 7 d).
 * - Sky: canvas clear colour = the section's sky (data). ONE writer at a time:
 *   the timeline scrub owns the sky while its region is active; every other
 *   section owns it through a single onToggle ScrollTrigger (0.8 s tween).
 * - Camera states driven by GSAP ScrollTrigger scrub (+ Lenis smooth scroll).
 * All story numbers live in the DOM text around the canvas; the canvas is
 * aria-hidden and never the only carrier of information.
 */

gsap.registerPlugin(ScrollTrigger);

export type CamPreset = 'wide' | 'kalteng' | 'tilt' | 'west2015';

interface CamState {
  cx: number;
  cy: number;
  alt: number;
  tilt: number; // radians from straight-down
}

export interface SceneSection {
  el: HTMLElement;
  preset: CamPreset;
  /** Column state to hold while on screen: a story year, the 'all' aggregate, or live FIRMS data. */
  year?: number | 'all' | 'live';
  /** Fixed sky class for sections without a data year (years without archive data, quiet close). */
  sky?: SkyClass;
}

export interface SceneRefs {
  /** Full-page sky background (visible when WebGL is unavailable). */
  skyEl: HTMLElement;
  /** Timeline sticky panel; its sky class follows the scrubbed year. */
  stickyEl: HTMLElement;
  /** Year headline (textContent + wdth font-variation-settings). */
  yearEl: HTMLElement;
  /** Wrap around <Sourced>; its .sourced-value gets the count imperatively. */
  countWrap: HTMLElement;
  /** Burned-area line text. */
  areaTextEl: HTMLElement;
  /** Burned-area source link (hidden for years without a verified figure). */
  areaLinkEl: HTMLAnchorElement;
  /** SVG bar strip root; bars carry .kisah-bar[data-year]. */
  stripEl: HTMLElement;
}

export interface KisahSceneOptions {
  canvas: HTMLCanvasElement;
  land: [number, number][];
  history: HistoryFile;
  /** Live FIRMS hotspots (Indonesia, last 7 days), or null when unavailable. */
  live: { hotspots: Hotspot[] } | null;
  refs: SceneRefs;
  /** Sections in DOM order with camera + sky state to hold while on screen. */
  sections: SceneSection[];
  /** Tall sticky region that scrubs 2006→2025. */
  timelineEl: HTMLElement;
  /** Burned-area display line for a year, or null when no verified figure exists. */
  areaForYear: (year: number) => { text: string; url: string } | null;
  onWebglUnavailable?: () => void;
}

const CENTRE_LON = 118;
const FOV = 45;
const HALF_TAN = Math.tan((FOV / 2) * (Math.PI / 180));
const EMBER = new THREE.Color('#F2611D');
const EMBER_TOP = EMBER.clone().lerp(new THREE.Color('#FFD9C2'), 0.35); // lit top faces
const PEAT = new THREE.Color('#2A1D15');
const HAZE = new THREE.Color('#D9C79A');
const BIN = 0.25;
const MIN_BIN_COUNT = 3; // bins under this stay hidden — the map must not drown
const LIVE_WINDOW_H = 168;

function dotTexture(soft: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  if (soft) {
    grad.addColorStop(0, 'rgba(255,255,255,0.5)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.75, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class KisahScene {
  private readonly opts: KisahSceneOptions;
  private readonly reduced: boolean;
  private readonly mobile: boolean;
  private readonly desktop: MediaQueryList;
  private gl = false;

  private renderer?: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 600);
  private cam: CamState = { cx: CENTRE_LON, cy: -2, alt: 60, tilt: 0 };
  private presets: Record<CamPreset, CamState>;

  private uniforms = {
    uMix: { value: 0 },
    uTime: { value: 0 },
    uFlicker: { value: 1 },
    uBase: { value: EMBER },
    uTop: { value: EMBER_TOP },
  };
  private mesh?: THREE.InstancedMesh;
  /** Column heights per state key: year numbers, 'all' aggregate, 'live'. */
  private heightByKey = new Map<string, Float32Array>();
  private hazeMat?: THREE.SpriteMaterial;

  private lenis?: Lenis;
  private sts: ScrollTrigger[] = [];
  private readonly tickFn = this.tick.bind(this);
  private dirty = true;
  private yearIdx = -1;
  private lastIdx = 0;
  private lastFrac = 0;
  private timelineActive = false;
  /** isActive per state trigger; the deepest active section owns sky+columns. */
  private activeSec = new Map<number, boolean>();
  /** Column state currently morphed to ('' while the timeline scrub owns the columns). */
  private colKey = '';
  private barByYear = new Map<number, Element>();
  private sky = new THREE.Color(SKY_HEX['sky-1']);
  private cA = new THREE.Color();
  private cB = new THREE.Color();

  constructor(opts: KisahSceneOptions) {
    this.opts = opts;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.mobile = window.matchMedia('(max-width: 767px)').matches;
    this.desktop = window.matchMedia('(min-width: 960px)');
    this.uniforms.uFlicker.value = this.reduced ? 0 : 1;

    // Camera presets; wide altitudes fit the aspect so Indonesia is never clipped.
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const fitAlt = (spanDeg: number) => Math.min(170, Math.max(16, spanDeg / (2 * HALF_TAN * aspect)));
    const wideAlt = fitAlt(52);
    this.presets = {
      wide: { cx: CENTRE_LON, cy: -2, alt: wideAlt, tilt: 0 },
      kalteng: { cx: 113.9, cy: -2.2, alt: 6, tilt: 0.55 },
      tilt: { cx: 117, cy: -1.5, alt: Math.max(wideAlt * 0.45, fitAlt(30)), tilt: 0.5 },
      west2015: { cx: 107.5, cy: 0.2, alt: fitAlt(30), tilt: 0.25 },
    };
    Object.assign(this.cam, this.presets[opts.sections[0]?.preset ?? 'wide']);

    // Bars for imperative active-state.
    opts.refs.stripEl.querySelectorAll('.kisah-bar').forEach((el) => {
      const y = Number(el.getAttribute('data-year'));
      if (Number.isFinite(y)) this.barByYear.set(y, el);
    });

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: opts.canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'low-power',
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.25 : 1.75));
      this.gl = true;
    } catch {
      this.gl = false;
      opts.onWebglUnavailable?.();
    }

    if (this.gl) this.buildScene();
    this.wireScroll();
    window.addEventListener('resize', this.onResize);
    this.onResize();
    gsap.ticker.add(this.tickFn);
    gsap.ticker.lagSmoothing(0);
    this.setYear(0, 0);
    // The story opens on the first section's state: its sky, its columns.
    const opening = opts.sections[0];
    if (opening) this.applySection(opening, false);
    this.dirty = true;
  }

  /** Text ink follows the live sky colour, so copy stays readable while the sky blends. */
  private syncInk() {
    const { r, g, b } = this.sky; // linear-light components
    const ink = inkForLuminance(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const root = this.opts.canvas.parentElement;
    if (!root) return;
    if (root.dataset.ink !== ink) root.dataset.ink = ink;
    // CSS backing colour for the desktop text blocks, in sRGB.
    const style = this.sky.getStyle();
    if (root.style.getPropertyValue('--live-sky') !== style) root.style.setProperty('--live-sky', style);
  }

  // ---------- scene construction ----------

  private buildScene() {
    const { land, history, live } = this.opts;
    const renderer = this.renderer!;

    // Land dots. Subsample to ~0.2° on small screens.
    const pos: number[] = [];
    for (const [lon, lat] of land) {
      if (this.mobile && (Math.round(lon * 10) % 2 !== 0 || Math.round(lat * 10) % 2 !== 0)) continue;
      pos.push(lon - CENTRE_LON, lat, 0);
    }
    const landGeo = new THREE.BufferGeometry();
    landGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const dotTex = dotTexture(false);
    const landMat = new THREE.PointsMaterial({
      size: 0.32,
      map: dotTex,
      color: PEAT,
      transparent: true,
      opacity: 0.92,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const landPts = new THREE.Points(landGeo, landMat);
    landPts.renderOrder = 0;
    this.scene.add(landPts);

    // Column states: every story year, the 'all' aggregate, and live FIRMS bins.
    const years = history.years;
    const binIndex = new Map<string, number>();
    const offsets: number[] = [];
    const seeds: number[] = [];
    const binKey = (lon: number, lat: number) => `${Math.round(lon / BIN)},${Math.round(lat / BIN)}`;
    const addBin = (lon: number, lat: number) => {
      const key = binKey(lon, lat);
      if (!binIndex.has(key)) {
        binIndex.set(key, offsets.length / 2);
        offsets.push(lon - CENTRE_LON, lat);
        seeds.push(Math.random());
      }
    };
    for (const y of years) for (const b of y.bins) addBin(b[0]!, b[1]!);
    const liveBins = live ? binUnique(live.hotspots, Date.now(), LIVE_WINDOW_H, BIN) : [];
    for (const b of liveBins) addBin(b[0]!, b[1]!);

    const nBins = offsets.length / 2;
    if (nBins > 0) {
      // Raw counts per state, then heights (0 for near-empty bins, log + sub-linear).
      const countsByKey = new Map<string, Float32Array>();
      for (const y of years) {
        const arr = new Float32Array(nBins);
        for (const b of y.bins) {
          const i = binIndex.get(binKey(b[0]!, b[1]!));
          if (i !== undefined) arr[i] = b[2]!;
        }
        countsByKey.set(String(y.year), arr);
      }
      const allArr = new Float32Array(nBins);
      for (const y of years) {
        for (const b of y.bins) {
          const i = binIndex.get(binKey(b[0]!, b[1]!));
          if (i !== undefined) allArr[i]! += b[2]!;
        }
      }
      countsByKey.set('all', allArr);
      if (live) {
        const arr = new Float32Array(nBins);
        for (const b of liveBins) {
          const i = binIndex.get(binKey(b[0]!, b[1]!));
          if (i !== undefined) arr[i] = b[2]!;
        }
        countsByKey.set('live', arr);
      }

      for (const [key, counts] of countsByKey) {
        const max = Math.max(...counts, 1);
        const h = new Float32Array(nBins);
        for (let i = 0; i < nBins; i++) {
          h[i] = counts[i]! < MIN_BIN_COUNT ? 0 : binHeight(counts[i]!, max);
        }
        this.heightByKey.set(key, h);
      }

      const geo = new THREE.BoxGeometry(BIN * 0.36, 1, BIN * 0.36);
      geo.translate(0, 0.5, 0); // base at y=0
      geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(offsets), 2));
      geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 1));
      geo.setAttribute('aH0', new THREE.InstancedBufferAttribute(new Float32Array(nBins), 1));
      geo.setAttribute('aH1', new THREE.InstancedBufferAttribute(new Float32Array(nBins), 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: /* glsl */ `
          attribute vec2 aOffset;
          attribute float aH0;
          attribute float aH1;
          attribute float aSeed;
          uniform float uMix;
          varying vec3 vNormal;
          varying float vSeed;
          varying float vH;
          void main() {
            float h = mix(aH0, aH1, uMix);
            float on = step(0.02, h);
            // Map lies in the XY plane (x = lon - 118, y = lat); columns rise along +Z.
            vec3 p = vec3(position.x * on + aOffset.x, position.z * on + aOffset.y, position.y * h);
            vNormal = normal; // object space: +z is the top face, ±x/±y the sides
            vSeed = aSeed;
            vH = h;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uBase;
          uniform vec3 uTop;
          uniform float uTime;
          uniform float uFlicker;
          varying vec3 vNormal;
          varying float vSeed;
          varying float vH;
          void main() {
            if (vH < 0.02) discard;
            // Shade faces so the columns read as 3D: lit tops, darkened sides,
            // y-facing sides darkest.
            float isTop = step(0.5, vNormal.z);
            vec3 side = uBase * mix(0.75, 0.62, step(0.5, abs(vNormal.y)));
            vec3 col = mix(side, uTop, isTop);
            float f = 1.0 + uFlicker * 0.08 * sin(uTime * 2.2 + vSeed * 31.416);
            gl_FragColor = vec4(col * f, 1.0);
          }
        `,
      });
      this.mesh = new THREE.InstancedMesh(geo, mat, nBins);
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = 1;
      this.scene.add(this.mesh);

      // Haze: soft sprites over busy areas; opacity follows the year ratio.
      if (!this.mobile) {
        const flat = years.flatMap((y) => y.bins.map((b) => ({ count: b[2]!, b })));
        flat.sort((a, b) => a.count - b.count);
        const hazeTex = dotTexture(true);
        this.hazeMat = new THREE.SpriteMaterial({
          map: hazeTex,
          color: HAZE,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        const group = new THREE.Group();
        for (let i = 0; i < 200; i++) {
          const pick = flat[Math.floor((i / 200) ** 2 * flat.length)]!; // bias toward busy bins
          const s = new THREE.Sprite(this.hazeMat);
          s.position.set(
            pick.b[0]! - CENTRE_LON + (Math.random() - 0.5) * 2,
            pick.b[1]! + (Math.random() - 0.5) * 1.5,
            1 + Math.random() * 2.5,
          );
          const sc = 3 + Math.random() * 6;
          s.scale.set(sc, sc * 0.55, 1);
          s.renderOrder = 2;
          group.add(s);
        }
        this.scene.add(group);
      }
    }

    renderer.setClearColor(this.sky);
  }

  // ---------- sky ----------

  private setSkyClass(el: HTMLElement, cls: SkyClass) {
    for (const c of ['sky-1', 'sky-2', 'sky-3', 'sky-4']) el.classList.remove(c);
    el.classList.add(cls);
    el.style.setProperty('--sky', SKY_HEX[cls]);
    // The page sky also drives the CSS text backing and ink when GL is off
    // (the frame loop overwrites both with blended values once it runs).
    if (el === this.opts.refs.skyEl) {
      const root = this.opts.canvas.parentElement;
      if (root) {
        root.style.setProperty('--live-sky', SKY_HEX[cls]);
        const c = this.cA.set(SKY_HEX[cls]);
        root.dataset.ink = inkForLuminance(0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b);
      }
    }
  }

  /** Tween (or jump) the page sky to a class; kills any in-flight sky tween. */
  private pageSkyTo(cls: SkyClass, animate: boolean) {
    gsap.killTweensOf(this.sky);
    if (animate && !this.reduced) {
      const target = new THREE.Color(SKY_HEX[cls]);
      gsap.to(this.sky, { r: target.r, g: target.g, b: target.b, duration: 0.8, ease: 'power1.out' });
    } else {
      this.sky.set(SKY_HEX[cls]);
    }
    this.setSkyClass(this.opts.refs.skyEl, cls);
    this.dirty = true;
  }

  // ---------- column states ----------

  private columnKeyOf(sec: SceneSection): string | null {
    if (sec.year === undefined) return null;
    const key = String(sec.year);
    return this.heightByKey.has(key) ? key : null;
  }

  /** Morph the columns to a state: freeze the current blend into aH0, target into aH1. */
  private morphColumnsTo(key: string, animate: boolean) {
    const mesh = this.mesh;
    const target = this.heightByKey.get(key);
    if (!mesh || !target) return;
    const h0 = mesh.geometry.getAttribute('aH0') as THREE.InstancedBufferAttribute;
    const h1 = mesh.geometry.getAttribute('aH1') as THREE.InstancedBufferAttribute;
    const a0 = h0.array as Float32Array;
    const a1 = h1.array as Float32Array;
    gsap.killTweensOf(this.uniforms.uMix);
    if (animate && !this.reduced) {
      const m = this.uniforms.uMix.value;
      for (let i = 0; i < a0.length; i++) a0[i] = a0[i]! + (a1[i]! - a0[i]!) * m;
      a1.set(target);
      this.uniforms.uMix.value = 0;
      gsap.to(this.uniforms.uMix, { value: 1, duration: 0.9, ease: 'power1.inOut' });
    } else {
      a0.set(target);
      a1.set(target);
      this.uniforms.uMix.value = 1;
    }
    h0.needsUpdate = true;
    h1.needsUpdate = true;
    this.colKey = key;
    if (this.hazeMat) this.hazeMat.opacity = 0.05;
    this.dirty = true;
  }

  /** One section takes over sky + columns. The only non-timeline sky writer. */
  private applySection(sec: SceneSection, animate: boolean) {
    const cls = this.resolveSky(sec);
    if (cls) this.pageSkyTo(cls, animate);
    const key = this.columnKeyOf(sec);
    if (key && key !== this.colKey) this.morphColumnsTo(key, animate);
  }

  /** Sections can overlap on screen; the deepest active one owns the state. */
  private onSectionToggle(i: number, sec: SceneSection, active: boolean) {
    this.activeSec.set(i, active);
    const deepest = this.deepestActive();
    if (deepest < 0) return; // between sections: hold the last state
    this.applySection(this.opts.sections[deepest]!, true);
  }

  private deepestActive(): number {
    let deepest = -1;
    for (let j = 0; j < this.opts.sections.length; j++) if (this.activeSec.get(j)) deepest = j;
    return deepest;
  }

  // ---------- year scrub (timeline region only) ----------

  setYear(idx: number, frac: number) {
    const { years } = this.opts.history;
    const n = years.length;
    if (n === 0) return;
    this.lastIdx = idx;
    this.lastFrac = frac;
    const i0 = Math.min(Math.max(idx, 0), n - 1);
    const i1 = Math.min(i0 + 1, n - 1);
    const y0 = years[i0]!;
    const y1 = years[i1]!;
    const maxCount = this.maxYearCount();
    const cls0 = skyClassFor(y0.count / maxCount);
    const cls1 = skyClassFor(y1.count / maxCount);

    if (this.gl) {
      this.uniforms.uMix.value = frac;
      gsap.killTweensOf(this.uniforms.uMix);
      gsap.killTweensOf(this.sky);
      this.cA.set(SKY_HEX[cls0]);
      this.cB.set(SKY_HEX[cls1]);
      this.sky.copy(this.cA).lerp(this.cB, frac);
      if (this.hazeMat) this.hazeMat.opacity = 0.12 * (y0.count / maxCount);
    }

    if (i0 !== this.yearIdx) {
      const prev = this.yearIdx;
      this.yearIdx = i0;
      this.colKey = '';

      // Swap the two morph target height arrays; uMix does the tweening.
      const mesh = this.mesh;
      const h0Arr = this.heightByKey.get(String(y0.year));
      const h1Arr = this.heightByKey.get(String(y1.year));
      if (mesh && h0Arr && h1Arr) {
        const h0 = mesh.geometry.getAttribute('aH0') as THREE.InstancedBufferAttribute;
        const h1 = mesh.geometry.getAttribute('aH1') as THREE.InstancedBufferAttribute;
        (h0.array as Float32Array).set(h0Arr);
        (h1.array as Float32Array).set(h1Arr);
        h0.needsUpdate = true;
        h1.needsUpdate = true;
      }

      const minCount = Math.min(...years.map((y) => y.count));

      // Imperative DOM only — no React state on the scroll path.
      const r = this.opts.refs;
      r.yearEl.textContent = String(y0.year);
      r.yearEl.style.fontVariationSettings = `"wdth" ${wdthFor(y0.count, minCount, maxCount)}`;
      const valueEl = r.countWrap.querySelector('.sourced-value');
      if (valueEl?.firstChild) valueEl.firstChild.textContent = formatId(y0.count);
      const area = this.opts.areaForYear(y0.year);
      r.areaTextEl.textContent = area ? area.text : 'Luas terbakar: belum ada angka terverifikasi';
      r.areaLinkEl.hidden = !area;
      if (area) r.areaLinkEl.href = area.url;
      this.setSkyClass(r.stickyEl, cls0);
      this.setSkyClass(r.skyEl, cls0);
      if (prev >= 0) {
        this.barByYear.get(years[Math.min(prev, n - 1)]!.year)?.classList.remove('is-active');
      }
      this.barByYear.get(y0.year)?.classList.add('is-active');
    }
    this.dirty = true;
  }

  private maxYearCount(): number {
    return Math.max(...this.opts.history.years.map((y) => y.count), 1);
  }

  // ---------- scroll wiring ----------

  private applyCam() {
    const { cx, cy, alt, tilt } = this.cam;
    const x = cx - CENTRE_LON; // presets are in degrees of longitude; the scene is centred on 118°E
    this.camera.position.set(x, cy - alt * Math.sin(tilt), alt * Math.cos(tilt));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(x, cy, 0);
  }

  private resolveSky(s: SceneSection): SkyClass | null {
    if (typeof s.year === 'number') {
      const y = this.opts.history.years.find((v) => v.year === s.year);
      if (y) return skyClassFor(y.count / this.maxYearCount());
    }
    return s.sky ?? null;
  }

  private wireScroll() {
    const { sections, timelineEl } = this.opts;

    if (!this.reduced) {
      this.lenis = new Lenis({ autoRaf: false });
      this.lenis.on('scroll', ScrollTrigger.update);
    }

    // Opening section: state trigger only (it is the first camera preset).
    if (sections[0]) {
      const st = ScrollTrigger.create({
        trigger: sections[0].el,
        start: 'top top',
        end: 'bottom 50%',
        onToggle: (self) => this.onSectionToggle(0, sections[0]!, self.isActive),
      });
      this.sts.push(st);
    }

    // Camera scrub + one state trigger per later section. The state trigger is
    // the single writer of sky/columns for that section; the scrub moves the
    // camera only.
    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i]!;

      if (this.reduced) {
        const st = ScrollTrigger.create({
          trigger: sec.el,
          start: 'top 60%',
          onEnter: () => this.jumpTo(sec),
          onEnterBack: () => this.jumpTo(sec),
        });
        this.sts.push(st);
      } else {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: sec.el, start: 'top bottom', end: 'top top', scrub: 0.5 },
        });
        tl.to(this.cam, { ...this.presets[sec.preset], ease: 'none', immediateRender: false }, 0);
        if (tl.scrollTrigger) this.sts.push(tl.scrollTrigger);

        const st = ScrollTrigger.create({
          trigger: sec.el,
          start: 'top 60%',
          end: 'bottom 40%',
          onToggle: (self) => this.onSectionToggle(i, sec, self.isActive),
        });
        this.sts.push(st);
      }
    }

    // Year scrub across the tall sticky timeline region. It owns sky+columns
    // only while active; section triggers take over outside its range.
    const st = ScrollTrigger.create({
      trigger: timelineEl,
      start: 'top top',
      end: 'bottom bottom',
      onToggle: (self) => {
        this.timelineActive = self.isActive;
        if (self.isActive) this.setYear(this.lastIdx, this.lastFrac);
      },
      onUpdate: (self) => {
        const n = this.opts.history.years.length;
        if (n === 0 || !this.timelineActive) return;
        const p = self.progress * n;
        this.setYear(Math.min(Math.floor(p), n - 1), p - Math.floor(p));
      },
    });
    this.sts.push(st);
  }

  private jumpTo(sec: SceneSection) {
    Object.assign(this.cam, this.presets[sec.preset]);
    this.applySection(sec, false);
    this.dirty = true;
    if (this.gl && this.reduced) {
      // 200 ms fade on the swap (DESIGN.md motion rules).
      gsap.fromTo(this.opts.canvas, { opacity: 0.35 }, { opacity: 1, duration: 0.2, overwrite: true });
    }
  }

  // ---------- frame loop ----------

  private tick(_time: number, dtMs: number) {
    if (document.hidden) return;
    if (!this.gl) {
      this.lenis?.raf(performance.now());
      return;
    }
    if (!this.reduced) {
      this.uniforms.uTime.value += dtMs / 1000; // subtle flicker
      this.lenis?.raf(performance.now());
      this.dirty = true; // continuous render while visible
    }
    if (!this.dirty) return;
    this.dirty = false;
    this.applyCam();
    this.syncInk();
    this.renderer!.setClearColor(this.sky);
    this.renderer!.render(this.scene, this.camera);
  }

  private onResize = () => {
    const canvas = this.opts.canvas;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (this.gl) {
      this.renderer!.setSize(w, h, false);
      this.camera.aspect = w / h;
      // On desktop the text column sits left, so shift the map's centre to
      // ~62% of the viewport (view origin 12% left of the frame).
      if (this.desktop.matches) this.camera.setViewOffset(w, h, -w * 0.12, 0, w, h);
      else this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
    }
    this.dirty = true;
  };

  // ---------- teardown ----------

  dispose() {
    gsap.ticker.remove(this.tickFn);
    for (const st of this.sts) st.kill();
    gsap.killTweensOf(this.cam);
    gsap.killTweensOf(this.sky);
    gsap.killTweensOf(this.uniforms.uMix);
    this.lenis?.destroy();
    window.removeEventListener('resize', this.onResize);
    this.scene.traverse((obj) => {
      const withGeo = obj as THREE.Points | THREE.InstancedMesh | THREE.Sprite;
      withGeo.geometry?.dispose();
      const mat = withGeo.material as (THREE.Material & { map?: THREE.Texture }) | undefined;
      mat?.map?.dispose();
      mat?.dispose();
    });
    this.scene.clear();
    this.renderer?.dispose();
  }
}
