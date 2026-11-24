/* Plan 3D : transforme un plan vertical (syllabus) en arbre horizontal en relief.
   Rendu en CSS 3D (perspective + preserve-3d) : le texte reste net et lisible.
   L'API permet aux missions de piloter le plan : caméra, marquages, liens à découvrir. */
(function () {
  'use strict';

  const DEFAULT_LEVELS = ['', 'Chapitre', 'Grande partie', 'Sous-partie', 'Point', 'Subdivision'];
  let LEVEL_NAMES = DEFAULT_LEVELS;
  const tok = n => n.tok || n.num;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clean = n => String(n).replace(/[)\s]/g, '');

  function maxDepth(node, level) {
    let m = level;
    (node.children || []).forEach(c => { m = Math.max(m, maxDepth(c, level + 1)); });
    if (node.points) {
      m = Math.max(m, level + 1);
      if (node.points.some(p => p.sub)) m = Math.max(m, level + 2);
    }
    return m;
  }

  function cardHTML(node, level, code) {
    let h = `<div class="pcard lvl${level}" data-code="${code}" tabindex="0" role="button"
      aria-label="${LEVEL_NAMES[level]} ${node.num} : ${node.title.replace(/"/g, '&quot;')}">
      <span class="pc-check" aria-hidden="true">✓</span>
      <span class="pc-level">${LEVEL_NAMES[level]}</span>
      <span class="pc-head"><span class="pc-num">${node.num}</span><span class="pc-title">${node.title}</span></span>`;
    if (node.points) {
      h += `<ol class="pc-points">` + node.points.map(p => {
        const pc = code + '.' + clean(p.num);
        return `<li class="pp" data-code="${pc}"><span class="pp-num">${p.num}</span> <span>${p.t}</span>` +
          (p.sub ? `<ul class="pc-sub">${p.sub.map(s => `<li class="pp" data-code="${pc}.${clean(s.num)}"><span class="pp-num">${s.num}</span> ${s.t}</li>`).join('')}</ul>` : '') +
          `</li>`;
      }).join('') + `</ol>`;
    }
    return h + `</div>`;
  }

  function nodeHTML(node, level, code, branch) {
    let h = cardHTML(node, level, code);
    if (node.children && node.children.length) {
      h += `<ul class="pt-ul" data-level="${level + 1}">` + node.children.map((c, i) => {
        const cc = code ? code + '.' + tok(c) : tok(c);
        const br = level === 1 ? i : branch;
        const chip = (node.links && i < node.children.length - 1)
          ? `<button class="link-chip" data-parent="${code}" data-i="${i}" type="button"><span class="lc-t">${node.links[i]}</span><span class="arr" aria-hidden="true">→</span></button>` : '';
        return `<li class="br${br}" data-code="${cc}">${nodeHTML(c, level + 1, cc, br)}${chip}</li>`;
      }).join('') + `</ul>`;
    }
    return h;
  }

  function verticalHTML(ch) {
    const out = [`<p class="v-l1">${ch.num}. ${ch.title.toUpperCase()}</p>`];
    (ch.children || []).forEach(p => {
      out.push(`<p class="v-l2">${p.num} – ${p.title}</p>`);
      (p.children || []).forEach(s => {
        out.push(`<p class="v-l3">${s.num} - ${s.title}</p>`);
        (s.points || []).forEach(pt => {
          out.push(`<p class="v-l4">${pt.num} ${pt.t}</p>`);
          (pt.sub || []).forEach(sb => out.push(`<p class="v-l5">${sb.num} ${sb.t}</p>`));
        });
      });
    });
    return out.join('');
  }

  /** Retrouve un nœud du plan à partir de son code (« », « I », « I.A », « I.A.1 », « II.B.2.c »). */
  function findNode(ch, code) {
    if (!code) return { node: ch, level: 1, trail: [ch] };
    const parts = code.split('.');
    let n = ch, trail = [ch];
    for (let k = 0; k < parts.length; k++) {
      if (n.children) {
        const c = n.children.find(x => tok(x) === parts[k]);
        if (!c) return null;
        n = c; trail.push(c);
      } else if (n.points) {
        const p = n.points.find(x => clean(x.num) === parts[k]);
        if (!p) return null;
        let res = { node: { num: p.num, title: p.t }, level: k + 2, trail: trail.concat({ num: p.num, title: p.t }) };
        if (parts[k + 1] && p.sub) {
          const s = p.sub.find(x => clean(x.num) === parts[k + 1]);
          if (s) res = { node: { num: s.num, title: s.t }, level: k + 3, trail: res.trail.concat({ num: s.num, title: s.t }) };
        }
        return res;
      }
    }
    return { node: n, level: parts.length + 1, trail };
  }

  /**
   * Plan3D(container, chapitres, options)
   * chapitres : [{key, data}]
   * options : { start:'vertical'|'horizontal', links:'none'|'visible'|'quiz', sens:'cache'|'visible',
   *             onCard(code, info) → true si l'action est consommée, onChip(parent, i, key), onChapter(key), onView(view), onLevel(n) }
   */
  function Plan3D(container, chapitres, opts) {
    opts = Object.assign({ start: 'vertical', links: 'none', sens: 'cache' }, opts || {});
    LEVEL_NAMES = opts.levels || DEFAULT_LEVELS;
    const BASE = { rx: 14, ry: -3 };
    const state = { idx: 0, rx: BASE.rx, ry: BASE.ry, zoom: 1, panX: 0, panY: 0, level: 1, max: 1, view: opts.start, mode: 'rotate' };
    const marks = {};   // marks[key][code] = Set(classes)
    const chips = {};   // chips[key]['parent|i'] = label

    container.classList.add('plan3d');
    container.innerHTML = `
      ${chapitres.length > 1 ? `<div class="p3-tabs" role="tablist">${chapitres.map((c, i) =>
        `<button role="tab" class="p3-tab" data-i="${i}"><span class="p3-tab-n">${c.data.etiquette || 'Chapitre ' + c.data.num}</span><small>${c.data.title}</small></button>`).join('')}</div>` : ''}
      <div class="p3-stage">
        <div class="p3-vertical" aria-label="Plan vertical, tel que dans le syllabus">
          <div class="p3-paper"><div class="p3-paper-head">Le plan tel qu’il apparaît dans le syllabus : une liste verticale</div><div class="p3-vlist"></div></div>
          <button class="btn primary big p3-go">Passer à la lecture horizontale <span aria-hidden="true">⤵</span></button>
        </div>
        <div class="p3-horizontal">
          <div class="p3-toolbar">
            <div class="p3-levels" role="group" aria-label="Descendre dans le plan"></div>
            <div class="p3-views">
              ${opts.links === 'visible' ? `<label class="p3-switch"><input type="checkbox" class="p3-links" checked> Liens</label>` : ''}
              <button class="btn ghost sm p3-play" title="Déployer le plan niveau par niveau">▶ Déployer</button>
              <button class="btn ghost sm p3-persp" title="Vue d’ensemble en relief">Vue d’ensemble</button>
              <button class="btn ghost sm p3-face" title="Vue de face">Face</button>
              <button class="btn ghost sm p3-mode" title="Basculer entre pivoter et déplacer">✥ Déplacer</button>
              <button class="btn ghost sm p3-zout" aria-label="Dézoomer">−</button>
              <button class="btn ghost sm p3-zin" aria-label="Zoomer">+</button>
              ${opts.start === 'vertical' ? `<button class="btn ghost sm p3-back" title="Revoir le plan vertical">↺ Vertical</button>` : ''}
            </div>
          </div>
          <div class="p3-scene" aria-label="Plan horizontal en relief. Faites glisser pour pivoter.">
            <div class="p3-floor"></div>
            <div class="p3-world"><div class="p3-tree"></div></div>
            <div class="p3-toast" aria-live="polite"></div>
          </div>
          <div class="p3-panel" aria-live="polite"></div>
        </div>
      </div>`;

    const $ = s => container.querySelector(s);
    const scene = $('.p3-scene'), world = $('.p3-world'), treeEl = $('.p3-tree'), panel = $('.p3-panel'), toast = $('.p3-toast');
    let fit = 1;
    const key = () => chapitres[state.idx].key;

    function applyTransform(instant) {
      world.style.transition = instant || reduceMotion ? 'none' : '';
      const s = fit * state.zoom;
      world.style.transform = `translateX(-50%) translate3d(${state.panX}px, ${state.panY}px, 0) scale(${s}) rotateX(${state.rx}deg) rotateY(${state.ry}deg)`;
      updateHeight();
    }
    function updateHeight() {
      const h = treeEl.offsetHeight * fit * 1.1;
      scene.style.height = Math.max(360, Math.min(h + 90, 820)) + 'px';
    }
    function computeFit() {
      const w = treeEl.offsetWidth || 1;
      fit = Math.min(1, (scene.clientWidth - 40) / w);
      if (opts.fitHeight) {
        const mh = Math.max(380, window.innerHeight * 0.64);
        fit = Math.min(fit, (mh - 90) / ((treeEl.offsetHeight || 1) * 1.12));
      }
    }
    function resetCamera(instant) {
      Object.assign(state, { rx: BASE.rx, ry: BASE.ry, panX: 0, panY: 0, zoom: 1 });
      applyTransform(instant);
    }

    function setLevel(n) {
      state.level = Math.max(1, Math.min(state.max, n));
      treeEl.querySelectorAll('.pt-ul').forEach(ul => ul.classList.toggle('folded', +ul.dataset.level > state.level));
      treeEl.classList.toggle('pts-folded', state.level < 4);
      treeEl.classList.toggle('sub-folded', state.level < 5);
      container.querySelectorAll('.p3-lv').forEach(b => {
        const v = +b.dataset.l;
        b.classList.toggle('on', v <= state.level);
        b.setAttribute('aria-pressed', v === state.level);
      });
      clearTimeout(setLevel.t);
      setLevel.t = setTimeout(() => { if (opts.fitHeight) { computeFit(); applyTransform(); } else updateHeight(); }, 700);
      if (opts.onLevel) opts.onLevel(state.level, state.max);
    }
    function renderLevels() {
      const box = $('.p3-levels');
      let h = '<span class="p3-lv-label">Niveau</span>';
      for (let l = 1; l <= state.max; l++) h += `<button class="p3-lv" data-l="${l}" title="${LEVEL_NAMES[l]}">${l}<small>${LEVEL_NAMES[l]}</small></button>`;
      box.innerHTML = h;
      box.querySelectorAll('.p3-lv').forEach(b => b.addEventListener('click', () => setLevel(+b.dataset.l)));
    }

    const elOf = code => treeEl.querySelector(`.pcard[data-code="${code}"]`) || treeEl.querySelector(`.pp[data-code="${code}"]`);
    const cardOf = code => {
      const el = elOf(code);
      return el ? (el.classList.contains('pcard') ? el : el.closest('.pcard')) : null;
    };

    function clearFocus() {
      treeEl.classList.remove('has-focus');
      treeEl.querySelectorAll('.focused, .on-path, .pp-focus').forEach(e => e.classList.remove('focused', 'on-path', 'pp-focus'));
      panel.innerHTML = '';
      panel.classList.remove('open');
    }

    function showPanel(code) {
      const f = findNode(chapitres[state.idx].data, code);
      if (!f) return;
      const { node, level, trail } = f;
      const ariane = trail.map(t => `<span>${t.num}</span>`).join('<i>›</i>');
      const sensBlock = node.sens ? (opts.sens === 'visible'
        ? `<p class="p3-sens">${node.sens}</p>`
        : `<details class="p3-sens-d"><summary>Ce que ce bloc étudie (corrigé)</summary><p class="p3-sens">${node.sens}</p></details>`) : '';
      panel.innerHTML = `
        <div class="p3-panel-top"><span class="p3-badge l${level}">${LEVEL_NAMES[level]}</span><span class="p3-ariane">${ariane}</span>
        <button class="p3-close" aria-label="Fermer la fiche">×</button></div>
        <h4>${code ? `<span class="p3-code">${code}</span> ` : ''}${node.title}</h4>
        ${sensBlock}
        ${node.indices ? `<p class="p3-ind-t">Indices du plan</p><ul class="p3-ind">${node.indices.map(i => `<li>${i}</li>`).join('')}</ul>` : ''}`;
      panel.classList.add('open');
      panel.querySelector('.p3-close').addEventListener('click', clearFocus);
    }

    function cardPos(card) {
      let x = 0, y = 0, el = card;
      while (el && el !== world) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
      return { cx: x + card.offsetWidth / 2, cy: y, h: card.offsetHeight };
    }

    /** Met un bloc au premier plan. options : { camera, panel } */
    function focus(code, o) {
      o = Object.assign({ camera: false, panel: true }, o || {});
      const el = elOf(code);
      if (!el) return;
      const card = cardOf(code);
      treeEl.querySelectorAll('.focused, .on-path, .pp-focus').forEach(e => e.classList.remove('focused', 'on-path', 'pp-focus'));
      treeEl.classList.add('has-focus');
      card.classList.add('focused');
      if (el !== card) el.classList.add('pp-focus');
      const li = card.parentElement;
      if (li && li.tagName === 'LI') li.classList.add('focused');
      let p = li && li.parentElement;
      while (p && p !== treeEl) { if (p.tagName === 'LI') p.classList.add('on-path'); p = p.parentElement; }
      if (o.panel) showPanel(code); else { panel.innerHTML = ''; panel.classList.remove('open'); }
      if (o.camera) {
        const pos = cardPos(card), tw = treeEl.offsetWidth;
        const z = Math.min(1.6, Math.max(1.15, 0.9 / fit));
        const s = fit * z;
        state.zoom = z;
        state.rx = 10; state.ry = (pos.cx < tw / 2 ? 5 : -5);
        state.panX = (tw / 2 - pos.cx) * s;
        state.panY = scene.clientHeight * 0.32 - 34 - (pos.cy + pos.h / 2) * s;
        applyTransform();
      }
    }

    // ---- Marquages persistants (par chapitre)
    function applyMarks() {
      const mk = marks[key()] || {};
      Object.keys(mk).forEach(code => { const el = elOf(code); if (el) mk[code].forEach(c => el.classList.add(c)); });
      const ck = chips[key()] || {};
      Object.keys(ck).forEach(k => {
        const [p, i] = k.split('|');
        const chip = treeEl.querySelector(`.link-chip[data-parent="${p}"][data-i="${i}"]`);
        if (chip) { chip.classList.add('solved'); chip.querySelector('.lc-t').textContent = ck[k]; }
      });
    }
    function mark(code, cls, k) {
      k = k || key();
      marks[k] = marks[k] || {};
      (marks[k][code] = marks[k][code] || new Set()).add(cls);
      if (k === key()) { const el = elOf(code); if (el) el.classList.add(cls); }
    }
    function unmark(cls, k) {
      const keys = k ? [k] : Object.keys(marks);
      keys.forEach(kk => Object.values(marks[kk] || {}).forEach(set => set.delete(cls)));
      treeEl.querySelectorAll('.' + cls).forEach(e => e.classList.remove(cls));
    }
    function flash(code, cls) {
      const el = elOf(code);
      if (!el) return;
      el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 900);
    }
    function setChip(parent, i, label, k) {
      k = k || key();
      (chips[k] = chips[k] || {})[parent + '|' + i] = label;
      if (k === key()) applyMarks();
    }
    function say(msg, tone) {
      toast.className = 'p3-toast show ' + (tone || '');
      toast.innerHTML = msg;
      clearTimeout(say.t);
      say.t = setTimeout(() => { toast.className = 'p3-toast'; }, 2600);
    }

    function renderChapter(i) {
      state.idx = i;
      const ch = chapitres[i].data;
      state.max = maxDepth(ch, 1);
      treeEl.innerHTML = `<ul class="pt-ul root" data-level="1"><li data-code="">${nodeHTML(ch, 1, '', -1)}</li></ul>`;
      $('.p3-vlist').innerHTML = verticalHTML(ch);
      container.classList.toggle('links-quiz', opts.links === 'quiz');
      container.classList.toggle('stack', (ch.children || []).reduce((n, c) => n + (c.children || []).length, 0) > 6);
      container.classList.toggle('show-links', opts.links === 'quiz' || (opts.links === 'visible' && (!$('.p3-links') || $('.p3-links').checked)));
      container.querySelectorAll('.p3-tab').forEach(t => {
        const on = +t.dataset.i === i;
        t.classList.toggle('on', on);
        t.setAttribute('aria-selected', on);
      });
      renderLevels();
      clearFocus();
      const handle = (code, el) => {
        const f = findNode(ch, code);
        if (opts.onCard && opts.onCard(code, f, el)) return;
        focus(code);
      };
      treeEl.querySelectorAll('.pcard').forEach(c => {
        c.addEventListener('click', e => {
          const pp = e.target.closest('.pp');
          e.stopPropagation();
          handle(pp ? pp.dataset.code : c.dataset.code, pp || c);
        });
        c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handle(c.dataset.code, c); } });
      });
      treeEl.querySelectorAll('.link-chip').forEach(ch2 => ch2.addEventListener('click', e => {
        e.stopPropagation();
        if (opts.onChip) opts.onChip(ch2.dataset.parent, +ch2.dataset.i, key());
      }));
      if (opts.links === 'quiz') treeEl.querySelectorAll('.link-chip .lc-t').forEach(t => { t.textContent = '?'; });
      applyMarks();
      setLevel(state.view === 'horizontal' ? state.max : 1);
      requestAnimationFrame(() => { computeFit(); resetCamera(true); });
      if (opts.onChapter) opts.onChapter(key());
    }

    let playing = null;
    function play() {
      if (playing) clearTimeout(playing);
      clearFocus(); resetCamera();
      let l = 1;
      setLevel(1);
      const step = () => {
        l++;
        if (l > state.max) { playing = null; return; }
        setLevel(l);
        playing = setTimeout(step, reduceMotion ? 50 : 800);
      };
      playing = setTimeout(step, reduceMotion ? 50 : 650);
    }

    function showView(v, animate) {
      state.view = v;
      container.classList.toggle('is-vertical', v === 'vertical');
      container.classList.toggle('is-horizontal', v === 'horizontal');
      if (v === 'horizontal') {
        requestAnimationFrame(() => {
          computeFit(); resetCamera(true);
          if (animate) play(); else setLevel(state.max);
        });
      }
      if (opts.onView) opts.onView(v);
    }

    function setChapter(k) {
      const i = chapitres.findIndex(c => c.key === k);
      if (i >= 0 && i !== state.idx) renderChapter(i);
    }

    // --- Événements
    container.querySelectorAll('.p3-tab').forEach(t => t.addEventListener('click', () => renderChapter(+t.dataset.i)));
    $('.p3-go').addEventListener('click', () => {
      container.classList.add('leaving');
      setTimeout(() => { container.classList.remove('leaving'); showView('horizontal', true); }, reduceMotion ? 0 : 650);
    });
    const back = $('.p3-back');
    if (back) back.addEventListener('click', () => showView('vertical'));
    $('.p3-play').addEventListener('click', play);
    $('.p3-persp').addEventListener('click', () => { clearFocus(); resetCamera(); });
    $('.p3-face').addEventListener('click', () => { state.rx = 0; state.ry = 0; applyTransform(); });
    $('.p3-zin').addEventListener('click', () => { state.zoom = Math.min(3, state.zoom * 1.2); applyTransform(); });
    $('.p3-zout').addEventListener('click', () => { state.zoom = Math.max(0.5, state.zoom / 1.2); applyTransform(); });
    const modeBtn = $('.p3-mode');
    modeBtn.addEventListener('click', () => {
      state.mode = state.mode === 'rotate' ? 'pan' : 'rotate';
      modeBtn.textContent = state.mode === 'rotate' ? '✥ Déplacer' : '⟲ Pivoter';
      scene.classList.toggle('pan', state.mode === 'pan');
    });
    const linksBox = $('.p3-links');
    if (linksBox) linksBox.addEventListener('change', () => {
      container.classList.toggle('show-links', linksBox.checked);
      requestAnimationFrame(() => { computeFit(); applyTransform(true); });
    });

    // Glisser pour pivoter / déplacer
    let drag = null;
    scene.addEventListener('pointerdown', e => {
      if (e.target.closest('.pcard, .link-chip')) return;
      drag = { x: e.clientX, y: e.clientY, rx: state.rx, ry: state.ry, px: state.panX, py: state.panY, moved: false };
      scene.setPointerCapture(e.pointerId);
      scene.classList.add('dragging');
    });
    scene.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (state.mode === 'rotate') {
        state.ry = Math.max(-40, Math.min(40, drag.ry + dx * 0.18));
        state.rx = Math.max(-10, Math.min(45, drag.rx - dy * 0.18));
      } else { state.panX = drag.px + dx; state.panY = drag.py + dy; }
      applyTransform(true);
    });
    const endDrag = () => { if (!drag) return; drag = null; scene.classList.remove('dragging'); };
    scene.addEventListener('pointerup', endDrag);
    scene.addEventListener('pointercancel', endDrag);

    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { computeFit(); applyTransform(true); }, 120); });

    renderChapter(0);
    showView(opts.start, false);

    return {
      play, setLevel, focus, clearFocus, mark, unmark, flash, setChip, setChapter, say, showView, resetCamera,
      current: key, view: () => state.view, find: code => findNode(chapitres[state.idx].data, code), el: container
    };
  }

  window.Plan3D = Plan3D;
  window.Plan3D.findNode = findNode;
})();
