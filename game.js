(() => {
  'use strict';

  /* ============================================================
     DATA CATALOGS
  ============================================================ */
  const CHARACTERS = [
    { id: 'dino',   name: 'Dino',   img: 'assets/dino_full.png', locked: false, rare: false, speed: 0.55, style: 0.45 },
    { id: 'kitty',  name: 'Kitty',  img: 'assets/kitty.png',     locked: false, rare: false, speed: 0.65, style: 0.70 },
    { id: 'robbie', name: 'Robbie', img: 'assets/robbie.png',    locked: false, rare: false, speed: 0.50, style: 0.85 },
    { id: 'alien',  name: 'Alien',  img: 'assets/alien.png',     locked: true,  rare: true, cost: 500, speed: 0.85, style: 0.90 },
    { id: 'ghost',  name: 'Ghost',  img: 'assets/ghost.png',     locked: true,  rare: true, cost: 750, speed: 0.95, style: 1.00 },
  ];

  const WORLDS = [
    { id: 'desert',   name: 'Desert World',   img: 'assets/world_desert.png',   bg: 'assets/world_desert_bg.png', wideBg: true, locked: false, rare: false, level: 0.30, hardness: 0.30 },
    { id: 'night',    name: 'Night World',    img: 'assets/world_night.png',    bg: 'assets/world_night_bg.png', wideBg: true, locked: false, rare: false, level: 0.60, hardness: 0.55 },
    { id: 'japanese', name: 'Japanese World', img: 'assets/world_japanese.png', bg: 'assets/world_japanese_bg.png', wideBg: true, locked: true,  rare: true, cost: 600, level: 0.90, hardness: 0.85 },
  ];

  const OBSTACLES = [
    { id: 'cactus', name: 'Cactus', img: 'assets/cactus.png', locked: false, rare: false, type: 'ground' },
    { id: 'coffee', name: 'Coffee', img: 'assets/coffee.png', locked: false, rare: false, type: 'ground' },
    { id: 'docs',   name: 'Docs',   img: 'assets/docs.png',   locked: false, rare: false, type: 'air' },
    { id: 'skull',  name: 'Skull',  img: 'assets/skull.png',  locked: true,  rare: true, cost: 400, type: 'air' },
  ];

  /* ============================================================
     STATE
  ============================================================ */
  const STORAGE_KEY = 'swapDinoState_v1';

  function defaultState() {
    return {
      coins: 0,
      bestScore: 0,
      history: [],
      selectedCharacter: 'dino',
      selectedWorld: 'desert',
      enabledObstacles: ['cactus', 'coffee', 'docs'],
      unlockedCharacters: ['dino', 'kitty', 'robbie'],
      unlockedWorlds: ['desert', 'night'],
      unlockedObstacles: ['cactus', 'coffee', 'docs'],
      settings: {
        music: true, sfx: true, vibration: true,
        leftHand: false, tutorial: true, autoPause: true,
        pixelScale: 2, animations: true, hq: true,
        language: 'ENGLISH',
      },
    };
  }

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed, {
        settings: Object.assign(defaultState().settings, parsed.settings || {}),
      });
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function isUnlocked(kind, id) {
    if (kind === 'character') return state.unlockedCharacters.includes(id);
    if (kind === 'world') return state.unlockedWorlds.includes(id);
    if (kind === 'obstacle') return state.unlockedObstacles.includes(id);
    return false;
  }

  function getCatalog(kind) {
    return kind === 'character' ? CHARACTERS : kind === 'world' ? WORLDS : OBSTACLES;
  }

  function unlockItem(kind, id, cost) {
    if (state.coins < cost) {
      flashInsufficientCoins();
      return false;
    }
    state.coins -= cost;
    if (kind === 'character') state.unlockedCharacters.push(id);
    if (kind === 'world') state.unlockedWorlds.push(id);
    if (kind === 'obstacle') state.unlockedObstacles.push(id);
    saveState();
    SFX.unlock();
    return true;
  }

  function flashInsufficientCoins() {
    SFX.error();
    const chip = document.querySelector('.screen.active .coin-chip');
    if (!chip) return;
    chip.style.borderColor = 'var(--danger)';
    chip.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 250 });
    setTimeout(() => { chip.style.borderColor = ''; }, 400);
  }

  /* ============================================================
     SOUND FX (synthesized with Web Audio — no external files)
  ============================================================ */
  const SFX = (() => {
    let ctx = null;
    function ensureCtx() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    window.addEventListener('pointerdown', ensureCtx, { once: true });
    window.addEventListener('keydown', ensureCtx, { once: true });

    function tone(freq, dur, type, opts) {
      opts = opts || {};
      if (!state.settings.sfx) return;
      const c = ensureCtx();
      if (!c) return;
      const t0 = c.currentTime + (opts.delay || 0);
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t0);
      if (opts.sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.sweepTo), t0 + dur);
      const peak = opts.volume ?? 0.16;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    function notes(seq, type) {
      seq.forEach(([freq, dur, delay]) => tone(freq, dur, type, { delay, volume: 0.15 }));
    }

    function vibrate(pattern) {
      if (state.settings.vibration && navigator.vibrate) navigator.vibrate(pattern);
    }

    return {
      jump()    { tone(260, 0.11, 'square', { sweepTo: 640, volume: 0.15 }); vibrate(10); },
      duck()    { tone(140, 0.07, 'square', { sweepTo: 60, volume: 0.1 }); },
      coin()    { notes([[880, 0.06, 0], [1318, 0.09, 0.06]], 'triangle'); vibrate(8); },
      click()   { tone(560, 0.035, 'square', { volume: 0.07 }); },
      toggle()  { tone(440, 0.045, 'square', { sweepTo: 700, volume: 0.08 }); },
      unlock()  { notes([[520, 0.07, 0], [660, 0.07, 0.07], [880, 0.13, 0.14]], 'square'); vibrate([0, 15, 30, 15]); },
      error()   { tone(160, 0.16, 'sawtooth', { sweepTo: 90, volume: 0.13 }); vibrate([0, 25, 40, 25]); },
      pause()   { tone(440, 0.08, 'square', { sweepTo: 260, volume: 0.1 }); },
      resume()  { tone(260, 0.08, 'square', { sweepTo: 440, volume: 0.1 }); },
      start()   { notes([[330, 0.08, 0], [440, 0.08, 0.08], [660, 0.14, 0.16]], 'square'); },
      lose()    { tone(320, 0.45, 'sawtooth', { sweepTo: 60, volume: 0.17 }); vibrate([0, 40, 30, 60]); },
      fanfare() { notes([[523, 0.1, 0], [659, 0.1, 0.1], [784, 0.1, 0.2], [1046, 0.25, 0.3]], 'square'); },
    };
  })();

  /* ============================================================
     DOM / ROUTER
  ============================================================ */
  const screens = Array.from(document.querySelectorAll('.screen'));

  function showScreen(name) {
    screens.forEach(s => s.classList.toggle('active', s.dataset.screen === name));
    const activeTabName = name === 'home' ? 'scores' : name;
    document.querySelectorAll(`.screen[data-screen="${name}"] .nav-tab`).forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === activeTabName);
    });
    syncCoinDisplays();
    if (name === 'home') renderHome();
    if (name === 'customize') renderCustomize();
    if (name === 'characters') renderLibrary('character');
    if (name === 'worlds') renderLibrary('world');
    if (name === 'obstacles') renderObstacleLibrary();
    if (name === 'scores') renderScores();
    if (name === 'gameplay') {} // handled by startGame()
    window.scrollTo(0, 0);
  }

  function syncCoinDisplays() {
    document.querySelectorAll('.coins-echo, #home-coins').forEach(el => { el.textContent = state.coins; });
  }

  document.body.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-nav]');
    if (!navBtn) return;
    const target = navBtn.dataset.nav;
    if (navBtn.dataset.action === 'start-game') {
      SFX.start();
      showScreen('gameplay');
      startGame();
      return;
    }
    SFX.click();
    if (target === 'gameplay') { showScreen('gameplay'); return; }
    showScreen(target);
  });

  /* ============================================================
     HOME
  ============================================================ */
  function renderHome() {
    const char = CHARACTERS.find(c => c.id === state.selectedCharacter);
    document.getElementById('home-dino-img').src = char.img;
  }

  /* ============================================================
     CUSTOMIZE
  ============================================================ */
  function renderCustomize() {
    renderMiniRow('customize-characters', 'character', CHARACTERS, state.selectedCharacter, (id) => {
      selectSingle('character', id);
      renderCustomize();
    });
    renderMiniRow('customize-obstacles', 'obstacle', OBSTACLES, null, (id) => {
      toggleObstacle(id);
      renderCustomize();
    }, true);
    renderMiniRow('customize-worlds', 'world', WORLDS, state.selectedWorld, (id) => {
      selectSingle('world', id);
      renderCustomize();
    });
  }

  function renderMiniRow(containerId, kind, catalog, selectedId, onPick, multi) {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    catalog.forEach(item => {
      const unlocked = isUnlocked(kind, item.id) || !item.locked;
      const isSelected = multi ? state.enabledObstacles.includes(item.id) : selectedId === item.id;
      const card = document.createElement('div');
      card.className = 'mini-card' + (unlocked ? '' : ' locked') + (isSelected ? ' selected' : '');
      const thumbClass = kind === 'world' ? 'mini-thumb world-thumb' : (kind === 'obstacle' ? 'mini-thumb obstacle-thumb' : 'mini-thumb');
      card.innerHTML = `
        <div class="${thumbClass}">
          <img src="${item.img}" alt="${item.name}">
          ${!unlocked ? '<img class="lock-badge" src="assets/icon_lock.png" alt="locked">' : ''}
          ${isSelected ? '<span class="check-badge">&#10003;</span>' : ''}
        </div>
        <p class="mini-label">${item.name}</p>`;
      card.addEventListener('click', () => {
        if (!unlocked) {
          if (unlockItem(kind, item.id, item.cost)) onPick(item.id);
          else return;
        } else {
          SFX.click();
          onPick(item.id);
        }
      });
      el.appendChild(card);
    });
  }

  function selectSingle(kind, id) {
    if (kind === 'character') state.selectedCharacter = id;
    if (kind === 'world') state.selectedWorld = id;
    saveState();
  }

  function toggleObstacle(id) {
    const idx = state.enabledObstacles.indexOf(id);
    if (idx >= 0) {
      if (state.enabledObstacles.length > 1) state.enabledObstacles.splice(idx, 1);
    } else {
      state.enabledObstacles.push(id);
    }
    saveState();
  }

  /* ============================================================
     CHARACTER / WORLD LIBRARY (grid + selected panel)
  ============================================================ */
  let libraryFilter = { character: 'all', world: 'all' };
  let librarySearch = '';

  function renderLibrary(kind) {
    const catalog = getCatalog(kind);
    const gridEl = document.getElementById(kind === 'character' ? 'character-grid' : 'world-grid');
    const panelEl = document.getElementById(kind === 'character' ? 'character-selected-panel' : 'world-selected-panel');
    const selectedId = kind === 'character' ? state.selectedCharacter : state.selectedWorld;
    const filter = libraryFilter[kind];

    gridEl.innerHTML = '';
    catalog
      .filter(item => {
        const unlocked = isUnlocked(kind, item.id) || !item.locked;
        if (filter === 'unlocked' && !unlocked) return false;
        if (filter === 'locked' && unlocked) return false;
        if (filter === 'rare' && !item.rare) return false;
        if (kind === 'character' && librarySearch && !item.name.toLowerCase().includes(librarySearch)) return false;
        return true;
      })
      .forEach(item => {
        const unlocked = isUnlocked(kind, item.id) || !item.locked;
        const card = document.createElement('div');
        card.className = 'lib-card' + (unlocked ? '' : ' locked') + (selectedId === item.id ? ' selected' : '');
        card.innerHTML = `
          <div class="lib-card-frame">
            <img src="${item.img}" alt="${item.name}">
            ${!unlocked ? `<span class="locked-badge">${item.cost} &#9733;</span>` : ''}
          </div>
          <p class="lib-card-label">${item.name}</p>`;
        card.addEventListener('click', () => {
          if (!unlocked) {
            if (!unlockItem(kind, item.id, item.cost)) return;
          } else {
            SFX.click();
          }
          if (kind === 'character') state.selectedCharacter = item.id;
          if (kind === 'world') state.selectedWorld = item.id;
          saveState();
          renderLibrary(kind);
        });
        gridEl.appendChild(card);
      });

    const sel = catalog.find(c => c.id === selectedId);
    const statA = kind === 'character' ? 'SPEED' : 'LEVEL';
    const statB = kind === 'character' ? 'STYLE' : 'HARDNESS';
    const valA = kind === 'character' ? sel.speed : sel.level;
    const valB = kind === 'character' ? sel.style : sel.hardness;
    panelEl.innerHTML = `
      <div class="head-row">
        <div class="thumb${kind === 'world' ? ' world-thumb' : ''}"><img src="${sel.img}" alt="${sel.name}"></div>
        <div class="info">
          <p class="name">${sel.name}</p>
          <p class="tag">SELECTED ${kind === 'character' ? 'DINO' : 'WORLD'}</p>
        </div>
      </div>
      <div class="stats">
        <div class="stat-row"><span class="label">${statA}</span><div class="bar"><div class="bar-fill" style="width:${valA * 100}%"></div></div></div>
        <div class="stat-row"><span class="label">${statB}</span><div class="bar"><div class="bar-fill" style="width:${valB * 100}%"></div></div></div>
      </div>
      <button class="btn btn-primary full" id="equip-btn"><img class="btn-icon" src="assets/play.png" alt=""><span>EQUIP</span></button>`;
    panelEl.querySelector('#equip-btn').addEventListener('click', () => { SFX.click(); showScreen('home'); });
  }

  document.getElementById('character-search').addEventListener('input', (e) => {
    librarySearch = e.target.value.trim().toLowerCase();
    renderLibrary('character');
  });

  document.getElementById('character-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-tab');
    if (!btn) return;
    SFX.click();
    setFilterActive('character-filters', btn);
    libraryFilter.character = btn.dataset.filter;
    renderLibrary('character');
  });
  document.getElementById('world-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-tab');
    if (!btn) return;
    SFX.click();
    setFilterActive('world-filters', btn);
    libraryFilter.world = btn.dataset.filter;
    renderLibrary('world');
  });

  function setFilterActive(containerId, btn) {
    document.querySelectorAll(`#${containerId} .filter-tab`).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  /* ============================================================
     OBSTACLE LIBRARY
  ============================================================ */
  let obstacleFilter = 'all';
  let obstaclePreviewId = 'cactus';

  function renderObstacleLibrary() {
    const listEl = document.getElementById('obstacle-list');
    listEl.innerHTML = '';
    OBSTACLES
      .filter(item => {
        const unlocked = isUnlocked('obstacle', item.id) || !item.locked;
        if (obstacleFilter === 'unlocked' && !unlocked) return false;
        if (obstacleFilter === 'locked' && unlocked) return false;
        if (obstacleFilter === 'rare' && !item.rare) return false;
        return true;
      })
      .forEach(item => {
        const unlocked = isUnlocked('obstacle', item.id) || !item.locked;
        const enabled = state.enabledObstacles.includes(item.id);
        const row = document.createElement('div');
        row.className = 'obstacle-row' + (unlocked ? '' : ' locked') + (enabled ? ' selected' : '');
        row.innerHTML = `
          <img src="${item.img}" alt="${item.name}">
          <span class="name">${item.name}</span>
          <span class="rarity-badge">${unlocked ? (enabled ? 'ENABLED' : (item.rare ? 'RARE' : 'COMMON')) : item.cost + ' ★'}</span>`;
        row.addEventListener('click', () => {
          if (!unlocked) {
            if (!unlockItem('obstacle', item.id, item.cost)) return;
          } else {
            SFX.toggle();
          }
          toggleObstacle(item.id);
          obstaclePreviewId = item.id;
          renderObstacleLibrary();
        });
        listEl.appendChild(row);
      });

    const sel = OBSTACLES.find(o => o.id === obstaclePreviewId) || OBSTACLES[0];
    const panelEl = document.getElementById('obstacle-selected-panel');
    const enabled = state.enabledObstacles.includes(sel.id);
    panelEl.innerHTML = `
      <div class="head-row">
        <div class="thumb"><img src="${sel.img}" alt="${sel.name}"></div>
        <div class="info">
          <p class="name">${sel.name}</p>
          <p class="tag">${sel.type === 'air' ? 'DUCK TO AVOID' : 'JUMP TO AVOID'}</p>
        </div>
      </div>
      <button class="btn ${enabled ? 'btn-secondary' : 'btn-primary'} full" id="equip-obstacle-btn"><span>${enabled ? 'DISABLE' : 'ENABLE'}</span></button>`;
    panelEl.querySelector('#equip-obstacle-btn').addEventListener('click', () => {
      const unlocked = isUnlocked('obstacle', sel.id) || !sel.locked;
      if (!unlocked && !unlockItem('obstacle', sel.id, sel.cost)) return;
      SFX.toggle();
      toggleObstacle(sel.id);
      renderObstacleLibrary();
    });
  }

  document.getElementById('obstacle-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-tab');
    if (!btn) return;
    SFX.click();
    setFilterActive('obstacle-filters', btn);
    obstacleFilter = btn.dataset.filter;
    renderObstacleLibrary();
  });

  /* ============================================================
     SCORES
  ============================================================ */
  function renderScores() {
    document.getElementById('scores-best').textContent = state.bestScore;
    document.getElementById('scores-coins').textContent = state.coins;
    const listEl = document.getElementById('scores-history');
    listEl.innerHTML = '';
    if (state.history.length === 0) {
      listEl.innerHTML = '<p class="history-empty">No runs yet &mdash; play a game!</p>';
      return;
    }
    state.history.slice(0, 8).forEach(run => {
      const row = document.createElement('div');
      row.className = 'history-row';
      row.innerHTML = `<span>${run.score}</span><span class="h-date">${run.date}</span>`;
      listEl.appendChild(row);
    });
  }

  /* ============================================================
     SETTINGS
  ============================================================ */
  const settingsMap = {
    'opt-music': 'music', 'opt-sfx': 'sfx', 'opt-vibration': 'vibration',
    'opt-lefthand': 'leftHand', 'opt-tutorial': 'tutorial', 'opt-autopause': 'autoPause',
    'opt-animations': 'animations', 'opt-hq': 'hq',
  };
  Object.keys(settingsMap).forEach(id => {
    const input = document.getElementById(id);
    input.checked = state.settings[settingsMap[id]];
    input.addEventListener('change', () => {
      state.settings[settingsMap[id]] = input.checked;
      SFX.toggle();
      applySettingsSideEffects();
    });
  });
  document.getElementById('opt-pixelscale').value = state.settings.pixelScale;
  document.getElementById('opt-pixelscale').addEventListener('input', (e) => {
    state.settings.pixelScale = Number(e.target.value);
  });
  document.getElementById('opt-language').value = state.settings.language;
  document.getElementById('opt-language').addEventListener('change', (e) => {
    state.settings.language = e.target.value;
  });
  document.getElementById('save-settings-btn').addEventListener('click', () => {
    SFX.click();
    saveState();
    applySettingsSideEffects();
    showScreen('home');
  });

  function applySettingsSideEffects() {
    document.body.classList.toggle('no-animations', !state.settings.animations);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.settings.autoPause && gameLoopRunning && !game.paused && !game.over) {
      pauseGame();
    }
  });

  /* ============================================================
     GAMEPLAY ENGINE
  ============================================================ */
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const overlayPaused = document.getElementById('overlay-paused');
  const overlayGameOver = document.getElementById('overlay-gameover');

  let game = null;
  let gameLoopRunning = false;
  let rafId = null;
  let dinoImgCache = {};
  let obstacleImgCache = {};
  let worldImgCache = {};
  let starImg = new Image(); starImg.src = 'assets/icon_star.png';

  function getImg(cache, src) {
    if (!cache[src]) { const im = new Image(); im.src = src; cache[src] = im; }
    return cache[src];
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    game && (game.viewW = rect.width, game.viewH = rect.height, game.groundY = rect.height - 54);
  }
  window.addEventListener('resize', resizeCanvas);

  function startGame() {
    const rect = canvas.getBoundingClientRect();
    const character = CHARACTERS.find(c => c.id === state.selectedCharacter);
    const enabledObstacles = OBSTACLES.filter(o => state.enabledObstacles.includes(o.id));
    game = {
      viewW: rect.width || 402,
      viewH: rect.height || 620,
      groundY: (rect.height || 620) - 54,
      frame: 0,
      speed: 4.6,
      maxSpeedReached: false,
      startTime: performance.now(),
      running: true,
      paused: false,
      over: false,
      score: 0,
      runCoins: 0,
      spawnTimer: 70,
      obstacles: [],
      coinPickups: [],
      character,
      enabledObstacles: enabledObstacles.length ? enabledObstacles : OBSTACLES.slice(0, 1),
      dino: {
        x: 46, y: 0, vy: 0, w: 46, h: 54, standH: 54, duckH: 32,
        jumping: false, ducking: false,
      },
      dustParticles: [],
    };
    resizeCanvas();
    game.dino.y = game.groundY - game.dino.standH;

    overlayPaused.classList.add('hidden');
    overlayGameOver.classList.add('hidden');
    document.getElementById('hud-best').textContent = state.bestScore;
    document.getElementById('hud-run-coins').textContent = 0;

    if (!gameLoopRunning) {
      gameLoopRunning = true;
      rafId = requestAnimationFrame(loop);
    }
  }

  function jump() {
    if (!game || game.paused || game.over) return;
    if (!game.dino.jumping) {
      game.dino.jumping = true;
      game.dino.vy = -12.5;
      spawnDust(game.dino.x + game.dino.w / 2, game.groundY);
      SFX.jump();
    }
  }

  function setDuck(on) {
    if (!game || game.paused || game.over) return;
    const d = game.dino;
    if (d.jumping) { d.ducking = on; return; }
    if (on && !d.ducking) {
      d.ducking = true; d.h = d.duckH; d.y = game.groundY - d.duckH;
      SFX.duck();
    } else if (!on && d.ducking) {
      d.ducking = false; d.h = d.standH; d.y = game.groundY - d.standH;
    }
  }

  function spawnDust(x, y) {
    for (let i = 0; i < 5; i++) {
      game.dustParticles.push({ x: x + (Math.random() - 0.5) * 14, y, vx: (Math.random() - 0.5) * 1.5, vy: -Math.random() * 1.5, life: 20 });
    }
  }

  function spawnObstacle() {
    const pool = game.enabledObstacles;
    const def = pool[Math.floor(Math.random() * pool.length)];
    const isAir = def.type === 'air';
    const h = isAir ? 26 + Math.random() * 8 : 34 + Math.random() * 20;
    const w = h * 0.85;
    game.obstacles.push({
      def, w, h,
      x: game.viewW + 20,
      y: isAir ? game.groundY - game.dino.standH + 6 : game.groundY - h,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  function maybeSpawnCoin() {
    if (Math.random() < 0.012) {
      game.coinPickups.push({
        x: game.viewW + 20,
        y: game.groundY - 40 - Math.random() * 90,
        collected: false,
        t: Math.random() * Math.PI * 2,
      });
    }
  }

  function update(dt) {
    if (!game.running || game.paused || game.over) return;
    game.frame++;
    const maxSpeed = 11.5;
    game.speed = Math.min(maxSpeed, 4.6 + game.frame * 0.0022);
    if (game.speed >= maxSpeed) game.maxSpeedReached = true;

    const d = game.dino;
    if (d.jumping) {
      d.vy += 0.62;
      d.y += d.vy;
      const floor = game.groundY - (d.ducking ? d.duckH : d.standH);
      if (d.y >= floor) { d.y = floor; d.vy = 0; d.jumping = false; spawnDust(d.x + d.w / 2, game.groundY); }
    }

    game.spawnTimer -= 1;
    if (game.spawnTimer <= 0) {
      spawnObstacle();
      game.spawnTimer = Math.max(38, 78 - game.speed * 3 + Math.random() * 30);
    }
    maybeSpawnCoin();

    for (const o of game.obstacles) { o.x -= game.speed; o.wobble += 0.08; }
    game.obstacles = game.obstacles.filter(o => o.x + o.w > -10);

    for (const c of game.coinPickups) { c.x -= game.speed; c.t += 0.15; }
    game.coinPickups = game.coinPickups.filter(c => c.x > -20 && !c.collected);

    for (const o of game.obstacles) {
      if (rectsOverlap(d.x, d.y, d.w, d.h, o.x, o.y, o.w, o.h)) { endGame(); return; }
    }
    for (const c of game.coinPickups) {
      if (!c.collected && rectsOverlap(d.x, d.y, d.w, d.h, c.x - 10, c.y - 10, 20, 20)) {
        c.collected = true; game.runCoins += 5;
        document.getElementById('hud-run-coins').textContent = game.runCoins;
        SFX.coin();
      }
    }

    game.dustParticles.forEach(p => { p.x += p.vx - game.speed * 0.3; p.y += p.vy; p.life--; });
    game.dustParticles = game.dustParticles.filter(p => p.life > 0);

    game.score += game.speed * 0.08;
  }

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    const pad = 5;
    return ax + pad < bx + bw - pad && ax + aw - pad > bx + pad && ay + pad < by + bh - pad && ay + ah - pad > by + pad;
  }

  function drawBackground() {
    const w = game.viewW, h = game.viewH;
    const worldDef = WORLDS.find(x => x.id === state.selectedWorld);
    const img = getImg(worldImgCache, worldDef.bg || worldDef.img);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f6eedc';
    ctx.fillRect(0, 0, w, h);
    if (img.complete && img.naturalWidth) {
      if (worldDef.wideBg) {
        // wide, seamlessly-tileable landscape photo: scale to canvas height, scroll horizontally
        const ih = h + 20;
        const iw = img.naturalWidth * (ih / img.naturalHeight);
        const parallaxX = -(game.frame * game.speed * 0.12) % iw;
        for (let x = parallaxX - iw; x < w; x += iw) {
          ctx.drawImage(img, x, -10, iw, ih);
        }
      } else {
        const scale = Math.max(w / img.naturalWidth, (h - 40) / img.naturalHeight) * 1.35;
        const iw = img.naturalWidth * scale, ih = img.naturalHeight * scale;
        const parallaxX = -(game.frame * game.speed * 0.10) % iw;
        ctx.globalAlpha = 0.85;
        for (let x = parallaxX - iw; x < w; x += iw) {
          ctx.drawImage(img, x, -20, iw, ih);
        }
        ctx.globalAlpha = 1;
      }
    }
    // ground
    const groundH = h - game.groundY;
    ctx.fillStyle = 'rgba(46,42,38,0.08)';
    ctx.fillRect(0, game.groundY + 2, w, groundH);
    ctx.strokeStyle = '#2e2a26';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, game.groundY + 2); ctx.lineTo(w, game.groundY + 2); ctx.stroke();
    ctx.fillStyle = 'rgba(46,42,38,0.35)';
    const dashOffset = (game.frame * game.speed) % 26;
    for (let x = -dashOffset; x < w; x += 26) {
      ctx.fillRect(x, game.groundY + 10, 12, 3);
    }
  }

  function drawDino() {
    const d = game.dino;
    const img = getImg(dinoImgCache, game.character.img);
    if (!img.complete || !img.naturalWidth) return;
    ctx.save();
    const cx = d.x + d.w / 2;
    const cy = d.y + d.h;
    ctx.translate(cx, cy);
    let squashX = 1, squashY = 1, rot = 0;
    if (d.jumping) {
      rot = Math.max(-0.12, Math.min(0.18, -d.vy * 0.02));
      squashY = 1 + Math.max(-0.08, Math.min(0.08, -d.vy * 0.01));
    } else if (d.ducking) {
      squashY = 0.62; squashX = 1.18;
    } else {
      const cyc = Math.sin(game.frame * 0.35);
      squashY = 1 + cyc * 0.05;
      rot = cyc * 0.045;
    }
    ctx.rotate(rot);
    ctx.scale(squashX, squashY);
    const iw = d.w * 1.35, ih = d.h * 1.35;
    ctx.drawImage(img, -iw / 2, -ih, iw, ih);
    ctx.restore();
  }

  function drawObstacles() {
    for (const o of game.obstacles) {
      const img = getImg(obstacleImgCache, o.def.img);
      if (!img.complete || !img.naturalWidth) continue;
      const bob = o.def.type === 'air' ? Math.sin(o.wobble) * 4 : 0;
      ctx.drawImage(img, o.x, o.y + bob, o.w, o.h);
    }
  }

  function drawCoins() {
    for (const c of game.coinPickups) {
      if (c.collected) continue;
      const bob = Math.sin(c.t) * 5;
      ctx.drawImage(starImg, c.x - 10, c.y + bob - 10, 20, 20);
    }
  }

  function drawDust() {
    ctx.fillStyle = 'rgba(46,42,38,0.4)';
    for (const p of game.dustParticles) {
      ctx.globalAlpha = Math.max(0, p.life / 20);
      ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    drawBackground();
    drawDust();
    drawCoins();
    drawObstacles();
    drawDino();
  }

  function loop() {
    if (game) { update(); draw(); }
    rafId = requestAnimationFrame(loop);
  }

  function pauseGame() {
    if (!game || game.over) return;
    SFX.pause();
    game.paused = true;
    overlayPaused.classList.remove('hidden');
  }
  function resumeGame() {
    if (!game) return;
    SFX.resume();
    game.paused = false;
    overlayPaused.classList.add('hidden');
  }

  function endGame() {
    game.over = true;
    game.running = false;
    SFX.lose();
    const finalScore = Math.floor(game.score);
    const isNewBest = finalScore > state.bestScore;
    if (isNewBest) state.bestScore = finalScore;
    const coinsEarned = Math.floor(finalScore / 12) + game.runCoins;
    state.coins += coinsEarned;
    state.history.unshift({ score: finalScore, date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });
    state.history = state.history.slice(0, 20);
    saveState();

    document.getElementById('final-score').textContent = finalScore;
    document.getElementById('go-best').textContent = state.bestScore;
    document.getElementById('go-coins').textContent = '+' + coinsEarned;

    const survivedSec = (performance.now() - game.startTime) / 1000;
    const achievements = [
      { name: 'New Best!', icon: 'assets/Scores.png', earned: isNewBest },
      { name: 'Speed Run', icon: 'assets/icon_star.png', earned: game.maxSpeedReached },
      { name: 'Marathon', icon: 'assets/icon_check.png', earned: survivedSec >= 30 },
    ];
    const achRow = document.getElementById('achievement-row');
    achRow.innerHTML = achievements.map(a => `
      <div class="achievement-badge${a.earned ? '' : ' locked'}">
        <img src="${a.earned ? a.icon : 'assets/icon_lock.png'}" alt="">
        <span>${a.earned ? a.name : 'Locked'}</span>
      </div>`).join('');

    overlayGameOver.classList.remove('hidden');
    if (isNewBest) setTimeout(() => SFX.fanfare(), 400);
  }

  function restartRun() {
    SFX.start();
    overlayGameOver.classList.add('hidden');
    overlayPaused.classList.add('hidden');
    startGame();
  }

  /* input */
  document.getElementById('pause-btn').addEventListener('click', () => {
    if (!game) return;
    game.paused ? resumeGame() : pauseGame();
  });
  document.getElementById('resume-btn').addEventListener('click', resumeGame);
  document.getElementById('restart-btn').addEventListener('click', restartRun);
  document.getElementById('play-again-btn').addEventListener('click', restartRun);

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!game || game.paused) return;
    if (game.over) return;
    jump();
    canvas._downY = e.clientY;
    canvas._downTime = performance.now();
    canvas._holdTimer = setTimeout(() => setDuck(true), 140);
  });
  window.addEventListener('pointerup', () => {
    clearTimeout(canvas._holdTimer);
    setDuck(false);
  });

  window.addEventListener('keydown', (e) => {
    if (!document.getElementById('screen-gameplay').classList.contains('active')) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
    else if (e.code === 'ArrowDown') { e.preventDefault(); setDuck(true); }
    else if (e.code === 'Escape') { game && (game.paused ? resumeGame() : pauseGame()); }
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'ArrowDown') setDuck(false); });

  /* ============================================================
     INIT
  ============================================================ */
  applySettingsSideEffects();
  showScreen('home');
})();
