// ==UserScript==
// @name         Wplace Overlay Pro (Việt hóa) - Modified By @SrCratier
// @namespace    http://tampermonkey.net/
// @version      5.3.0-vi
// @description  [Vietsub by CheemsGalaxy] Overlays tiles on wplace.live. Can also resize, and color-match your overlay to wplace's palette. Make sure to comply with the site's Terms of Service, and rules! This script is not affiliated with Wplace.live in any way, use at your risk. This script is not affiliated with TamperMonkey. The author of this userscript is not responsible for any damages, issues, loss of data, or punishment that may occur as a result of using this script. This script is provided "as is" under GPLv3.
// @author       shinkonet (Modificado por @SrCratier), Vietsub by CheemsGalaxy
// @match        https://wplace.live/*
// @license      GPLv3
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      *
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const TILE_SIZE = 1000;
  const MAX_OVERLAY_DIM = 3000;
  const MINIFY_SCALE = 3;
  const NATIVE_FETCH = window.fetch;
  const tileDataCache = new Map();

  const gmGet = (key, def) => {
    try {
      if (typeof GM !== 'undefined' && typeof GM.getValue === 'function') return GM.getValue(key, def);
      if (typeof GM_getValue === 'function') return Promise.resolve(GM_getValue(key, def));
    } catch {}
    return Promise.resolve(def);
  };
  const gmSet = (key, value) => {
    try {
      if (typeof GM !== 'undefined' && typeof GM.setValue === 'function') return GM.setValue(key, value);
      if (typeof GM_setValue === 'function') return Promise.resolve(GM_setValue(key, value));
    } catch {}
    return Promise.resolve();
  };

  function gmFetchBlob(url) {
    return new Promise((resolve, reject) => {
      try {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          responseType: 'blob',
          onload: (res) => {
            if (res.status >= 200 && res.status < 300 && res.response) resolve(res.response);
            else reject(new Error(`GM_xhr failed: ${res.status} ${res.statusText}`));
          },
          onerror: () => reject(new Error('GM_xhr network error')),
          ontimeout: () => reject(new Error('GM_xhr timeout')),
        });
      } catch (e) { reject(e); }
    });
  }
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }
  async function urlToDataURL(url) {
    const blob = await gmFetchBlob(url);
    if (!blob || !String(blob.type).startsWith('image/')) throw new Error('URL did not return an image blob');
    return await blobToDataURL(blob);
  }
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  const WPLACE_FREE = [
    [0,0,0], [60,60,60], [120,120,120], [210,210,210], [255,255,255],
    [96,0,24], [237,28,36], [255,127,39], [246,170,9], [249,221,59], [255,250,188],
    [14,185,104], [19,230,123], [135,255,94],
    [12,129,110], [16,174,166], [19,225,190], [96,247,242],
    [40,80,158], [64,147,228],
    [107,80,246], [153,177,251],
    [120,12,153], [170,56,185], [224,159,249],
    [203,0,122], [236,31,128], [243,141,169],
    [104,70,52], [149,104,42], [248,178,119]
  ];
  const WPLACE_PAID = [
    [170,170,170],
    [165,14,30], [250,128,114],
    [228,92,26], [156,132,49], [197,173,49], [232,212,95],
    [74,107,58], [90,148,74], [132,197,115],
    [15,121,159], [187,250,242], [125,199,255],
    [77,49,184], [74,66,132], [122,113,196], [181,174,241],
    [155,82,73], [209,128,120], [250,182,164],
    [219,164,99], [123,99,82], [156,132,107], [214,181,148],
    [209,128,81], [255,197,165],
    [109,100,63], [148,140,107], [205,197,158],
    [51,57,65], [109,117,141], [179,185,209]
  ];

  const FULL_PALETTE = [...WPLACE_FREE, ...WPLACE_PAID];

  const WPLACE_NAMES = {
    "0,0,0":"Black","60,60,60":"Dark Gray","120,120,120":"Gray","210,210,210":"Light Gray","255,255,255":"White", "170,170,170":"Medium Gray",
    "96,0,24":"Deep Red","237,28,36":"Red","255,127,39":"Orange","246,170,9":"Gold","249,221,59":"Yellow","255,250,188":"Light Yellow",
    "14,185,104":"Dark Green","19,230,123":"Green","135,255,94":"Light Green",
    "12,129,110":"Dark Teal","16,174,166":"Teal","19,225,190":"Light Teal","96,247,242":"Cyan",
    "40,80,158":"Dark Blue","64,147,228":"Blue",
    "107,80,246":"Indigo","153,177,251":"Light Indigo",
    "120,12,153":"Dark Purple","170,56,185":"Purple","224,159,249":"Light Purple",
    "203,0,122":"Dark Pink","236,31,128":"Pink","243,141,169":"Light Pink",
    "104,70,52":"Dark Brown","149,104,42":"Brown","248,178,119":"Beige",
    "165,14,30":"Dark Red","250,128,114":"Light Red",
    "228,92,26":"Dark Orange","156,132,49":"Dark Goldenrod","197,173,49":"Goldenrod","232,212,95":"Light Goldenrod",
    "74,107,58":"Dark Olive","90,148,74":"Olive","132,197,115":"Light Olive",
    "15,121,159":"Dark Cyan","187,250,242":"Light Cyan","125,199,255":"Light Blue",
    "77,49,184":"Dark Indigo","74,66,132":"Dark Slate Blue","122,113,196":"Slate Blue","181,174,241":"Light Slate Blue",
    "155,82,73":"Dark Peach","209,128,120":"Peach","250,182,164":"Light Peach",
    "219,164,99":"Light Brown","123,99,82":"Dark Tan","156,132,107":"Tan","214,181,148":"Light Tan",
    "209,128,81":"Dark Beige","255,197,165":"Light Beige",
    "109,100,63":"Dark Stone","148,140,107":"Stone","205,197,158":"Light Stone",
    "51,57,65":"Dark Slate","109,117,141":"Slate","179,185,209":"Light Slate"
  };

  function getPaletteColorId(r, g, b) {
      let minDistance = Infinity;
      let bestId = 0;
      for (let i = 0; i < FULL_PALETTE.length; i++) {
          const pr = FULL_PALETTE[i][0], pg = FULL_PALETTE[i][1], pb = FULL_PALETTE[i][2];
          const rmean = (r + pr) / 2;
          const dr = r - pr;
          const dg = g - pg;
          const db = b - pb;
          const dist = (((512 + rmean) * dr * dr) >> 8) + (4 * dg * dg) + (((767 - rmean) * db * db) >> 8);
          if (dist < minDistance) { minDistance = dist; bestId = i; }
          if (dist === 0) break;
      }
      return bestId;
  }

  const DEFAULT_FREE_KEYS = WPLACE_FREE.map(([r,g,b]) => `${r},${g},${b}`);
  const DEFAULT_PAID_KEYS = [];
  const page = unsafeWindow;

  let lastKnownAvailableColors = new Set();

  const DONATORS = [
    { name: "kleyder1205 ", contribution: "- Đã donate 5 USD   :D ❤️" },
    { name: "Nuntius ", contribution: "- Đã donate 5 USD   :D ❤️" },
    { name: "espressos work ", contribution: "- Đã donate 5 USD   :D ❤️" },
  ];

  function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
  function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
          const later = () => {
              clearTimeout(timeout);
              func(...args);
          };
          clearTimeout(timeout);
          timeout = setTimeout(later, wait);
      };
  }
  function uniqueName(base) {
    const names = new Set(config.overlays.map(o => (o.name || '').toLowerCase()));
    if (!names.has(base.toLowerCase())) return base;
    let i = 1; while (names.has(`${base} (${i})`.toLowerCase())) i++; return `${base} (${i})`;
  }

  function createCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function createHTMLCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function canvasToBlob(canvas) { if (canvas.convertToBlob) return canvas.convertToBlob(); return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("toBlob failed")), "image/png")); }
  async function canvasToDataURLSafe(canvas) {
    if (canvas && typeof canvas.toDataURL === 'function') return canvas.toDataURL('image/png');
    if (canvas && typeof canvas.convertToBlob === 'function') { const blob = await canvas.convertToBlob(); return await blobToDataURL(blob); }
    if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
      const bmp = canvas.transferToImageBitmap?.();
      if (bmp) { const html = createHTMLCanvas(canvas.width, canvas.height); const ctx = html.getContext('2d'); ctx.drawImage(bmp, 0, 0); return html.toDataURL('image/png'); }
    }
    throw new Error('Cannot export canvas to data URL');
  }
  async function blobToImage(blob) {
    if (typeof createImageBitmap === 'function') { try { return await createImageBitmap(blob); } catch {} }
    return new Promise((resolve, reject) => { const url = URL.createObjectURL(blob); const img = new Image(); img.onload = () => { URL.revokeObjectURL(url); resolve(img); }; img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); }; img.src = url; });
  }
  function loadImage(src) { return new Promise((resolve, reject) => { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => resolve(img); img.onerror = reject; img.src = src; }); }
  function extractPixelCoords(pixelUrl) {
    try { const u = new URL(pixelUrl); const parts = u.pathname.split('/'); const sp = new URLSearchParams(u.search);
      return { chunk1: parseInt(parts[3], 10), chunk2: parseInt(parts[4], 10), posX: parseInt(sp.get('x') || '0', 10), posY: parseInt(sp.get('y') || '0', 10) };
    } catch { return { chunk1: 0, chunk2: 0, posX: 0, posY: 0 }; }
  }
  function matchTileUrl(urlStr) {
    try { const u = new URL(urlStr, location.href);
      if (u.hostname !== 'backend.wplace.live' || !u.pathname.startsWith('/files/')) return null;
      const m = u.pathname.match(/\/(\d+)\/(\d+)\.png$/i);
      if (!m) return null;
      return { chunk1: parseInt(m[1], 10), chunk2: parseInt(m[2], 10) };
    } catch { return null; }
  }
  function matchPixelUrl(urlStr) {
    try { const u = new URL(urlStr, location.href);
      if (u.hostname !== 'backend.wplace.live') return null;
      const m = u.pathname.match(/\/s0\/pixel\/(\d+)\/(\d+)$/); if (!m) return null;
      const sp = u.searchParams;
      return { normalized: `https://backend.wplace.live/s0/pixel/${m[1]}/${m[2]}?x=${sp.get('x')||0}&y=${sp.get('y')||0}` };
    } catch { return null; }
  }
  function rectIntersect(ax, ay, aw, ah, bx, by, bw, bh) {
    const x = Math.max(ax, bx), y = Math.max(ay, by);
    const r = Math.min(ax + aw, bx + bw), b = Math.min(ay + ah, by + bh);
    const w = Math.max(0, r - x), h = Math.max(0, b - y);
    return { x, y, w, h };
  }

  const overlayCache = new Map();
  const imageAnalysisCache = new Map();
  const tooLargeOverlays = new Set();

  function overlaySignature(ov) {
    const imgKey = ov.imageBase64 ? ov.imageBase64.slice(0, 64) + ':' + ov.imageBase64.length : 'none';
    return [imgKey, ov.pixelUrl || 'null', ov.offsetX, ov.offsetY, ov.opacity].join('|');
  }
  function clearOverlayCache() { overlayCache.clear(); }

  async function getOrBuildOverlayCache(ov) {
      let cache = imageAnalysisCache.get(ov.id);
      if (cache && cache.base64 === ov.imageBase64) return cache;

      const img = await loadImage(ov.imageBase64);
      const canvas = createHTMLCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, img.width, img.height).data;

      const colorIds = new Uint8Array(img.width * img.height);
      const neededCounts = {};
      const fastColorCache = new Map();

      for (let i = 0; i < data.length; i += 4) {
          const pxIdx = i / 4;
          if (data[i + 3] < 128) {
              colorIds[pxIdx] = 255;
              continue;
          }
          const r = data[i], g = data[i+1], b = data[i+2];
          const rawKey = (r << 16) | (g << 8) | b;

          let bestId = fastColorCache.get(rawKey);
          if (bestId === undefined) {
              bestId = getPaletteColorId(r, g, b);
              fastColorCache.set(rawKey, bestId);
          }

          colorIds[pxIdx] = bestId;
          neededCounts[bestId] = (neededCounts[bestId] || 0) + 1;
      }

      cache = { base64: ov.imageBase64, width: img.width, height: img.height, colorIds, neededCounts };
      imageAnalysisCache.set(ov.id, cache);

      if (ov.cachedColorData) delete ov.cachedColorData;

      return cache;
  }

  async function buildOverlayDataForChunk(ov, targetChunk1, targetChunk2, originalTileImageData = null) {
    if (!ov.enabled || !ov.imageBase64 || !ov.pixelUrl) return null;
    if (tooLargeOverlays.has(ov.id)) return null;
    const sig = overlaySignature(ov);
    const cacheKey = `${ov.id}|${sig}|${targetChunk1}|${targetChunk2}|errors=${config.showErrors}|filter=${ov.filterActive}`;
    if (overlayCache.has(cacheKey)) return overlayCache.get(cacheKey);

    const cacheData = await getOrBuildOverlayCache(ov);
    const wImg = cacheData.width, hImg = cacheData.height;

    if (wImg >= MAX_OVERLAY_DIM || hImg >= MAX_OVERLAY_DIM) {
      tooLargeOverlays.add(ov.id);
      showToast(`Bỏ qua overlay "${ov.name}": ảnh quá lớn.`);
      return null;
    }

    const base = extractPixelCoords(ov.pixelUrl);
    if (!Number.isFinite(base.chunk1) || !Number.isFinite(base.chunk2)) return null;

    const drawX = (base.chunk1 * TILE_SIZE + base.posX + ov.offsetX) - (targetChunk1 * TILE_SIZE);
    const drawY = (base.chunk2 * TILE_SIZE + base.posY + ov.offsetY) - (targetChunk2 * TILE_SIZE);
    const isect = rectIntersect(0, 0, TILE_SIZE, TILE_SIZE, drawX, drawY, wImg, hImg);
    if (isect.w === 0 || isect.h === 0) { overlayCache.set(cacheKey, null); return null; }

    const imageData = new ImageData(isect.w, isect.h);
    const data = imageData.data;
    const colorStrength = ov.opacity;
    const whiteStrength = 1 - colorStrength;
    const isErrorCheckMode = config.showErrors && originalTileImageData;

    const filterSet = (ov.filterActive && ov.savedFilters) ? new Set(ov.savedFilters) : null;

    for (let i = 0; i < data.length; i += 4) {
      const currentX = isect.x + (i / 4) % isect.w;
      const currentY = isect.y + Math.floor((i / 4) / isect.w);

      const ovLocX = currentX - drawX;
      const ovLocY = currentY - drawY;
      const ovId = cacheData.colorIds[ovLocY * wImg + ovLocX];

      if (ovId === 255) continue;

      const targetColor = FULL_PALETTE[ovId];
      const r_ov = targetColor[0], g_ov = targetColor[1], b_ov = targetColor[2];

      if (filterSet && !filterSet.has(`${r_ov},${g_ov},${b_ov}`)) continue;

      const originalIndex = (currentY * TILE_SIZE + currentX) * 4;

      if (isErrorCheckMode && originalTileImageData) {
          const r_orig = originalTileImageData.data[originalIndex];
          const g_orig = originalTileImageData.data[originalIndex + 1];
          const b_orig = originalTileImageData.data[originalIndex + 2];
          const a_orig = originalTileImageData.data[originalIndex + 3];
          const ovSum = r_ov + g_ov + b_ov;
          let isMatch = false;

          if (ovSum < 10) {
               const mapSum = r_orig + g_orig + b_orig;
               isMatch = (a_orig > 200) && (mapSum < 10);
          } else {
               isMatch = (a_orig > 100) && (r_ov === r_orig && g_ov === g_orig && b_ov === b_orig);
          }
          if (isMatch) continue;

          const alpha = 0.6;
          data[i] = Math.round(r_ov * (1 - alpha) + 255 * alpha);
          data[i + 1] = Math.round(g_ov * (1 - alpha) + 0 * alpha);
          data[i + 2] = Math.round(b_ov * (1 - alpha) + 255 * alpha);
          data[i + 3] = 255;
      } else if (config.highlightMissing && originalTileImageData) {
          const r_orig = originalTileImageData.data[originalIndex];
          const g_orig = originalTileImageData.data[originalIndex + 1];
          const b_orig = originalTileImageData.data[originalIndex + 2];
          if (r_ov === r_orig && g_ov === g_orig && b_ov === b_orig) continue;

          data[i] = 0; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 150;
      } else {
          data[i] = Math.round(r_ov * colorStrength + 255 * whiteStrength);
          data[i + 1] = Math.round(g_ov * colorStrength + 255 * whiteStrength);
          data[i + 2] = Math.round(b_ov * colorStrength + 255 * whiteStrength);
          data[i + 3] = 255;
      }
    }
    const result = { imageData, dx: isect.x, dy: isect.y };
    overlayCache.set(cacheKey, result);
    if (overlayCache.size > 60) overlayCache.delete(overlayCache.keys().next().value);
    return result;
  }

  const PATTERNS = [
      (x, y, c, s) => x === c && y === c,
      (x, y, c, s) => y === c,
      (x, y, c, s) => x === c,
      (x, y, c, s) => x === c || y === c,
  ];

  const GRAYSCALE_KEYS = ["0,0,0", "60,60,60", "120,120,120", "170,170,170", "210,210,210", "255,255,255"];
  const FULL_PALETTE_ORDERED = [...new Set([...WPLACE_FREE, ...WPLACE_PAID].map(rgb => rgb.join(',')))];
  const OTHER_COLORS_ORDERED = FULL_PALETTE_ORDERED.filter(key => !GRAYSCALE_KEYS.includes(key));
  const colorToPatternMap = new Map();

  function getPattern(colorKey, relX, relY, center, scale) {
      if (colorToPatternMap.has(colorKey)) {
          const patternFn = colorToPatternMap.get(colorKey);
          return patternFn(relX, relY, center, scale);
      }
      let bestMatchKey = colorKey;
      let minDistance = Infinity;
      const [r, g, b] = colorKey.split(',').map(Number);
      for (const paletteKey of FULL_PALETTE_ORDERED) {
          const [pr, pg, pb] = paletteKey.split(',').map(Number);
          const distance = Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(b - pb);
          if (distance < minDistance) {
              minDistance = distance;
              bestMatchKey = paletteKey;
          }
          if (distance === 0) break;
      }
      let patternFn;
      switch (bestMatchKey) {
          case "255,255,255": case "0,0,0": patternFn = PATTERNS[0]; break;
          case "210,210,210": case "60,60,60": patternFn = PATTERNS[1]; break;
          case "170,170,170": patternFn = PATTERNS[2]; break;
          case "120,120,120": patternFn = PATTERNS[3]; break;
          default: {
              const colorIndex = OTHER_COLORS_ORDERED.indexOf(bestMatchKey);
              const patternIndex = (colorIndex === -1) ? 0 : colorIndex % PATTERNS.length;
              patternFn = PATTERNS[patternIndex];
              break;
          }
      }
      colorToPatternMap.set(colorKey, patternFn);
      return patternFn(relX, relY, center, scale);
  }

  function isColorSimilar(r1, g1, b1, r2, g2, b2, tolerance = 15) {
      return (Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)) <= tolerance;
  }

  async function buildOverlayDataForChunkMinify(ov, targetChunk1, targetChunk2, originalTileImageData = null) {
    if (!ov.enabled || !ov.imageBase64 || !ov.pixelUrl) return null;
    if (tooLargeOverlays.has(ov.id)) return null;

    const scale = MINIFY_SCALE;
    const sig = overlaySignature(ov);
    const cacheKey = `${ov.id}|${sig}|minify|s${scale}|${targetChunk1}|${targetChunk2}|errors=${config.showErrors}|filter=${ov.filterActive}`;
    if (overlayCache.has(cacheKey)) return overlayCache.get(cacheKey);

    const cacheData = await getOrBuildOverlayCache(ov);
    const wImg = cacheData.width, hImg = cacheData.height;

    if (wImg >= MAX_OVERLAY_DIM || hImg >= MAX_OVERLAY_DIM) {
      tooLargeOverlays.add(ov.id);
      showToast(`Bỏ qua overlay "${ov.name}": ảnh quá lớn.`);
      return null;
    }

    const base = extractPixelCoords(ov.pixelUrl);
    if (!Number.isFinite(base.chunk1) || !Number.isFinite(base.chunk2)) return null;

    const drawX = (base.chunk1 * TILE_SIZE + base.posX + ov.offsetX) - (targetChunk1 * TILE_SIZE);
    const drawY = (base.chunk2 * TILE_SIZE + base.posY + ov.offsetY) - (targetChunk2 * TILE_SIZE);

    const tileW = TILE_SIZE * scale;
    const tileH = TILE_SIZE * scale;
    const drawXScaled = Math.round(drawX * scale);
    const drawYScaled = Math.round(drawY * scale);
    const wScaled = wImg * scale;
    const hScaled = hImg * scale;

    const isect = rectIntersect(0, 0, tileW, tileH, drawXScaled, drawYScaled, wScaled, hScaled);
    if (isect.w === 0 || isect.h === 0) { overlayCache.set(cacheKey, null); return null; }

    const imageData = new ImageData(isect.w, isect.h);
    const data = imageData.data;
    const colorStrength = ov.opacity;
    const whiteStrength = 1 - colorStrength;
    const center = Math.floor(scale / 2);
    const width = isect.w;
    const isErrorCheckMode = config.showErrors && originalTileImageData;

    const origW = Math.ceil(width / scale);
    const origH = Math.ceil(isect.h / scale);
    const errorCache = isErrorCheckMode ? new Uint8Array(origW * origH) : null;
    const errorCalculated = isErrorCheckMode ? new Uint8Array(origW * origH) : null;

    const filterSet = (ov.filterActive && ov.savedFilters) ? new Set(ov.savedFilters) : null;

    for (let i = 0; i < data.length; i += 4) {
      const px = (i / 4) % width;
      const py = Math.floor((i / 4) / width);
      const absX = isect.x + px;
      const absY = isect.y + py;

      const originalLocalX = Math.floor(absX / scale) - drawX;
      const originalLocalY = Math.floor(absY / scale) - drawY;

      if (originalLocalX < 0 || originalLocalX >= wImg || originalLocalY < 0 || originalLocalY >= hImg) continue;

      const ovId = cacheData.colorIds[originalLocalY * wImg + originalLocalX];
      if (ovId === 255) continue;

      const targetColor = FULL_PALETTE[ovId];
      const r_ov = targetColor[0], g_ov = targetColor[1], b_ov = targetColor[2];
      const colorKey = `${r_ov},${g_ov},${b_ov}`;

      if (filterSet && !filterSet.has(colorKey)) continue;

      const relX = absX % scale;
      const relY = absY % scale;
      const shouldDrawPattern = getPattern(colorKey, relX, relY, center, scale);

      if (isErrorCheckMode) {
          const originalX = Math.floor(absX / scale);
          const originalY = Math.floor(absY / scale);
          const cacheIdx = originalY * origW + originalX;
          let isMatch = false;

          if (errorCalculated[cacheIdx]) {
              isMatch = errorCache[cacheIdx] === 1;
          } else {
              const originalIndex = (originalY * TILE_SIZE + originalX) * 4;
              const r_orig = originalTileImageData.data[originalIndex];
              const g_orig = originalTileImageData.data[originalIndex+1];
              const b_orig = originalTileImageData.data[originalIndex+2];
              const a_orig = originalTileImageData.data[originalIndex+3];
              const ovSum = r_ov + g_ov + b_ov;

              if (ovSum < 10) {
                  const mapSum = r_orig + g_orig + b_orig;
                  isMatch = (a_orig > 200) && (mapSum < 10);
              } else {
                  isMatch = (a_orig > 100) && isColorSimilar(r_ov, g_ov, b_ov, r_orig, g_orig, b_orig);
              }
              errorCache[cacheIdx] = isMatch ? 1 : 0;
              errorCalculated[cacheIdx] = 1;
          }

          if (isMatch) continue;

          if (shouldDrawPattern) {
              data[i] = r_ov; data[i+1] = g_ov; data[i+2] = b_ov; data[i+3] = 255;
          } else {
              data[i] = 255; data[i+1] = 0; data[i+2] = 255; data[i+3] = 255;
          }
      } else {
          if (shouldDrawPattern) {
              data[i] = Math.round(r_ov * colorStrength + 255 * whiteStrength);
              data[i + 1] = Math.round(g_ov * colorStrength + 255 * whiteStrength);
              data[i + 2] = Math.round(b_ov * colorStrength + 255 * whiteStrength);
              data[i + 3] = 255;
          }
      }
    }

    const result = { imageData, dx: isect.x, dy: isect.y, scaled: true, scale };
    overlayCache.set(cacheKey, result);
    if (overlayCache.size > 60) overlayCache.delete(overlayCache.keys().next().value);
    return result;
  }

  async function mergeOverlaysBehind(originalBlob, overlayDatas) {
    if (!overlayDatas || overlayDatas.length === 0) return originalBlob;
    const originalImage = await blobToImage(originalBlob);
    const w = originalImage.width, h = originalImage.height;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    for (const ovd of overlayDatas) { if (!ovd) continue; ctx.putImageData(ovd.imageData, ovd.dx, ovd.dy); }
    ctx.drawImage(originalImage, 0, 0);
    return await canvasToBlob(canvas);
  }

  async function mergeOverlaysAbove(originalBlob, overlayDatas) {
    if (!overlayDatas || overlayDatas.length === 0) return originalBlob;
    const originalImage = await blobToImage(originalBlob);
    const w = originalImage.width, h = originalImage.height;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(originalImage, 0, 0);
    for (const ovd of overlayDatas) {
      if (!ovd) continue;
      const data = ovd.imageData.data;
      const ovw = ovd.imageData.width;
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 0) {
          const x = ovd.dx + (i / 4) % ovw;
          const y = ovd.dy + Math.floor((i / 4) / ovw);
          ctx.fillStyle = `rgba(${data[i]}, ${data[i+1]}, ${data[i+2]}, ${alpha/255})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    return await canvasToBlob(canvas);
  }

  async function composeMinifiedTile(originalBlob, overlayDatas) {
    if (!overlayDatas || overlayDatas.length === 0) return originalBlob;
    const scale = MINIFY_SCALE;
    const originalImage = await blobToImage(originalBlob);
    const w = originalImage.width, h = originalImage.height;
    const canvas = createCanvas(w * scale, h * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(originalImage, 0, 0, w * scale, h * scale);
    for (const ovd of overlayDatas) {
      if (!ovd) continue;
      const tw = ovd.imageData.width;
      const th = ovd.imageData.height;
      if (tw === 0 || th === 0) continue;
      const temp = createCanvas(tw, th);
      const tctx = temp.getContext('2d', { willReadFrequently: true });
      tctx.putImageData(ovd.imageData, 0, 0);
      ctx.drawImage(temp, ovd.dx, ovd.dy);
    }
    return await canvasToBlob(canvas);
  }

    async function drawSelectionBoxOnBlob(blob, c1, c2) {
    if (!config.copyPreviewActive || !config.copyPointA || !config.copyPointB) return blob;
    const minX = Math.min(config.copyPointA.absX, config.copyPointB.absX);
    const minY = Math.min(config.copyPointA.absY, config.copyPointB.absY);
    const maxX = Math.max(config.copyPointA.absX, config.copyPointB.absX);
    const maxY = Math.max(config.copyPointA.absY, config.copyPointB.absY);
    const W = maxX - minX + 1;
    const H = maxY - minY + 1;
    const tileAbsX = c1 * TILE_SIZE;
    const tileAbsY = c2 * TILE_SIZE;
    const iSect = rectIntersect(minX, minY, W, H, tileAbsX, tileAbsY, TILE_SIZE, TILE_SIZE);
    if (iSect.w === 0 || iSect.h === 0) return blob;

    const originalImage = await blobToImage(blob);
    const canvas = createCanvas(originalImage.width, originalImage.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(originalImage, 0, 0);
    const dx = iSect.x - tileAbsX;
    const dy = iSect.y - tileAbsY;
    ctx.strokeStyle = 'rgba(237, 28, 36, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (tileAbsY <= minY) {
        ctx.moveTo(dx, dy + 1);
        ctx.lineTo(dx + iSect.w, dy + 1);
    }
    if (tileAbsY + TILE_SIZE >= maxY) {
        ctx.moveTo(dx, dy + iSect.h - 1);
        ctx.lineTo(dx + iSect.w, dy + iSect.h - 1);
    }
    if (tileAbsX <= minX) {
        ctx.moveTo(dx + 1, dy);
        ctx.lineTo(dx + 1, dy + iSect.h);
    }
    if (tileAbsX + TILE_SIZE >= maxX) {
        ctx.moveTo(dx + iSect.w - 1, dy);
        ctx.lineTo(dx + iSect.w - 1, dy + iSect.h);
    }
    ctx.stroke();
    return canvasToBlob(canvas);
}

function showToast(message, duration = 3000) {
    let stack = document.getElementById('op-toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'op-toast-stack';
      stack.id = 'op-toast-stack';
      document.body.appendChild(stack);
    }
    stack.classList.toggle('op-dark', config.theme === 'dark');
    const t = document.createElement('div');
    t.className = 'op-toast';
    t.textContent = message;
    stack.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 200);
    }, duration);
  }
  let hookInstalled = false;
  let overlayStateBeforePreview = true;

  function overlaysNeedingHook() {
    if (!config.showOverlay && !config.copyPreviewActive) return false;
    const hasImage = config.overlays.some(o => o.enabled && o.imageBase64);
    const placing  = !!config.autoCapturePixelUrl && !!config.activeOverlayId;
    const copying = !!config.isSettingCopyPoint;
    const needsHookMode = (config.overlayMode === 'behind' || config.overlayMode === 'above' || config.overlayMode === 'minify');
    return (needsHookMode && hasImage) || placing || copying || config.copyPreviewActive;
  }
  function ensureHook() { if (overlaysNeedingHook()) attachHook(); else detachHook(); }

  function attachHook() {
    if (hookInstalled) return;
    const originalFetch = NATIVE_FETCH;
    const hookedFetch = async (input, init) => {
        const urlStr = typeof input === 'string' ? input : (input && input.url) || '';

        if (!urlStr.includes('backend.wplace.live')) return originalFetch(input, init);

        const pixelMatch = matchPixelUrl(urlStr);
        if (pixelMatch) {
            if (config.autoCapturePixelUrl && config.activeOverlayId) {
                const ov = config.overlays.find(o => o.id === config.activeOverlayId);
                if (ov) {
                    ov.pixelUrl = pixelMatch.normalized; ov.offsetX = 0; ov.offsetY = 0;
                    await saveConfig(['overlays']); clearOverlayCache();
                    config.autoCapturePixelUrl = false; await saveConfig(['autoCapturePixelUrl']);
                    const c = extractPixelCoords(ov.pixelUrl);
                    showToast(`Đã đặt mốc neo cho "${ov.name}": chunk ${c.chunk1}/${c.chunk2} tại (${c.posX}, ${c.posY}).`);
                }
            }
            if (config.isSettingCopyPoint) {
                const coords = extractPixelCoords(pixelMatch.normalized);
                const point = {
                    chunk1: coords.chunk1, chunk2: coords.chunk2,
                    posX: coords.posX, posY: coords.posY,
                    absX: coords.chunk1 * TILE_SIZE + coords.posX,
                    absY: coords.chunk2 * TILE_SIZE + coords.posY,
                };
                const pointBeingSet = config.isSettingCopyPoint;
                config[pointBeingSet === 'A' ? 'copyPointA' : 'copyPointB'] = point;
                showToast(`Đã đặt điểm ${pointBeingSet} tại (${point.absX}, ${point.absY})`);
                config.isSettingCopyPoint = null;
                const keysToSave = ['copyPointA', 'copyPointB', 'isSettingCopyPoint'];
                if (config.copyPointA && config.copyPointB) {
                    config.copyPreviewActive = true;
                    keysToSave.push('copyPreviewActive');
                    overlayStateBeforePreview = config.showOverlay;
                    if (config.showOverlay) {
                        config.showOverlay = false;
                        keysToSave.push('showOverlay');
                        showToast('Đã bật xem trước khu vực. Overlay đã tắt.');
                    } else {
                        showToast('Đã bật xem trước khu vực.');
                    }
                    clearOverlayCache();
                }
                await saveConfig(keysToSave);
            }
            updateUI();
            ensureHook();
            const response = await originalFetch(input, init);

            if (response.ok && config.isColorPanelVisible) {
                await updateOverlayProgress();
            }
            if (response.ok && config.showErrors) {
                try {
                    const coords = extractPixelCoords(pixelMatch.normalized);
                    if (Number.isFinite(coords.chunk1) && Number.isFinite(coords.chunk2)) {
                        const chunkId = `|${coords.chunk1}|${coords.chunk2}|`;
                        for (const key of overlayCache.keys()) {
                            if (key.includes(chunkId)) {
                                overlayCache.delete(key);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Overlay Pro: Error invalidating cache after pixel placement.", e);
                }
            }
            return response;
        }

        const tileMatch = matchTileUrl(urlStr);
        if (tileMatch) {
            try {
                const response = await originalFetch(input, init);
                if (!response.ok) return response;
                const ct = (response.headers.get('Content-Type') || '').toLowerCase();
                if (!ct.includes('image')) return response;
                let originalBlob = await response.blob();
                if (originalBlob.size > 15 * 1024 * 1024) return new Response(originalBlob);
                const originalImage = await blobToImage(originalBlob);
                const tempCanvas = createCanvas(originalImage.width, originalImage.height);
                const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
                tempCtx.drawImage(originalImage, 0, 0);
                const originalTileImageData = tempCtx.getImageData(0, 0, originalImage.width, originalImage.height);
                tileDataCache.set(`${tileMatch.chunk1}/${tileMatch.chunk2}`, originalTileImageData);

                if (tileDataCache.size > 50) tileDataCache.delete(tileDataCache.keys().next().value);

                let finalBlob = originalBlob;
                const validModes = ['behind', 'above', 'minify'];
                const enabledOverlays = config.overlays.filter(o => o.enabled && o.imageBase64 && o.pixelUrl);

                if (config.showOverlay && enabledOverlays.length > 0 && validModes.includes(config.overlayMode)) {
                    if (config.overlayMode === 'minify') {
                        const overlayDatas = [];
                        for (const ov of enabledOverlays) {
                            overlayDatas.push(await buildOverlayDataForChunkMinify(ov, tileMatch.chunk1, tileMatch.chunk2, config.showErrors ? originalTileImageData : null));
                        }
                        finalBlob = await composeMinifiedTile(originalBlob, overlayDatas.filter(Boolean));
                    } else {
                        const overlayDatas = [];
                        for (const ov of enabledOverlays) {
                            overlayDatas.push(await buildOverlayDataForChunk(ov, tileMatch.chunk1, tileMatch.chunk2, config.showErrors ? originalTileImageData : null));
                        }
                        finalBlob = await (config.overlayMode === 'behind' ?
                            mergeOverlaysBehind(originalBlob, overlayDatas.filter(Boolean)) :
                            mergeOverlaysAbove(originalBlob, overlayDatas.filter(Boolean)));
                    }
                }
                if (config.copyPreviewActive) {
                    finalBlob = await drawSelectionBoxOnBlob(finalBlob, tileMatch.chunk1, tileMatch.chunk2);
                }
                const headers = new Headers(response.headers);
                headers.set('Content-Type', 'image/png');
                headers.delete('Content-Length');
                return new Response(finalBlob, { status: response.status, statusText: response.statusText, headers });
            } catch (e) {
                if (e.name !== 'AbortError') console.error("Overlay Pro: Error processing tile", e);
                return originalFetch(input, init);
            }
        }
        return originalFetch(input, init);
    };
    page.fetch = hookedFetch;
    window.fetch = hookedFetch;
    hookInstalled = true;
  }
  function detachHook() { if (!hookInstalled) return; page.fetch = NATIVE_FETCH; window.fetch = NATIVE_FETCH; hookInstalled = false; }

  const config = {
    language: 'vi',
    overlays:[],
    activeOverlayId: null,
    overlayMode: 'minify',
    isPanelCollapsed: false,
    autoCapturePixelUrl: false,
    showOverlay: true,
    showErrors: false,
    panelX: null,
    panelY: null,
    theme: 'dark',
    activeTab: 'overlays',
    copyNudgeTarget: 'A',
    isSettingCopyPoint: null,
    copyPointA: null,
    copyPointB: null,
    copyPreviewActive: false,
    ccFreeKeys: DEFAULT_FREE_KEYS.slice(),
    ccPaidKeys: DEFAULT_PAID_KEYS.slice(),
    ccZoom: 1.0,
    ccRealtime: false,
    isColorPanelVisible: false,
    colorPanelX: null,
    colorPanelY: null,
    colorPanelAlpha: 0.85,
    panelAlpha: 0.85,
    highlightMissing: false,
    caSortEnabled: true,
    caHighlightEnabled: true,
    caIsCollapsed: false,
    caFiltersVisible: false,
    caShowColorNames: true,
    caShowProgress: true,
    caShowRemainingOnly: false,
    lastKnownColors: []
  };
  const CONFIG_KEYS = Object.keys(config);
  const i18n = {
    vi: {
        title: "VoX - Overlay Pro", settings: "Cài đặt", toggle: "Thu gọn/Mở rộng Panel",
        overlayBtn: "Overlay", modeBtn: "Chế độ", errorsBtn: "Hiện lỗi", posBtn: "Đặt vị trí",
        tabOverlays: "Overlay", tabEditor: "Chỉnh sửa", tabTools: "Công cụ",
        add: "+ Thêm", import: "Nhập", export: "Xuất",
        editorPlaceholder: "Chọn một overlay để chỉnh sửa.", name: "Tên", mode: "Chế độ",
        modeStd: "Tiêu chuẩn (Khuyên dùng)", modeEnh: "Nâng cao (Pixel Art)", modePho: "Chân thực (Dithering)",
        image: "Ảnh", load: "Tải", dropzone: "Kéo ảnh vào đây hoặc bấm để chọn tệp.",
        opacity: "Độ trong suốt", offsetX: "Offset X", offsetY: "Y",
        copyCanvas: "Sao chép Canvas", setPointA: "Đặt điểm A", setPointB: "Đặt điểm B",
        fineTune: "Tinh chỉnh:", pointA: "Điểm A", pointB: "Điểm B",
        previewArea: "Xem trước khu vực", download: "Tải xuống", showProgress: "Hiện tiến độ Overlay",
        genSettings: "Cài đặt chung", uiTheme: "Giao diện", lightDark: "Sáng / Tối",
        panelAlpha: "Độ trong suốt Panel",
        support: "Dự án này miễn phí, nhưng mình sẽ rất biết ơn nếu bạn ủng hộ để duy trì phát triển ❤️",
        thanks: "❤️ Xem lời cảm ơn", langToggle: "VI"
    }
  };
  function t(key) { return (i18n[config.language] || i18n.vi)[key] || key; }

  async function loadConfig() {
    try {
      await Promise.all(CONFIG_KEYS.map(async k => { config[k] = await gmGet(k, config[k]); }));

      if (Array.isArray(config.overlays)) {
          config.overlays.forEach(ov => {
              if (ov.cachedColorData) delete ov.cachedColorData;
          });
      }

      if (!Array.isArray(config.ccFreeKeys) || config.ccFreeKeys.length === 0) config.ccFreeKeys = DEFAULT_FREE_KEYS.slice();
      if (!Array.isArray(config.ccPaidKeys)) config.ccPaidKeys = DEFAULT_PAID_KEYS.slice();
      if (!Number.isFinite(config.ccZoom) || config.ccZoom <= 0) config.ccZoom = 1.0;
      if (typeof config.ccRealtime !== 'boolean') config.ccRealtime = false;
        lastKnownAvailableColors = new Set(config.lastKnownColors);
    } catch (e) { console.error("Overlay Pro: Failed to load config", e); }
  }
  async function saveConfig(keys = CONFIG_KEYS) {
    try { await Promise.all(keys.map(k => gmSet(k, config[k]))); }
    catch (e) { console.error("Overlay Pro: Failed to save config", e); }
  }

function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      body.op-theme-light {
        --op-bg: #f0f0f5; --op-border: #dcdcec; --op-muted: #6b7280; --op-text: #111827;
        --op-subtle: #ffffff; --op-btn: #eef2f7; --op-btn-border: #d8dee8; --op-btn-hover: #e7ecf5;
        --op-accent: #8A2BE2;
        --op-active-bg: #8A2BE2;
        --op-active-text: #ffffff;
        --op-neon-green: #39FF14;
      }
      body.op-theme-dark {
        --op-bg: #12121c; --op-border: #2a2a4a; --op-muted: #a0a7b4; --op-text: #f5f6f9;
        --op-subtle: #1a1a2e; --op-btn: #2a2a4a; --op-btn-border: #38385a; --op-btn-hover: #3c3c6a;
        --op-accent: #A020F0;
        --op-active-bg: #8A2BE2;
        --op-active-text: #ffffff;
        --op-neon-green: #39FF14;
      }

      .op-scroll-lock { overflow: hidden !important; }

      #overlay-pro-panel, .op-modal {
        position: fixed; z-index: 9999;
        background: rgba(var(--op-bg-rgb), var(--op-panel-alpha, 0.85));
        backdrop-filter: blur(12px) saturate(150%);
        border: 1px solid var(--op-border);
        border-radius: 16px; color: var(--op-text); font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        font-size: 14px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.25), 0 0 0 1px rgba(138, 43, 226, 0.2);
        user-select: none;
      }
      #overlay-pro-panel { width: 340px; }

      .op-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--op-border); cursor: grab; touch-action: none; }
      .op-header:active { cursor: grabbing; }
      .op-header h3 { margin: 0; font-size: 15px; font-weight: 600; }
      #overlay-pro-panel.collapsed .op-header { border-bottom-color: transparent; }
      .op-header-actions { display: flex; gap: 6px; }

      .op-toggle-btn, .op-hdr-btn { background: transparent; border: 1px solid var(--op-border); color: var(--op-text); border-radius: 10px; padding: 4px 8px; cursor: pointer; transition: all 0.2s ease; }
      .op-toggle-btn:hover, .op-hdr-btn:hover { background: var(--op-btn); border-color: var(--op-accent); }

      .op-content { padding: 12px; display: flex; flex-direction: column; gap: 12px; }
      .op-global-controls { display: flex; flex-wrap: wrap; gap: 8px; }
      .op-global-controls > .op-button { flex: 1 1 calc(50% - 8px); text-align: center; justify-content: center; }

      .op-tabs { display: flex; border-bottom: 1px solid var(--op-border); }
      .op-tab-btn {
        flex: 1; padding: 8px 12px; background: transparent;
        border: none; border-bottom: 2px solid transparent;
        cursor: pointer; color: var(--op-muted); font-weight: 500;
        transition: color 0.2s, border-color 0.2s;
      }
      .op-tab-btn:hover { color: var(--op-accent); }
      .op-tab-btn.active { color: var(--op-text); border-bottom-color: var(--op-accent); }
      .op-tab-panes { padding: 12px 0 0 0; }
      .op-tab-pane { display: none; flex-direction: column; gap: 12px; }
      .op-tab-pane.active { display: flex; }

      .op-section {
        display: flex; flex-direction: column; gap: 8px;
        background: var(--op-subtle); border: 1px solid var(--op-border);
        border-radius: 12px; padding: 10px;
      }
      .op-row { display: flex; align-items: center; gap: 8px; }
      .op-row.space { justify-content: space-between; }
      .op-grow { flex: 1; }

      .op-button { background: var(--op-btn); color: var(--op-text); border: 1px solid var(--op-btn-border); border-radius: 10px; padding: 6px 10px; cursor: pointer; transition: all 0.2s ease; }
      .op-button:hover { background: var(--op-btn-hover); border-color: var(--op-accent); }
      .op-button:disabled { opacity: 0.5; cursor: not-allowed; }
      .op-button.icon { width: 30px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; }

      .op-input { background: var(--op-bg); border: 1px solid var(--op-border); color: var(--op-text); border-radius: 10px; padding: 8px; width: 100%; box-sizing: border-box; transition: all 0.2s ease; }

      .op-select {
        appearance: none; -webkit-appearance: none; -moz-appearance: none;
        background-color: var(--op-bg);
        border: 1px solid var(--op-border);
        color: var(--op-text);
        border-radius: 12px;
        padding: 8px 32px 8px 12px;
        width: 100%;
        cursor: pointer;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23888888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 8px center;
        background-size: 16px;
        transition: all 0.2s ease;
        font-size: 13px;
      }

      .op-input:focus, .op-select:focus { outline: none; border-color: var(--op-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--op-accent) 25%, transparent); }

      input[type="range"] { -webkit-appearance: none; appearance: none; width: 100%; background: transparent; cursor: pointer; }
      input[type="range"]:focus { outline: none; }
      input[type="range"]::-webkit-slider-runnable-track { height: 8px; background: linear-gradient(90deg, #ff7e5f, #8A2BE2); border-radius: 4px; }
      input[type="range"]::-moz-range-track { height: 8px; background: linear-gradient(90deg, #ff7e5f, #8A2BE2); border-radius: 4px; }
      input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; margin-top: -6px; height: 20px; width: 20px; background-color: #A020F0; border-radius: 50%; border: 2px solid var(--op-subtle); box-shadow: 0 0 5px #A020F0; }
      input[type="range"]::-moz-range-thumb { height: 20px; width: 20px; background-color: #A020F0; border-radius: 50%; border: 2px solid var(--op-subtle); box-shadow: 0 0 5px #A020F0; }

      .op-list { display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; border: 1px solid var(--op-border); padding: 6px; border-radius: 10px; background: var(--op-bg); }
      .op-item { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px; border-radius: 8px; border: 1px solid var(--op-border); background: var(--op-subtle); }
      .op-item.active { border-color: var(--op-accent); box-shadow: 0 0 0 1px var(--op-accent); background: var(--op-bg); }
      .op-item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }

      .op-muted { color: var(--op-muted); font-size: 12px; }

      .op-preview { width: 100%; height: 90px; background: var(--op-bg); display: flex; align-items: center; justify-content: center; border: 2px dashed var(--op-border); border-radius: 10px; overflow: hidden; position: relative; cursor: pointer; transition: all 0.2s ease; }
      .op-preview:hover, .op-preview.drop-highlight { border-color: var(--op-accent); background: color-mix(in srgb, var(--op-accent) 8%, transparent); }
      .op-preview img, .op-preview canvas { max-width: 100%; max-height: 100%; display: block; pointer-events: none; image-rendering: pixelated; }
      .op-preview .op-drop-hint { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 85%; text-align: center; font-size: 11px; color: var(--op-muted); pointer-events: none; }

      .op-icon-btn { background: var(--op-btn); color: var(--op-text); border: 1px solid var(--op-btn-border); border-radius: 10px; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease; }
      .op-icon-btn:hover { background: var(--op-btn-hover); border-color: var(--op-accent); }

      .op-danger { background: var(--op-active-bg) !important; border-color: var(--op-accent) !important; color: var(--op-active-text) !important; box-shadow: 0 0 8px var(--op-accent); }
      .op-danger-text { color: #dc2626; font-weight: 600; }

      .op-toast-stack { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; z-index: 999999; width: min(92vw, 480px); }
      .op-toast { background: var(--op-subtle); border: 1px solid var(--op-border); color: var(--op-text); padding: 10px 16px; border-radius: 12px; font-size: 14px; box-shadow: 0 6px 16px rgba(0,0,0,0.2); opacity: 0; transform: translateY(10px); transition: all .2s ease; max-width: 100%; text-align: center; }
      .op-toast.show { opacity: 1; transform: translateY(0); }

      .op-backdrop { position: fixed; inset: 0; z-index: 9998; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: none; opacity: 0; transition: opacity 0.2s ease; }
      .op-backdrop.show { display: block; opacity: 1; }
      .op-modal {
        opacity: 0; transform: translate(-50%, -45%); transition: opacity 0.2s ease, transform 0.2s ease; pointer-events: none;
      }
      .op-modal.show {
        opacity: 1; transform: translate(-50%, -50%); pointer-events: auto;
      }

      .op-cc-modal, .op-rs-modal, #op-main-settings-modal, #op-ca-settings-modal { width: min(1280px, 98vw); max-height: 92vh; left: 50%; top: 50%; display: flex; flex-direction: column; }
      #op-main-settings-modal { width: 300px; max-height: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
      .op-cc-header, .op-rs-header { padding: 10px 12px; border-bottom: 1px solid var(--op-border); display: flex; align-items: center; justify-content: space-between; }
      #op-ca-settings-modal { width: 280px; max-height: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
      .op-cc-title, .op-rs-title { font-weight: 600; }
      .op-cc-close, .op-rs-close { border: 1px solid var(--op-border); background: transparent; border-radius: 8px; padding: 4px 8px; cursor: pointer; }
      .op-cc-close:hover, .op-rs-close:hover { background: var(--op-btn); }
      .op-cc-pill { border-radius: 999px; padding: 4px 10px; border: 1px solid var(--op-border); background: var(--op-bg); }
      .op-cc-body { display: grid; grid-template-columns: 2fr 420px; grid-template-areas: "preview controls"; gap: 12px; padding: 12px; overflow: hidden; }
      @media (max-width: 860px) { .op-cc-body { grid-template-columns: 1fr; grid-template-areas: "preview" "controls"; max-height: calc(92vh - 100px); overflow: auto; } }
      .op-cc-preview-wrap { grid-area: preview; background: var(--op-bg); border: 1px solid var(--op-border); border-radius: 12px; position: relative; min-height: 320px; display: flex; align-items: center; justify-content: center; overflow: auto; }
      .op-cc-canvas { image-rendering: pixelated; }
      .op-cc-zoom { position: absolute; top: 8px; right: 8px; display: inline-flex; gap: 6px; }
      .op-cc-zoom .op-icon-btn { width: 34px; height: 34px; }
      .op-cc-controls { grid-area: controls; display: flex; flex-direction: column; gap: 12px; background: var(--op-subtle); border: 1px solid var(--op-border); border-radius: 12px; padding: 10px; overflow: auto; max-height: calc(92vh - 160px); }
      .op-cc-palette { display: flex; flex-direction: column; gap: 8px; background: var(--op-bg); border: 1px dashed var(--op-border); border-radius: 10px; padding: 8px; }
      .op-cc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(22px, 22px)); gap: 6px; }
      .op-cc-cell { width: 22px; height: 22px; border-radius: 4px; border: 2px solid color-mix(in srgb, var(--op-border) 50%, transparent); box-shadow: 0 0 0 1px rgba(0,0,0,0.15) inset; cursor: pointer; transition: all 0.2s ease; }
      .op-cc-cell.active { outline: 2px solid var(--op-accent); border-color: var(--op-accent); }
      .op-cc-footer, .op-rs-footer { padding: 10px 12px; border-top: 1px solid var(--op-border); display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
      .op-cc-actions { display: inline-flex; gap: 8px; }
      .op-cc-ghost { color: var(--op-muted); font-size: 12px; }
      .op-rs-modal { width: min(1200px, 96vw); max-height: 92vh; }
      .op-rs-header { padding: 10px 12px; border-bottom: 1px solid var(--op-border); display: flex; align-items: center; justify-content: space-between; }
      .op-rs-title { font-weight: 600; }
      .op-rs-tabs { display: flex; gap: 6px; padding: 8px 12px 0 12px; }
      .op-rs-tab-btn { background: var(--op-btn); color: var(--op-text); border: 1px solid var(--op-btn-border); border-radius: 10px; padding: 6px 10px; cursor: pointer; }
      .op-rs-tab-btn.active { outline: 2px solid var(--op-accent); background: var(--op-btn-hover); }
      .op-rs-body { padding: 12px; display: grid; grid-template-columns: 1fr; gap: 10px; overflow: auto; }
      .op-rs-pane { display: none; }
      .op-rs-pane.show { display: block; }
      .op-rs-preview-wrap { background: var(--op-subtle); border: 1px solid var(--op-border); border-radius: 12px; position: relative; height: clamp(260px, 36vh, 540px); display: flex; align-items: center; justify-content: center; overflow: hidden; }
      .op-rs-canvas { image-rendering: pixelated; }
      .op-rs-zoom { position: absolute; top: 8px; right: 8px; display: inline-flex; gap: 6px; }
      .op-rs-grid-note { color: var(--op-muted); font-size: 12px; }
      .op-rs-mini { width: 96px; }
      .op-rs-dual { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; height: 100%; padding: 8px; box-sizing: border-box; }
      .op-rs-col { position: relative; background: var(--op-bg); border: 1px dashed var(--op-border); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; overflow: hidden; }
      .op-rs-col .label { position: absolute; top: 2px; left: 0; right: 0; text-align: center; font-size: 12px; color: var(--op-muted); pointer-events: none; }
      .op-rs-col .pad-top { height: 18px; width: 100%; flex: 0 0 auto; }
      .op-rs-thumb { width: 100%; height: calc(100% - 18px); display: block; }
      .op-pan-grab { cursor: grab; }
      .op-pan-grabbing { cursor: grabbing; }

      .op-settings-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      #op-color-analysis-panel {
        position: fixed; z-index: 9998; width: 280px; max-height: 75vh;
        background: rgba(var(--op-bg-rgb), 0.9); backdrop-filter: blur(12px) saturate(150%);
        border: 1px solid var(--op-border); border-radius: 14px; color: var(--op-text);
        font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        font-size: 13px; box-shadow: 0 10px 25px rgba(0,0,0,0.15), 0 0 0 1px rgba(138, 43, 226, 0.2);
        display: flex; flex-direction: column; transition: opacity 0.2s ease, transform 0.2s ease, max-height 0.3s ease;
        transform: scale(0.95); opacity: 0; pointer-events: none; user-select: none;
      }
      #op-color-analysis-panel.filters-open {
          max-height: 95vh;
      }
      #op-color-analysis-panel.show { transform: scale(1); opacity: 1; pointer-events: auto; }
      .op-ca-header {
        padding: 8px 10px; font-weight: 600;
        border-bottom: 1px solid var(--op-border); flex-shrink: 0;
        display: flex; justify-content: space-between; align-items: center; cursor: grab;
        touch-action: none;
      }
      .op-ca-header:active { cursor: grabbing; }

      #op-color-analysis-panel.collapsed .op-ca-header { border-bottom-color: transparent; }
      .op-ca-settings-wrap { position: relative; display: flex; gap: 4px; }
      .op-ca-settings-btn {
        background: transparent; border: none; font-size: 16px; cursor: pointer;
        padding: 5px; border-radius: 8px; line-height: 1; opacity: 0.7;
        transition: all 0.2s;
      }
      .op-ca-settings-btn:hover { opacity: 1; background: var(--op-btn-hover); }
      .op-ca-settings-btn.active { background: var(--op-accent) !important; color: white !important; opacity: 1; }
      .op-ca-settings-popup {
        position: absolute; top: calc(100% + 8px); right: 0; transform-origin: top right;
        width: 200px; background: var(--op-bg); border: 1px solid var(--op-border);
        padding: 12px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.15);
        display: none; flex-direction: column; gap: 8px; z-index: 10;
      }
      .op-ca-settings-popup.show { display: flex; }
      .op-ca-settings-popup label { font-size: 13px; font-weight: 500; }
      .op-ca-settings-popup input[type="range"] { margin-top: 4px; }

      .op-ca-list {
        padding: 8px; overflow-y: auto; display: flex; flex-direction: column;
        gap: 6px; flex-grow: 1; flex-shrink: 1; min-height: 0;
        transition: all 0.3s ease-in-out;
      }
      .op-ca-item {
        display: grid; grid-template-columns: auto auto 1fr auto; align-items: center;
        gap: 8px; padding: 5px 8px;
        background: color-mix(in srgb, var(--op-btn) 50%, transparent); border-radius: 8px;
        border-left: 3px solid transparent; transition: all 0.2s ease;
      }
      body.ca-hide-names .op-ca-name {
          display: none;
      }
      .op-ca-swatch { width: 18px; height: 18px; border-radius: 5px; border: 1px solid var(--op-border); flex-shrink: 0; }
      .op-ca-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;}
      .op-ca-count { font-weight: 500; font-size: 12px; background: var(--op-subtle); padding: 3px 8px; border-radius: 6px; text-align: right; transition: all 0.2s ease; }
      .op-ca-count.completed { color: var(--op-neon-green); background: color-mix(in srgb, var(--op-neon-green) 15%, transparent); }

      .op-ca-footer {
        border-top: 1px solid var(--op-border); padding: 10px 12px; flex-shrink: 0;
        display: flex; flex-direction: column; gap: 8px;
      }
      .op-ca-total-progress { display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 14px; }
      .op-ca-main-actions { display: flex; gap: 8px; width: 100%; }
      .op-ca-main-actions .op-button { flex: 1; }
      .op-ca-filters-pane {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease-in-out, padding 0.3s ease-in-out, margin 0.3s ease-in-out;
          padding: 0 4px; margin: 0;
          border-top: 1px solid transparent;
          display: flex; flex-direction: column; gap: 10px;
          flex-shrink: 0;
      }
      .op-ca-filters-pane.show {
          max-height: 500px;
          margin-top: 10px;
          padding-top: 10px;
          border-top-color: var(--op-border);
      }
      .op-ca-filter-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .op-ca-controls { display: flex; flex-direction: column; gap: 8px; }
      .op-ca-control-row { display: flex; justify-content: space-between; align-items: center; }
      .op-ca-control-row label { font-size: 13px; font-weight: 500; }
      .op-switch {
        position: relative; display: inline-block; width: 40px; height: 22px;
        background-color: var(--op-btn); border: 1px solid var(--op-border);
        border-radius: 22px; cursor: pointer; transition: all 0.3s ease;
      }
      .op-switch::before {
        content: ''; position: absolute; width: 16px; height: 16px;
        border-radius: 50%; top: 2px; left: 2px;
        background-color: var(--op-muted); transition: all 0.3s ease;
      }
      .op-switch.active { background-color: var(--op-accent); box-shadow: 0 0 8px var(--op-accent); }
      .op-switch.active::before { transform: translateX(18px); background-color: white; }
      .op-ca-item.available {
        background: linear-gradient(90deg, color-mix(in srgb, var(--op-accent) 25%, transparent) 0%, transparent 100%);
        border-color: var(--op-accent);
        box-shadow: 0 0 8px color-mix(in srgb, var(--op-accent) 50%, transparent);
      }
      .op-donation-section {
        margin-top: 15px;
        padding-top: 10px;
        border-top: 1px solid var(--op-border);
        text-align: center;
        font-size: 12px;
        color: var(--op-muted);
      }
      .op-donation-section p {
        margin: 0 0 8px 0;
      }
      .op-donation-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 8px;
        background: var(--op-subtle);
        border-radius: 6px;
        margin-top: 4px;
      }
      .op-donation-info code {
        font-family: monospace;
        font-weight: bold;
        color: var(--op-text);
        user-select: all;
        background: var(--op-bg);
        padding: 2px 6px;
        border-radius: 4px;
      }
      .op-show-donators {
        width: 100%;
        margin-top: 10px;
      }
      .op-donators-list-wrap {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease-in-out;
      }
      .op-donators-list-wrap.show {
        max-height: 150px;
      }
      .op-donators-list {
        list-style: none;
        padding: 8px 0 0 0;
        margin: 0;
        max-height: 140px;
        overflow-y: auto;
        border-top: 1px solid var(--op-border);
        margin-top: 8px;
      }
      .op-donator-item, .op-donator-item-empty {
        display: flex;
        justify-content: space-between;
        padding: 5px 8px;
        border-radius: 4px;
      }
      .op-donator-item:nth-child(odd) {
        background: var(--op-subtle);
      }
      .op-donator-item-empty {
        justify-content: center;
        font-style: italic;
      }
      .op-donator-contribution {
        font-weight: bold;
        color: var(--op-accent);
      }
      @media (max-width: 480px) {
       #op-color-analysis-panel {
       width: 90vw;
       max-width: 280px;
       left: auto;
       right: 5vw;
      }
     }
     .op-custom-select { position: relative; width: 100%; font-size: 13px; }
      .op-select-trigger {
        background: var(--op-bg); border: 1px solid var(--op-border);
        color: var(--op-text); border-radius: 12px; padding: 8px 12px;
        cursor: pointer; display: flex; justify-content: space-between; align-items: center;
        transition: all 0.2s ease;
      }
      .op-select-trigger:hover { border-color: var(--op-accent); background: var(--op-subtle); }
      .op-select-trigger::after { content: '▼'; font-size: 10px; opacity: 0.7; transition: transform 0.2s; }
      .op-custom-select.open .op-select-trigger::after { transform: rotate(180deg); }
      .op-select-options {
        position: absolute; top: calc(100% + 6px); left: 0; right: 0;
        background: rgba(var(--op-bg-rgb), 0.95); backdrop-filter: blur(12px);
        border: 1px solid var(--op-border); border-radius: 12px;
        padding: 6px; z-index: 1000; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        opacity: 0; transform: translateY(-10px); pointer-events: none;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex; flex-direction: column; gap: 4px;
      }
      .op-custom-select.open .op-select-options { opacity: 1; transform: translateY(0); pointer-events: auto; }
      .op-option {
        padding: 8px 10px; border-radius: 8px; cursor: pointer;
        transition: background 0.2s; display: flex; align-items: center; gap: 8px;
      }
      .op-option:hover { background: var(--op-btn-hover); color: var(--op-accent); }
      .op-option.selected { background: color-mix(in srgb, var(--op-accent) 15%, transparent); color: var(--op-accent); font-weight: 500; }
      #overlay-pro-panel, .op-modal {
          background: rgba(18, 18, 28, var(--op-panel-alpha, 0.85)) !important;
      }
      #overlay-pro-panel, .op-modal, #op-color-analysis-panel {
          box-shadow: 0 10px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(138, 43, 226, 0.5) !important;
          text-shadow: 0px 1px 3px rgba(0,0,0,0.9);
          color: #e0e0e0 !important;
      }
      .op-header { text-shadow: 0px 2px 5px rgba(0,0,0,1); }
      .op-section, .op-preview, .op-input, .op-select, .op-item, .op-ca-item {
          background: rgba(0, 0, 0, 0.45) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
          color: #e0e0e0 !important;
      }
      .op-button {
          background: rgba(31, 40, 51, 0.7) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
          color: #e0e0e0 !important;
      }
      .op-button:hover {
          background: rgba(138, 43, 226, 0.6) !important;
          border-color: rgba(138, 43, 226, 1) !important;
      }
      .op-button.op-danger {
          background: rgba(138, 43, 226, 0.8) !important;
          color: #ffffff !important;
          text-shadow: none;
      }
      .op-muted { color: #a0a7b4 !important; }
`;
    document.head.appendChild(style);
}

  function createUI() {
    if (document.getElementById('overlay-pro-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'overlay-pro-panel';

    const panelW = 340;
    const defaultLeft = Math.max(12, window.innerWidth - panelW - 80);
    panel.style.left = (Number.isFinite(config.panelX) ? config.panelX : defaultLeft) + 'px';
    panel.style.top = (Number.isFinite(config.panelY) ? config.panelY : 120) + 'px';

panel.innerHTML = `
  <div class="op-header" id="op-header">
    <div style="display:flex; flex-direction:column; line-height:1.2;">
      <h3 style="margin:0;">${t('title')}<span style="font-size: 13px; color: var(--op-muted); font-weight: 500; margin-left: 8px;">-_-/</span></h3>
      <span style="font-size: 10px; color: var(--op-muted);">Vietsub by CheemsGalaxy</span>
    </div>
    <div class="op-header-actions">
        <button class="op-hdr-btn" id="op-main-settings-btn" title="${t('settings')}">⚙️</button>
        <button class="op-toggle-btn" id="op-panel-toggle" title="${t('toggle')}">▾</button>
    </div>
  </div>
      <div class="op-content" id="op-content">
        <div class="op-global-controls">
            <button class="op-button" id="op-show-overlay-toggle">${t('overlayBtn')}: BẬT</button>
            <button class="op-button" id="op-mode-toggle">${t('modeBtn')}: Thu nhỏ</button>
            <button class="op-button" id="op-show-errors-toggle">${t('errorsBtn')}: OFF</button>
            <button class="op-button" id="op-autocap-toggle">${t('posBtn')}: OFF</button>
        </div>

        <div class="op-tabs">
            <button class="op-tab-btn active" data-tab="overlays">${t('tabOverlays')}</button>
            <button class="op-tab-btn" data-tab="editor">${t('tabEditor')}</button>
            <button class="op-tab-btn" data-tab="tools">${t('tabTools')}</button>
        </div>

        <div class="op-tab-panes op-section" style="padding-top: 12px; border-top-left-radius: 0;">
            <div class="op-tab-pane active" data-pane="overlays">
                <div class="op-row space">
                    <button class="op-button" id="op-add-overlay">${t('add')}</button>
                    <button class="op-button" id="op-import-overlay">${t('import')}</button>
                    <button class="op-button" id="op-export-overlay">${t('export')}</button>
                </div>
                <div class="op-list" id="op-overlay-list"></div>
                            <div id="op-list-preview-area" style="display: none; margin-top: 8px;">
                <div id="op-list-preview-content" class="op-preview" style="height: 140px; cursor: default;">
                    <img id="op-list-preview-img" alt="Preview">
                </div>
            </div>
            </div>

            <div class="op-tab-pane" data-pane="editor">
                <div id="op-editor-placeholder" class="op-muted" style="text-align:center; padding: 20px;">
                    ${t('editorPlaceholder')}
                </div>
                <div id="op-editor-content" style="display:none; flex-direction:column; gap: 12px;">
                    <div>
                        <div class="op-row">
                            <label style="width: 60px;">${t('name')}</label>
                            <input type="text" class="op-input op-grow" id="op-name">
                        </div>
                    </div>
                    <div>
                        <div class="op-row">
                            <label style="width: 60px;">${t('mode')}</label>
                            <div class="op-custom-select" id="op-mode-dropdown">
                                <input type="hidden" id="op-color-mode" value="standard">
                                <div class="op-select-trigger" id="op-mode-trigger">
                                    <span id="op-mode-text">${t('modeStd')}</span>
                                </div>
                                <div class="op-select-options">
                                    <div class="op-option selected" data-value="standard">
                                        <span>•</span> ${t('modeStd')}
                                    </div>
                                    <div class="op-option" data-value="enhanced">
                                        <span>•</span> ${t('modeEnh')}
                                    </div>
                                    <div class="op-option" data-value="photorealistic">
                                        <span>•</span> ${t('modePho')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div id="op-image-source">
                            <div class="op-row">
                                <label style="width: 60px;">${t('image')}</label>
                                <input type="text" class="op-input op-grow" id="op-image-url" placeholder="URL">
                                <button class="op-button" id="op-fetch">${t('load')}</button>
                            </div>
                            <div class="op-preview" id="op-dropzone" style="margin-top:8px;">
                                <div class="op-drop-hint">${t('dropzone')}</div>
                                <input type="file" id="op-file-input" accept="image/*" style="display:none">
                            </div>
                        </div>
                        <div class="op-preview" id="op-preview-wrap" style="display:none;">
                            <img id="op-image-preview" alt="No image">
                        </div>
                        <div class="op-row" id="op-cc-btn-row" style="display:none; justify-content:space-around; gap:8px; flex-wrap:wrap; margin-top:8px;">
                            <button class="op-button" id="op-download-overlay" title="Tải ảnh xuống">Save 💾</button>
                            <button class="op-button" id="op-open-resize" title="Đổi kích thước">Đổi kích thước</button>
                            <button class="op-button" id="op-open-cc" title="Công cụ màu">Color Tools</button>
                        </div>
                    </div>
                    <div>
                      <div class="op-row"><span class="op-muted" id="op-coord-display"></span></div>
                      <div class="op-row" style="width: 100%; gap: 12px; padding: 6px 0;">
                        <label style="width: 60px;">${t('opacity')}</label>
                        <input type="range" min="0" max="1" step="0.05" class="op-slider op-grow" id="op-opacity-slider">
                        <span id="op-opacity-value" style="width: 36px; text-align: right;">100%</span>
                      </div>
                    </div>
                    <div>
                        <div class="op-row space">
                         <span class="op-muted" id="op-offset-indicator">${t('offsetX')} 0, ${t('offsetY')} 0</span>
                          <div class="op-nudge-controls" style="text-align: right;">
                            <button class="op-icon-btn" id="op-nudge-left" title="Trái">←</button>
                            <button class="op-icon-btn" id="op-nudge-down" title="Xuống">↓</button>
                            <button class="op-icon-btn" id="op-nudge-up" title="Lên">↑</button>
                           <button class="op-icon-btn" id="op-nudge-right" title="Phải">→</button>
                        </div>
                      </div>
                    </div>
                </div>
            </div>

            <div class="op-tab-pane" data-pane="tools">
                <div>
                    <span style="font-weight:600; text-align:center; margin-bottom: 8px; display:block;">${t('copyCanvas')}</span>
                    <div class="op-row space" style="margin-bottom: 10px;">
                        <button class="op-button" id="op-copy-set-a">${t('setPointA')}</button>
                        <span class="op-muted" id="op-copy-a-coords">---</span>
                    </div>
                    <div class="op-row space">
                        <button class="op-button" id="op-copy-set-b">${t('setPointB')}</button>
                        <span class="op-muted" id="op-copy-b-coords">---</span>
                    </div>
                    <div class="op-row space" style="margin-top: 8px;">
                        <span id="op-copy-info" class="op-muted" style="text-align:center; width:100%;"></span>
                    </div>
                     <div class="op-section" style="margin-top: 8px;">
                         <div class="op-row space">
                             <span>${t('fineTune')}</span>
                             <div class="op-row">
                                <input type="radio" id="op-nudge-target-a" name="op-nudge-target" value="A" checked>
                                <label for="op-nudge-target-a">${t('pointA')}</label>
                                <input type="radio" id="op-nudge-target-b" name="op-nudge-target" value="B">
                                <label for="op-nudge-target-b">${t('pointB')}</label>
                             </div>
                         </div>
                         <div class="op-nudge-controls" style="text-align: right; margin-top:4px;">
                            <button class="op-icon-btn" id="op-nudge-copy-left" title="Trái">←</button>
                            <button class="op-icon-btn" id="op-nudge-copy-down" title="Xuống">↓</button>
                            <button class="op-icon-btn" id="op-nudge-copy-up" title="Lên">↑</button>
                            <button class="op-icon-btn" id="op-nudge-copy-right" title="Phải">→</button>
                         </div>
                    </div>
                    <div class="op-row space" style="margin-top: 8px;">
                        <button class="op-button" id="op-copy-preview-toggle" style="flex:1;">${t('previewArea')}</button>
                        <button class="op-button" id="op-copy-create" style="flex:1;">${t('download')}</button>
                    </div>
                </div>

                <div id="op-color-analysis-section" class="op-section" style="margin-top: 12px; padding: 12px; align-items: center;">
                    <button class="op-button" id="op-analyze-colors-btn" style="width: 100%;">${t('showProgress')}</button>
                </div>

            </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    const settingsModal = document.createElement('div');
    settingsModal.id = 'op-main-settings-modal';
    settingsModal.className = 'op-modal';
    settingsModal.innerHTML = `
        <h3>${t('genSettings')}</h3>
        <div class="op-settings-row">
            <span>${t('uiTheme')}</span>
            <button class="op-button" id="op-theme-toggle">${t('lightDark')}</button>
        </div>
        <div class="op-settings-row">
            <label>${t('panelAlpha')}</label>
        </div>
        <input type="range" id="op-panel-alpha-slider" min="0.4" max="1" step="0.05">
        <div class="op-donation-section">
            <p>${t('support')}</p>
            <div class="op-donation-info">
                <span>Binance ID:</span>
                <code>851390091</code>
            </div>
            <div class="op-donation-info">
                <span>PayPal:</span>
                <code>@srcratier</code>
            </div>
        </div>
         <button class="op-button op-show-donators">${t('thanks')}</button>
         <div class="op-donators-list-wrap"></div>
         <p style="text-align:center; font-size:11px; color:var(--op-muted); margin: 4px 0 0;">Vietsub by CheemsGalaxy<br><a href="https://github.com/CheemsGalaxy" target="_blank" rel="noopener noreferrer" style="color:var(--op-muted);">github.com/CheemsGalaxy</a></p>
    `;
    document.body.appendChild(settingsModal);

    const backdrop = document.createElement('div');
    backdrop.id = 'op-main-settings-backdrop';
    backdrop.className = 'op-backdrop';
    document.body.appendChild(backdrop);

    const colorAnalysisPanel = document.createElement('div');
        colorAnalysisPanel.id = 'op-color-analysis-panel';
    colorAnalysisPanel.innerHTML = `
    <div class="op-ca-header" id="op-ca-header-drag">
        <span>Tiến độ màu</span>
        <div class="op-ca-settings-wrap">
            <button class="op-ca-settings-btn" id="op-ca-settings-btn" title="Cài đặt tiến độ">⚙️</button>
            <button class="op-ca-settings-btn" id="op-ca-toggle-collapse" title="Thu gọn/Mở rộng" style="margin-left: 5px;">▾</button>
        </div>
    </div>
    <div class="op-ca-list" id="op-ca-list-content">
        <span class="op-muted" style="text-align: center; padding: 20px 0;">Chọn một overlay rồi bấm "Hiện tiến độ Overlay".</span>
    </div>
    <div class="op-ca-footer" id="op-ca-footer">
        <div class="op-ca-total-progress">
            <span>Tổng tiến độ:</span>
            <span id="op-ca-total-percentage">0%</span>
        </div>
        <div class="op-ca-main-actions">
            <button class="op-button" id="op-ca-apply-filter">Áp dụng</button>
            <button class="op-button" id="op-ca-toggle-filters">⚙️ Bộ lọc</button>
        </div>
    </div>
    <div class="op-ca-filters-pane" id="op-ca-filters-pane">
        <div class="op-ca-filter-actions">
            <button class="op-button" id="op-ca-mark-available">Đang có</button>
            <button class="op-button" id="op-ca-mark-all">Chọn tất cả</button>
            <button class="op-button" id="op-ca-mark-none">Bỏ chọn</button>
            <button class="op-button" id="op-ca-show-all">Khôi phục</button>
        </div>
        <div class="op-ca-controls">
            <div class="op-ca-control-row">
                <label>Hiện tên màu</label>
                <div class="op-switch" id="op-ca-show-names-toggle"></div>
            </div>
            <div class="op-ca-control-row">
                <label>Hiện tiến độ</label>
                <div class="op-switch" id="op-ca-show-progress-toggle"></div>
            </div>
            <div class="op-ca-control-row">
                <label>Chỉ hiện màu còn thiếu</label>
                <div class="op-switch" id="op-ca-show-remaining-toggle"></div>
            </div>
        </div>
    </div>
`;
    document.body.appendChild(colorAnalysisPanel);

    const caSettingsModal = document.createElement('div');
    caSettingsModal.id = 'op-ca-settings-modal';
    caSettingsModal.className = 'op-modal';
    caSettingsModal.innerHTML = `
        <h3>Cài đặt tiến độ</h3>
        <div class="op-ca-controls" style="display: flex; flex-direction: column; gap: 12px;">
            <div class="op-ca-control-row">
                <label>Sắp xếp theo số lượng</label>
                <div class="op-switch" id="op-ca-sort-toggle"></div>
            </div>

        </div>
        <hr style="border-color: var(--op-border); margin: 12px 0;">
        <label>Độ trong suốt Panel</label>
        <input type="range" id="op-ca-alpha-slider" min="0.2" max="1" step="0.05">
    `;
    document.body.appendChild(caSettingsModal);

    const caBackdrop = document.createElement('div');
    caBackdrop.id = 'op-ca-settings-backdrop';
    caBackdrop.className = 'op-backdrop';
    document.body.appendChild(caBackdrop);

    buildCCModal();
    buildRSModal();
    addEventListeners();
    enableDrag(panel, '#op-header', 'panelX', 'panelY');
    enableDrag(colorAnalysisPanel, '#op-ca-header-drag', 'colorPanelX', 'colorPanelY');
    updateUI();
  }

  function getActiveOverlay() { return config.overlays.find(o => o.id === config.activeOverlayId) || null; }

function rebuildOverlayListUI() {
  const list = document.getElementById('op-overlay-list');
  if (!list) return;

  list.innerHTML = '';

  for (const ov of config.overlays) {
    const item = document.createElement('div');
    const isActive = ov.id === config.activeOverlayId;
    item.className = 'op-item' + (isActive ? ' active' : '');
    const localTag = ov.isLocal ? ' (cục bộ)' : (!ov.imageBase64 ? ' (chưa có ảnh)' : '');
    const title = (ov.name || '(chưa đặt tên)') + localTag;

    item.innerHTML = `
      <div class="op-row" style="width:100%;">
        <input type="radio" name="op-active" ${isActive ? 'checked' : ''} title="Đặt làm overlay đang chọn"/>
        <input type="checkbox" ${ov.enabled ? 'checked' : ''} title="Bật/Tắt"/>
        <div class="op-item-name" title="${title}">${title}</div>
        <button class="op-icon-btn op-trash-btn" title="Xóa overlay">🗑️</button>
      </div>
    `;

    const radio = item.querySelector('input[type="radio"]');
    const checkbox = item.querySelector('input[type="checkbox"]');
    const nameDiv = item.querySelector('.op-item-name');
    const trashBtn = item.querySelector('.op-trash-btn');

    const selectThisOverlay = async () => {
        if (config.activeOverlayId !== ov.id) {
            config.activeOverlayId = ov.id;
            await saveConfig(['activeOverlayId']);
            updateUI();
            if (config.isColorPanelVisible) {
                await updateOverlayProgress();
            }
        }
    };

    nameDiv.addEventListener('click', selectThisOverlay);
    radio.addEventListener('change', selectThisOverlay);

    checkbox.addEventListener('change', () => { ov.enabled = checkbox.checked; saveConfig(['overlays']); clearOverlayCache(); ensureHook(); });

    trashBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Xóa overlay "${ov.name || '(chưa đặt tên)'}"?`)) return;
      const idx = config.overlays.findIndex(o => o.id === ov.id);
      if (idx >= 0) {
        config.overlays.splice(idx, 1);
        if (config.activeOverlayId === ov.id) {
            config.activeOverlayId = config.overlays[0]?.id || null;
            if (config.isColorPanelVisible) {
                await updateOverlayProgress();
            }
        }
        await saveConfig(['overlays', 'activeOverlayId']);
        clearOverlayCache(); ensureHook(); updateUI();
      }
    });

    list.appendChild(item);
  }
}
  async function addBlankOverlay() {
    const name = uniqueName('Overlay');
    const ov = { id: uid(), name, enabled: true, imageUrl: null, imageBase64: null, isLocal: false, pixelUrl: null, offsetX: 0, offsetY: 0, opacity: 1.0, colorMode: 'standard' };
    config.overlays.push(ov);
    config.activeOverlayId = ov.id;
    await saveConfig(['overlays', 'activeOverlayId']);
    clearOverlayCache(); ensureHook(); updateUI();
    return ov;
  }

async function processImageToPalette(base64, mode = 'standard') {
    const img = await loadImage(base64);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const palette = [...WPLACE_FREE, ...WPLACE_PAID];

    return new Promise((resolve, reject) => {
        const workerCode = `
            self.onmessage = function(e) {
                const { imgBuffer, width, height, mode, palette } = e.data;
                const data = new Uint8ClampedArray(imgBuffer);

                const getNearestColor = (r, g, b) => {
                    let minInfo = Infinity;
                    let bestColor = palette[0];
                    for (let i = 0; i < palette.length; i++) {
                        const p = palette[i];
                        const pr = p[0], pg = p[1], pb = p[2];
                        const rmean = (r + pr) * 0.5;
                        const dr = r - pr;
                        const dg = g - pg;
                        const db = b - pb;
                        const dist = (((512 + rmean) * dr * dr) >> 8) + (4 * dg * dg) + (((767 - rmean) * db * db) >> 8);
                        if (dist < minInfo) {
                            minInfo = dist;
                            bestColor = p;
                        }
                    }
                    return bestColor;
                };

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                    if (a < 128) {
                        data[i + 3] = 0;
                        continue;
                    }

                    const best = getNearestColor(r, g, b);

                    if (mode === 'enhanced') {
                        data[i] = best[0]; data[i + 1] = best[1]; data[i + 2] = best[2]; data[i + 3] = 255;
                        continue;
                    }

                    const oldR = r, oldG = g, oldB = b;
                    const newR = best[0], newG = best[1], newB = best[2];

                    data[i] = newR; data[i + 1] = newG; data[i + 2] = newB; data[i + 3] = 255;

                    const errR = oldR - newR, errG = oldG - newG, errB = oldB - newB;
                    const x = (i / 4) % width;
                    const y = Math.floor((i / 4) / width);

                    const distributeError = (dx, dy, factor) => {
                        if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height) {
                            const nIdx = ((y + dy) * width + (x + dx)) * 4;
                            if (data[nIdx + 3] >= 128) {
                                data[nIdx] += errR * factor;
                                data[nIdx + 1] += errG * factor;
                                data[nIdx + 2] += errB * factor;
                            }
                        }
                    };

                    if (mode === 'photorealistic') {
                        distributeError(1, 0, 7 / 16); distributeError(-1, 1, 3 / 16); distributeError(0, 1, 5 / 16); distributeError(1, 1, 1 / 16);
                    } else {
                        distributeError(1, 0, 1 / 8); distributeError(2, 0, 1 / 8); distributeError(-1, 1, 1 / 8); distributeError(0, 1, 1 / 8); distributeError(1, 1, 1 / 8); distributeError(0, 2, 1 / 8);
                    }
                }

                self.postMessage({ resultBuffer: data.buffer }, [data.buffer]);
            };
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));

        worker.onmessage = function(e) {
            const processedData = new Uint8ClampedArray(e.data.resultBuffer);
            const newImageData = new ImageData(processedData, canvas.width, canvas.height);
            ctx.putImageData(newImageData, 0, 0);
            worker.terminate();
            resolve(canvas.toDataURL('image/png'));
        };

        worker.onerror = function(err) {
            console.error("Error en el Web Worker:", err);
            worker.terminate();
            reject(err);
        };

        worker.postMessage({
            imgBuffer: imageData.data.buffer,
            width: canvas.width,
            height: canvas.height,
            mode: mode,
            palette: palette
        }, [imageData.data.buffer]);
    });
}

  async function setOverlayImageFromURL(ov, url) {
    const mode = document.getElementById('op-color-mode').value;
    showToast(`Đang xử lý (${mode === 'euclidean' ? 'Toán học' : 'Tự nhiên'})...`);

    const rawBase64 = await urlToDataURL(url);
    const processedBase64 = await processImageToPalette(rawBase64, mode);

    ov.imageUrl = url;
    ov.imageBase64 = processedBase64;
    ov.isLocal = false;

    ov.filterActive = false;
    ov.savedFilters = [];

    await saveConfig(['overlays']); clearOverlayCache();
    config.autoCapturePixelUrl = true; await saveConfig(['autoCapturePixelUrl']);
    ensureHook(); updateUI();

    document.getElementById('op-color-mode').value = 'standard';

    showToast(`Đã xử lý và tải ảnh xong. Bấm vào bản đồ để đặt mốc neo.`);
  }

async function setOverlayImageFromFile(ov, file) {
    if (!file || !file.type || !file.type.startsWith('image/')) { alert('Vui lòng chọn một tệp ảnh.'); return; }
    if (!confirm('Ảnh PNG cục bộ không thể xuất/chia sẻ! Bạn có chắc chắn không?')) return;

    const mode = document.getElementById('op-color-mode').value;
    showToast(`Đang xử lý ảnh cục bộ (${mode === 'euclidean' ? 'Toán học' : 'Tự nhiên'})...`);

    const rawBase64 = await fileToDataURL(file);
    const processedBase64 = await processImageToPalette(rawBase64, mode);

    ov.imageBase64 = processedBase64;
    ov.imageUrl = null;
    ov.isLocal = true;

    ov.filterActive = false;
    ov.savedFilters = [];

    await saveConfig(['overlays']); clearOverlayCache();
    config.autoCapturePixelUrl = true; await saveConfig(['autoCapturePixelUrl']);
    ensureHook(); updateUI();

    document.getElementById('op-color-mode').value = 'standard';

    showToast(`Đã xử lý ảnh cục bộ xong. Bấm vào bản đồ để đặt mốc neo.`);
  }

  async function importOverlayFromJSON(jsonText) {
    let obj; try { obj = JSON.parse(jsonText); } catch { alert('JSON không hợp lệ'); return; }
    const arr = Array.isArray(obj) ? obj : [obj];
    let imported = 0, failed = 0;
    for (const item of arr) {
      const name = uniqueName(item.name || 'Overlay Importado');
      const imageUrl = item.imageUrl;
      const pixelUrl = item.pixelUrl ?? null;
      const offsetX = Number.isFinite(item.offsetX) ? item.offsetX : 0;
      const offsetY = Number.isFinite(item.offsetY) ? item.offsetY : 0;
      const opacity = Number.isFinite(item.opacity) ? item.opacity : 1.0;
      if (!imageUrl) { failed++; continue; }
      try {
        const base64 = await urlToDataURL(imageUrl);
        const ov = { id: uid(), name, enabled: true, imageUrl, imageBase64: base64, isLocal: false, pixelUrl, offsetX, offsetY, opacity };
        config.overlays.push(ov); imported++;
      } catch (e) { console.error('Nhập thất bại cho', imageUrl, e); failed++; }
    }
    if (imported > 0) {
      config.activeOverlayId = config.overlays[config.overlays.length - 1].id;
      await saveConfig(['overlays', 'activeOverlayId']); clearOverlayCache(); ensureHook(); updateUI();
    }
    alert(`Nhập hoàn tất. Đã nhập: ${imported}${failed ? `, Thất bại: ${failed}` : ''}`);
  }

  function exportActiveOverlayToClipboard() {
    const ov = getActiveOverlay();
    if (!ov) { alert('Chưa có overlay nào đang được chọn.'); return; }
    if (ov.isLocal || !ov.imageUrl) { alert('Overlay này dùng ảnh cục bộ nên không thể xuất. Vui lòng tải ảnh lên mạng và dùng URL.'); return; }
    const payload = { version: 1, name: ov.name, imageUrl: ov.imageUrl, pixelUrl: ov.pixelUrl ?? null, offsetX: ov.offsetX, offsetY: ov.offsetY, opacity: ov.opacity };
    const text = JSON.stringify(payload, null, 2);
    copyText(text).then(() => alert('Đã sao chép JSON của overlay vào clipboard!')).catch(() => { prompt('Sao chép đoạn JSON sau:', text); });
  }
  function copyText(text) { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text); return Promise.reject(new Error('Clipboard API not available')); }

  async function createCanvasCopy() {
    const { copyPointA: pA, copyPointB: pB } = config;
    if (!pA || !pB) {
        showToast('Bạn cần đặt điểm A và B trước.');
        return;
    }

    if (config.showOverlay && config.overlayMode !== 'original') {
        showToast('Lưu ý: Đang sao chép canvas gốc, không có overlay.', 4000);
    }

    const minX = Math.min(pA.absX, pB.absX);
    const minY = Math.min(pA.absY, pB.absY);
    const maxX = Math.max(pA.absX, pB.absX);
    const maxY = Math.max(pA.absY, pB.absY);

    const W = maxX - minX + 1;
    const H = maxY - minY + 1;

    if (W > 50000 || H > 50000) {
        showToast(`Khu vực quá lớn (${W}x${H}). Tối đa 50000px mỗi cạnh.`);
        return;
    }

    const startChunk1 = Math.floor(minX / TILE_SIZE);
    const endChunk1 = Math.floor(maxX / TILE_SIZE);
    const startChunk2 = Math.floor(minY / TILE_SIZE);
    const endChunk2 = Math.floor(maxY / TILE_SIZE);

    const missingTiles = [];
    for (let c1 = startChunk1; c1 <= endChunk1; c1++) {
        for (let c2 = startChunk2; c2 <= endChunk2; c2++) {
            if (!tileDataCache.has(`${c1}/${c2}`)) {
                missingTiles.push(`${c1}/${c2}`);
            }
        }
    }

    if (missingTiles.length > 0) {
        showToast(`Khu vực chưa tải đủ dữ liệu. Vui lòng di chuyển bản đồ qua toàn bộ vùng đã chọn để tải dữ liệu, rồi thử lại.`);
        console.log("Faltan los siguientes tiles:", missingTiles);
        return;
    }

    showToast(`Đang sao chép ${W}x${H}px...`);

    const canvas = createHTMLCanvas(W, H);
    const ctx = canvas.getContext('2d');

    for (let c1 = startChunk1; c1 <= endChunk1; c1++) {
        for (let c2 = startChunk2; c2 <= endChunk2; c2++) {
            const tileImageData = tileDataCache.get(`${c1}/${c2}`);
            if (!tileImageData) continue;

            const tempTileCanvas = createCanvas(TILE_SIZE, TILE_SIZE);
            tempTileCanvas.getContext('2d').putImageData(tileImageData, 0, 0);

            const tileAbsX = c1 * TILE_SIZE;
            const tileAbsY = c2 * TILE_SIZE;
            const iSect = rectIntersect(minX, minY, W, H, tileAbsX, tileAbsY, TILE_SIZE, TILE_SIZE);

            if (iSect.w > 0 && iSect.h > 0) {
                const sx = iSect.x - tileAbsX;
                const sy = iSect.y - tileAbsY;
                const dx = iSect.x - minX;
                const dy = iSect.y - minY;
                ctx.drawImage(tempTileCanvas, sx, sy, iSect.w, iSect.h, dx, dy, iSect.w, iSect.h);
            }
        }
    }

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `wplace_copy_${minX}_${minY}_${W}x${H}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Đã tải xuống bản sao canvas!`);

    if (config.copyPreviewActive) {
        config.copyPreviewActive = false;
        await saveConfig(['copyPreviewActive']);
        clearOverlayCache();
        ensureHook();
        updateUI();
    }
  }

  async function nudgeCopyPoint(dx, dy) {
      const targetKey = config.copyNudgeTarget === 'A' ? 'copyPointA' : 'copyPointB';
      const point = config[targetKey];
      if (!point) {
          showToast(`Điểm ${config.copyNudgeTarget} chưa được đặt.`);
          return;
      }
      point.absX += dx;
      point.absY += dy;

      point.chunk1 = Math.floor(point.absX / TILE_SIZE);
      point.chunk2 = Math.floor(point.absY / TILE_SIZE);
      point.posX = point.absX % TILE_SIZE;
      point.posY = point.absY % TILE_SIZE;

      await saveConfig([targetKey]);
      updateUI();
      if(config.copyPreviewActive) forceTileRefresh();
  }

function addEventListeners() {
    const $ = (id) => document.getElementById(id);

    $('op-theme-toggle').addEventListener('click', async (e) => {
        e.stopPropagation();
        config.theme = config.theme === 'light' ? 'dark' : 'light';
        await saveConfig(['theme']);
applyTheme();
        updateUI();
    });

    $('op-panel-toggle').addEventListener('click', (e) => { e.stopPropagation(); config.isPanelCollapsed = !config.isPanelCollapsed; saveConfig(['isPanelCollapsed']); updateUI(); });

    $('op-show-overlay-toggle').addEventListener('click', () => {
        if (config.showOverlay) {
            if (config.autoCapturePixelUrl) {
                showToast('⚠️ Không thể tắt Overlay khi "Set Position" đang bật.', 3000);
                return;
            }
            if (config.isSettingCopyPoint) {
                showToast('⚠️ Không thể tắt Overlay khi đang chọn điểm sao chép.', 3000);
                return;
            }
            if (config.copyPreviewActive) {
                showToast('⚠️ Hãy tắt "Xem trước khu vực" trước để điều khiển Overlay thủ công.', 3000);
                return;
            }
        }

        config.showOverlay = !config.showOverlay;
        saveConfig(['showOverlay']);
        clearOverlayCache();
        ensureHook();
        updateUI();
        showToast('Đã áp dụng thay đổi. Di chuyển bản đồ hoặc đặt một pixel để xem.');
    });

    $('op-mode-toggle').addEventListener('click', () => {
        const modes = ['minify', 'behind', 'above', 'original'];
        const current = modes.indexOf(config.overlayMode);
        config.overlayMode = modes[(current + 1) % modes.length];
        saveConfig(['overlayMode']);
        clearOverlayCache();
        ensureHook();
        updateUI();
        showToast('Đã đổi chế độ. Di chuyển bản đồ để cập nhật.');
    });

    $('op-autocap-toggle').addEventListener('click', () => {
        config.autoCapturePixelUrl = !config.autoCapturePixelUrl;
        const keysToSave = ['autoCapturePixelUrl'];
        if (config.autoCapturePixelUrl) {
            config.isSettingCopyPoint = null;
            keysToSave.push('isSettingCopyPoint');
            if (!config.showOverlay) {
                config.showOverlay = true;
                keysToSave.push('showOverlay');
                showToast('Đã bật Set Position. Overlay tự động BẬT.');
                clearOverlayCache();
            } else {
                showToast('Đã bật chế độ Set Position.');
            }
        } else {
            showToast('Đã tắt chế độ Set Position.');
        }
        saveConfig(keysToSave);
        ensureHook();
        updateUI();
    });

    $('op-show-errors-toggle').addEventListener('click', async () => {
        const enabling = !config.showErrors;
        const keysToSave = ['showErrors'];
        if (enabling) {
            if (!config.showOverlay) {
                config.showOverlay = true;
                keysToSave.push('showOverlay');
                showToast('Đã bật overlay để hiển thị lỗi.');
            }
            if (config.overlayMode === 'original') {
                config.overlayMode = 'minify';
                keysToSave.push('overlayMode');
                showToast("Đã đổi sang chế độ 'Thu nhỏ' để hiện lỗi.");
            }
        }
        config.showErrors = enabling;
        await saveConfig(keysToSave);
        clearOverlayCache();
        ensureHook();
        updateUI();
        showToast('Đã cập nhật chế độ hiển thị lỗi. Di chuyển bản đồ để xem thay đổi.');
    });

    document.querySelectorAll('.op-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
    });

    $('op-add-overlay').addEventListener('click', async () => {
        try {
            await addBlankOverlay();
            setActiveTab('editor');
        } catch (e) {
            console.error(e);
        }
    });
    $('op-import-overlay').addEventListener('click', async () => { const text = prompt('Dán JSON của overlay (đơn hoặc mảng):'); if (!text) return; await importOverlayFromJSON(text); });
    $('op-export-overlay').addEventListener('click', () => exportActiveOverlayToClipboard());

    $('op-name').addEventListener('change', async (e) => {
        const ov = getActiveOverlay(); if (!ov) return;
        const desired = (e.target.value || '').trim() || 'Overlay';
        if (config.overlays.some(o => o.id !== ov.id && (o.name || '').toLowerCase() === desired.toLowerCase())) { ov.name = uniqueName(desired); showToast(`Tên đã được dùng. Đã đổi tên thành "${ov.name}".`); } else { ov.name = desired; }
        await saveConfig(['overlays']); rebuildOverlayListUI();
    });

    $('op-fetch').addEventListener('click', async () => {
        const ov = getActiveOverlay(); if (!ov) { alert('Chưa có overlay nào đang được chọn.'); return; }
        if (ov.imageBase64) { alert('Overlay này đã có ảnh. Hãy tạo overlay mới để đổi ảnh.'); return; }
        const url = $('op-image-url').value.trim(); if (!url) { alert('Vui lòng nhập link ảnh trước.'); return; }
        try { await setOverlayImageFromURL(ov, url); } catch (e) { console.error(e); alert('Không thể tải ảnh.'); }
    });

    const dropzone = $('op-dropzone');
    dropzone.addEventListener('click', () => $('op-file-input').click());
    $('op-file-input').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return;
        const ov = getActiveOverlay(); if (!ov) return;
        if (ov.imageBase64) { alert('Overlay này đã có ảnh. Hãy tạo overlay mới để đổi ảnh.'); return; }
        try { await setOverlayImageFromFile(ov, file); } catch (err) { console.error(err); alert('Không thể tải ảnh cục bộ.'); }
    });
    ['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.classList.add('drop-highlight'); }));
    ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); if (evt === 'dragleave' && e.target !== dropzone) return; dropzone.classList.remove('drop-highlight'); }));
    dropzone.addEventListener('drop', async (e) => {
        const dt = e.dataTransfer; if (!dt) return; const file = dt.files && dt.files[0]; if (!file) return;
        const ov = getActiveOverlay(); if (!ov) return;
        if (ov.imageBase64) { alert('Overlay này đã có ảnh. Hãy tạo overlay mới để đổi ảnh.'); return; }
        try { await setOverlayImageFromFile(ov, file); } catch (err) { console.error(err); alert('Không thể tải ảnh vừa kéo thả.'); }
    });

        const debouncedRefresh = debounce(() => {
        clearOverlayCache();
        showToast('Đã cập nhật vị trí. Di chuyển bản đồ để thấy thay đổi.', 2000);
    }, 500);

    const debouncedSave = debounce(() => {
        saveConfig(['overlays']);
    }, 300);

    const nudge = (dx, dy) => {
        const ov = getActiveOverlay();
        if (!ov) return;
        ov.offsetX += dx;
        ov.offsetY += dy;

        const indicator = document.getElementById('op-offset-indicator');
        if (indicator) indicator.textContent = `Offset X ${ov.offsetX}, Y ${ov.offsetY}`;

        debouncedRefresh();
        debouncedSave();
    };

    $('op-nudge-up').addEventListener('click', () => nudge(0, -1));
    $('op-nudge-down').addEventListener('click', () => nudge(0, 1));
    $('op-nudge-left').addEventListener('click', () => nudge(-1, 0));
    $('op-nudge-right').addEventListener('click', () => nudge(1, 0));

    $('op-opacity-slider').addEventListener('input', (e) => {
        const ov = getActiveOverlay(); if (!ov) return;
        ov.opacity = parseFloat(e.target.value);
        $('op-opacity-value').textContent = Math.round(ov.opacity * 100) + '%';
        if (config.showErrors) {
            config.showErrors = false;
            saveConfig(['showErrors']);
            clearOverlayCache();
            showToast('Đã tắt chế độ hiển thị lỗi để chỉnh độ trong suốt.');
            updateUI();
        }
    });
    $('op-opacity-slider').addEventListener('change', async () => {
        await saveConfig(['overlays']);
        clearOverlayCache();
        showToast('Đã lưu độ trong suốt. Di chuyển bản đồ để cập nhật.');
    });

    $('op-download-overlay').addEventListener('click', () => {
        const ov = getActiveOverlay();
        if (!ov || !ov.imageBase64) { showToast('Không có ảnh để tải xuống.'); return; }
        const a = document.createElement('a');
        a.href = ov.imageBase64;
        a.download = `${(ov.name || 'overlay').replace(/[^\w.-]+/g, '_')}.png`;
        a.click();
        a.remove();
    });

    $('op-open-cc').addEventListener('click', () => {
        const ov = getActiveOverlay(); if (!ov || !ov.imageBase64) { showToast('Không có ảnh để chỉnh sửa.'); return; }
        openCCModal(ov);
    });

    $('op-open-resize').addEventListener('click', () => {
        const ov = getActiveOverlay();
        if (!ov || !ov.imageBase64) { showToast('Không có ảnh để đổi kích thước.'); return; }
        openRSModal(ov);
    });

    const setCopyPoint = async (point) => {
        config.isSettingCopyPoint = point;
        const keysToSave = ['isSettingCopyPoint'];

        if (point) {
            config.autoCapturePixelUrl = false;
            keysToSave.push('autoCapturePixelUrl');

            if (config.copyPreviewActive) {
                config.copyPreviewActive = false;
                config.showOverlay = overlayStateBeforePreview;
                keysToSave.push('copyPreviewActive', 'showOverlay');
                clearOverlayCache();
            }
        }

        await saveConfig(keysToSave);
        showToast(point ? `Bấm vào canvas để đặt điểm ${point}` : 'Đã hủy lựa chọn.');
        updateUI();
        ensureHook();
    };
    $('op-copy-set-a').addEventListener('click', () => setCopyPoint('A'));
    $('op-copy-set-b').addEventListener('click', () => setCopyPoint('B'));
    $('op-copy-create').addEventListener('click', () => { createCanvasCopy(); });
    $('op-copy-preview-toggle').addEventListener('click', () => {
        if (!config.copyPointA || !config.copyPointB) {
            showToast('Bạn cần đặt điểm A và B trước.');
            return;
        }
        const activating = !config.copyPreviewActive;
        config.copyPreviewActive = activating;

        if (activating) {
            overlayStateBeforePreview = config.showOverlay;
            if (config.showOverlay) {
                config.showOverlay = false;
                showToast('Đã tắt Overlay để hiển thị bản xem trước.');
            }
        } else {
            config.showOverlay = overlayStateBeforePreview;
        }

        saveConfig(['copyPreviewActive', 'showOverlay']);
        clearOverlayCache();
        ensureHook();
        updateUI();
        forceTileRefresh();
    });

    document.querySelectorAll('input[name="op-nudge-target"]').forEach(radio => {
        radio.addEventListener('change', async (e) => {
            config.copyNudgeTarget = e.target.value;
            await saveConfig(['copyNudgeTarget']);
        });
    });
    $('op-nudge-copy-up').addEventListener('click', () => nudgeCopyPoint(0, -1));
    $('op-nudge-copy-down').addEventListener('click', () => nudgeCopyPoint(0, 1));
    $('op-nudge-copy-left').addEventListener('click', () => nudgeCopyPoint(-1, 0));
    $('op-nudge-copy-right').addEventListener('click', () => nudgeCopyPoint(1, 0));

    $('op-analyze-colors-btn').addEventListener('click', async () => {
        config.isColorPanelVisible = !config.isColorPanelVisible;
        await saveConfig(['isColorPanelVisible']);

        if (config.isColorPanelVisible) {
            await updateOverlayProgress();
        }
        updateUI();
    });

    const mainSettingsBtn = $('op-main-settings-btn');
    const mainSettingsModal = $('op-main-settings-modal');
    const mainBackdrop = $('op-main-settings-backdrop');
    const panelAlphaSlider = $('op-panel-alpha-slider');

    const toggleMainSettingsModal = (show) => {
        mainSettingsModal.classList.toggle('show', show);
        mainBackdrop.classList.toggle('show', show);
    };

    mainSettingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMainSettingsModal(true);
    });

    mainBackdrop.addEventListener('click', () => toggleMainSettingsModal(false));

    panelAlphaSlider.value = config.panelAlpha;
    panelAlphaSlider.addEventListener('input', (e) => {
        config.panelAlpha = parseFloat(e.target.value);
        document.getElementById('overlay-pro-panel').style.setProperty('--op-panel-alpha', config.panelAlpha);
        updateUI();
    });
    panelAlphaSlider.addEventListener('change', () => {
        saveConfig(['panelAlpha']);
    });

    const caSettingsBtn = $('op-ca-settings-btn');
    const caSettingsModal = $('op-ca-settings-modal');
    const caBackdrop = $('op-ca-settings-backdrop');
    const caAlphaSlider = $('op-ca-alpha-slider');
    const caSortToggle = $('op-ca-sort-toggle');

    const toggleCaSettingsModal = (show) => {
        caSettingsModal.classList.toggle('show', show);
        caBackdrop.classList.toggle('show', show);
    };

    caSettingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCaSettingsModal(true);
    });

    caBackdrop.addEventListener('click', () => toggleCaSettingsModal(false));

    caAlphaSlider.value = config.colorPanelAlpha;
    caAlphaSlider.addEventListener('input', (e) => {
        config.colorPanelAlpha = parseFloat(e.target.value);
        updateUI();
    });
    caAlphaSlider.addEventListener('change', () => {
        saveConfig(['colorPanelAlpha']);
    });

    caSortToggle.classList.toggle('active', config.caSortEnabled);
    caSortToggle.addEventListener('click', async () => {
        config.caSortEnabled = !config.caSortEnabled;
        caSortToggle.classList.toggle('active', config.caSortEnabled);
        await saveConfig(['caSortEnabled']);
        if (config.isColorPanelVisible) await updateOverlayProgress();
    });

    document.querySelectorAll('.op-show-donators').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const parentModal = button.closest('.op-modal');
            const listWrap = parentModal.querySelector('.op-donators-list-wrap');
            if (!listWrap) return;

            if (listWrap.classList.contains('show')) {
                listWrap.classList.remove('show');
                listWrap.innerHTML = '';
            } else {
                let listHTML = '<ul class="op-donators-list">';
                if (DONATORS.length === 0) {
                    listHTML += '<li class="op-donator-item-empty">Chưa có ai donate. Hãy là người đầu tiên!</li>';
                } else {
                    DONATORS.forEach(d => {
                        listHTML += `<li class="op-donator-item"><span class="op-donator-name">${d.name}</span><span class="op-donator-contribution">${d.contribution}</span></li>`;
                    });
                }
                listHTML += '</ul>';
                listWrap.innerHTML = listHTML;
                listWrap.classList.add('show');
            }
        });
    });

    $('op-ca-toggle-collapse').addEventListener('click', async (e) => {
        e.stopPropagation();
        config.caIsCollapsed = !config.caIsCollapsed;

        if (config.caIsCollapsed) {
            config.caFiltersVisible = false;
        }

        await saveConfig(['caIsCollapsed', 'caFiltersVisible']);
        updateUI();
    });

    $('op-ca-toggle-filters').addEventListener('click', async (e) => {
        e.stopPropagation();
        config.caFiltersVisible = !config.caFiltersVisible;
        await saveConfig(['caFiltersVisible']);
        updateUI();
    });

    const createViewToggleHandler = (key, needsProgressUpdate) => async () => {
        config[key] = !config[key];
        await saveConfig([key]);
        if (needsProgressUpdate) {
            await updateOverlayProgress();
        }
        updateUI();
    };

    $('op-ca-show-names-toggle').addEventListener('click', createViewToggleHandler('caShowColorNames', true));
    $('op-ca-show-progress-toggle').addEventListener('click', createViewToggleHandler('caShowProgress', true));
    $('op-ca-show-remaining-toggle').addEventListener('click', createViewToggleHandler('caShowRemainingOnly', true));

    const dropdown = $('op-mode-dropdown');
    const trigger = $('op-mode-trigger');
    const hiddenInput = $('op-color-mode');
    const triggerText = $('op-mode-text');
    const options = dropdown.querySelectorAll('.op-option');

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.op-custom-select.open').forEach(d => { if (d !== dropdown) d.classList.remove('open'); });
        dropdown.classList.toggle('open');
    });

    options.forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            options.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            const val = opt.dataset.value;
            const text = opt.innerText.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]\s+/, '');
            hiddenInput.value = val;
            const ov = getActiveOverlay();
            if (ov) { ov.colorMode = val; saveConfig(['overlays']); }
            let displayMode = 'BlueMarble';
            if(val === 'enhanced') displayMode = 'Pixel Art';
            if(val === 'photorealistic') displayMode = 'Dithering';
            triggerText.textContent = text.split('(')[0].trim() + ' (' + displayMode + ')';
            dropdown.classList.remove('open');
        });
    });

    window.addEventListener('click', () => { if (dropdown) dropdown.classList.remove('open'); });
}

    function getAvailableColors() {
    const colorElements = document.querySelectorAll('[id^="color-"]');

    if (colorElements.length === 0) {
        return lastKnownAvailableColors;
    }

    const currentColors = new Set();
    colorElements.forEach(el => {
        if (!el.querySelector("svg")) {
            const rgbStr = el.style.backgroundColor.match(/\d+/g);
            if (rgbStr) {
                const rgb = rgbStr.map(Number);
                currentColors.add(`${rgb[0]},${rgb[1]},${rgb[2]}`);
            }
        }
    });

    if (currentColors.size !== lastKnownAvailableColors.size || ![...currentColors].every(color => lastKnownAvailableColors.has(color))) {
        lastKnownAvailableColors = currentColors;
        config.lastKnownColors = Array.from(currentColors);

        saveConfig(['lastKnownColors']);
    }

    return lastKnownAvailableColors;
}

async function updateOverlayProgress() {
    const panelContent = document.getElementById('op-ca-list-content');
    const totalPercentageEl = document.getElementById('op-ca-total-percentage');
    const ov = getActiveOverlay();

    document.getElementById('op-ca-sort-toggle').classList.toggle('active', !!config.caSortEnabled);
    const mainActions = document.querySelector('.op-ca-main-actions');
    if (mainActions) mainActions.style.display = 'none';

    if (!ov || !ov.imageBase64 || !ov.pixelUrl) {
        panelContent.innerHTML = `<span class="op-muted" style="text-align: center; padding: 20px 0;">Chọn một overlay đã có ảnh và đặt mốc neo.</span>`;
        totalPercentageEl.textContent = 'N/A';
        return;
    }

    if (mainActions) mainActions.style.display = 'flex';
    panelContent.innerHTML = `<span class="op-muted" style="text-align: center; padding: 20px 0;">Analizando...</span>`;
    totalPercentageEl.textContent = '0%';

    try {
        const availableColors = getAvailableColors();
        const cacheData = await getOrBuildOverlayCache(ov);
        const { width, height, colorIds, neededCounts } = cacheData;

        const colorData = new Map();
        let totalNeeded = 0;
        let totalPlaced = 0;

        for (const [idStr, count] of Object.entries(neededCounts)) {
            const id = Number(idStr);
            const [r, g, b] = FULL_PALETTE[id];
            const key = `${r},${g},${b}`;
            colorData.set(key, { needed: count, placed: 0, botId: id });
            totalNeeded += count;
        }

        if (totalNeeded === 0) {
            panelContent.innerHTML = `<span class="op-muted" style="text-align: center; padding: 20px 0;">Ảnh đang trống.</span>`;
            return;
        }

        const base = extractPixelCoords(ov.pixelUrl);
        const overlayBaseX = base.chunk1 * TILE_SIZE + base.posX + ov.offsetX;
        const overlayBaseY = base.chunk2 * TILE_SIZE + base.posY + ov.offsetY;

        for (const [tileKey, tileImageData] of tileDataCache.entries()) {
            const [c1, c2] = tileKey.split('/').map(Number);
            const tileAbsX = c1 * TILE_SIZE;
            const tileAbsY = c2 * TILE_SIZE;

            const isect = rectIntersect(tileAbsX, tileAbsY, TILE_SIZE, TILE_SIZE, overlayBaseX, overlayBaseY, width, height);
            if (isect.w === 0 || isect.h === 0) continue;

            for (let y = 0; y < isect.h; y++) {
                for (let x = 0; x < isect.w; x++) {
                    const ovLocX = (isect.x + x) - overlayBaseX;
                    const ovLocY = (isect.y + y) - overlayBaseY;
                    const ovId = colorIds[ovLocY * width + ovLocX];

                    if (ovId === 255) continue;

                    const mapLocX = (isect.x + x) - tileAbsX;
                    const mapLocY = (isect.y + y) - tileAbsY;
                    const mapIdx = (mapLocY * TILE_SIZE + mapLocX) * 4;

                    const ma = tileImageData.data[mapIdx+3];
                    if (ma > 200) {
                        const mr = tileImageData.data[mapIdx];
                        const mg = tileImageData.data[mapIdx+1];
                        const mb = tileImageData.data[mapIdx+2];
                        const targetColor = FULL_PALETTE[ovId];

                        if (Math.abs(mr - targetColor[0]) + Math.abs(mg - targetColor[1]) + Math.abs(mb - targetColor[2]) < 15) {
                            const key = `${targetColor[0]},${targetColor[1]},${targetColor[2]}`;
                            if (colorData.has(key)) {
                                colorData.get(key).placed++;
                                totalPlaced++;
                            }
                        }
                    }
                }
            }
        }

        let colorsArray = Array.from(colorData.entries()).map(([key, data]) => {
            return { key, name: WPLACE_NAMES[key] || 'Desconocido', needed: data.needed, placed: data.placed, isAvailable: availableColors.has(key) };
        });

        colorsArray.sort((a, b) => {
            if (config.caHighlightEnabled && a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
            if (config.caSortEnabled) return b.needed - a.needed;
            return 0;
        });

        panelContent.innerHTML = '';
        const isFilterActiveForThisOverlay = !!ov.filterActive;
        const savedFiltersSet = new Set(ov.savedFilters || []);

        for (const color of colorsArray) {
            const item = document.createElement('div');
            item.className = 'op-ca-item';
            if (config.caHighlightEnabled && color.isAvailable) item.classList.add('available');

            const isChecked = isFilterActiveForThisOverlay ? savedFiltersSet.has(color.key) : true;
            const remaining = color.needed - color.placed;
            const progressText = config.caShowRemainingOnly ? `${remaining}` : `${color.placed} / ${color.needed}`;

            item.innerHTML = `
                <input type="checkbox" class="op-ca-filter-check" data-color-key="${color.key}" ${isChecked ? 'checked' : ''} style="margin-left: -2px;">
                <div class="op-ca-swatch" style="background-color: rgb(${color.key});"></div>
                <span class="op-ca-name">${color.name}</span>
                <span class="op-ca-count">${progressText}</span>
            `;

            if (remaining === 0 && color.needed > 0) item.querySelector('.op-ca-count')?.classList.add('completed');
            panelContent.appendChild(item);
        }

        totalPercentageEl.textContent = `${totalNeeded > 0 ? ((totalPlaced / totalNeeded) * 100).toFixed(1) : '0.0'}%`;

        const applyAndRefresh = async (isFilter, colors, message) => {
            ov.filterActive = isFilter;
            ov.savedFilters = colors;
            await saveConfig(['overlays']);
            clearOverlayCache();
            showToast(message + ' Di chuyển bản đồ để xem thay đổi.');
        };

        document.getElementById('op-ca-apply-filter').onclick = () => {
            const selected = Array.from(panelContent.querySelectorAll('.op-ca-filter-check:checked')).map(cb => cb.dataset.colorKey);
            applyAndRefresh(true, selected, `Đã áp dụng bộ lọc. Đang hiển thị ${selected.length} màu.`);
        };
        document.getElementById('op-ca-show-all').onclick = () => {
            panelContent.querySelectorAll('.op-ca-filter-check').forEach(cb => cb.checked = true);
            applyAndRefresh(false, [], 'Đã xóa bộ lọc. Đang hiển thị tất cả các màu.');
        };
        document.getElementById('op-ca-mark-available').onclick = () => {
            const availableSet = new Set(colorsArray.filter(c => c.isAvailable).map(c => c.key));
            panelContent.querySelectorAll('.op-ca-filter-check').forEach(cb => cb.checked = availableSet.has(cb.dataset.colorKey));
        };
        document.getElementById('op-ca-mark-all').onclick = () => panelContent.querySelectorAll('.op-ca-filter-check').forEach(cb => cb.checked = true);
        document.getElementById('op-ca-mark-none').onclick = () => panelContent.querySelectorAll('.op-ca-filter-check').forEach(cb => cb.checked = false);

    } catch (error) {
        console.error("Lỗi khi cập nhật tiến độ overlay:", error);
        panelContent.innerHTML = `<span class="op-muted op-danger-text" style="text-align: center; padding: 20px 0;">Lỗi khi xử lý ảnh.</span>`;
        totalPercentageEl.textContent = 'Lỗi';
    }
}

  function enableDrag(panel, headerSelector, xKey, yKey) {
    const header = panel.querySelector(headerSelector);
    if (!header) return;

    let isDragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0, moved = false;
    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

    const onPointerDown = (e) => {
        if (e.target.closest('button, input, a, .op-switch')) return;
        isDragging = true;
        moved = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = panel.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        header.setPointerCapture?.(e.pointerId);
        e.preventDefault();
    };

    const onPointerMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
        const maxTop = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
        panel.style.left = clamp(startLeft + dx, 8, maxLeft) + 'px';
        panel.style.top = clamp(startTop + dy, 8, maxTop) + 'px';
        moved = true;
    };

    const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        header.releasePointerCapture?.(e.pointerId);
        if (moved) {
            config[xKey] = parseInt(panel.style.left, 10) || 0;
            config[yKey] = parseInt(panel.style.top, 10) || 0;
            saveConfig([xKey, yKey]);
        }
    };

    header.addEventListener('pointerdown', onPointerDown);
    header.addEventListener('pointermove', onPointerMove);
    header.addEventListener('pointerup', onPointerUp);
    header.addEventListener('pointercancel', onPointerUp);

      window.addEventListener('resize', () => {
      const rect = panel.getBoundingClientRect();
      const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
      const maxTop  = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
      const newLeft = Math.min(Math.max(rect.left, 8), maxLeft);
      const newTop  = Math.min(Math.max(rect.top, 8), maxTop);
      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
      config[xKey] = newLeft;
      config[yKey] = newTop;
      saveConfig([xKey, yKey]);
    });
}

  function applyTheme() {
    document.body.classList.toggle('op-theme-dark', config.theme === 'dark');
    document.body.classList.toggle('op-theme-light', config.theme !== 'dark');
    const stack = document.getElementById('op-toast-stack');
    if (stack) stack.classList.toggle('op-dark', config.theme === 'dark');
  }
  function setActiveTab(tabName) {
    if (!tabName) return;
    config.activeTab = tabName;
    saveConfig(['activeTab']);

    document.querySelectorAll('.op-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.op-tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.dataset.pane === tabName);
    });
  }

  function updateEditorUI() {
    const $ = (id) => document.getElementById(id);
    const ov = getActiveOverlay();

    const placeholder = $('op-editor-placeholder');
    const content = $('op-editor-content');

    if (!ov) {
        placeholder.style.display = 'block';
        content.style.display = 'none';
        return;
    }

    placeholder.style.display = 'none';
    content.style.display = 'flex';

    $('op-name').value = ov.name || '';

    const srcWrap = $('op-image-source');
    const previewWrap = $('op-preview-wrap');
    const previewImg = $('op-image-preview');
    const ccRow = $('op-cc-btn-row');

    if (ov.imageBase64) {
      srcWrap.style.display = 'none';
      previewWrap.style.display = 'flex';
      previewImg.src = ov.imageBase64;
      ccRow.style.display = 'flex';
    } else {
      srcWrap.style.display = 'block';
      previewWrap.style.display = 'none';
      ccRow.style.display = 'none';
      $('op-image-url').value = ov.imageUrl || '';
    }

    const coords = ov.pixelUrl ? extractPixelCoords(ov.pixelUrl) : { chunk1: '-', chunk2: '-', posX: '-', posY: '-' };
    $('op-coord-display').textContent = ov.pixelUrl
      ? `Ref: chunk ${coords.chunk1}/${coords.chunk2} en (${coords.posX}, ${coords.posY})`
      : `Chưa đặt mốc neo. Bật "Đặt vị trí" rồi bấm vào một pixel.`;

    $('op-opacity-slider').value = String(ov.opacity);
    $('op-opacity-value').textContent = Math.round(ov.opacity * 100) + '%';
    $('op-opacity-slider').disabled = config.showErrors;

    const indicator = document.getElementById('op-offset-indicator');
    if (indicator) indicator.textContent = `Offset X ${ov.offsetX}, Y ${ov.offsetY}`;

    const cMode = ov.colorMode || 'standard';
    $('op-color-mode').value = cMode;
    const textMap = { 'standard': t('modeStd'), 'enhanced': t('modeEnh'), 'photorealistic': t('modePho') };
    const textEl = $('op-mode-text');
    if (textEl) textEl.textContent = textMap[cMode] || t('modeStd');
    document.querySelectorAll('.op-option').forEach(opt => opt.classList.toggle('selected', opt.dataset.value === cMode));
  }
  function updateCopierUI() {
    const $ = (id) => document.getElementById(id);

    const { copyPointA: pA, copyPointB: pB, isSettingCopyPoint, copyPreviewActive } = config;
    $('op-copy-a-coords').textContent = pA ? `(${pA.absX}, ${pA.absY})` : 'Chưa đặt';
    $('op-copy-b-coords').textContent = pB ? `(${pB.absX}, ${pB.absY})` : 'Chưa đặt';

    const btnA = $('op-copy-set-a');
    const btnB = $('op-copy-set-b');
    btnA.classList.toggle('op-danger', isSettingCopyPoint === 'A');
    btnB.classList.toggle('op-danger', isSettingCopyPoint === 'B');
    btnA.textContent = isSettingCopyPoint === 'A' ? 'Đang đặt A...' : 'Đặt điểm A';
    btnB.textContent = isSettingCopyPoint === 'B' ? 'Đang đặt B...' : 'Đặt điểm B';

    const info = $('op-copy-info');
    const canCreate = pA && pB;
    if (canCreate) {
        const W = Math.abs(pA.absX - pB.absX) + 1;
        const H = Math.abs(pA.absY - pB.absY) + 1;
        info.textContent = `Kích thước đã chọn: ${W} x ${H} pixel.`;
    } else {
        info.textContent = 'Chọn hai điểm để xác định khu vực.';
    }

    const previewBtn = $('op-copy-preview-toggle');
    previewBtn.disabled = !canCreate;
    previewBtn.textContent = copyPreviewActive ? 'Ẩn khu vực' : 'Xem trước khu vực';
    previewBtn.classList.toggle('op-danger', copyPreviewActive);

    $('op-copy-create').disabled = !copyPreviewActive;

          const nudgeTargetA = $('op-nudge-target-a');
    if (nudgeTargetA) nudgeTargetA.checked = config.copyNudgeTarget === 'A';
    const nudgeTargetB = $('op-nudge-target-b');
    if (nudgeTargetB) nudgeTargetB.checked = config.copyNudgeTarget === 'B';

  }
    function updateOverlayListPreview() {
    const previewArea = document.getElementById('op-list-preview-area');
    const previewImg = document.getElementById('op-list-preview-img');
    const activeOverlay = getActiveOverlay();

    if (activeOverlay && activeOverlay.imageBase64) {
        previewImg.src = activeOverlay.imageBase64;
        previewArea.style.display = 'block';
    } else {
        previewArea.style.display = 'none';
    }
}

function updateUI() {
    const $ = (id) => document.getElementById(id);
    const panel = $('overlay-pro-panel');
    if (!panel) return;

    panel.classList.toggle('collapsed', !!config.isPanelCollapsed);

    applyTheme();

    const mainRgb = '18, 18, 28';

    panel.style.setProperty('--op-bg-rgb', mainRgb);
    panel.style.setProperty('--op-panel-alpha', config.panelAlpha);

    const content = $('op-content');
    const toggle = $('op-panel-toggle');
    const collapsed = !!config.isPanelCollapsed;
    content.style.display = collapsed ? 'none' : 'flex';
    toggle.textContent = collapsed ? '▸' : '▾';
    toggle.title = collapsed ? 'Expandir' : 'Plegar';

    const showOverlayBtn = $('op-show-overlay-toggle');
    showOverlayBtn.textContent = `${t('overlayBtn')}: ${config.showOverlay ? 'BẬT' : 'TẮT'}`;
    showOverlayBtn.classList.toggle('op-danger', !config.showOverlay);

    const modeBtn = $('op-mode-toggle');
    const modeMap = { behind: 'Phía sau', above: 'Phía trên', minify: `Thu nhỏ ◻`, original: 'Gốc' };
    modeBtn.textContent = `${t('modeBtn')}: ${modeMap[config.overlayMode] || 'Gốc'}`;
    const autoBtn = $('op-autocap-toggle');
    autoBtn.textContent = `${t('posBtn')}: ${config.autoCapturePixelUrl ? 'BẬT' : 'TẮT'}`;
    const showErrorBtn = $('op-show-errors-toggle');
    showErrorBtn.textContent = `${t('errorsBtn')}: ${config.showErrors ? 'BẬT' : 'TẮT'}`;
    showErrorBtn.classList.toggle('op-danger', !!config.showErrors);

    setActiveTab(config.activeTab);
    rebuildOverlayListUI();
    updateEditorUI();
    updateCopierUI();
    updateOverlayListPreview();

    const exportBtn = $('op-export-overlay');
    const ov = getActiveOverlay();
    const canExport = !!(ov && ov.imageUrl && !ov.isLocal);
    exportBtn.disabled = !canExport;
    exportBtn.title = canExport ? 'Xuất overlay đang chọn ra JSON' : 'Không thể xuất ảnh cục bộ';

    const analyzeBtn = $('op-analyze-colors-btn');
    if(analyzeBtn) analyzeBtn.classList.toggle('op-danger', config.isColorPanelVisible);

    const colorPanel = $('op-color-analysis-panel');
    if (colorPanel) {
        colorPanel.classList.toggle('show', config.isColorPanelVisible);
        colorPanel.classList.toggle('collapsed', !!config.caIsCollapsed);
        colorPanel.classList.toggle('filters-open', !!config.caFiltersVisible && !config.caIsCollapsed);

        if (Number.isFinite(config.colorPanelX) && Number.isFinite(config.colorPanelY)) {
            colorPanel.style.left = config.colorPanelX + 'px';
            colorPanel.style.top = config.colorPanelY + 'px';
        } else if (config.isColorPanelVisible) {

            const rect = colorPanel.getBoundingClientRect();
            colorPanel.style.left = `${(window.innerWidth - rect.width) / 2}px`;
            colorPanel.style.top = `${(window.innerHeight - rect.height) / 2}px`;
        }

        colorPanel.style.setProperty('--op-bg-rgb', mainRgb);
        colorPanel.style.background = `rgba(${mainRgb}, ${config.colorPanelAlpha})`;
        const caContent = colorPanel.querySelector('.op-ca-list');
        const caFooter = colorPanel.querySelector('.op-ca-footer');
        const caToggleBtn = colorPanel.querySelector('#op-ca-toggle-collapse');

        if (caContent && caFooter && caToggleBtn) {
            const isCollapsed = !!config.caIsCollapsed;
            caContent.style.display = isCollapsed ? 'none' : 'flex';
            caFooter.style.display = isCollapsed ? 'none' : 'flex';
            caToggleBtn.textContent = isCollapsed ? '▸' : '▾';

            const filtersPane = $('op-ca-filters-pane');
            if(filtersPane) filtersPane.classList.toggle('show', !!config.caFiltersVisible);

            $('op-ca-show-names-toggle')?.classList.toggle('active', !!config.caShowColorNames);
            $('op-ca-show-progress-toggle')?.classList.toggle('active', !!config.caShowProgress);
            $('op-ca-show-remaining-toggle')?.classList.toggle('active', !!config.caShowRemainingOnly);

            const totalProgressEl = colorPanel.querySelector('.op-ca-total-progress');
            if (totalProgressEl) {
                totalProgressEl.style.display = config.caShowProgress ? 'flex' : 'none';
            }
        }

        document.body.classList.toggle('ca-hide-names', !config.caShowColorNames);
    }
}

  let cc = null;

  function buildCCModal() {
    const backdrop = document.createElement('div');
    backdrop.className = 'op-cc-backdrop';
    backdrop.id = 'op-cc-backdrop';
    document.body.appendChild(backdrop);

    const modal = document.createElement('div');
    modal.className = 'op-cc-modal op-modal';
    modal.id = 'op-cc-modal';

    modal.innerHTML = `
      <div class="op-cc-header" id="op-cc-header">
        <div class="op-cc-title">Chỉnh màu</div>
        <div class="op-row" style="gap:6px;">
          <button class="op-button op-cc-pill" id="op-cc-realtime" title="Bật/Tắt tính toán theo thời gian thực khi đổi bảng màu.">Thời gian thực: TẮT</button>
          <button class="op-cc-close" id="op-cc-close" title="Đóng">✕</button>
        </div>
      </div>

      <div class="op-cc-body">
        <div class="op-cc-preview-wrap" style="grid-area: preview;">
          <canvas id="op-cc-preview" class="op-cc-canvas"></canvas>
          <div class="op-cc-zoom">
            <button class="op-icon-btn" id="op-cc-zoom-out" title="Thu nhỏ">−</button>
            <button class="op-icon-btn" id="op-cc-zoom-in" title="Phóng to">+</button>
          </div>
        </div>

        <div class="op-cc-controls" style="grid-area: controls;">
          <div class="op-cc-palette" id="op-cc-free">
            <div class="op-row space">
              <label>Màu Miễn Phí</label>
              <button class="op-button" id="op-cc-free-toggle" title="Chọn/Bỏ chọn tất cả màu trong bảng màu này.">Bỏ chọn tất cả</button>
            </div>
            <div id="op-cc-free-grid" class="op-cc-grid"></div>
          </div>

          <div class="op-cc-palette" id="op-cc-paid">
            <div class="op-row space">
              <label>Màu Trả Phí (2000💧)</label>
              <button class="op-button" id="op-cc-paid-toggle" title="Chọn/Bỏ chọn tất cả màu trong bảng màu này.">Chọn tất cả</button>
            </div>
            <div id="op-cc-paid-grid" class="op-cc-grid"></div>
          </div>
        </div>
      </div>

      <div class="op-cc-footer">
        <div class="op-cc-ghost" id="op-cc-meta"></div>
        <div class="op-cc-actions">
          <button class="op-button" id="op-cc-recalc" title="Tính lại ánh xạ màu">Tính lại</button>
          <button class="op-button" id="op-cc-apply" title="Áp dụng thay đổi vào overlay">Áp dụng</button>
          <button class="op-button" id="op-cc-cancel" title="Đóng mà không lưu">Hủy</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#op-cc-close').addEventListener('click', closeCCModal);
    backdrop.addEventListener('click', closeCCModal);
    modal.querySelector('#op-cc-cancel').addEventListener('click', closeCCModal);

    cc = {
      backdrop,
      modal,
      previewCanvas: modal.querySelector('#op-cc-preview'),
      previewCtx: modal.querySelector('#op-cc-preview').getContext('2d', { willReadFrequently: true }),
      sourceCanvas: null,
      sourceCtx: null,
      sourceImageData: null,
      processedCanvas: null,
      processedCtx: null,
      freeGrid: modal.querySelector('#op-cc-free-grid'),
      paidGrid: modal.querySelector('#op-cc-paid-grid'),
      freeToggle: modal.querySelector('#op-cc-free-toggle'),
      paidToggle: modal.querySelector('#op-cc-paid-toggle'),
      meta: modal.querySelector('#op-cc-meta'),
      applyBtn: modal.querySelector('#op-cc-apply'),
      recalcBtn: modal.querySelector('#op-cc-recalc'),
      realtimeBtn: modal.querySelector('#op-cc-realtime'),
      zoom: 1.0,
      selectedFree: new Set(config.ccFreeKeys),
      selectedPaid: new Set(config.ccPaidKeys),
      realtime: !!config.ccRealtime,
      overlay: null,
      lastColorCounts: {},
      isStale: false
    };

    cc.realtimeBtn.addEventListener('click', async () => {
      cc.realtime = !cc.realtime;
      cc.realtimeBtn.textContent = `Thời gian thực: ${cc.realtime ? 'BẬT' : 'TẮT'}`;
      cc.realtimeBtn.classList.toggle('op-danger', cc.realtime);
      config.ccRealtime = cc.realtime; await saveConfig(['ccRealtime']);
      if (cc.realtime && cc.isStale) recalcNow();
    });

    const zoomIn = async () => { cc.zoom = Math.min(8, (cc.zoom || 1) * 1.25); config.ccZoom = cc.zoom; await saveConfig(['ccZoom']); applyPreview(); updateMeta(); };
    const zoomOut = async () => { cc.zoom = Math.max(0.1, (cc.zoom || 1) / 1.25); config.ccZoom = cc.zoom; await saveConfig(['ccZoom']); applyPreview(); updateMeta(); };
    modal.querySelector('#op-cc-zoom-in').addEventListener('click', zoomIn);
    modal.querySelector('#op-cc-zoom-out').addEventListener('click', zoomOut);

    cc.recalcBtn.addEventListener('click', () => { recalcNow(); });

    cc.applyBtn.addEventListener('click', async () => {
      const ov = cc.overlay; if (!ov) return;
      const activePalette = getActivePalette();
      if (activePalette.length === 0) { showToast('Chọn ít nhất một màu.'); return; }
      if (cc.isStale) recalcNow();
      if (!cc.processedCanvas) { showToast('Không có gì để áp dụng.'); return; }
      if (cc.processedCanvas.width >= MAX_OVERLAY_DIM || cc.processedCanvas.height >= MAX_OVERLAY_DIM) {
        showToast(`Ảnh quá lớn để áp dụng (phải nhỏ hơn ${MAX_OVERLAY_DIM}×${MAX_OVERLAY_DIM}).`); return;
      }
      const dataUrl = cc.processedCanvas.toDataURL('image/png');
      ov.imageBase64 = dataUrl; ov.imageUrl = null; ov.isLocal = true;
      await saveConfig(['overlays']); clearOverlayCache(); ensureHook(); updateUI();
      const uniqueColors = Object.keys(cc.lastColorCounts).length;
      showToast(`Đã cập nhật overlay (${cc.processedCanvas.width}×${cc.processedCanvas.height}, ${uniqueColors} màu).`);
      closeCCModal();
    });

    renderPaletteGrid();

    cc.freeToggle.addEventListener('click', async () => {
      const allActive = isAllFreeActive();
      setAllActive('free', !allActive);
      config.ccFreeKeys = Array.from(cc.selectedFree);
      await saveConfig(['ccFreeKeys']);
      if (cc.realtime) { await processImage(); } else { cc.isStale = true; }
      applyPreview(); updateMeta(); updateMasterButtons();
    });
    cc.paidToggle.addEventListener('click', async () => {
      const allActive = isAllPaidActive();
      setAllActive('paid', !allActive);
      config.ccPaidKeys = Array.from(cc.selectedPaid);
      await saveConfig(['ccPaidKeys']);
      if (cc.realtime) { await processImage(); } else { cc.isStale = true; }
      applyPreview(); updateMeta(); updateMasterButtons();
    });

    function markStale() {
      cc.isStale = true;
      cc.meta.textContent = cc.meta.textContent.replace(/ \| Trạng thái: .+$/, '') + ' | Trạng thái: đang chờ tính lại';
    }
    async function recalcNow() {
      await processImage();
      cc.isStale = false;
      applyPreview();
      updateMeta();
    }
  }

  function openCCModal(overlay) {
    if (!cc) return;
    cc.overlay = overlay;
    document.body.classList.add('op-scroll-lock');
    cc.zoom = Number(config.ccZoom) || 1.0;
    cc.realtime = !!config.ccRealtime;
    cc.realtimeBtn.textContent = `Thời gian thực: ${cc.realtime ? 'BẬT' : 'TẮT'}`;
    cc.realtimeBtn.classList.toggle('op-danger', cc.realtime);
    const img = new Image();
    img.onload = async () => {
      if (!cc.sourceCanvas) { cc.sourceCanvas = document.createElement('canvas'); cc.sourceCtx = cc.sourceCanvas.getContext('2d', { willReadFrequently: true }); }
      cc.sourceCanvas.width = img.width; cc.sourceCanvas.height = img.height;
      cc.sourceCtx.clearRect(0,0,img.width,img.height);
      cc.sourceCtx.drawImage(img, 0, 0);
      cc.sourceImageData = cc.sourceCtx.getImageData(0,0,img.width,img.height);
      if (!cc.processedCanvas) { cc.processedCanvas = document.createElement('canvas'); cc.processedCtx = cc.processedCanvas.getContext('2d'); }

      cc.backdrop.classList.add('show');
      cc.modal.classList.add('show');

      await processImage();
      cc.isStale = false;
      applyPreview();
      updateMeta();
    };
    img.src = overlay.imageBase64;
  }

  function closeCCModal() {
    if (!cc) return;
    cc.backdrop.classList.remove('show');
    cc.modal.classList.remove('show');
    cc.overlay = null;
    document.body.classList.remove('op-scroll-lock');
  }

  function weightedNearest(r, g, b, palette) {
    let best = null, bestDist = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const [pr, pg, pb] = palette[i];
      const rmean = (pr + r) / 2;
      const rdiff = pr - r;
      const gdiff = pg - g;
      const bdiff = pb - b;
      const x = (512 + rmean) * rdiff * rdiff >> 8;
      const y = 4 * gdiff * gdiff;
      const z = (767 - rmean) * bdiff * bdiff >> 8;
      const dist = Math.sqrt(x + y + z);
      if (dist < bestDist) { bestDist = dist; best = [pr, pg, pb]; }
    }
    return best || [0,0,0];
  }

  function getActivePalette() {
    const arr = [];
    cc.selectedFree.forEach(k => { const [r,g,b] = k.split(',').map(n => parseInt(n,10)); if (Number.isFinite(r)) arr.push([r,g,b]); });
    cc.selectedPaid.forEach(k => { const [r,g,b] = k.split(',').map(n => parseInt(n,10)); if (Number.isFinite(r)) arr.push([r,g,b]); });
    return arr;
  }

  async function processImage() {
    if (!cc.sourceImageData || cc.isProcessing) return;
    cc.isProcessing = true;

    cc.applyBtn.disabled = true;
    cc.recalcBtn.disabled = true;
    cc.meta.textContent = 'Calculando colores... por favor espera.';

    const w = cc.sourceImageData.width, h = cc.sourceImageData.height;
    const src = cc.sourceImageData.data;
    const out = new Uint8ClampedArray(src.length);
    const palette = getActivePalette();
    const counts = {};
    const colorCache = new Map();
    const CHUNK_SIZE = 150000;
    const totalPixels = src.length / 4;
    let pixelIndex = 0;

    await new Promise(resolve => {
        function processChunk() {
            const end = Math.min(pixelIndex + CHUNK_SIZE, totalPixels);

            for (let i = pixelIndex; i < end; i++) {
                const idx = i * 4;
                const r = src[idx], g = src[idx+1], b = src[idx+2], a = src[idx+3];

                if (a === 0) {
                    out[idx]=0; out[idx+1]=0; out[idx+2]=0; out[idx+3]=0;
                    continue;
                }

                const rawKey = (r << 16) | (g << 8) | b;
                let best = colorCache.get(rawKey);

                if (!best) {
                    best = palette.length ? weightedNearest(r, g, b, palette) : [r, g, b];
                    colorCache.set(rawKey, best);
                }

                out[idx]=best[0]; out[idx+1]=best[1]; out[idx+2]=best[2]; out[idx+3]=255;

                const key = `${best[0]},${best[1]},${best[2]}`;
                counts[key] = (counts[key] || 0) + 1;
            }

            pixelIndex = end;
            if (pixelIndex < totalPixels) {
                cc.meta.textContent = `Calculando colores... ${Math.floor((pixelIndex / totalPixels) * 100)}%`;
                setTimeout(processChunk, 0);
            } else {
                resolve();
            }
        }
        processChunk();
    });

    if (!cc.processedCanvas) {
        cc.processedCanvas = document.createElement('canvas');
        cc.processedCtx = cc.processedCanvas.getContext('2d');
    }
    cc.processedCanvas.width = w;
    cc.processedCanvas.height = h;
    const outImg = new ImageData(out, w, h);
    cc.processedCtx.putImageData(outImg, 0, 0);
    cc.lastColorCounts = counts;

    cc.applyBtn.disabled = false;
    cc.recalcBtn.disabled = false;
    cc.isProcessing = false;
  }

  function applyPreview() {
    const zoom = Number(cc.zoom) || 1.0;
    const srcCanvas = cc.processedCanvas;
    if (!srcCanvas) return;
    const pw = Math.max(1, Math.round(srcCanvas.width * zoom));
    const ph = Math.max(1, Math.round(srcCanvas.height * zoom));
    cc.previewCanvas.width = pw;
    cc.previewCanvas.height = ph;
    const ctx = cc.previewCtx;
    ctx.clearRect(0,0,pw,ph);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(srcCanvas, 0,0, srcCanvas.width, srcCanvas.height, 0,0, pw, ph);
    ctx.imageSmoothingEnabled = true;
  }

  function updateMeta() {
    if (!cc.sourceImageData) { cc.meta.textContent = ''; return; }
    const w = cc.sourceImageData.width, h = cc.sourceImageData.height;
    const colorsUsed = Object.keys(cc.lastColorCounts||{}).length;
    const status = cc.isStale ? 'đang chờ tính lại' : 'đã cập nhật';
    cc.meta.textContent = `Kích thước: ${w}×${h} | Thu phóng: ${cc.zoom.toFixed(2)}× | Số màu: ${colorsUsed} | Trạng thái: ${status}`;
  }

  function renderPaletteGrid() {
    cc.freeGrid.innerHTML = '';
    cc.paidGrid.innerHTML = '';
    for (const [r,g,b] of WPLACE_FREE) {
      const key = `${r},${g},${b}`;
      const cell = document.createElement('div');
      cell.className = 'op-cc-cell';
      cell.style.background = `rgb(${r},${g},${b})`;
      cell.title = WPLACE_NAMES[key] || key;
      cell.dataset.key = key;
      cell.dataset.type = 'free';
      if (cc.selectedFree.has(key)) cell.classList.add('active');
      cell.addEventListener('click', async () => {
        if (cc.selectedFree.has(key)) cc.selectedFree.delete(key); else cc.selectedFree.add(key);
        cell.classList.toggle('active', cc.selectedFree.has(key));
        config.ccFreeKeys = Array.from(cc.selectedFree); await saveConfig(['ccFreeKeys']);
        if (cc.realtime) { await processImage(); } else { cc.isStale = true; }
        applyPreview(); updateMeta(); updateMasterButtons();
      });
      cc.freeGrid.appendChild(cell);
    }
    for (const [r,g,b] of WPLACE_PAID) {
      const key = `${r},${g},${b}`;
      const cell = document.createElement('div');
      cell.className = 'op-cc-cell';
      cell.style.background = `rgb(${r},${g},${b})`;
      cell.title = WPLACE_NAMES[key] || key;
      cell.dataset.key = key;
      cell.dataset.type = 'paid';
      if (cc.selectedPaid.has(key)) cell.classList.add('active');
      cell.addEventListener('click', async () => {
        if (cc.selectedPaid.has(key)) cc.selectedPaid.delete(key); else cc.selectedPaid.add(key);
        cell.classList.toggle('active', cc.selectedPaid.has(key));
        config.ccPaidKeys = Array.from(cc.selectedPaid); await saveConfig(['ccPaidKeys']);
        if (cc.realtime) { await processImage(); } else { cc.isStale = true; }
        applyPreview(); updateMeta(); updateMasterButtons();
      });
      cc.paidGrid.appendChild(cell);
    }
    updateMasterButtons();
  }

  function updateMasterButtons() {
    cc.freeToggle.textContent = isAllFreeActive() ? 'Bỏ chọn tất cả' : 'Chọn tất cả';
    cc.paidToggle.textContent = isAllPaidActive() ? 'Bỏ chọn tất cả' : 'Chọn tất cả';
  }
  function isAllFreeActive() { return DEFAULT_FREE_KEYS.every(k => cc.selectedFree.has(k)); }
  function isAllPaidActive() {
    const allPaidKeys = WPLACE_PAID.map(([r,g,b]) => `${r},${g},${b}`);
    return allPaidKeys.every(k => cc.selectedPaid.has(k)) && allPaidKeys.length > 0;
  }
  function setAllActive(type, active) {
    if (type === 'free') {
      const keys = DEFAULT_FREE_KEYS;
      if (active) keys.forEach(k => cc.selectedFree.add(k)); else cc.selectedFree.clear();
      cc.freeGrid.querySelectorAll('.op-cc-cell').forEach(cell => cell.classList.toggle('active', active));
    } else {
      const keys = WPLACE_PAID.map(([r,g,b]) => `${r},${g},${b}`);
      if (active) keys.forEach(k => cc.selectedPaid.add(k)); else cc.selectedPaid.clear();
      cc.paidGrid.querySelectorAll('.op-cc-cell').forEach(cell => cell.classList.toggle('active', active));
    }
  }

  let rs = null;

  function buildRSModal() {
    const backdrop = document.createElement('div');
    backdrop.className = 'op-rs-backdrop';
    backdrop.id = 'op-rs-backdrop';
    document.body.appendChild(backdrop);

    const modal = document.createElement('div');
    modal.className = 'op-rs-modal op-modal';
    modal.id = 'op-rs-modal';

    modal.innerHTML = `
      <div class="op-rs-header" id="op-rs-header">
        <div class="op-rs-title">Đổi kích thước Overlay</div>
        <button class="op-rs-close" id="op-rs-close" title="Đóng">✕</button>
      </div>
      <div class="op-rs-body" style="padding: 15px;">
          <div class="op-rs-row" style="margin-bottom: 8px;">
            <label style="width:110px;">Gốc</label>
            <input type="text" class="op-input" id="op-rs-orig" disabled>
          </div>
          <div class="op-rs-row" style="margin-bottom: 8px;">
            <label style="width:110px;">Rộng</label>
            <input type="number" min="1" step="1" class="op-input" id="op-rs-w">
          </div>
          <div class="op-rs-row" style="margin-bottom: 8px;">
            <label style="width:110px;">Cao</label>
            <input type="number" min="1" step="1" class="op-input" id="op-rs-h">
          </div>
          <div class="op-rs-row" style="margin-bottom: 12px;">
            <input type="checkbox" id="op-rs-lock" checked>
            <label for="op-rs-lock">Khóa tỉ lệ khung hình</label>
          </div>
          <div class="op-rs-row" style="gap:6px; flex-wrap:wrap; margin-bottom: 12px;">
            <label style="width:110px;">Chỉnh tỉ lệ nhanh</label>
            <button class="op-button" id="op-rs-double">2x</button>
            <button class="op-button" id="op-rs-onex">1x</button>
            <button class="op-button" id="op-rs-half">0.5x</button>
            <button class="op-button" id="op-rs-third">0.33x</button>
          </div>
          <div class="op-rs-preview-wrap" style="height: 200px; display: flex; gap: 10px; background: var(--op-bg); border-radius: 8px; padding: 10px;">
              <div style="flex:1; display:flex; flex-direction:column; align-items:center;">
                  <span style="font-size:11px; color:var(--op-muted);">Gốc</span>
                  <canvas id="op-rs-sim-orig" style="max-width:100%; max-height:100%; object-fit:contain; image-rendering:pixelated;"></canvas>
              </div>
              <div style="flex:1; display:flex; flex-direction:column; align-items:center;">
                  <span style="font-size:11px; color:var(--op-muted);">Kết quả</span>
                  <canvas id="op-rs-sim-new" style="max-width:100%; max-height:100%; object-fit:contain; image-rendering:pixelated;"></canvas>
              </div>
          </div>
      </div>
      <div class="op-rs-footer">
        <div class="op-cc-ghost" id="op-rs-meta">Kích thước hợp lệ.</div>
        <div class="op-cc-actions">
          <button class="op-button" id="op-rs-apply">Áp dụng</button>
          <button class="op-button" id="op-rs-cancel">Hủy</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const els = {
      backdrop, modal,
      orig: modal.querySelector('#op-rs-orig'), w: modal.querySelector('#op-rs-w'), h: modal.querySelector('#op-rs-h'),
      lock: modal.querySelector('#op-rs-lock'),
      onex: modal.querySelector('#op-rs-onex'), half: modal.querySelector('#op-rs-half'),
      third: modal.querySelector('#op-rs-third'), double: modal.querySelector('#op-rs-double'),
      simOrig: modal.querySelector('#op-rs-sim-orig'), simNew: modal.querySelector('#op-rs-sim-new'),
      meta: modal.querySelector('#op-rs-meta'),
      applyBtn: modal.querySelector('#op-rs-apply'), cancelBtn: modal.querySelector('#op-rs-cancel'), closeBtn: modal.querySelector('#op-rs-close')
    };

    const ctxSimOrig = els.simOrig.getContext('2d', { willReadFrequently: true });
    const ctxSimNew = els.simNew.getContext('2d', { willReadFrequently: true });

    rs = { ...els, ov: null, img: null, origW: 0, origH: 0, updating: false };

    const syncMeta = () => {
      const W = parseInt(rs.w.value||'0',10), H = parseInt(rs.h.value||'0',10);
      const ok = Number.isFinite(W) && Number.isFinite(H) && W>0 && H>0;
      const limit = (W >= MAX_OVERLAY_DIM || H >= MAX_OVERLAY_DIM);
      rs.meta.textContent = ok ? (limit ? `Mục tiêu: ${W}×${H} (Giới hạn: < ${MAX_OVERLAY_DIM})` : `Mục tiêu: ${W}×${H} (OK)`) : 'Kích thước không hợp lệ.';
      rs.applyBtn.disabled = (!ok || limit);
    };

    const applyScale = (scale) => {
      const W = Math.max(1, Math.round(rs.origW * scale));
      rs.updating = true;
      rs.w.value = W;
      rs.h.value = rs.lock.checked ? Math.max(1, Math.round(W * rs.origH / rs.origW)) : Math.max(1, Math.round(rs.origH * scale));
      rs.updating = false;
      syncMeta(); drawPreviews();
    };

    const drawPreviews = () => {
      if (!rs.img) return;
      rs.simOrig.width = rs.origW; rs.simOrig.height = rs.origH;
      ctxSimOrig.clearRect(0,0,rs.origW,rs.origH);
      ctxSimOrig.drawImage(rs.img, 0, 0);

      const W = parseInt(rs.w.value||'0',10), H = parseInt(rs.h.value||'0',10);
      if (W>0 && H>0) {
        rs.simNew.width = W; rs.simNew.height = H;
        ctxSimNew.imageSmoothingEnabled = false;
        ctxSimNew.clearRect(0,0,W,H);
        ctxSimNew.drawImage(rs.img, 0, 0, rs.origW, rs.origH, 0, 0, W, H);
      }
    };

    rs.w.addEventListener('input', () => {
      if (rs.updating) return; rs.updating = true;
      const W = parseInt(rs.w.value||'0',10);
      if (rs.lock.checked && rs.origW>0 && rs.origH>0 && W>0) rs.h.value = Math.max(1, Math.round(W * rs.origH / rs.origW));
      rs.updating = false; syncMeta(); drawPreviews();
    });

    rs.h.addEventListener('input', () => {
      if (rs.updating) return; rs.updating = true;
      const H = parseInt(rs.h.value||'0',10);
      if (rs.lock.checked && rs.origW>0 && rs.origH>0 && H>0) rs.w.value = Math.max(1, Math.round(H * rs.origW / rs.origH));
      rs.updating = false; syncMeta(); drawPreviews();
    });

    rs.double.addEventListener('click', () => applyScale(2));
    rs.onex.addEventListener('click', () => applyScale(1));
    rs.half.addEventListener('click', () => applyScale(0.5));
    rs.third.addEventListener('click', () => applyScale(1/3));

    const close = () => closeRSModal();
    rs.cancelBtn.addEventListener('click', close); rs.closeBtn.addEventListener('click', close); backdrop.addEventListener('click', close);

    rs.applyBtn.addEventListener('click', async () => {
      if (!rs.ov) return;
      const W = parseInt(rs.w.value||'0',10), H = parseInt(rs.h.value||'0',10);
      if (W<=0 || H<=0 || W>=MAX_OVERLAY_DIM || H>=MAX_OVERLAY_DIM) { showToast('Kích thước không hợp lệ'); return; }
      try {
        await resizeOverlayImage(rs.ov, W, H);
        closeRSModal(); showToast(`Đã đổi kích thước thành ${W}×${H}.`);
      } catch (e) { showToast('Áp dụng thất bại.'); }
    });

    rs._drawPreviews = drawPreviews;
  }

  function openRSModal(overlay) {
    if (!rs) return;
    rs.ov = overlay;
    const img = new Image();
    img.onload = () => {
      rs.img = img; rs.origW = img.width; rs.origH = img.height;
      rs.orig.value = `${rs.origW}×${rs.origH}`;
      rs.w.value = String(rs.origW); rs.h.value = String(rs.origH);
      rs.lock.checked = true;
      document.body.classList.add('op-scroll-lock');
      rs.backdrop.classList.add('show');
      rs.modal.classList.add('show');
      rs._drawPreviews();
    };
    img.src = overlay.imageBase64;
  }

  function closeRSModal() {
    if (!rs) return;
    rs.backdrop.classList.remove('show');
    rs.modal.classList.remove('show');
    rs.ov = null; rs.img = null;
    document.body.classList.remove('op-scroll-lock');
  }

  async function resizeOverlayImage(ov, targetW, targetH) {
    const img = await loadImage(ov.imageBase64);
    const canvas = createHTMLCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0,0,targetW,targetH);
    ctx.drawImage(img, 0,0, img.width,img.height, 0,0, targetW,targetH);
    const id = ctx.getImageData(0,0,targetW,targetH);
    const data = id.data;
    for (let i=0;i<data.length;i+=4) {
      if (data[i+3] === 0) { data[i]=0; data[i+1]=0; data[i+2]=0; data[i+3]=0; }
      else { data[i+3] = 255; }
    }
    ctx.putImageData(id, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    ov.imageBase64 = dataUrl;
    ov.imageUrl = null;
    ov.isLocal = true;
    await saveConfig(['overlays']);
    clearOverlayCache();
    ensureHook();
    updateUI();
  }

function main() {
  loadConfig().then(() => {
    injectStyles();
    const onReady = () => {
        createUI();
        ensureHook();
        applyTheme();
        console.log("Overlay Pro: Script cargado.");
        if (config.isColorPanelVisible) {
            setTimeout(() => {
                updateOverlayProgress();
            }, 1500);
        }
    };
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
  });
}
main();
})();
