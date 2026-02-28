import {
  TILE_WIDTH, TILE_HEIGHT, TILE_GAP, GRID_COLS, GRID_ROWS,
} from "@/lib/constants";

const INNER_W = TILE_WIDTH - TILE_GAP;
const INNER_H = TILE_HEIGHT - TILE_GAP;
const TILE_ASPECT = INNER_W / INNER_H;

// Per-instance: off(2) + slot(1) + scale(1) + col(4) + uvRect(4) = 12 floats = 48 bytes
const FLOATS_PER = 12;

const VERT = `#version 300 es
precision highp float;
in vec2 a_pos;
in vec2 a_off;
in float a_slot;
in float a_scale;
in vec4 a_col;
in vec4 a_uv;
uniform vec2 u_scr, u_pan, u_tile;
uniform float u_zoom;
out vec2 v_uv;
flat out int v_slot;
flat out vec4 v_col;
void main(){
  v_uv = mix(a_uv.xy, a_uv.zw, a_pos);
  v_slot = int(a_slot + .5);
  v_col = a_col;
  vec2 c = a_off + u_tile * .5;
  vec2 w = c + (a_pos - .5) * u_tile * a_scale;
  vec2 s = w * u_zoom + u_pan;
  vec2 cl = s / u_scr * 2. - 1.;
  cl.y = -cl.y;
  gl_Position = vec4(cl, 0, 1);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
flat in int v_slot;
flat in vec4 v_col;
uniform sampler2D u_t0,u_t1,u_t2,u_t3,u_t4,u_t5,u_t6,u_t7;
out vec4 o;
void main(){
  if(v_slot<0){o=v_col;return;}
  vec4 c;
  vec2 u=v_uv;
  if(v_slot==0)c=texture(u_t0,u);
  else if(v_slot==1)c=texture(u_t1,u);
  else if(v_slot==2)c=texture(u_t2,u);
  else if(v_slot==3)c=texture(u_t3,u);
  else if(v_slot==4)c=texture(u_t4,u);
  else if(v_slot==5)c=texture(u_t5,u);
  else if(v_slot==6)c=texture(u_t6,u);
  else if(v_slot==7)c=texture(u_t7,u);
  else{o=v_col;return;}
  o=vec4(c.rgb,c.a*v_col.a);
}`;

const HOVER_V = `#version 300 es
precision highp float;
in vec2 a_pos;
uniform vec2 u_scr,u_pan,u_off,u_tile;
uniform float u_zoom,u_scale;
out vec2 v_uv;
void main(){
  v_uv=a_pos;
  vec2 c=u_off+u_tile*.5;
  vec2 w=c+(a_pos-.5)*u_tile*u_scale;
  vec2 s=w*u_zoom+u_pan;
  vec2 cl=s/u_scr*2.-1.; cl.y=-cl.y;
  gl_Position=vec4(cl,0,1);
}`;

const HOVER_F = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_alpha,u_bw,u_fill;
uniform vec4 u_bc;
uniform vec2 u_tile;
out vec4 o;
void main(){
  vec2 p=v_uv*u_tile;
  float b=u_bw;
  if(p.x<b||p.x>u_tile.x-b||p.y<b||p.y>u_tile.y-b)
    o=vec4(u_bc.rgb,u_bc.a*u_alpha);
  else
    o=vec4(u_bc.rgb,u_fill*u_alpha);
}`;

const SLOTS = 8;
const MAX_INST = 4096;

function mkShader(gl: WebGL2RenderingContext, t: number, s: string) {
  const sh = gl.createShader(t)!;
  gl.shaderSource(sh, s); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(sh) || "shader error");
  return sh;
}

function mkProg(gl: WebGL2RenderingContext, v: string, f: string) {
  const p = gl.createProgram()!;
  const vs = mkShader(gl, gl.VERTEX_SHADER, v);
  const fs = mkShader(gl, gl.FRAGMENT_SHADER, f);
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p) || "link error");
  return p;
}

interface GpuTexEntry { glTex: WebGLTexture; lastFrame: number; }
const gpuTexCache = new Map<ImageBitmap, GpuTexEntry>();
let gpuFrame = 0;
const GPU_TEX_MAX = 512;
const GPU_TEX_EVICT = 128;

/**
 * Compute center-crop UV rect so a source image fills the tile
 * without stretching — excess is cropped equally from both sides.
 */
export function cropUV(imgW: number, imgH: number): [number, number, number, number] {
  if (imgW <= 0 || imgH <= 0) return [0, 0, 1, 1];
  const srcAspect = imgW / imgH;
  if (srcAspect > TILE_ASPECT) {
    // Image is wider than tile — crop sides
    const frac = TILE_ASPECT / srcAspect;
    const margin = (1 - frac) * 0.5;
    return [margin, 0, 1 - margin, 1];
  } else {
    // Image is taller than tile — crop top/bottom
    const frac = srcAspect / TILE_ASPECT;
    const margin = (1 - frac) * 0.5;
    return [0, margin, 1, 1 - margin];
  }
}

function buildAdLabelTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const w = 56, h = 100;
  const c = document.createElement("canvas");
  c.width = w * 2; c.height = h * 2;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#3a3a3e";
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.font = `bold ${Math.round(h * 0.5)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("AD", c.width / 2, c.height / 2);

  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

export class TileRenderer {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private hProg: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private hVao: WebGLVertexArrayObject;
  private iBuf: WebGLBuffer;
  private iData: Float32Array;
  private dpr: number;
  private adTex: WebGLTexture;

  private uScr: WebGLUniformLocation;
  private uPan: WebGLUniformLocation;
  private uZoom: WebGLUniformLocation;
  private uTile: WebGLUniformLocation;
  private uTex: WebGLUniformLocation[];

  private hScr: WebGLUniformLocation;
  private hPan: WebGLUniformLocation;
  private hZoom: WebGLUniformLocation;
  private hOff: WebGLUniformLocation;
  private hTile: WebGLUniformLocation;
  private hScale: WebGLUniformLocation;
  private hAlpha: WebGLUniformLocation;
  private hBc: WebGLUniformLocation;
  private hBw: WebGLUniformLocation;
  private hFill: WebGLUniformLocation;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false,
    })!;
    if (!gl) throw new Error("WebGL2 not supported");
    this.gl = gl;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.prog = mkProg(gl, VERT, FRAG);
    this.hProg = mkProg(gl, HOVER_V, HOVER_F);

    const u = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n)!;
    this.uScr = u(this.prog, "u_scr");
    this.uPan = u(this.prog, "u_pan");
    this.uZoom = u(this.prog, "u_zoom");
    this.uTile = u(this.prog, "u_tile");
    this.uTex = [];
    for (let i = 0; i < SLOTS; i++) this.uTex.push(u(this.prog, `u_t${i}`));

    this.hScr = u(this.hProg, "u_scr");
    this.hPan = u(this.hProg, "u_pan");
    this.hZoom = u(this.hProg, "u_zoom");
    this.hOff = u(this.hProg, "u_off");
    this.hTile = u(this.hProg, "u_tile");
    this.hScale = u(this.hProg, "u_scale");
    this.hAlpha = u(this.hProg, "u_alpha");
    this.hBc = u(this.hProg, "u_bc");
    this.hBw = u(this.hProg, "u_bw");
    this.hFill = u(this.hProg, "u_fill");

    const qb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0,1,0,0,1,1,1]), gl.STATIC_DRAW);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    const a = (n: string) => gl.getAttribLocation(this.prog, n);
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.enableVertexAttribArray(a("a_pos"));
    gl.vertexAttribPointer(a("a_pos"), 2, gl.FLOAT, false, 0, 0);

    this.iData = new Float32Array(MAX_INST * FLOATS_PER);
    this.iBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.iData.byteLength, gl.DYNAMIC_DRAW);

    const STRIDE = FLOATS_PER * 4;
    const attr = (name: string, size: number, offset: number) => {
      const loc = a(name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE, offset);
      gl.vertexAttribDivisor(loc, 1);
    };
    attr("a_off", 2, 0);
    attr("a_slot", 1, 8);
    attr("a_scale", 1, 12);
    attr("a_col", 4, 16);
    attr("a_uv", 4, 32);
    gl.bindVertexArray(null);

    this.hVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.hVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    const hp = gl.getAttribLocation(this.hProg, "a_pos");
    gl.enableVertexAttribArray(hp);
    gl.vertexAttribPointer(hp, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.adTex = buildAdLabelTexture(gl);
  }

  resize() {
    const c = this.canvas;
    const w = c.clientWidth * this.dpr | 0;
    const h = c.clientHeight * this.dpr | 0;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  }

  private getGpuTex(img: ImageBitmap): WebGLTexture {
    const existing = gpuTexCache.get(img);
    if (existing) { existing.lastFrame = gpuFrame; return existing.glTex; }

    if (gpuTexCache.size >= GPU_TEX_MAX) {
      const cutoff = gpuFrame - 120;
      let removed = 0;
      for (const [key, entry] of gpuTexCache) {
        if (entry.lastFrame < cutoff) {
          this.gl.deleteTexture(entry.glTex);
          gpuTexCache.delete(key);
          if (++removed >= GPU_TEX_EVICT) break;
        }
      }
    }

    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gpuTexCache.set(img, { glTex: t, lastFrame: gpuFrame });
    return t;
  }

  beginFrame() {
    gpuFrame++;
    const gl = this.gl;
    const cw = this.canvas.width, ch = this.canvas.height;
    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0.039, 0.039, 0.039, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  draw(
    imgTiles: readonly ImgTile[],
    panX: number, panY: number, zoom: number,
    hCol: number, hRow: number, hAlpha: number, hScale: number,
  ) {
    const gl = this.gl;
    const cw = this.canvas.width, ch = this.canvas.height;

    if (imgTiles.length === 0) {
      this.drawHover(gl, cw, ch, panX, panY, zoom, hCol, hRow, hAlpha, hScale);
      return;
    }

    const d = this.dpr;
    const px = panX * d, py = panY * d, z = zoom * d;

    gl.useProgram(this.prog);
    gl.uniform2f(this.uScr, cw, ch);
    gl.uniform2f(this.uPan, px, py);
    gl.uniform1f(this.uZoom, z);
    gl.uniform2f(this.uTile, INNER_W, INNER_H);
    gl.bindVertexArray(this.vao);

    let cursor = 0;
    while (cursor < imgTiles.length) {
      const batchTexes: WebGLTexture[] = [];
      const texToSlot = new Map<WebGLTexture, number>();
      let count = 0;

      for (let i = cursor; i < imgTiles.length && count < MAX_INST; i++) {
        const t = imgTiles[i];
        const glTex = this.getGpuTex(t.img);
        let slot = texToSlot.get(glTex);
        if (slot === undefined) {
          if (batchTexes.length >= SLOTS) break;
          slot = batchTexes.length;
          batchTexes.push(glTex);
          texToSlot.set(glTex, slot);
        }

        const o = count * FLOATS_PER;
        this.iData[o]     = t.col * TILE_WIDTH + TILE_GAP * 0.5;
        this.iData[o + 1] = t.row * TILE_HEIGHT + TILE_GAP * 0.5;
        this.iData[o + 2] = slot;
        this.iData[o + 3] = t.scale;
        this.iData[o + 4] = 1; this.iData[o + 5] = 1;
        this.iData[o + 6] = 1; this.iData[o + 7] = t.alpha;
        this.iData[o + 8]  = t.u0;
        this.iData[o + 9]  = t.v0;
        this.iData[o + 10] = t.u1;
        this.iData[o + 11] = t.v1;
        count++;
        cursor = i + 1;
      }

      if (count === 0) break;

      for (let s = 0; s < batchTexes.length; s++) {
        gl.activeTexture(gl.TEXTURE0 + s);
        gl.bindTexture(gl.TEXTURE_2D, batchTexes[s]);
        gl.uniform1i(this.uTex[s], s);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, this.iBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.iData, 0, count * FLOATS_PER);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    }

    gl.bindVertexArray(null);
    this.drawHover(gl, cw, ch, panX, panY, zoom, hCol, hRow, hAlpha, hScale);
  }

  drawSolid(
    solidTiles: readonly SolidTile[],
    panX: number, panY: number, zoom: number,
  ) {
    if (solidTiles.length === 0) return;
    const gl = this.gl;
    const d = this.dpr;
    gl.useProgram(this.prog);
    gl.uniform2f(this.uScr, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.uPan, panX * d, panY * d);
    gl.uniform1f(this.uZoom, zoom * d);
    gl.uniform2f(this.uTile, INNER_W, INNER_H);
    gl.bindVertexArray(this.vao);

    let cursor = 0;
    while (cursor < solidTiles.length) {
      const count = Math.min(solidTiles.length - cursor, MAX_INST);
      for (let i = 0; i < count; i++) {
        const t = solidTiles[cursor + i];
        const o = i * FLOATS_PER;
        this.iData[o]     = t.col * TILE_WIDTH + TILE_GAP * 0.5;
        this.iData[o + 1] = t.row * TILE_HEIGHT + TILE_GAP * 0.5;
        this.iData[o + 2] = -1;
        this.iData[o + 3] = t.scale ?? 1;
        this.iData[o + 4] = t.r; this.iData[o + 5] = t.g;
        this.iData[o + 6] = t.b; this.iData[o + 7] = 1;
        this.iData[o + 8] = 0; this.iData[o + 9] = 0;
        this.iData[o + 10] = 1; this.iData[o + 11] = 1;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.iBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.iData, 0, count * FLOATS_PER);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      cursor += count;
    }
    gl.bindVertexArray(null);
  }

  drawAdLabels(
    adTiles: readonly SolidTile[],
    panX: number, panY: number, zoom: number,
  ) {
    if (adTiles.length === 0) return;
    const gl = this.gl;
    const d = this.dpr;
    gl.useProgram(this.prog);
    gl.uniform2f(this.uScr, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.uPan, panX * d, panY * d);
    gl.uniform1f(this.uZoom, zoom * d);
    gl.uniform2f(this.uTile, INNER_W, INNER_H);
    gl.bindVertexArray(this.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.adTex);
    gl.uniform1i(this.uTex[0], 0);

    let cursor = 0;
    while (cursor < adTiles.length) {
      const count = Math.min(adTiles.length - cursor, MAX_INST);
      for (let i = 0; i < count; i++) {
        const t = adTiles[cursor + i];
        const o = i * FLOATS_PER;
        this.iData[o]     = t.col * TILE_WIDTH + TILE_GAP * 0.5;
        this.iData[o + 1] = t.row * TILE_HEIGHT + TILE_GAP * 0.5;
        this.iData[o + 2] = 0;
        this.iData[o + 3] = 1;
        this.iData[o + 4] = 1; this.iData[o + 5] = 1;
        this.iData[o + 6] = 1; this.iData[o + 7] = 1;
        this.iData[o + 8] = 0; this.iData[o + 9] = 0;
        this.iData[o + 10] = 1; this.iData[o + 11] = 1;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.iBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.iData, 0, count * FLOATS_PER);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      cursor += count;
    }
    gl.bindVertexArray(null);
  }

  private drawHover(
    gl: WebGL2RenderingContext, cw: number, ch: number,
    panX: number, panY: number, zoom: number,
    hCol: number, hRow: number, hAlpha: number, hScale: number,
  ) {
    if (hCol < 0 || hRow < 0 || hAlpha < 0.01) return;
    const d = this.dpr;
    gl.useProgram(this.hProg);
    gl.uniform2f(this.hScr, cw, ch);
    gl.uniform2f(this.hPan, panX * d, panY * d);
    gl.uniform1f(this.hZoom, zoom * d);
    gl.uniform2f(this.hOff, hCol * TILE_WIDTH + TILE_GAP * 0.5, hRow * TILE_HEIGHT + TILE_GAP * 0.5);
    gl.uniform2f(this.hTile, INNER_W, INNER_H);
    gl.uniform1f(this.hScale, hScale);
    gl.uniform1f(this.hAlpha, hAlpha);
    gl.uniform4f(this.hBc, 0.545, 0.361, 0.965, 1.0);
    gl.uniform1f(this.hBw, 1.5);
    gl.uniform1f(this.hFill, 0.08);
    gl.bindVertexArray(this.hVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  drawBorders(
    borders: readonly BorderTile[],
    panX: number, panY: number, zoom: number,
  ) {
    if (borders.length === 0) return;
    const gl = this.gl;
    const cw = this.canvas.width, ch = this.canvas.height;
    const d = this.dpr;
    gl.useProgram(this.hProg);
    gl.uniform2f(this.hScr, cw, ch);
    gl.uniform2f(this.hPan, panX * d, panY * d);
    gl.uniform1f(this.hZoom, zoom * d);
    gl.uniform2f(this.hTile, INNER_W, INNER_H);
    gl.bindVertexArray(this.hVao);

    gl.uniform1f(this.hFill, 0.0);
    for (const b of borders) {
      gl.uniform2f(this.hOff, b.col * TILE_WIDTH + TILE_GAP * 0.5, b.row * TILE_HEIGHT + TILE_GAP * 0.5);
      gl.uniform1f(this.hScale, 1.0);
      gl.uniform1f(this.hAlpha, 1.0);
      gl.uniform4f(this.hBc, b.r, b.g, b.b, 1.0);
      gl.uniform1f(this.hBw, b.width);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    gl.bindVertexArray(null);
  }

  destroy() {
    const gl = this.gl;
    gl.deleteProgram(this.prog);
    gl.deleteProgram(this.hProg);
    gl.deleteBuffer(this.iBuf);
    gl.deleteVertexArray(this.vao);
    gl.deleteVertexArray(this.hVao);
    gl.deleteTexture(this.adTex);
    for (const e of gpuTexCache.values()) gl.deleteTexture(e.glTex);
    gpuTexCache.clear();
  }

  screenToWorld(sx: number, sy: number, panX: number, panY: number, zoom: number) {
    return { wx: (sx - panX) / zoom, wy: (sy - panY) / zoom };
  }

  worldToGrid(wx: number, wy: number) {
    const col = Math.floor(wx / TILE_WIDTH);
    const row = Math.floor(wy / TILE_HEIGHT);
    return (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS)
      ? { col, row } : { col: -1, row: -1 };
  }
}

export interface ImgTile {
  col: number;
  row: number;
  img: ImageBitmap;
  scale: number;
  u0: number; v0: number;
  u1: number; v1: number;
  alpha: number;
}

export interface SolidTile {
  col: number;
  row: number;
  r: number; g: number; b: number;
  scale?: number;
}

export interface BorderTile {
  col: number;
  row: number;
  r: number; g: number; b: number;
  width: number;
}
