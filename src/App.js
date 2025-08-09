import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// 2048+ — Minimal, colorful, and calm. Dark/Light themes, refined header, pastel tiles, glassy modals.
// Mobile-friendly (touchAction: none), single-spawn, proper win/over logic, state persisted (cookie+localStorage).

// ---------- utils ----------
const rnd = (n) => Math.floor(Math.random() * n);
const uid = (() => { let i = 1; return () => i++; })();
const empty = (n) => Array.from({ length: n }, () => Array(n).fill(null));
const cloneTiles = (tiles) => tiles.map((t) => ({ ...t }));
const toBoard = (tiles, n) => { const b = empty(n); for (const t of tiles) b[t.r][t.c] = t; return b; };

function spawn(tiles, n, bias = 0.9) {
  const b = toBoard(tiles, n);
  const free = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!b[r][c]) free.push([r, c]);
  if (free.length === 0) return tiles;
  const [r, c] = free[rnd(free.length)];
  const v = Math.random() < bias ? 2 : 4;
  return [...tiles, { id: uid(), r, c, value: v }];
}

function slideLine(line, dir) {
  const n = line.length; const order = [...Array(n).keys()]; if (dir === +1) order.reverse();
  const locked = new Set(); let moved = false, gained = 0;
  for (const i of order) {
    const t = line[i]; if (!t) continue; let ni = i;
    while (true) {
      const j = ni + dir; if (j < 0 || j >= n) break;
      if (line[j] === null) { ni = j; continue; }
      if (!locked.has(j) && line[j] && line[j].value === t.value) { ni = j; }
      break;
    }
    if (ni !== i) {
      if (line[ni] && line[ni].value === t.value && !locked.has(ni)) {
        const newVal = line[ni].value * 2;
        line[ni] = { ...line[ni], value: newVal, bump: true };
        line[i] = null; t.dead = true; locked.add(ni); moved = true; gained += newVal;
      } else { line[ni] = t; line[i] = null; moved = true; }
    }
  }
  return { line, moved, gained };
}

function move(tiles, n, dir) {
  const b = toBoard(cloneTiles(tiles), n);
  let moved = false, gained = 0;
  if (dir === 'L' || dir === 'R') {
    for (let r = 0; r < n; r++) {
      const line = b[r].slice();
      const res = slideLine(line, dir === 'L' ? -1 : +1);
      b[r] = res.line; moved = moved || res.moved; gained += res.gained;
      for (let c = 0; c < n; c++) if (b[r][c]) { b[r][c].r = r; b[r][c].c = c; }
    }
  } else {
    for (let c = 0; c < n; c++) {
      const col = Array.from({ length: n }, (_, r) => b[r][c]);
      const res = slideLine(col, dir === 'U' ? -1 : +1);
      for (let r = 0; r < n; r++) { b[r][c] = res.line[r]; if (b[r][c]) { b[r][c].r = r; b[r][c].c = c; } }
      moved = moved || res.moved; gained += res.gained;
    }
  }
  const next = []; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (b[r][c]) next.push(b[r][c]);
  return { tiles: next.filter(t => !t.dead), moved, gained };
}

const anyMovesLeft = (board) => {
  const n = board.length;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const t = board[r][c]; if (!t) return true;
    if (r + 1 < n && board[r + 1][c] && board[r + 1][c].value === t.value) return true;
    if (c + 1 < n && board[r][c + 1] && board[r][c + 1].value === t.value) return true;
  }
  return false;
};

// ---------- persistence (cookies + localStorage) ----------
const STORE_KEY = 'g2048_state_v1';
const saveCookie = (obj) => { try { document.cookie = `${STORE_KEY}=${encodeURIComponent(JSON.stringify(obj))}; max-age=31536000; path=/`; } catch { } };
const loadCookie  = () => { try { const m = document.cookie.match(new RegExp(`${STORE_KEY}=([^;]+)`)); return m ? JSON.parse(decodeURIComponent(m[1])) : null; } catch { return null; } };
const saveLocal   = (obj) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch { } };
const loadLocal   = () => { try { const s = localStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : null; } catch { return null; } };
const persist     = (obj) => { saveLocal(obj); saveCookie(obj); };
const loadPersist = () => loadLocal() || loadCookie();

// ---------- theming & visuals ----------
const palettes = {
  light: {
    bg: "bg-[radial-gradient(80%_60%_at_50%_0%,#f7faff_0%,#eef2ff_40%,#e9eefc_100%)] text-zinc-900",
    surface: "bg-white/80 border-zinc-300",
    subtle: "bg-white/60 border-zinc-200",
    glass: "bg-white/70 backdrop-blur border-zinc-200",
    track: "bg-zinc-200 border-zinc-300",
  },
  dark: {
    bg: "bg-[radial-gradient(80%_60%_at_50%_0%,#0c1024_0%,#0b1120_40%,#0a0f1a_100%)] text-white",
    surface: "bg-white/5 border-white/10",
    subtle: "bg-white/7 border-white/10",
    glass: "bg-black/40 backdrop-blur-xl border-white/10",
    track: "bg-black/30 border-white/10",
  }
};

const tileStyle = (v, theme) => {
  // calm pastel gradient swatches per value
  const base = theme === 'light'
    ? {
        2:  "from-[#D9FBFF] to-[#CFE8FF] text-zinc-800",
        4:  "from-[#E7F9D9] to-[#CFF6C8] text-zinc-800",
        8:  "from-[#FFE6C7] to-[#FFD6A5] text-zinc-900",
        16: "from-[#FFD2E1] to-[#FFC2DD] text-zinc-900",
        32: "from-[#FFD9D6] to-[#FFB4A2] text-zinc-900",
        64: "from-[#F9D3FF] to-[#E5B8FF] text-zinc-900",
        128:"from-[#D7F3FF] to-[#A5E4FF] text-zinc-900",
        256:"from-[#D7FFF1] to-[#B2F7EF] text-zinc-900",
        512:"from-[#E5F0FF] to-[#C4D7FF] text-zinc-900",
        1024:"from-[#E6E1FF] to-[#CDBAFF] text-zinc-900",
        2048:"from-[#FFECC7] to-[#FFD36E] text-zinc-900",
      }
    : {
        2:  "from-[#243b55] to-[#141e30] text-white",
        4:  "from-[#0f2027] to-[#203a43] text-white",
        8:  "from-[#42275a] to-[#734b6d] text-white",
        16: "from-[#283c86] to-[#45a247] text-white",
        32: "from-[#614385] to-[#516395] text-white",
        64: "from-[#457fca] to-[#5691c8] text-white",
        128:"from-[#3a1c71] to-[#d76d77] text-white",
        256:"from-[#36d1dc] to-[#5b86e5] text-white",
        512:"from-[#00b09b] to-[#96c93d] text-white",
        1024:"from-[#f7971e] to-[#ffd200] text-white",
        2048:"from-[#d53369] to-[#daae51] text-white",
      };
  const sw = base[v] || base[2048];
  return `bg-gradient-to-br ${sw}`;
};

const fontSizeFor = (v) => (v < 128 ? '32px' : v < 1024 ? '34px' : v < 2048 ? '32px' : v < 4096 ? '28px' : '26px');

export default function Game2048() {
  const [n, setN] = useState(4);
  const [bias] = useState(0.9);
  const [tiles, setTiles] = useState(() => spawn(spawn([], n, bias), n, bias));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [win, setWin] = useState(false);
  const [keptGoing, setKeptGoing] = useState(false);
  const [theme, setTheme] = useState('dark');

  const wrapRef = useRef(null);
  const [cell, setCell] = useState(96);
  const GAP = 12;

  // mobile-friendly resize
  useLayoutEffect(() => {
    function measure() {
      const el = wrapRef.current; if (!el) return;
      const size = Math.min(el.clientWidth, 620);
      setCell(Math.max(56, Math.floor((size - GAP * (n + 1)) / n)));
    }
    measure();
    const ro = new ResizeObserver(measure); ro.observe(document.body);
    return () => ro.disconnect();
  }, [n]);

  const board = useMemo(() => toBoard(tiles, n), [tiles, n]);

  function reset(nn = n) {
    setN(nn); setScore(0); setOver(false); setWin(false); setBusy(false); setKeptGoing(false);
    const start = spawn(spawn([], nn, bias), nn, bias);
    setTiles(start);
    persist({ n: nn, tiles: start, score: 0, best, theme, keptGoing: false });
  }

  function step(dir) {
    if (busy || over) return;
    setBusy(true);
    const res = move(tiles, n, dir);
    if (!res.moved) {
      if (!anyMovesLeft(board)) setOver(true);
      setBusy(false); return;
    }
    setTiles(res.tiles);
    const gained = res.gained;
    setTimeout(() => {
      setTiles((t) => {
        const after = spawn(t, n, bias);
        const nextScore = score + gained;
        const nextBest = Math.max(best, nextScore);
        persist({ n, tiles: after, score: nextScore, best: nextBest, theme, keptGoing });
        return after;
      });
      setScore((s) => { const ns = s + gained; setBest((b) => Math.max(b, ns)); return ns; });
      const maxNow = Math.max(...res.tiles.map((t) => t.value));
      if (maxNow >= 2048 && !keptGoing) setWin(true);
      if (!anyMovesLeft(toBoard(res.tiles, n))) setOver(true);
      setBusy(false);
    }, 140);
  }

  // load persisted once
  useEffect(() => {
    const saved = loadPersist();
    if (saved && saved.tiles && Array.isArray(saved.tiles)) {
      if (typeof saved.n === 'number') setN(saved.n);
      if (saved.theme) setTheme(saved.theme);
      if (typeof saved.best === 'number') setBest(saved.best);
      if (typeof saved.score === 'number') setScore(saved.score);
      if (typeof saved.keptGoing === 'boolean') setKeptGoing(saved.keptGoing);
      setTiles(saved.tiles);
    }
  }, []);

  // persist prefs & non-volatile state
  useEffect(() => { 
    persist({ n, tiles, score, best, theme, keptGoing }); 
  }, [n, tiles, score, best, theme, keptGoing]);

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","a","d","w","s"].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowLeft' || e.key === 'a') step('L');
      if (e.key === 'ArrowRight' || e.key === 'd') step('R');
      if (e.key === 'ArrowUp' || e.key === 'w') step('U');
      if (e.key === 'ArrowDown' || e.key === 's') step('D');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tiles, n, busy, over, keptGoing, step]);

  // touch: keep page from scrolling when swiping inside board
  const swipe = useRef({ x: 0, y: 0 });
  const onTouchStart = (e) => { const t = e.touches[0]; swipe.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e) => { const t = e.changedTouches[0]; const dx = t.clientX - swipe.current.x; const dy = t.clientY - swipe.current.y; if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return; step(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U')); };

  const isDark = theme === 'dark';
  const pal = isDark ? palettes.dark : palettes.light;
  const appTheme = pal.bg;
  const sizePx = cell * n + GAP * (n + 1);
  const maxTile = Math.max(0, ...tiles.map((t) => t.value));

  // ---- Header (compact, balanced) ----
  const SizeSegment = () => (
    <div className={`rounded-full border px-1 py-1 flex gap-1 ${pal.surface}`}>
      {[4,5].map((s) => (
        <button key={s} onClick={() => reset(s)} className={`min-h-10 px-3 rounded-full text-sm transition font-medium ${n===s ? (isDark? 'bg-emerald-600 text-white shadow-sm':'bg-emerald-500 text-white shadow-sm') : 'hover:bg-white/10'}`}>
          {s}×{s}
        </button>
      ))}
    </div>
  );

  const ThemeToggle = () => {
    const TRACK_W = 96, KNOB_W = 52, PADDING = 4;
    const x = isDark ? 0 : TRACK_W - KNOB_W - PADDING*2;
    return (
      <button aria-pressed={isDark} title="Toggle theme" onClick={() => setTheme((t)=>t==='dark'?'light':'dark')} className={`relative w-24 h-10 rounded-full border overflow-hidden ${pal.track}`}>
        <motion.div key={theme} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.25 }} className={`absolute inset-0 ${isDark? 'bg-gradient-to-r from-zinc-900/40 to-zinc-700/40':'bg-gradient-to-r from-amber-200/50 to-orange-200/50'}`} />
        <div className="absolute inset-0 pointer-events-none grid grid-cols-2 place-items-center text-sm z-10">
          <span className={`${isDark ? 'opacity-100' : 'opacity-60'}`}>🌙</span>
          <span className={`${!isDark ? 'opacity-100' : 'opacity-60'}`}>☀️</span>
        </div>
        <motion.div aria-hidden className={`absolute top-1 h-8 rounded-full shadow-md z-20 ${isDark?'bg-zinc-800':'bg-amber-300'}`} style={{ width: KNOB_W, left: PADDING }} animate={{ x }} transition={{ type:'spring', stiffness:320, damping:28 }} />
      </button>
    );
  };

  return (
    <div className={`min-h-screen ${appTheme} p-4 sm:p-6`}>
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">2048+</h1>
            <p className="text-xs sm:text-sm opacity-80">Minimal • Colorful • Smooth</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <SizeSegment />
            <ThemeToggle />
            <button onClick={() => reset(n)} className="min-h-10 px-4 rounded-full text-sm font-semibold bg-gradient-to-tr from-emerald-500 to-emerald-400 text-white shadow hover:brightness-110">New Game</button>
          </div>
        </div>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-2 mb-3 sm:mb-4">
          <Stat label="Score" value={score} theme={theme} />
          <Stat label="Best" value={best} theme={theme} />
          <Stat label="Max" value={maxTile} theme={theme} />
        </section>

        {/* Board */}
        <div
          ref={wrapRef}
          className="select-none"
          style={{ touchAction: 'none' }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className={`relative mx-auto rounded-3xl border p-[12px] ${pal.glass}`} style={{ width: sizePx, height: sizePx }}>
            <div className="absolute inset-0 p-[12px] grid gap-2" style={{ gridTemplateColumns: `repeat(${n},1fr)`, gridTemplateRows: `repeat(${n},1fr)` }}>
              {Array.from({ length: n * n }).map((_, i) => (
                <div key={i} className={`rounded-2xl border ${pal.subtle}`} />
              ))}
            </div>
            <AnimatePresence initial={false}>
              {tiles.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ scale: 0.75, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1, x: t.c * (cell + GAP), y: t.r * (cell + GAP) }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                  className={`absolute rounded-2xl font-black flex items-center justify-center shadow-lg border border-white/10 ${tileStyle(t.value, theme)}`}
                  style={{ width: cell, height: cell }}
                >
                  <motion.span animate={t.bump ? { scale: [1, 1.18, 1] } : {}} transition={{ duration: 0.18 }} style={{ fontSize: fontSizeFor(t.value), textShadow: '0 1px 0 rgba(0,0,0,.15)' }}>{t.value}</motion.span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Controls (compact) */}
        <div className="mt-4 flex gap-2 justify-center">
          {['U','L','D','R'].map((k) => (
            <button key={k} onClick={() => step(k)} disabled={busy} className={`min-h-10 px-4 rounded-full border ${pal.surface} disabled:opacity-50`}>{ { U:'↑', L:'←', D:'↓', R:'→' }[k] }</button>
          ))}
        </div>

        {/* Modals */}
        <AnimatePresence>
          {(over || win) && (
            <motion.div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }} className={`relative max-w-sm w-full rounded-3xl p-6 shadow-2xl ${pal.glass}`}>
                <motion.div className={`absolute -top-8 -right-8 h-24 w-24 rounded-full ${win ? 'bg-emerald-400/25' : 'bg-rose-400/25'}`} animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.9, 0.5] }} transition={{ repeat: Infinity, duration: 2.4 }} />
                <div className="flex items-center gap-3 mb-3">
                  <div className={`h-11 w-11 rounded-2xl flex items-center justify-center text-2xl ${win ? 'bg-emerald-500/20 border border-emerald-400/40' : 'bg-rose-500/20 border border-rose-400/40'}`}>{win ? '🏆' : '💀'}</div>
                  <div>
                    <h2 className="text-xl font-bold">{win ? 'You Win!' : 'Game Over'}</h2>
                    <p className="text-xs opacity-80">Score <b>{score}</b> • Best <b>{best}</b></p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button onClick={() => reset(n)} className="min-h-10 px-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white">{win ? 'Play Again' : 'Try Again'}</button>
                  {win && (
                    <button onClick={() => { setWin(false); setKeptGoing(true); persist({ n, tiles, score, best, theme, keptGoing: true }); }} className={`min-h-10 px-4 rounded-full border ${pal.surface}`}>Keep Going</button>
                  )}
                  <button onClick={() => { setOver(false); setWin(false); }} className={`min-h-10 px-4 rounded-full border ${pal.surface}`}>Close</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Stat({ label, value, theme }) {
  const isDark = theme === 'dark';
  const frame = isDark ? 'from-white/10 to-transparent border-white/10' : 'from-zinc-200 to-transparent border-zinc-300';
  return (
    <div className={`rounded-2xl px-3 py-2 border bg-gradient-to-b ${frame}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
