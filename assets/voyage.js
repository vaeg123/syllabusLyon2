/* « Le voyage du plan » : tout le parcours OR3 sur un seul écran, en 3D, adapté à toutes les tailles.
   Les lignes du plan vertical s'envolent vers le plan horizontal, se retournent en phrases,
   se relient, puis deviennent un paragraphe cohérent sous la problématique. */
(function () {
  'use strict';

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PHASES = {
    obs: { nom: 'Observer', c: 'obs' }, rep: { nom: 'Repérer', c: 'rep' }, rel: { nom: 'Relier', c: 'rel' },
    ref: { nom: 'Reformuler', c: 'ref' }, ora: { nom: 'Cohérence', c: 'ora' }
  };
  // Dimensions logiques selon l'orientation de l'écran
  const GEO = {
    land: { W: 1400, M: 50, width: { 1: 460, 2: 380, 3: 288, 4: 276, 5: 252 }, paper: 780, tilt: 16 },
    port: { W: 600, M: 14, width: { 1: 560, 2: 276, 3: 272, 4: 262, 5: 244 }, paper: 572, tilt: 8 }
  };
  const ZL = { 1: 70, 2: 48, 3: 26, 4: 14, 5: 10 };
  const clean = n => String(n).replace(/[)\s]/g, '');
  const tok = n => n.tok || n.num;
  const pl = w => w.toLowerCase().split(' ').map(x => x + 's').join(' ');
  const nb = s => s.replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ');
  const T = p => `translate3d(${p.x}px, ${p.y}px, ${p.z || 0}px) rotateX(${p.rx || 0}deg) rotateY(${p.ry || 0}deg) scale(${p.s == null ? 1 : p.s})`;
  const markLinks = s => s.replace(/(^|[\s(«])(d’abord|D’abord|ensuite|Ensuite|ainsi|Ainsi|donc|Donc|enfin|Enfin|puis|alors|Toutefois|toutefois)(?=[\s,.;:)])/g, '$1<mark class="lk">$2</mark>');

  // ---------- Déplacement animé d'un élément (avec arc en 3D si demandé)
  function place(el, p, o) {
    o = o || {};
    const prev = el._p;
    el._p = p;
    el.style.transitionDelay = (o.delay || 0) + 'ms';
    el.style.opacity = p.o == null ? 1 : p.o;
    const t = T(p);
    if (!prev || o.instant || reduce) { if (el._anim) { el._anim.cancel(); el._anim = null; } el.style.transform = t; return; }
    if (T(prev) === t && !el._anim) return;
    const from = el._anim ? getComputedStyle(el).transform : T(prev);
    if (el._anim) { el._anim.cancel(); el._anim = null; }
    el.style.transform = t;
    const frames = o.arc
      ? [{ transform: from }, { transform: T({ x: (prev.x + p.x) / 2, y: Math.min(prev.y, p.y) - 50, z: Math.max(prev.z || 0, p.z || 0) + 280, rx: -14, ry: ((prev.ry || 0) + (p.ry || 0)) / 2, s: 1.06 }), offset: 0.5 }, { transform: t }]
      : [{ transform: from }, { transform: t }];
    const a = el.animate(frames, { duration: o.dur || 1000, delay: o.delay || 0, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'backwards' });
    el._anim = a;
    a.onfinish = () => { if (el._anim === a) el._anim = null; };
  }

  function Voyage(root, m) {
    const rel = m.etapes.relier.missions.find(x => x.type === 'chips').items;
    const refM = m.etapes.reformuler.missions;

    function findNode(C, code) {
      let n = C;
      code.split('.').forEach(c => { n = (n.children || []).find(x => tok(x) === c) || n; });
      return n;
    }

    // ---------- Les étapes du voyage
    const steps = [];
    Object.keys(m.chapitres).forEach(ch => {
      const C = m.chapitres[ch];
      const links = rel.filter(l => l.ch === ch);
      const pb = refM.find(x => x.type === 'cover' && x.ch === ch).options.find(o => o.ok).t;
      const sents = refM.find(x => x.type === 'order' && x.ch === ch).sentences;
      const base = { ch, pb, sents, links };
      const kids = l => { const par = l.parent ? findNode(C, l.parent) : C; return [par.children[l.i], par.children[l.i + 1]].map(c => (l.parent ? l.parent + '.' : '') + tok(c)); };
      const add = o => steps.push(Object.assign({}, base, o));
      const unit = C.etiquette || 'Chapitre ' + C.num;
      const N = m.niveaux || ['', 'Chapitre', 'Grande partie', 'Sous-partie', 'Point', 'Subdivision'];
      const keys = Object.keys(m.chapitres), nextKey = keys[keys.indexOf(ch) + 1];
      const nextUnit = nextKey ? (m.chapitres[nextKey].etiquette || 'Chapitre ' + m.chapitres[nextKey].num) : null;
      add({ ph: 'obs', titre: `${unit} · Le plan vertical`,
        html: `Le plan de <b>« ${C.title} »</b> tel qu’il apparaît dans le document du cours : une liste verticale. Tout y est, mais on ne voit pas comment les parties s’organisent.`, st: { mode: 'v' } });
      add({ ph: 'obs', titre: 'Le plan se déploie',
        html: `Chaque ligne quitte la liste et prend sa place : <b>le grand titre en haut</b>, les <b>${pl(N[2])}</b> côte à côte, puis les <b>${pl(N[3])}</b>${N[4] ? ` et leurs <b>${pl(N[4])}</b>` : ''} en dessous. La hiérarchie devient visible d’un seul regard.`, st: { mode: 't', points: true } });
      add({ ph: 'rep', titre: `Les ${pl(N[3])} se retournent`,
        html: `Chaque carte se retourne : <b>son titre devient une phrase</b> qui dit ce qu’elle étudie.${N[4] ? ' Les lignes intérieures se rangent dans leur carte : elles ont servi à comprendre le titre, <b>sans en changer le sens</b>.' : ' La phrase garde <b>le sens exact</b> du titre.'}`, st: { mode: 't', flip: [3] } });
      add({ ph: 'rep', titre: `Les ${pl(N[2])} se retournent`,
        html: `Les ${pl(N[2])} se retournent à leur tour. Chaque phrase tient compte <b>de toutes leurs subdivisions</b> : elle donne le sujet d’ensemble.`, st: { mode: 't', flip: [2, 3] } });
      links.forEach((l, k) => add({ ph: 'rel', titre: l.titre.replace(/^[\d.]+ – /, ''),
        html: `<p class="vk">Le lien : <span class="vk-chip">${l.label}</span></p>${l.model}`, st: { mode: 't', links: k + 1, focus: kids(l) } }));
      add({ ph: 'ref', titre: 'La problématique',
        html: `Le plan recule : il devient un raisonnement. Au sommet, la <b>problématique</b>, la question à laquelle tout l’ensemble répond.`, st: { mode: 't', links: links.length, ref: true, n: 0 } });
      sents.forEach((s, k) => add({ ph: 'ref', titre: `Phrase ${k + 1} sur ${sents.length} · ${s.tag}`,
        html: `Le bloc <b>${s.tag}</b> s’allume, se transforme en phrase et rejoint le paragraphe.`, st: { mode: 't', links: links.length, ref: true, n: k + 1, src: s.codes } }));
      add({ ph: 'ora', titre: `La cohérence · ${unit}`,
        html: `Le plan est devenu <b>un texte cohérent</b>. Les mots surlignés (<mark class="lk">ensuite</mark>, <mark class="lk">ainsi</mark>, <mark class="lk">donc</mark>…) rendent visibles les liens entre les parties.${nextUnit ? ` Suivant : ${nextUnit}.` : ' Vous avez parcouru toute la méthode.'}`,
        st: { mode: 't', links: links.length, ref: true, n: sents.length, bilan: true } });
    });

    // ---------- Interface : une scène + un panneau de pilotage
    root.innerHTML = `
      <div class="vy-stage" aria-label="Scène 3D du plan"><div class="vy-world"><svg class="vy-edges" xmlns="http://www.w3.org/2000/svg"></svg><div class="vy-paper"></div><div class="vy-page"></div></div></div>
      <aside class="vy-side">
        <div class="vy-side-top">
          <a class="vy-home" href="#/" aria-label="Retour à l’accueil" title="Accueil">⌂</a>
          <div class="vy-chs"${Object.keys(m.chapitres).length < 2 ? ' hidden' : ''}>${Object.keys(m.chapitres).map(ch => `<button class="vy-ch" data-ch="${ch}" title="${m.chapitres[ch].title.replace(/"/g, '&quot;')}">${m.chapitres[ch].onglet || 'Ch. ' + m.chapitres[ch].num}</button>`).join('')}</div>
          <span class="vy-mat">${m.court || m.nom}</span>
          <a class="vy-train" href="#/m/${m.id}/observer" title="S’entraîner avec les missions">S’entraîner →</a>
        </div>
        <div class="vy-head"><span class="vy-badge"></span><span class="vy-count"></span></div>
        <h2 class="vy-title"></h2>
        <div class="vy-html"></div>
        <div class="vy-bar">${steps.map((s, k) => `<button class="vy-seg ${PHASES[s.ph].c}" data-k="${k}" aria-label="Étape ${k + 1} : ${s.titre.replace(/"/g, '&quot;')}"></button>`).join('')}</div>
        <div class="vy-ctrl">
          <button class="vy-btn vy-prev" aria-label="Étape précédente">←</button>
          <button class="vy-btn vy-play" aria-label="Lecture automatique">▶</button>
          <button class="vy-btn vy-next" aria-label="Étape suivante">Suivant →</button>
        </div>
      </aside>`;

    const stage = root.querySelector('.vy-stage'), world = root.querySelector('.vy-world'), svg = root.querySelector('.vy-edges');
    const paper = root.querySelector('.vy-paper'), page = root.querySelector('.vy-page');
    let items = [], byCode = {}, chips = [], sentEls = [], problemEl = null, built = null, cur = -1, H = 700, scale = 1, ox = 0, oy = 0;
    let orient = null, G = GEO.land, tilt = { rx: 6, ry: 0 };

    // ---------- Construction des éléments d'un chapitre
    function build(ch) {
      world.querySelectorAll('.vy-it, .vy-chip, .vy-sent, .vy-pb').forEach(e => e.remove());
      items = []; byCode = {}; chips = []; sentEls = [];
      const C = m.chapitres[ch];
      const add = (code, level, num, title, sens, parent, bi) => {
        const el = document.createElement('div');
        el.className = `vy-it l${level}${level >= 2 ? ' br' + (bi % 5) : ''}`;
        el.innerHTML = `<div class="vy-in"><div class="vy-f"><span class="n">${num}</span><span class="sep">${level === 1 ? '. ' : level === 2 ? ' – ' : level === 3 ? ' - ' : ' '}</span><span class="t">${nb(title)}</span></div>${sens ? `<div class="vy-b"><span class="bn">${num}</span> ${nb(sens)}</div>` : ''}</div>`;
        world.appendChild(el);
        const it = { el, code, level, parent, kids: [] };
        items.push(it); byCode[code] = it;
        if (parent != null && byCode[parent]) byCode[parent].kids.push(it);
      };
      add('', 1, C.num, C.title, C.sens, null);
      C.children.forEach((p, bi) => {
        const pk = tok(p);
        add(pk, 2, p.num, p.title, p.sens, '', bi);
        (p.children || []).forEach(s => {
          const sc = pk + '.' + tok(s);
          add(sc, 3, s.num, s.title, s.sens, pk, bi);
          (s.points || []).forEach(pt => {
            const pc = sc + '.' + clean(pt.num);
            add(pc, 4, pt.num, pt.t, null, sc, bi);
            (pt.sub || []).forEach(sb => add(pc + '.' + clean(sb.num), 5, sb.num, sb.t, null, sc, bi));
          });
        });
      });
      const st = steps.find(s => s.ch === ch);
      st.links.forEach(l => {
        const el = document.createElement('div');
        el.className = 'vy-chip'; el.innerHTML = `<span>${l.label}</span> →`; el.style.opacity = 0;
        world.appendChild(el);
        const par = l.parent ? byCode[l.parent] : byCode[''];
        const sib = par.kids.filter(k => k.level === par.level + 1);
        chips.push({ el, a: sib[l.i], b: sib[l.i + 1] });
      });
      problemEl = document.createElement('div');
      problemEl.className = 'vy-pb'; problemEl.style.opacity = 0;
      problemEl.innerHTML = `<span class="pb-l">Problématique</span>${nb(st.pb)}`;
      world.appendChild(problemEl);
      st.sents.forEach(s => {
        const el = document.createElement('div');
        el.className = 'vy-sent'; el.style.opacity = 0;
        el.innerHTML = `<span class="stag">${s.tag}</span><span>${markLinks(nb(s.t))}</span>`;
        world.appendChild(el);
        sentEls.push({ el, codes: s.codes });
      });
      built = ch;
      root.querySelectorAll('.vy-ch').forEach(b => b.classList.toggle('on', b.dataset.ch === ch));
    }

    // ---------- Mises en page
    const measure = (it, flipped) => {
      const f = it.el.querySelector('.vy-f'), b = it.el.querySelector('.vy-b');
      return (flipped && b ? b : f).offsetHeight;
    };

    function layoutVertical() {
      const pw = G.paper, px = (G.W - pw) / 2, x0 = px + (orient === 'port' ? 24 : 50), th = G.tilt * Math.PI / 180;
      let y = 86;
      items.forEach(it => {
        it.el.classList.add('v'); it.el.classList.remove('flip', 'dim', 'hl', 'src');
        const ind = it.level === 4 ? 16 : it.level === 5 ? 34 : 0;
        it.el.style.width = (pw - (x0 - px) * 2 - ind) + 'px';
        if (it.level === 2) y += 12; else if (it.level === 3) y += 4;
        const h = measure(it, false);
        it.el.style.height = h + 'px';
        const lx = x0 + ind - px;
        it.target = { x: px + lx * Math.cos(th), y, z: -lx * Math.sin(th), ry: G.tilt };
        y += h + 3;
      });
      paper.style.width = pw + 'px'; paper.style.height = (y - 20) + 'px';
      paper.style.transform = `translate3d(${px}px, 44px, -2px) rotateY(${G.tilt}deg)`;
      return y + 40;
    }

    let WD = GEO.land.width, layoutMode = 'row';
    function layoutTree(st) {
      const flip = new Set(st.flip || []), showPts = !!st.points;
      const sub = items.filter(i => i.level === 3), parts = items.filter(i => i.level === 2), C = byCode[''];
      const avail = G.W - 2 * G.M, base = G.width;
      layoutMode = orient === 'land' && sub.length && sub.length * (base[3] + 24) <= avail ? 'row' : 'cols';
      const maxCols = Math.max(1, Math.min(parts.length, Math.floor(avail / (orient === 'land' ? 250 : 280))));
      const colW = avail / (layoutMode === 'row' ? sub.length : maxCols);
      WD = layoutMode === 'row' ? Object.assign({}, base)
        : { 1: Math.min(base[1], avail), 2: Math.min(base[2], colW - 14), 3: Math.min(base[3], colW - 14), 4: Math.min(base[4], colW - 30), 5: Math.min(base[5], colW - 50) };
      items.forEach(it => {
        it.el.classList.remove('v');
        it.el.classList.toggle('flip', flip.has(it.level));
        it.el.style.width = WD[it.level] + 'px';
      });
      const hOf = it => measure(it, flip.has(it.level));
      const placePoints = (s, startY) => {
        let py = startY;
        items.filter(p => p.parent === s.code && p.level >= 4).forEach(p => {
          const hp = measure(p, false);
          p.el.style.height = hp + 'px';
          if (showPts) { p.target = { x: s.target.x + 8 + (p.level === 5 ? 20 : 0), y: py, z: ZL[p.level] }; py += hp + 6; }
          else p.target = { x: s.cx - WD[p.level] / 2, y: s.target.y + s.h / 2 - hp / 2, z: 0, s: 0.2, o: 0 };
        });
        return showPts ? py : startY - 14;
      };
      const y1 = 22, h1 = hOf(C);
      C.el.style.height = h1 + 'px';
      C.target = { x: G.W / 2 - WD[1] / 2, y: y1, z: ZL[1] }; C.cx = G.W / 2; C.h = h1;
      const y2 = y1 + h1 + (orient === 'port' ? 40 : 60);
      let bottom = y2;
      if (layoutMode === 'row') {
        const h2 = Math.max(...parts.map(hOf)), y3 = y2 + h2 + 60;
        sub.forEach((s, i) => {
          const cx = G.M + colW * (i + 0.5), h = hOf(s);
          s.el.style.height = h + 'px'; s.cx = cx; s.h = h;
          s.target = { x: cx - WD[3] / 2, y: y3, z: ZL[3] };
          bottom = Math.max(bottom, placePoints(s, y3 + h + 14));
        });
        parts.forEach(p => {
          const ks = sub.filter(s => s.parent === p.code), h = hOf(p);
          p.cx = ks.length ? ks.reduce((a, s) => a + s.cx, 0) / ks.length : G.W / 2; p.h = h; p.row = 0;
          p.el.style.height = h + 'px';
          p.target = { x: p.cx - WD[2] / 2, y: y2, z: ZL[2] };
        });
      } else {
        // Une colonne par division ; les colonnes passent à la ligne si l'écran est étroit
        let rowY = y2;
        for (let r = 0; r * maxCols < parts.length; r++) {
          const row = parts.slice(r * maxCols, (r + 1) * maxCols);
          const off = (avail - row.length * colW) / 2;
          row.forEach((p, i) => {
            const cx = G.M + off + colW * (i + 0.5), h = hOf(p);
            p.cx = cx; p.h = h; p.row = r; p.el.style.height = h + 'px';
            p.target = { x: cx - WD[2] / 2, y: rowY, z: ZL[2] };
          });
          const h2 = Math.max(...row.map(p => p.h));
          let rowBottom = rowY + h2;
          row.forEach(p => {
            let y = rowY + h2 + 30;
            sub.filter(s => s.parent === p.code).forEach(s => {
              const h = hOf(s);
              s.el.style.height = h + 'px'; s.cx = p.cx; s.h = h;
              s.target = { x: p.cx - WD[3] / 2, y, z: ZL[3] };
              y = placePoints(s, y + h + 10) + 44;
            });
            rowBottom = Math.max(rowBottom, y - 30);
          });
          bottom = rowBottom;
          rowY = rowBottom + 70;
        }
      }
      return bottom + 40;
    }

    function drawEdges(on, dim) {
      const C = byCode[''];
      let d = '';
      const elbow = (a, b) => { const x1 = a.cx, y1 = a.target.y + a.h, x2 = b.cx, y2 = b.target.y, ym = (y1 + y2) / 2; d += `M${x1},${y1} V${ym} H${x2} V${y2} `; };
      items.filter(i => i.level === 2).forEach(p => {
        if (!p.row) elbow(C, p);
        else d += `M${C.cx},${C.target.y + C.h} V${p.target.y - 26} H${p.cx} V${p.target.y} `;
      });
      if (layoutMode === 'row') items.filter(i => i.level === 3).forEach(s => elbow(byCode[s.parent], s));
      else items.filter(i => i.level === 2).forEach(p => {
        const gx = p.target.x + 10;
        items.filter(s => s.parent === p.code && s.level === 3).forEach(s => { d += `M${gx},${p.target.y + p.h} V${s.target.y + 22} H${s.target.x} `; });
      });
      svg.innerHTML = `<path d="${d}" />`;
      svg.setAttribute('viewBox', `0 0 ${G.W} ${H}`);
      svg.style.width = G.W + 'px'; svg.style.height = H + 'px';
      svg.classList.toggle('on', on); svg.classList.toggle('dim', !!dim);
    }

    // ---------- Application d'un état
    function apply(k, instant) {
      const s = steps[k], st = s.st;
      const chapterChange = built !== s.ch;
      if (chapterChange) build(s.ch);
      const fromVertical = !chapterChange && items.length && items[0].el.classList.contains('v');
      if (st.mode === 'v') {
        H = layoutVertical();
        paper.classList.add('on'); svg.classList.remove('on');
        items.forEach((it, i) => place(it.el, it.target, { instant: instant || chapterChange, arc: !instant && !chapterChange, delay: instant ? 0 : i * 25, dur: 900 }));
        if (chapterChange && !instant) items.forEach((it, i) => { it.el.style.opacity = 0; requestAnimationFrame(() => { it.el.style.transitionDelay = (i * 30) + 'ms'; it.el.style.opacity = 1; }); });
      } else {
        H = layoutTree(st);
        paper.classList.remove('on');
        const focus = new Set(st.focus || []), src = new Set(st.src || []);
        items.forEach((it, i) => {
          const dimmed = st.ref ? !src.has(it.code) : (focus.size > 0 && !focus.has(it.code) && it.level < 4);
          it.el.classList.toggle('dim', dimmed);
          it.el.classList.toggle('hl', focus.has(it.code));
          it.el.classList.toggle('src', src.has(it.code));
          const p = Object.assign({}, it.target);
          if (st.ref) { p.z = src.has(it.code) ? -60 : -260; if (it.level >= 4) p.o = 0; }
          place(it.el, p, { instant, arc: fromVertical, delay: fromVertical ? (it.level - 1) * 650 + (i % 6) * 70 : 0, dur: fromVertical ? 1150 : 900 });
        });
        drawEdges(true, st.ref || focus.size > 0);
        if (fromVertical && !instant) { svg.classList.remove('on'); setTimeout(() => svg.classList.add('on'), 2400); }
      }
      // Liens
      chips.forEach((c, i) => {
        const shown = st.mode === 't' && (st.links || 0) > i;
        const a = c.a, b = c.b;
        let x, y;
        if (Math.abs(a.cx - b.cx) < 1) { x = a.cx - 52; y = (a.target.y + a.h + b.target.y) / 2 - 16; }
        else if (Math.abs(a.target.y - b.target.y) > 1) { x = b.target.x + WD[b.level] / 2 - 52; y = b.target.y - 42; }
        else {
          x = (a.target.x + WD[a.level] + b.target.x) / 2 - 52;
          const gap = b.target.x - (a.target.x + WD[a.level]);
          y = gap < 110 ? Math.min(a.target.y, b.target.y) - 40 : a.target.y + Math.min(a.h, b.h) / 2 - 16;
        }
        c.el.classList.toggle('pop', shown && st.links === i + 1 && !st.ref);
        place(c.el, { x, y, z: st.ref ? -200 : 110, s: shown ? 1 : 0.2, o: shown ? (st.ref ? 0.25 : 1) : 0 }, { instant: instant || !c.el._p });
      });
      // Page de reformulation
      const n = st.n || 0;
      const hideAt = el => { const it = byCode[el.codes ? el.codes[0] : ''] || byCode['']; return Object.assign({}, it.target, { z: -240, s: 0.5, o: 0 }); };
      if (st.ref) {
        const pw = Math.min(980, G.W - 2 * G.M), px = (G.W - pw) / 2, pad = orient === 'port' ? 18 : 30;
        page.classList.add('on');
        problemEl.style.width = (pw - 2 * pad) + 'px';
        let y = 64 + problemEl.offsetHeight + 18;
        place(problemEl, { x: px + pad, y: 64, z: 170 }, { instant, arc: !problemEl._p || problemEl._p.z < 100, dur: 1100 });
        sentEls.forEach((s, i) => {
          s.el.style.width = (pw - 2 * pad) + 'px';
          if (i < n) {
            s.el.classList.toggle('lit', i === n - 1 && !st.bilan);
            place(s.el, { x: px + pad, y, z: 170 }, { instant, arc: !s.el._p || s.el._p.o === 0, dur: 1200, delay: 120 });
            y += s.el.offsetHeight + 10;
          } else { s.el.classList.remove('lit'); place(s.el, hideAt(s), { instant: true }); }
        });
        page.classList.toggle('bilan', !!st.bilan);
        page.style.width = pw + 'px'; page.style.height = (y - 30) + 'px';
        page.style.transform = `translate3d(${px}px, 40px, 150px)`;
        H = Math.max(H, y + 30);
      } else {
        page.classList.remove('on', 'bilan');
        place(problemEl, hideAt({}), { instant: true });
        sentEls.forEach(s => { s.el.classList.remove('lit'); place(s.el, hideAt(s), { instant: true }); });
      }
      fit(); focusView(st); fit();
    }

    // ---------- Adaptation à l'écran : orientation et échelle
    function checkOrient() {
      const o = stage.clientWidth / Math.max(1, stage.clientHeight) < 1.05 ? 'port' : 'land';
      if (o !== orient) {
        orient = o; G = GEO[o];
        root.classList.toggle('portrait', o === 'port');
        world.style.width = G.W + 'px';
        return true;
      }
      return false;
    }
    let panY = 0, maxPan = 0;
    function fit() {
      const sw = stage.clientWidth, sh = stage.clientHeight;
      const wFit = sw / G.W, hFit = (sh - 10) / (H * 1.07);
      // En portrait, on garde un texte lisible : si le plan est trop long, il défile verticalement
      scale = orient === 'port' ? Math.min(wFit, Math.max(hFit, wFit * 0.86)) : Math.min(wFit, hFit);
      const contentH = H * scale * 1.07;
      maxPan = Math.max(0, contentH - sh + 24);
      panY = Math.max(0, Math.min(maxPan, panY));
      ox = (sw - G.W * scale) / 2;
      oy = maxPan ? 8 - panY : Math.max(4, (sh - contentH) / 2);
      stage.classList.toggle('scrollable', maxPan > 0);
      world.style.height = H + 'px';
      world.style.transform = `translate(${ox}px, ${oy}px) scale(${scale}) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`;
    }
    function focusView(st) {
      if (!maxPan) { panY = 0; return; }
      let y = 0;
      if (st.ref) { const last = sentEls[(st.n || 0) - 1]; y = last && last.el._p ? last.el._p.y : 40; }
      else if (st.focus && st.focus.length) y = Math.min(...st.focus.map(c => (byCode[c] && byCode[c].target ? byCode[c].target.y : 0)));
      panY = y * scale - stage.clientHeight * 0.28;
    }

    // ---------- Navigation
    function go(k, instant) {
      k = Math.max(0, Math.min(steps.length - 1, k));
      if (k === cur && !instant) return;
      cur = k;
      const s = steps[k], ph = PHASES[s.ph];
      apply(k, instant);
      root.classList.remove('obs', 'rep', 'rel', 'ref', 'ora'); root.classList.add(ph.c);
      root.querySelector('.vy-badge').textContent = ph.nom;
      root.querySelector('.vy-title').textContent = s.titre;
      const hh = root.querySelector('.vy-html');
      hh.innerHTML = s.html; hh.scrollTop = 0; hh.classList.remove('in'); void hh.offsetWidth; hh.classList.add('in');
      root.querySelector('.vy-count').textContent = `${k + 1} / ${steps.length}`;
      root.querySelectorAll('.vy-seg').forEach(b => { const j = +b.dataset.k; b.classList.toggle('done', j < k); b.classList.toggle('cur', j === k); });
      root.querySelector('.vy-prev').disabled = k === 0;
      root.querySelector('.vy-next').textContent = k === steps.length - 1 ? 'Rejouer ↺' : 'Suivant →';
      try { localStorage.setItem('or3-voyage', String(k)); } catch (e) { /* ignore */ }
      fit();
    }

    let timer = null;
    const playBtn = root.querySelector('.vy-play');
    const stop = () => { clearTimeout(timer); timer = null; playBtn.textContent = '▶'; playBtn.classList.remove('on'); playBtn.setAttribute('aria-label', 'Lecture automatique'); };
    const delayFor = k => steps[k].st.mode === 't' && k > 0 && steps[k - 1].st.mode === 'v' ? 5200 : Math.max(4200, steps[k].html.replace(/<[^>]+>/g, '').length * 45);
    const tick = () => { if (cur >= steps.length - 1) return stop(); go(cur + 1); timer = setTimeout(tick, delayFor(cur)); };
    playBtn.addEventListener('click', () => {
      if (timer) return stop();
      playBtn.textContent = '❚❚'; playBtn.classList.add('on'); playBtn.setAttribute('aria-label', 'Pause');
      if (cur >= steps.length - 1) go(0);
      timer = setTimeout(tick, 600);
    });
    root.querySelector('.vy-next').addEventListener('click', () => { stop(); go(cur === steps.length - 1 ? 0 : cur + 1); });
    root.querySelector('.vy-prev').addEventListener('click', () => { stop(); go(cur - 1); });
    root.querySelectorAll('.vy-seg').forEach(b => b.addEventListener('click', () => { stop(); go(+b.dataset.k); }));
    root.querySelectorAll('.vy-ch').forEach(b => b.addEventListener('click', () => { stop(); go(steps.findIndex(s => s.ch === b.dataset.ch)); }));
    // Clavier et balayage tactile
    const onKey = e => {
      if (!document.body.contains(root)) return document.removeEventListener('keydown', onKey);
      if (e.target.closest('input, textarea') || (e.key === ' ' && e.target.closest('button, a'))) return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); stop(); go(cur + 1); } else if (e.key === 'ArrowLeft') { stop(); go(cur - 1); }
    };
    document.addEventListener('keydown', onKey);
    let sx = null, sy = null, py0 = 0, vmove = false;
    stage.addEventListener('wheel', e => { if (!maxPan) return; e.preventDefault(); panY += e.deltaY; fit(); }, { passive: false });
    stage.addEventListener('touchmove', e => {
      if (sy == null || !maxPan) return;
      const dy = e.touches[0].clientY - sy, dx = e.touches[0].clientX - sx;
      if (vmove || (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx))) { vmove = true; e.preventDefault(); panY = py0 - dy; fit(); }
    }, { passive: false });
    stage.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; py0 = panY; vmove = false; }, { passive: true });
    stage.addEventListener('touchend', e => {
      if (sx == null) return;
      const dx = e.changedTouches[0].clientX - sx; sx = null; sy = null;
      if (vmove) { vmove = false; return; }
      if (Math.abs(dx) > 50) { stop(); go(cur + (dx < 0 ? 1 : -1)); }
    });
    // Parallaxe 3D au survol (souris uniquement)
    stage.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = stage.getBoundingClientRect();
      tilt = { rx: 6 - ((e.clientY - r.top) / r.height - 0.5) * 8, ry: ((e.clientX - r.left) / r.width - 0.5) * 10 };
      fit();
    });
    stage.addEventListener('pointerleave', () => { tilt = { rx: 6, ry: 0 }; fit(); });
    let rt;
    const onResize = () => {
      if (!document.body.contains(root)) return window.removeEventListener('resize', onResize);
      clearTimeout(rt);
      rt = setTimeout(() => { if (checkOrient()) apply(cur, true); else fit(); }, 120);
    };
    window.addEventListener('resize', onResize);
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(stage);

    let start = 0;
    try { start = Math.min(steps.length - 1, +localStorage.getItem('or3-voyage') || 0); } catch (e) { /* ignore */ }
    requestAnimationFrame(() => { checkOrient(); go(start, true); });
    return { go, stop, steps };
  }

  window.Voyage = Voyage;
})();
