/* Application : routage, pages, studios de missions interactives, progression locale.
   Aucune donnée n'est envoyée : les réponses restent dans le navigateur de l'étudiant. */
(function () {
  'use strict';

  const ETAPES = [
    { key: 'observer',   nom: 'Observer',   verbe: 'Situer',       couleur: 'obs', icone: '◎', resume: 'Situer la partie étudiée et reconnaître les niveaux du plan.' },
    { key: 'reperer',    nom: 'Repérer',    verbe: 'Clarifier',    couleur: 'rep', icone: '✦', resume: 'Clarifier les mots utiles et comprendre ce que chaque titre annonce.' },
    { key: 'relier',     nom: 'Relier',     verbe: 'Expliquer',    couleur: 'rel', icone: '⇄', resume: 'Expliquer pourquoi les sujets sont associés et présentés dans cet ordre.' },
    { key: 'reformuler', nom: 'Reformuler', verbe: 'Reconstruire', couleur: 'ref', icone: '❖', resume: 'Reconstruire la logique du plan et la relier à une problématique.' },
    { key: 'oral',       nom: 'Présenter',  verbe: 'Dire',         couleur: 'ora', icone: '♪', resume: 'Présenter oralement la logique d’ensemble, plan à l’appui.' }
  ];
  const ORDRE = ['droit', 'hfe', 'anthro', 'gqc'];
  const matieres = () => ORDRE.filter(k => window.MATIERES[k]).map(k => window.MATIERES[k]);
  const AUTRES_OLD = [
    { nom: 'Introduction générale au droit', per: 'Partie 1, chapitres 1 à 5' },
    { nom: 'Histoire des faits économiques', per: 'Chapitres 1 et 2' },
    { nom: 'Anthropologie et sociologie du droit', per: 'Partie 1, sous-parties 1.1 à 1.3' }
  ];

  // ---------- Stockage local
  const KEY = 'or3-syllabus-v2';
  const store = {
    all() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } },
    get(k, d) { const a = this.all(); return k in a ? a[k] : d; },
    set(k, v) { try { const a = this.all(); a[k] = v; localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { /* stockage indisponible */ } }
  };
  const isDone = (m, e) => !!store.get(`done:${m}:${e}`, false);

  const app = document.getElementById('app');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const shuffle = (arr, seed) => { const a = arr.slice(); let s = seed || 7; for (let i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor(s / 233280 * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const codeLabel = c => c === '' ? 'le grand titre' : c;
  const blocName = (ctx, code) => { const f = ctx.plan.find(code); return f && f.node ? `« ${f.node.title} »` : codeLabel(code); };

  const CONNECTEURS = `<div class="conn-grid">${[
    ['Addition, complément', '« également », « de plus »', 'Ajoutent un élément : précisez en quoi les éléments se complètent.'],
    ['Opposition', '« en revanche », « A, tandis que B »', 'Mettent deux éléments en contraste.'],
    ['Concession', '« bien que » + subjonctif', 'Un fait qui n’empêche pas l’autre : une attente déjouée.'],
    ['Cause, justification', '« parce que », « car »', '« Le plan associe A et B car… » justifie le rapprochement.'],
    ['Conséquence', '« donc », « par conséquent »', 'Un résultat du fait précédent, à établir et non à déduire de la seule succession des titres.']
  ].map((c, k) => `<div class="conn-c k${k}"><p class="conn-n">${c[0]}</p><p class="conn-w">${c[1]}</p><p class="conn-d">${c[2]}</p></div>`).join('')}</div>`;

  // =====================================================================
  //  MISSIONS : chaque type sait s'afficher et réagir au plan 3D
  // =====================================================================
  const M = {};

  // --- Déplier le plan
  M.flip = {
    render: m => `<p class="m-consigne">${m.consigne}</p><div class="m-wait"><span class="pulse"></span> En attente : cliquez sur le bouton sous le plan vertical.</div><div class="m-after" hidden><p>${m.apres}</p></div>`,
    mount(el, m, ctx) {
      const ok = () => { el.querySelector('.m-wait').hidden = true; el.querySelector('.m-after').hidden = false; ctx.complete(); };
      if (ctx.plan.view() === 'horizontal') ok();
      ctx.onView = v => { if (v === 'horizontal') ok(); };
    }
  };

  // --- Trouver un bloc
  M.find = {
    render: m => `<p class="m-consigne">${m.consigne}</p>
      <div class="find-box"><div class="find-target"><span class="ft-lbl">Trouvez</span><span class="ft-code"></span><span class="ft-ch"></span></div>
      <div class="find-rounds">${m.rounds.map((r, k) => `<span class="fr" data-k="${k}">${k + 1}</span>`).join('')}</div></div>
      <p class="m-fb" aria-live="polite"></p><button class="btn sm next-round" hidden>Code suivant →</button>`,
    mount(el, m, ctx) {
      let r = 0;
      const fb = el.querySelector('.m-fb'), nb = el.querySelector('.next-round');
      const show = () => {
        const R = m.rounds[r];
        ctx.plan.setChapter(R.ch);
        if (ctx.plan.view() !== 'horizontal') ctx.plan.showView('horizontal');
        el.querySelector('.ft-code').textContent = R.label || R.code;
        el.querySelector('.ft-ch').textContent = Object.keys(ctx.matiere.chapitres).length > 1 ? 'dans ' + (ctx.matiere.chapitres[R.ch].etiquette || 'le chapitre ' + R.ch.slice(1)).toLowerCase() : '';
        el.querySelectorAll('.fr').forEach(f => f.classList.toggle('cur', +f.dataset.k === r));
        fb.className = 'm-fb'; fb.textContent = ''; nb.hidden = true;
      };
      ctx.onCard = code => {
        const R = m.rounds[r];
        if (!nb.hidden) return true;
        if (code === R.code) {
          ctx.plan.mark(code, 'found'); ctx.plan.flash(code, 'good-flash'); ctx.plan.say('✓ ' + (R.label || code), 'good');
          fb.className = 'm-fb good'; fb.innerHTML = `<strong>Trouvé !</strong> ${R.expl}`;
          el.querySelector(`.fr[data-k="${r}"]`).classList.add('ok');
          if (r < m.rounds.length - 1) nb.hidden = false; else ctx.complete();
        } else {
          ctx.plan.flash(code, 'bad-flash');
          fb.className = 'm-fb bad';
          fb.innerHTML = code.startsWith(R.code + '.') ? `Vous êtes dans le bon bloc, mais sur une ligne intérieure, ${blocName(ctx, code)}. Cliquez sur le titre de la carte.`
            : R.code.startsWith(code ? code + '.' : '') ? `Bonne direction : ${blocName(ctx, code)} contient ce que vous cherchez. Descendez encore d’un niveau.`
            : `Ce bloc est ${blocName(ctx, code)}. Relisez le repère de gauche à droite, du plus grand niveau au plus petit.`;
        }
        return true;
      };
      nb.addEventListener('click', () => { r++; show(); });
      show();
    }
  };

  // --- Écrire puis comparer
  M.write = {
    render: m => `<p class="m-consigne">${m.prompt}</p>
      <textarea rows="4" placeholder="Écrivez votre réponse ici, avec vos mots…"></textarea>
      <div class="ex-actions">${m.hints && m.hints.length ? `<button class="btn ghost sm hint-btn">Un indice</button>` : ''}<button class="btn sm reveal-btn">Comparer avec le corrigé</button></div>
      <ol class="hints"></ol>
      <p class="nudge" hidden>Essayez d’abord d’écrire quelques mots, même incomplets : c’est en comparant que l’on apprend. Cliquez à nouveau pour voir le corrigé.</p>
      <div class="model" hidden><p class="model-t">Proposition du corrigé</p><p>${m.model}</p><p class="model-note">Plusieurs formulations peuvent convenir : vérifiez que la vôtre garde le même sens.</p></div>`,
    mount(el, m, ctx) {
      if (m.focus) { ctx.plan.setChapter(m.focus.ch); ctx.plan.focus(m.focus.code, { camera: false, panel: false }); }
      const ta = el.querySelector('textarea'), id = 't:' + m.id;
      ta.value = store.get(id, ''); ta.addEventListener('input', () => store.set(id, ta.value));
      const hb = el.querySelector('.hint-btn');
      if (hb) { let n = 0; hb.addEventListener('click', () => { if (n < m.hints.length) el.querySelector('.hints').insertAdjacentHTML('beforeend', `<li><span>Indice ${n + 1}</span> ${m.hints[n++]}</li>`); if (n >= m.hints.length) hb.disabled = true; }); }
      const rev = el.querySelector('.reveal-btn'), nudge = el.querySelector('.nudge');
      let warned = false;
      const show = () => { el.querySelector('.model').hidden = false; nudge.hidden = true; rev.disabled = true; rev.textContent = 'Corrigé affiché'; ctx.complete(); };
      rev.addEventListener('click', () => { if (ta.value.trim().length < 8 && !warned) { warned = true; nudge.hidden = false; return; } show(); });
      if (ctx.wasDone) show();
    }
  };

  // --- Mots clés : cartes 3D reliées au plan
  M.words = {
    render: m => `<p class="m-consigne">${m.consigne}</p>
      <div class="words">
        <div class="w-chips">${m.items.map((w, k) => `<button class="w-chip ${w.ch}" data-k="${k}">${w.term}</button>`).join('')}</div>
        <div class="w-stage"><div class="w-card"><div class="w-inner">
          <div class="w-face w-front"><p class="w-hint">Choisissez un mot à gauche.</p></div>
          <div class="w-face w-back"></div></div></div>
          <p class="w-count"></p></div>
      </div>`,
    mount(el, m, ctx) {
      const seen = new Set(store.get('w:' + ctx.mk, []));
      const cardEl = el.querySelector('.w-card'), front = el.querySelector('.w-front'), back = el.querySelector('.w-back'), count = el.querySelector('.w-count');
      const upd = () => {
        el.querySelectorAll('.w-chip').forEach(c => c.classList.toggle('seen', seen.has(+c.dataset.k)));
        count.innerHTML = `<b>${seen.size}</b> / ${m.need} mots explorés${seen.size >= m.need ? ' ✓' : ''}`;
        if (seen.size >= m.need) ctx.complete();
      };
      const open = k => {
        const w = m.items[k];
        el.querySelectorAll('.w-chip').forEach(c => c.classList.toggle('cur', +c.dataset.k === k));
        cardEl.classList.remove('flipped');
        ctx.plan.setChapter(w.ch); ctx.plan.focus(w.code, { camera: true, panel: false });
        const id = `f:${ctx.mk}:${k}`;
        front.innerHTML = `<p class="w-term">${w.term}</p><p class="w-where">Dans le plan : <b>${blocName(ctx, w.code)}</b></p>
          <textarea rows="3" placeholder="Votre définition, avec vos mots…"></textarea><button class="btn sm w-flip">Retourner la carte ↻</button>`;
        const ta = front.querySelector('textarea'); ta.value = store.get(id, ''); ta.addEventListener('input', () => store.set(id, ta.value));
        front.querySelector('.w-flip').addEventListener('click', () => {
          const v = ta.value.trim();
          back.innerHTML = `<p class="w-term">${w.term}</p><p class="w-def">${w.def}</p><p class="w-src">Source : ${w.src}</p>${v ? `<p class="w-mine"><b>Votre définition :</b> ${esc(v)}</p>` : ''}<button class="btn ghost sm w-unflip">↺ Revenir</button>`;
          back.querySelector('.w-unflip').addEventListener('click', () => cardEl.classList.remove('flipped'));
          cardEl.classList.add('flipped');
          seen.add(k); store.set('w:' + ctx.mk, [...seen]); upd();
        });
      };
      el.querySelectorAll('.w-chip').forEach(c => c.addEventListener('click', () => open(+c.dataset.k)));
      upd();
    }
  };

  // --- Portée des mots : carrousel 3D
  M.portee = {
    render: m => `<p class="m-consigne">${m.consigne}</p><div class="car"><div class="car-card"></div></div>
      <div class="car-nav"><div class="car-dots">${m.items.map((_, k) => `<span data-k="${k}"></span>`).join('')}</div><button class="btn sm car-next" disabled>Titre suivant →</button></div>`,
    mount(el, m, ctx) {
      let k = 0;
      const box = el.querySelector('.car-card'), next = el.querySelector('.car-next');
      const solved = new Set(store.get('p:' + ctx.mk, []));
      const show = () => {
        const it = m.items[k];
        ctx.plan.setChapter(it.ch); ctx.plan.focus(it.code, { camera: true, panel: false });
        box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
        box.innerHTML = `<p class="car-q">${it.q}</p><div class="qcm-opts">${it.options.map((o, j) => `<button class="qopt" data-j="${j}"><span class="qletter">${'ABC'[j]}</span><span>${o.t}</span></button>`).join('')}</div><p class="qfb"></p>`;
        el.querySelectorAll('.car-dots span').forEach(d => { d.classList.toggle('cur', +d.dataset.k === k); d.classList.toggle('ok', solved.has(+d.dataset.k)); });
        next.disabled = !solved.has(k) || k === m.items.length - 1;
        box.querySelectorAll('.qopt').forEach(b => b.addEventListener('click', () => {
          const o = it.options[+b.dataset.j], fb = box.querySelector('.qfb');
          b.classList.add('picked', o.ok ? 'good' : 'bad');
          fb.className = 'qfb ' + (o.ok ? 'good' : 'bad'); fb.innerHTML = `<strong>${o.ok ? 'Oui.' : 'Pas tout à fait.'}</strong> ${o.fb}`;
          if (o.ok) {
            solved.add(k); store.set('p:' + ctx.mk, [...solved]);
            ctx.plan.flash(it.code, 'good-flash');
            el.querySelector(`.car-dots span[data-k="${k}"]`).classList.add('ok');
            next.disabled = k === m.items.length - 1;
            if (solved.size === m.items.length) ctx.complete();
          } else ctx.plan.flash(it.code, 'bad-flash');
        }));
      };
      next.addEventListener('click', () => { if (k < m.items.length - 1) { k++; show(); } });
      el.querySelectorAll('.car-dots span').forEach(d => d.addEventListener('click', () => { k = +d.dataset.k; show(); }));
      show();
    }
  };

  // --- Associer chaque phrase à son bloc
  M.match = {
    render: m => `<p class="m-consigne">${m.consigne}</p><div class="match-head"><span class="mh-ch"></span><span class="mh-count"></span></div><div class="match-list"></div><p class="m-fb" aria-live="polite"></p>`,
    mount(el, m, ctx) {
      const done = new Set(store.get('mt:' + ctx.mk, []));
      const keys = Object.keys(m.chapters);
      let ch = keys.find(k => m.chapters[k].some(s => !done.has(k + ':' + s.code))) || keys[0], sel = null;
      const list = el.querySelector('.match-list'), fb = el.querySelector('.m-fb');
      const restoreMarks = () => done.forEach(d => { const [k, c] = d.split(':'); ctx.plan.mark(c, 'matched', k); });
      const draw = () => {
        ctx.plan.setChapter(ch);
        const items = shuffle(m.chapters[ch], 11 + keys.indexOf(ch) * 12);
        const n = m.chapters[ch].filter(s => done.has(ch + ':' + s.code)).length;
        el.querySelector('.mh-ch').innerHTML = `${ctx.matiere.chapitres[ch].etiquette || 'Chapitre ' + ch.slice(1)}${keys.length > 1 ? ` <button class="btn ghost sm mh-sw">${ctx.matiere.chapitres[keys[(keys.indexOf(ch) + 1) % keys.length]].etiquette || 'Chapitre suivant'} →</button>` : ''}`;
        el.querySelector('.mh-count').textContent = `${n} / ${items.length} blocs`;
        list.innerHTML = items.map(s => `<button class="mitem${done.has(ch + ':' + s.code) ? ' done' : ''}" data-code="${s.code}"><span class="mi-tag">${done.has(ch + ':' + s.code) ? s.code : '?'}</span><span>${s.text}</span></button>`).join('');
        list.querySelectorAll('.mitem:not(.done)').forEach(b => b.addEventListener('click', () => {
          sel = b.dataset.code;
          list.querySelectorAll('.mitem').forEach(x => x.classList.toggle('sel', x === b));
          fb.className = 'm-fb'; fb.innerHTML = '👉 Cliquez maintenant sur le bloc du plan qui correspond à cette phrase.';
        }));
        const sw = el.querySelector('.mh-sw'); if (sw) sw.addEventListener('click', () => { ch = keys[(keys.indexOf(ch) + 1) % keys.length]; sel = null; draw(); });
      };
      ctx.onCard = (code, f, target) => {
        const card = target.closest('.pcard'); const c = card ? card.dataset.code : code;
        if (!sel) { fb.className = 'm-fb'; fb.textContent = 'Sélectionnez d’abord une phrase dans la liste.'; ctx.plan.flash(c, 'bad-flash'); return true; }
        if (c === sel) {
          done.add(ch + ':' + c); store.set('mt:' + ctx.mk, [...done]);
          ctx.plan.mark(c, 'matched'); ctx.plan.flash(c, 'good-flash'); ctx.plan.say('✓ ' + c, 'good');
          fb.className = 'm-fb good'; fb.innerHTML = `<strong>Oui !</strong> Cette phrase décrit bien ${blocName(ctx, c)}.`;
          sel = null;
          const total = keys.reduce((a, k) => a + m.chapters[k].length, 0);
          if (done.size >= total) { draw(); ctx.complete(); return true; }
          if (m.chapters[ch].every(s => done.has(ch + ':' + s.code))) {
            ctx.plan.say('Chapitre terminé ! Place au suivant.', 'good');
            setTimeout(() => { ch = keys.find(k => m.chapters[k].some(s => !done.has(k + ':' + s.code))); draw(); }, 1200);
          } else draw();
        } else {
          ctx.plan.flash(c, 'bad-flash');
          fb.className = 'm-fb bad'; fb.innerHTML = `Ce n’est pas ${blocName(ctx, c)}. Relisez la phrase : quels mots du titre reprend-elle ?`;
        }
        return true;
      };
      restoreMarks(); draw();
      if (done.size >= keys.reduce((a, k) => a + m.chapters[k].length, 0)) ctx.complete();
    }
  };

  // --- Révéler les liens du plan
  M.chips = {
    render: m => `<p class="m-consigne">${m.consigne}</p>
      <div class="chips-wrap"><ol class="chip-list">${m.items.map((it, k) => `<li><button class="cl-item" data-k="${k}"><span class="cl-n">${it.titre.split(' ')[0]}</span><span class="cl-t">${it.between[0]} <b>?</b> ${it.between[1]}</span></button></li>`).join('')}</ol>
      <div class="chip-q"><p class="cq-empty">Cliquez sur un <b>?</b> dans le plan ou choisissez un lien dans la liste.</p></div></div>`,
    mount(el, m, ctx) {
      const solved = new Set(store.get('ch:' + ctx.mk, []));
      const qBox = el.querySelector('.chip-q');
      const sync = () => {
        el.querySelectorAll('.cl-item').forEach(b => {
          const k = +b.dataset.k, it = m.items[k];
          b.classList.toggle('ok', solved.has(k));
          b.querySelector('b').textContent = solved.has(k) ? it.label : '?';
        });
        if (solved.size === m.items.length) ctx.complete();
      };
      solved.forEach(k => { const it = m.items[k]; ctx.plan.setChip(it.parent, it.i, it.label, it.ch); });
      const target = it => {
        ctx.plan.el.querySelectorAll('.link-chip.target').forEach(x => x.classList.remove('target'));
        const c = ctx.plan.el.querySelector(`.link-chip[data-parent="${it.parent}"][data-i="${it.i}"]`);
        if (c) c.classList.add('target');
      };
      const open = k => {
        const it = m.items[k];
        ctx.plan.setChapter(it.ch); target(it);
        el.querySelectorAll('.cl-item').forEach(b => b.classList.toggle('cur', +b.dataset.k === k));
        qBox.innerHTML = `<p class="ex-label">${it.titre}</p>
          <div class="rel-pair"><span class="rel-a">${it.between[0]}</span><span class="rel-arrow"><span class="rel-q">${solved.has(k) ? it.label : '?'}</span></span><span class="rel-b">${it.between[1]}</span></div>
          <p class="ex-q">${it.q}</p><div class="qcm-opts">${it.options.map((o, j) => `<button class="qopt" data-j="${j}"><span class="qletter">${'ABC'[j]}</span><span>${o.t}</span></button>`).join('')}</div>
          <p class="qfb"></p><div class="model" ${solved.has(k) ? '' : 'hidden'}><p class="model-t">Le corrigé <small>(les mots du lien sont soulignés)</small></p><p>${it.model}</p></div>
          <button class="btn sm cq-next" hidden>Lien suivant →</button>`;
        const fb = qBox.querySelector('.qfb'), nx = qBox.querySelector('.cq-next');
        qBox.querySelectorAll('.qopt').forEach(b => b.addEventListener('click', () => {
          const o = it.options[+b.dataset.j];
          b.classList.add('picked', o.ok ? 'good' : 'bad');
          fb.className = 'qfb ' + (o.ok ? 'good' : 'bad'); fb.innerHTML = `<strong>${o.ok ? 'Oui.' : 'Pas tout à fait.'}</strong> ${o.fb}`;
          if (o.ok) {
            solved.add(k); store.set('ch:' + ctx.mk, [...solved]);
            ctx.plan.setChip(it.parent, it.i, it.label, it.ch);
            ctx.plan.say(`Lien révélé : <b>${it.label}</b>`, 'good');
            qBox.querySelector('.rel-q').textContent = it.label;
            qBox.querySelector('.model').hidden = false;
            const nk = m.items.findIndex((_, j) => !solved.has(j));
            if (nk >= 0) { nx.hidden = false; nx.onclick = () => open(nk); }
            sync();
          }
        }));
      };
      ctx.onChip = (parent, i, key) => { const k = m.items.findIndex(it => it.ch === key && it.parent === parent && it.i === i); if (k >= 0) open(k); };
      el.querySelectorAll('.cl-item').forEach(b => b.addEventListener('click', () => open(+b.dataset.k)));
      sync();
    }
  };

  // --- Problématique : ce qu'elle couvre s'allume dans le plan
  M.cover = {
    render: m => `<p class="m-consigne">${m.consigne}</p><div class="cov-opts">${m.options.map((o, j) => `<button class="cov" data-j="${j}"><span class="cov-l">${'ABC'[j]}</span><span class="cov-t">${o.t}</span></button>`).join('')}</div>
      <div class="cov-legend"><span class="lg-c">couvert</span><span class="lg-p">en partie</span><span class="lg-m">oublié</span></div><p class="qfb"></p>`,
    mount(el, m, ctx) {
      ctx.plan.setChapter(m.ch);
      const parts = ctx.matiere.chapitres[m.ch].children.map(c => c.tok || c.num);
      const pick = j => {
        const o = m.options[j];
        ['covered', 'partial', 'missing'].forEach(c => ctx.plan.unmark(c, m.ch));
        ctx.plan.clearFocus(); ctx.plan.resetCamera();
        parts.forEach(p => {
          if (o.covers.includes(p)) ctx.plan.mark(p, 'covered');
          else if (o.covers.some(c => c.startsWith(p + '.'))) { ctx.plan.mark(p, 'partial'); o.covers.filter(c => c.startsWith(p + '.')).forEach(c => ctx.plan.mark(c, 'covered')); }
          else ctx.plan.mark(p, 'missing');
        });
        ctx.plan.mark('', o.ok ? 'covered' : 'missing');
        el.querySelectorAll('.cov').forEach(b => b.classList.toggle('picked', +b.dataset.j === j));
        el.querySelector(`.cov[data-j="${j}"]`).classList.add(o.ok ? 'good' : 'bad');
        const fb = el.querySelector('.qfb');
        fb.className = 'qfb ' + (o.ok ? 'good' : 'bad'); fb.innerHTML = `<strong>${o.ok ? 'Oui.' : 'Regardez le plan.'}</strong> ${o.fb}`;
        if (o.ok) { ctx.plan.say('Toutes les parties sont couvertes ✓', 'good'); ctx.complete(); }
      };
      el.querySelectorAll('.cov').forEach(b => b.addEventListener('click', () => pick(+b.dataset.j)));
      if (ctx.wasDone) pick(m.options.findIndex(o => o.ok));
    },
    leave(ctx, m) { ['covered', 'partial', 'missing'].forEach(c => ctx.plan.unmark(c, m.ch)); }
  };

  // --- Remettre le raisonnement dans l'ordre, puis le rejouer
  M.order = {
    render: m => `<p class="m-consigne">${m.consigne}</p><div class="ord"><div class="ord-pool"></div><ol class="ord-built"></ol></div>
      <p class="m-fb" aria-live="polite"></p><button class="btn sm ord-play" hidden>▶ Rejouer l’enchaînement dans le plan</button>`,
    mount(el, m, ctx) {
      ctx.plan.setChapter(m.ch);
      let n = 0;
      const pool = el.querySelector('.ord-pool'), built = el.querySelector('.ord-built'), fb = el.querySelector('.m-fb'), play = el.querySelector('.ord-play');
      const spot = codes => { ctx.plan.unmark('spot'); ctx.plan.focus(codes[0], { camera: true, panel: false }); codes.slice(1).forEach(c => ctx.plan.mark(c, 'spot')); };
      const add = k => {
        const s = m.sentences[k];
        built.insertAdjacentHTML('beforeend', `<li><span class="stag">${s.tag}</span><span>${s.t}</span></li>`);
        const b = pool.querySelector(`[data-k="${k}"]`); if (b) b.remove();
        n++;
      };
      pool.innerHTML = shuffle(m.sentences.map((s, k) => k), m.ch === 'c1' ? 5 : 9).map(k => `<button class="ord-s" data-k="${k}">${m.sentences[k].t}</button>`).join('');
      pool.querySelectorAll('.ord-s').forEach(b => b.addEventListener('click', () => {
        const k = +b.dataset.k;
        if (k === n) {
          add(k); spot(m.sentences[k].codes);
          fb.className = 'm-fb good'; fb.innerHTML = `<strong>Oui.</strong> Cette phrase traite <b>${m.sentences[k].tag}</b>.`;
          if (n === m.sentences.length) finish();
        } else {
          b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
          fb.className = 'm-fb bad'; fb.innerHTML = `Pas encore. Suivez l’ordre du plan : d’abord I, puis II ; dans chaque partie, A avant B. La conclusion vient en dernier.`;
        }
      }));
      let timer = null;
      const finish = () => { fb.className = 'm-fb good'; fb.innerHTML = '<strong>Paragraphe reconstitué !</strong> Rejouez-le pour voir le raisonnement parcourir le plan.'; play.hidden = false; ctx.complete(); };
      play.addEventListener('click', () => {
        clearTimeout(timer);
        const lis = [...built.children]; let i = 0;
        const step = () => {
          lis.forEach((li, j) => li.classList.toggle('lit', j === i));
          spot(m.sentences[i].codes);
          i++; if (i < lis.length) timer = setTimeout(step, 2600); else timer = setTimeout(() => { lis.forEach(li => li.classList.remove('lit')); ctx.plan.unmark('spot'); ctx.plan.clearFocus(); ctx.plan.resetCamera(); }, 2600);
        };
        step();
      });
      ctx.cleanup = () => clearTimeout(timer);
      if (ctx.wasDone) { m.sentences.forEach((_, k) => add(k)); finish(); }
    },
    leave(ctx) { ctx.plan.unmark('spot'); }
  };

  // --- Présentation guidée : la caméra suit le texte
  M.tour = {
    render: m => `<p class="m-consigne">${m.consigne}</p>
      <div class="tour"><div class="tour-top"><span class="tour-h"></span><span class="tour-n"></span></div><div class="tour-bar"><span></span></div>
      <div class="tour-p"></div>
      <div class="tour-nav"><button class="btn ghost sm t-prev">← Précédent</button><button class="btn sm t-auto">▶ Lecture automatique</button><button class="btn sm t-next">Suivant →</button></div></div>`,
    mount(el, m, ctx) {
      let i = store.get('tour:' + ctx.mk, 0), timer = null;
      const P = el.querySelector('.tour-p'), auto = el.querySelector('.t-auto');
      const show = () => {
        const p = m.paras[i];
        store.set('tour:' + ctx.mk, i);
        ctx.plan.setChapter(p.ch); ctx.plan.unmark('spot');
        ctx.plan.focus(p.codes[0], { camera: true, panel: false }); p.codes.slice(1).forEach(c => ctx.plan.mark(c, 'spot'));
        el.querySelector('.tour-h').textContent = p.h;
        el.querySelector('.tour-n').textContent = `${i + 1} / ${m.paras.length}`;
        el.querySelector('.tour-bar span').style.width = ((i + 1) / m.paras.length * 100) + '%';
        P.className = 'tour-p' + (p.tr ? ' tr' : ''); void P.offsetWidth; P.classList.add('in');
        P.innerHTML = (p.tr ? '<span class="tr-lbl">Transition</span>' : '') + p.t;
        el.querySelector('.t-prev').disabled = i === 0; el.querySelector('.t-next').disabled = i === m.paras.length - 1;
        if (i === m.paras.length - 1) ctx.complete();
      };
      const stop = () => { clearTimeout(timer); timer = null; auto.textContent = '▶ Lecture automatique'; };
      const tick = () => { if (i < m.paras.length - 1) { i++; show(); timer = setTimeout(tick, Math.max(6000, m.paras[i].t.length * 55)); } else stop(); };
      el.querySelector('.t-prev').addEventListener('click', () => { stop(); if (i > 0) { i--; show(); } });
      el.querySelector('.t-next').addEventListener('click', () => { stop(); if (i < m.paras.length - 1) { i++; show(); } });
      auto.addEventListener('click', () => { if (timer) return stop(); auto.textContent = '❚❚ Pause'; timer = setTimeout(tick, Math.max(6000, m.paras[i].t.length * 55)); });
      ctx.cleanup = stop;
      show();
    },
    leave(ctx) { ctx.plan.unmark('spot'); }
  };

  // --- Liste de vérification + bilan
  M.check = {
    render: m => `<p class="m-consigne">${m.consigne}</p><ul class="chk">${m.items.map((t, k) => `<li><label><input type="checkbox" data-k="${k}"><span>${t}</span></label></li>`).join('')}</ul>
      <p class="ex-q">${m.bilan.prompt}</p><textarea rows="3" placeholder="Votre bilan…"></textarea>
      <details class="bilan-d"><summary>Voir un exemple de bilan</summary><p>${m.bilan.model}</p></details>`,
    mount(el, m, ctx) {
      const boxes = [...el.querySelectorAll('.chk input')];
      const upd = () => { if (boxes.every(b => b.checked)) ctx.complete(); };
      boxes.forEach(b => { const k = `c:${m.id}:${b.dataset.k}`; b.checked = store.get(k, false); b.addEventListener('change', () => { store.set(k, b.checked); upd(); }); });
      const ta = el.querySelector('textarea'); ta.value = store.get('t:bilan-' + m.id, ''); ta.addEventListener('input', () => store.set('t:bilan-' + m.id, ta.value));
      upd();
    }
  };

  // =====================================================================
  //  PAGES
  // =====================================================================
  function shell(inner, cls) { app.className = cls || ''; app.innerHTML = inner; window.scrollTo(0, 0); }

  function stepper(mid, current) {
    return `<ol class="stepper">${ETAPES.map((e, k) => `<li class="${e.couleur}${e.key === current ? ' cur' : ''}${isDone(mid, e.key) ? ' done' : ''}">
      <a href="#/m/${mid}/${e.key}"><span class="st-n">${isDone(mid, e.key) ? '✓' : e.icone}</span><span class="st-name">${e.nom}</span></a></li>`).join('')}</ol>`;
  }

  function pageEtape(mid, ekey) {
    const m = window.MATIERES[mid];
    const k = ETAPES.findIndex(e => e.key === ekey);
    if (!m || k < 0) return pageMatiere(mid);
    const e = ETAPES[k], step = m.etapes[ekey], prev = ETAPES[k - 1], next = ETAPES[k + 1];
    const N = step.missions.length;
    shell(`
      <nav class="crumbs"><a href="#/">Accueil</a><i>›</i><a href="#/m/${mid}">${m.nom}</a><i>›</i><span>${e.nom}</span></nav>
      ${stepper(mid, ekey)}
      <header class="studio-head ${e.couleur}"><span class="sh-icon">${e.icone}</span><div><p class="eyebrow">Étape ${k + 1} sur ${ETAPES.length} · ${N} mission${N > 1 ? 's' : ''}</p><h1>${e.nom}</h1><p class="sh-intro">${step.intro}</p></div></header>
      <div class="studio-plan"></div>
      <section class="mission ${e.couleur}" aria-live="polite">
        <div class="mi-head"><div class="mi-dots">${step.missions.map((x, j) => `<button class="mi-dot" data-j="${j}" title="${esc(x.titre)}">${j + 1}</button>`).join('')}</div>
          <p class="mi-kicker"></p><h2 class="mi-title"></h2><span class="burst" aria-hidden="true"></span></div>
        <div class="mi-body"></div>
        <div class="mi-foot"><button class="btn ghost sm mi-prev">← Mission précédente</button><span class="mi-done-lbl"></span><button class="btn sm mi-next"></button></div>
      </section>
      <details class="langue ${e.couleur}"><summary><span>Aa</span> Point de langue · ${step.langue.titre}</summary><div class="lg-body">${step.langue.html}${step.langue.connectors ? CONNECTEURS : ''}</div></details>
      <div class="pnav">${prev ? `<a class="btn ghost" href="#/m/${mid}/${prev.key}">← ${prev.nom}</a>` : `<a class="btn ghost" href="#/m/${mid}">← Le parcours</a>`}
        ${next ? `<a class="btn primary" href="#/m/${mid}/${next.key}">${next.nom} →</a>` : `<a class="btn primary" href="#/m/${mid}">Terminer le parcours ✓</a>`}</div>`, 'etape ' + e.couleur);

    const ctx = { onCard: null, onChip: null, onView: null, cleanup: null, complete: null, wasDone: false, mk: '', matiere: m };
    const chs = Object.keys(m.chapitres).map(kk => ({ key: kk, data: m.chapitres[kk] }));
    ctx.plan = window.Plan3D(app.querySelector('.studio-plan'), chs, {
      start: step.plan.start === 'vertical' && !store.get(`md:${mid}:${ekey}:0`, false) ? 'vertical' : 'horizontal',
      links: step.plan.links, sens: 'cache', fitHeight: true, levels: m.niveaux,
      onCard: (code, f, el) => ctx.onCard ? ctx.onCard(code, f, el) : false,
      onChip: (p, i, kk) => { if (ctx.onChip) ctx.onChip(p, i, kk); },
      onView: v => { if (ctx.onView) ctx.onView(v); }
    });

    const box = app.querySelector('.mission');
    const doneKey = j => `md:${mid}:${ekey}:${j}`;
    let cur = Math.min(store.get(`mi:${mid}:${ekey}`, 0), N - 1), curDef = null;

    const refreshDots = () => box.querySelectorAll('.mi-dot').forEach(d => {
      const j = +d.dataset.j; d.classList.toggle('cur', j === cur); d.classList.toggle('ok', !!store.get(doneKey(j), false));
      d.textContent = store.get(doneKey(j), false) ? '✓' : j + 1;
    });
    const setNext = () => {
      const nb = box.querySelector('.mi-next'), ok = !!store.get(doneKey(cur), false);
      box.querySelector('.mi-done-lbl').textContent = ok ? 'Mission accomplie ✓' : '';
      if (cur < N - 1) { nb.textContent = ok ? 'Mission suivante →' : 'Passer cette mission →'; nb.classList.toggle('ghost', !ok); }
      else { nb.textContent = next ? `Étape suivante : ${next.nom} →` : 'Terminer le parcours ✓'; nb.classList.toggle('ghost', !ok); }
      box.querySelector('.mi-prev').disabled = cur === 0;
    };

    function open(j) {
      if (ctx.cleanup) ctx.cleanup();
      if (curDef && M[curDef.type].leave) M[curDef.type].leave(ctx, curDef);
      ctx.plan.el.querySelectorAll('.link-chip.target').forEach(x => x.classList.remove('target'));
      Object.assign(ctx, { onCard: null, onChip: null, onView: null, cleanup: null });
      cur = j; store.set(`mi:${mid}:${ekey}`, j);
      const def = step.missions[j]; curDef = def;
      ctx.mk = `${mid}:${ekey}:${j}`;
      ctx.wasDone = !!store.get(doneKey(j), false);
      ctx.complete = () => {
        if (!store.get(doneKey(j), false)) {
          store.set(doneKey(j), true);
          const b = box.querySelector('.burst'); b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
          if (step.missions.every((_, q) => store.get(doneKey(q), false))) {
            store.set(`done:${mid}:${ekey}`, true);
            const st = app.querySelector('.stepper'); if (st) st.outerHTML = stepper(mid, ekey);
          }
        }
        refreshDots(); setNext();
      };
      box.querySelector('.mi-kicker').textContent = `Mission ${j + 1} sur ${N}`;
      box.querySelector('.mi-title').textContent = def.titre;
      const body = box.querySelector('.mi-body');
      body.innerHTML = M[def.type].render(def);
      body.classList.remove('in'); void body.offsetWidth; body.classList.add('in');
      M[def.type].mount(body, def, ctx);
      refreshDots(); setNext();
    }

    box.querySelectorAll('.mi-dot').forEach(d => d.addEventListener('click', () => open(+d.dataset.j)));
    box.querySelector('.mi-prev').addEventListener('click', () => { if (cur > 0) { open(cur - 1); box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } });
    box.querySelector('.mi-next').addEventListener('click', () => {
      if (cur < N - 1) { open(cur + 1); app.querySelector('.studio-plan').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      else location.hash = next ? `#/m/${mid}/${next.key}` : `#/m/${mid}`;
    });
    window.__stepCleanup = () => { if (ctx.cleanup) ctx.cleanup(); };
    open(cur);
  }

  function pageVoyage(mid) {
    const m = window.MATIERES[mid] || window.MATIERES.gqc;
    document.body.classList.add('immersive');
    shell(`<h1 class="sr-only">Le voyage du plan</h1><div class="voyage" id="voyage"></div>`, 'page-voyage');
    window.Voyage(document.getElementById('voyage'), m);
  }

  function pageHome() {
    shell(`
      <section class="hero">
        <div class="hero-txt">
          <p class="eyebrow">TD Accompagnement · L1 AES · 2026-2027</p>
          <h1>Lire un syllabus,<br><em>comprendre un cours.</em></h1>
          <p class="hero-p">Un plan de cours n’est pas une simple liste de titres : c’est un <strong>raisonnement</strong>. Ici, vous le faites apparaître <strong>en le manipulant</strong> : le plan se déploie en 3D, les blocs s’allument, les liens se révèlent.</p>
          <div class="hero-cta"><a class="btn primary big" href="#/" onclick="document.getElementById('matieres').scrollIntoView({ behavior: 'smooth' }); return false;">Choisir une matière →</a><a class="btn ghost" href="#/methode">Découvrir la méthode</a></div>
        </div>
        <div class="hero-3d" aria-hidden="true"><div class="h3-stack">
          <div class="h3-card c4"><b>Reformuler</b><span>Reconstruire</span></div><div class="h3-card c3"><b>Relier</b><span>Expliquer</span></div>
          <div class="h3-card c2"><b>Repérer</b><span>Clarifier</span></div><div class="h3-card c1"><b>Observer</b><span>Situer</span></div></div></div>
      </section>
      <section class="sec"><div class="home-voyage"><div><h2>Le voyage du plan</h2><p>Tout le parcours sur une seule page : le plan vertical s’envole vers l’horizontale, puis se transforme en phrases et en raisonnement.</p></div><a class="btn big" href="#/voyage/droit">Lancer le voyage ▶</a></div></section>
      <section class="sec teaser">
        <h2>Ce qui vous attend</h2>
        <div class="tz-grid">
          <div class="tz obs"><span>◎</span><b>Le plan se déplie</b><p>La liste du syllabus bascule et devient un arbre en relief que vous faites pivoter.</p></div>
          <div class="tz rep"><span>✦</span><b>Les blocs s’allument</b><p>Associez chaque phrase à son bloc : le plan se colore au fil de vos réussites.</p></div>
          <div class="tz rel"><span>⇄</span><b>Les liens se révèlent</b><p>Chaque flèche cache un « ? ». Trouvez le bon lien : il s’inscrit dans le plan.</p></div>
          <div class="tz ref"><span>❖</span><b>La problématique s’éclaire</b><p>Testez une problématique : le plan montre ce qu’elle couvre… et ce qu’elle oublie.</p></div>
          <div class="tz ora"><span>♪</span><b>La caméra vous suit</b><p>En présentation guidée, le plan suit chaque paragraphe que vous prononcez.</p></div>
        </div>
      </section>
      <section class="sec" id="matieres">
        <h2>Les parcours par matière</h2>
        <div class="mgrid">${matieres().map(mm => {
          const dc = ETAPES.filter(e => isDone(mm.id, e.key)).length;
          return `<div class="mcard live"><span class="m-state">${dc ? `${dc} / ${ETAPES.length} étapes` : 'Disponible'}</span>
            <p class="m-name">${mm.nom}</p><p class="m-per">${mm.perimetre}</p>
            <div class="m-prog">${ETAPES.map(e => `<span class="${e.couleur}${isDone(mm.id, e.key) ? ' on' : ''}"></span>`).join('')}</div>
            <div class="m-acts"><a class="btn sm" href="#/voyage/${mm.id}">▶ Voyage 3D</a><a class="btn ghost sm" href="#/m/${mm.id}">Missions</a></div></div>`;
        }).join('')}
        </div>
      </section>`, 'home');
  }

  function pageMethode() {
    shell(`
      <nav class="crumbs"><a href="#/">Accueil</a><i>›</i><span>La méthode</span></nav>
      <header class="phead"><p class="eyebrow">Séance 2 · Support de cours commun</p><h1>La méthode du syllabus</h1>
        <p class="lead">Présenter la <strong>cohérence</strong> d’un plan et son rapport à une <strong>problématique</strong>, en quatre gestes.</p></header>
      <div class="meth-grid">
        <section class="mcard2 obs"><span class="mc-i">◎</span><h2>Observer</h2><p class="mc-v">Situer</p><p>Situer la partie étudiée et reconnaître les <strong>niveaux</strong> du plan : chapitre, grandes parties, sous-parties, points.</p><p class="mc-q">Où suis-je, et comment ce plan est-il construit ?</p></section>
        <section class="mcard2 rep"><span class="mc-i">✦</span><h2>Repérer</h2><p class="mc-v">Clarifier</p><p>Clarifier les mots utiles et le sujet de chaque titre, <strong>sans en changer le sens</strong>. « Mais on ne se marie pas forcément » ≠ « on ne se marie plus ».</p><p class="mc-q">Qu’annonce exactement ce titre ?</p></section>
        <section class="mcard2 rel"><span class="mc-i">⇄</span><h2>Relier</h2><p class="mc-v">Expliquer</p><p>Expliquer pourquoi les sujets sont associés et présentés dans cet ordre. <strong>Ordre ≠ cause</strong> : la succession des titres ne prouve rien à elle seule.</p><p class="mc-q">Quel est le rôle de ce bloc par rapport à son voisin ?</p></section>
        <section class="mcard2 ref"><span class="mc-i">❖</span><h2>Reformuler</h2><p class="mc-v">Reconstruire</p><p>Réunir les liens dans une présentation suivie, au <strong>présent du commentaire</strong>, avec des reprises claires.</p><p class="mc-q">À quelle question ce plan permet-il de répondre ?</p></section>
      </div>
      <section class="sec"><h2>Les mots du lien</h2>${CONNECTEURS}
        <p class="conn-foot">« Parce que » introduit une proposition avec un verbe ; « en raison de » est suivi d’un groupe nominal.</p></section>
      <div class="pnav"><a class="btn ghost" href="#/">← Accueil</a><a class="btn primary" href="#/m/gqc/observer">Appliquer la méthode →</a></div>`, 'methode');
  }

  function pageMatiere(mid) {
    const m = window.MATIERES[mid];
    if (!m) return pageHome();
    shell(`
      <nav class="crumbs"><a href="#/">Accueil</a><i>›</i><span>${m.nom}</span></nav>
      <header class="phead"><p class="eyebrow">Parcours</p><h1>${m.nom}</h1><p class="lead">${m.perimetre}</p></header>
      <aside class="goal"><p class="goal-t">L’objectif du parcours</p><p>${m.objectif}</p></aside>
      <p class="note-src">${m.avertissement}</p>
      <div class="steps-grid">${ETAPES.map((e, k) => `
        <a class="step-card ${e.couleur}${isDone(mid, e.key) ? ' done' : ''}" href="#/m/${mid}/${e.key}">
          <span class="sc-n">${isDone(mid, e.key) ? '✓' : e.icone}</span><p class="sc-name">${k + 1}. ${e.nom}</p><p class="sc-d">${e.resume}</p>
          <span class="sc-m">${m.etapes[e.key].missions.length} missions</span><span class="sc-go">${isDone(mid, e.key) ? 'Revoir' : 'Commencer'} →</span></a>`).join('')}</div>
      <div class="pnav"><a class="btn ghost" href="#/voyage/${mid}">▶ Voir le voyage 3D</a><a class="btn primary" href="#/m/${mid}/observer">Commencer les missions →</a></div>`, 'matiere');
  }

  function route() {
    if (window.__stepCleanup) { window.__stepCleanup(); window.__stepCleanup = null; }
    document.body.classList.remove('immersive');
    const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
    document.querySelectorAll('.topnav a').forEach(a => {
      const h = a.getAttribute('href');
      a.classList.toggle('on', parts[0] === 'm' ? h.startsWith('#/m/') : h === '#/' + (parts[0] || ''));
    });
    if (!parts.length) return pageHome();
    if (parts[0] === 'methode') return pageMethode();
    if (parts[0] === 'voyage') return pageVoyage(parts[1] || 'droit');
    if (parts[0] === 'm' && parts[1] && parts[2]) return pageEtape(parts[1], parts[2]);
    if (parts[0] === 'm') return pageMatiere(parts[1] || 'gqc');
    pageHome();
  }

  window.addEventListener('hashchange', route);
  document.addEventListener('DOMContentLoaded', route);
})();
