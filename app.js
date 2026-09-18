/* Интерфейс работает и через file://, и с локальным HTTP-сервером. */
(() => {
  'use strict';
  const D = window.ColdWarData, E = window.ColdWarEngine;
  const app = document.querySelector('#app'), modal = document.querySelector('#modal');
  const saveKey = 'on-the-brink.save.v2';
  let state = null, view = 'home', storageOK = true, toastTimer, showHistoricalHints = false;
  const esc = s => String(s).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const sign = n => n > 0 ? `+${n}` : `${n}`;
  function notice(message) {
    const box = document.querySelector('#notice');
    clearTimeout(toastTimer); box.textContent = message; box.hidden = false;
    toastTimer = setTimeout(() => { box.hidden = true; }, 5500);
  }
  try {
    const raw = localStorage.getItem(saveKey);
    if (!raw && localStorage.getItem('on-the-brink.save.v1')) notice('Обновлён сценарий: начните новую кампанию. Сохранение первой версии оставлено в браузере.');
    if (raw) { state = E.restore(raw); if (!state) notice('Сохранение повреждено или несовместимо. Можно начать новую кампанию.'); }
  } catch { storageOK = false; }
  function persist() {
    try { localStorage.setItem(saveKey, E.serialize(state)); storageOK = true; }
    catch { storageOK = false; notice('Браузер не разрешает сохранение. Кампания работает до закрытия вкладки; журнал можно скачать.'); }
  }
  const flag = side => `<span class="flag ${side}" aria-hidden="true">${side === 'ussr' ? '★' : ''}</span>`;
  function sourceLinks(ids) {
    return `<div class="source-links">${ids.map(id => { const s = D.sources[id]; return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} <span aria-hidden="true">↗</span></a>`; }).join('')}</div>`;
  }
  function home() {
    view = 'home';
    app.innerHTML = `<section class="landing"><div class="intro-grid"><div class="intro"><div class="eyebrow">ИНТЕРАКТИВНАЯ НОВЕЛЛА <span aria-hidden="true">/</span> 1945–1991</div><h1>НА<br><em>ГРАНИ.</em></h1><h2>Две сверхдержавы.<br>Один мир, который нельзя потерять.</h2><p>Почему союзники стали противниками? Разберитесь в интересах сторон, выберите собственный курс и измените ход следующих событий. От восстановления Европы до будущего СССР — решения оставляют след.</p></div><div class="hero-art"><img src="assets/world.svg" alt="Стилизованная схема противостояния Вашингтона и Москвы"><div class="art-caption"><span>ДОСЬЕ № 001 / ХОЛОДНАЯ ВОЙНА</span><span>${D.episodes.length} ЭПИЗОДОВ</span></div><div class="orbit" aria-hidden="true"></div><div class="art-bottom"><div><b>1945</b><br>НАЧАЛО ПРОТИВОСТОЯНИЯ</div><div><b>1991</b><br>КОНЕЦ ЭПОХИ</div></div></div></div><section class="selection" aria-labelledby="side-title"><div class="section-heading"><h3 id="side-title">Выберите сторону истории</h3><span>01 / НАЧАЛО КАМПАНИИ</span></div><div class="side-grid"><button class="side-card" data-action="start" data-side="usa">${flag('usa')}<span><strong>Соединённые Штаты</strong><small>Сдерживание, союзы и глобальное влияние</small></span><span class="arrow" aria-hidden="true">↗</span></button><button class="side-card" data-action="start" data-side="ussr">${flag('ussr')}<span><strong>Советский Союз</strong><small>Безопасность границ, социалистический блок и паритет</small></span><span class="arrow" aria-hidden="true">↗</span></button></div><div class="landing-foot"><span class="micro">≈ 45–70 минут · ${D.episodes.length} эпизодов · 2 точки зрения<br>Развилки истории, внутренняя политика и последствия вашего курса.</span>${state ? `<button class="resume-button" data-action="resume">${state.phase === 'ending' ? 'Открыть итоги' : 'Продолжить'} · ${D.sides[state.side]} · ${D.episodes[state.index].year} <span>→</span></button>` : `<span class="micro">${storageOK ? 'Прогресс сохраняется в этом браузере' : 'Сохранение недоступно в настройках браузера'}</span>`}</div></section></section>`;
  }
  function metrics(values = state.stats, labels = D.metrics) {
    const hints = { tension: '100 — военная развилка', resources: 'Текущие средства на политику', influence: 'Политический вес вашей стороны', trust: 'Возможность заключать договоры', economy: 'Определяет будущие поступления', allies: 'Поддержка, а не число государств', readiness: 'Обычные силы и снабжение', stability: 'Способность проводить курс внутри страны' };
    return Object.entries(labels).map(([key,label]) => `<div class="metric ${key}"><div class="metric-head"><span>${label}</span><strong>${values[key]}</strong></div><div class="meter" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${values[key]}"><span style="width:${values[key]}%"></span></div><p>${hints[key]}</p></div>`).join('');
  }
  function strategicPanel() {
    return `<div class="strategic-panel"><h3>Основа вашего курса</h3>${metrics(state.strategic,D.strategic)}<details class="rival-details"><summary>Состояние соперника</summary><p>Экономика: ${state.rival.economy}<br>Союзная поддержка: ${state.rival.allies}<br>Готовность армии: ${state.rival.readiness}</p><p>Условная реакция на ваш курс и фон эпохи. Это не реальные исторические измерения.</p></details></div>`;
  }
  function deltas(delta, labels = D.metrics, omitZero = false) {
    return `<div class="deltas">${Object.entries(labels).filter(([k]) => !omitZero || delta[k]).map(([k,label]) => { const n = delta[k] || 0, good = k === 'tension' ? n < 0 : n > 0; return `<span class="delta ${n === 0 ? 'neutral' : good ? 'good' : 'bad'}">${label} ${sign(n)}</span>`; }).join('')}</div>`;
  }
  function exposition(ep) {
    const x = ep.exposition;
    return `<section class="exposition"><span class="eyebrow">РАЗОБРАТЬСЯ В СИТУАЦИИ</span><h3>Как мы здесь оказались</h3><p>${esc(x.origin)}</p><h4>Чего хотят участники</h4><ul>${x.interests.map(t => `<li>${esc(t)}</li>`).join('')}</ul><div class="stakes"><h4>Почему ваше решение важно</h4><p>${esc(x.stakes)}</p></div></section>`;
  }
  function branchContext(ep) {
    const carry = state.phase === 'decision' ? E.carry(state) : state.history.at(-1)?.carry || [];
    return `${ep.branch ? `<section class="branch-card"><span class="eyebrow">ВАША АЛЬТЕРНАТИВНАЯ ИСТОРИЯ</span><h3>Прошлое изменило эту главу</h3><p>${esc(ep.branch.reason)}</p><details><summary>На чём основано допущение</summary><p>${esc(ep.branch.caveat)}</p>${sourceLinks(ep.branch.sources)}</details></section>` : ''}${carry.length ? `<details class="carry" open><summary>Что пришло из ваших прошлых решений</summary><ul>${carry.map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>` : ''}`;
  }
  function fiscalPreview(c) {
    if(state.index === D.episodes.length-1 || E.availability(state,c)) return '';
    const next = D.episodes[state.index+1];
    // Условная сцена создаётся заново при resolve: сравниваем содержание выбора,
    // а не ссылки на объекты из двух разных экземпляров сцены.
    const idx = E.current(state).choices[state.side].findIndex(choice => choice.title === c.title);
    const after = E.choose(state,idx), budget = E.budget(after,next), before = E.budget(state,next);
    if(budget.net === before.net) return '';
    return `<span class="fiscal-preview">Регулярный бюджет в следующей главе: ${sign(budget.net)} (${sign(budget.net-before.net)} к прежнему курсу). Уже учитывает поступления и содержание.</span>`;
  }
  function sceneArt(motif) {
    const drawings = {
      conference: '<path d="M38 153h224v12H38zM55 165l-8 66m198-66 8 66M75 111v40m150-40v40M68 108q8-18 15 0m134 0q8-18 15 0"/><circle cx="97" cy="88" r="14"/><path d="M73 142v-24q24-20 48 0v24"/><circle cx="204" cy="88" r="14"/><path d="M180 142v-24q24-20 48 0v24M150 50v95m0-95 39 14-39 13"/>',
      rebuild: '<path d="M34 223h241M51 223V113h53v110M119 223V75h54v148M189 223V137h59v86M47 103l31-26 31 26M115 65l30-26 32 26M62 132h28m-28 24h28m-28 24h28m40-84h32m-32 27h32m-32 27h32m-32 27h32m38-20h33m-33 25h33"/>',
      airlift: '<path d="m39 127 99-6 12-67 13 2 2 64 98 32-2 10-99-14-5 46 21 16-3 9-31-9-27 2-1-10 19-15-4-46-91-3zM38 237h230M55 237v-28h52v28m91 0v-39h57v39"/>',
      conflict: '<path d="M25 211 70 136l27 24 47-94 52 92 21-21 61 74M92 211l53-75 38 75M150 25v20m0 184v30M18 142h24m220 0h24"/><circle cx="150" cy="142" r="96" stroke-dasharray="4 7"/>',
      mountains: '<path d="m12 229 70-131 41 75 52-129 110 185zM56 145l26-47 22 40M153 99l22-55 31 52M73 230v-31h51v31m75 0v-43h32v43"/>',
      city: '<path d="M22 231h257M39 231v-93h50v93m21 0V96h66v135m19 0V124h62v107M126 96V70h33v26m-30-26 14-30 13 30M50 156h27m-27 25h27m-27 25h27m47-84h37m-37 30h37m-37 30h37m45-35h36m-36 28h36m-36 28h36"/>',
      wall: '<path d="M18 240V122L282 83v157M18 151l264-31M18 180l264-22M18 210l264-11M60 116v29m44-35v29m48-36v31m49-39v33m43-39v33M42 149v29m46-32v29m46-36v37m49-42v35m47-40v37M70 178v28m65-34v31m66-39v38M35 120V92l17-20m29 39V78l17-20m35 47V70l17-20m35 47V62l17-20m37 47V56l17-20M30 97l235-43"/>',
      missile: '<path d="M92 216V84q10-44 23-57 14 15 24 57v132zM92 189l-23 32v19l23-11m47-40 23 32v19l-23-11M91 91h49M103 231v24m23-24v24M193 203V99q8-28 18-44 12 17 20 44v104zM193 181l-19 34v14l19-9m38-39 19 34v14l-19-9M192 104h40M203 223v22m17-22v22"/><circle cx="115" cy="133" r="14"/>',
      space: '<ellipse cx="150" cy="143" rx="132" ry="68" transform="rotate(-28 150 143)" stroke-dasharray="3 5"/><circle cx="150" cy="143" r="58"/><path d="m165 124 83-58m-79 69 100-10m-104 29 79 48m-97-39 18 96"/><path d="M114 97q-27 47 12 94M143 88q-30 55 18 112"/><circle cx="54" cy="171" r="5"/>'
    };
    return `<svg class="scene-art" viewBox="0 0 300 280" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">${drawings[motif] || drawings.conference}</svg>`;
  }
  function timeline() {
    return `<div class="timeline" aria-label="Хронология кампании">${D.episodes.map((e, i) => `<span class="time-node ${i === state.index ? 'current' : i < state.index ? 'done' : ''}" ${i === state.index ? 'aria-current="step"' : ''} title="${esc(e.title)}">${e.year}</span>`).join('')}</div>`;
  }
  function historyBox(ep) {
    return `<section class="history-box"><span class="eyebrow">СВЕРКА С ИСТОРИЕЙ</span><h3>Что произошло в действительности</h3><p>${esc(ep.history)}</p>${sourceLinks(ep.sources)}</section>`;
  }
  function decisions(ep) {
    return `${exposition(ep)}<div class="briefing"><span class="eyebrow">ВАША ПЕРСПЕКТИВА / ${esc(ep.leaders[state.side])}</span><p>${esc(ep.briefs[state.side])}</p></div><div class="choices-heading"><h3>Ваше решение</h3><button class="text-button" data-action="historical-hints">${showHistoricalHints ? 'Скрыть исторические подсказки' : 'Показать исторические подсказки'}</button></div><p class="route-state">${state.historical ? 'Вы пока следуете историческому маршруту.' : 'Ваш маршрут уже отличается от реального. Следующие главы учитывают принятый курс.'}</p><div class="choice-list">${ep.choices[state.side].map((c,i) => {
      const blocked = E.availability(state,c), p = E.preview(state,c);
      return `<button class="choice" data-action="choose" data-choice="${i}" ${blocked ? 'disabled' : ''}><span class="choice-number" aria-hidden="true">0${i+1}</span><span class="choice-main"><span class="choice-title">${esc(c.title)}</span>${showHistoricalHints && c.historical ? '<span class="history-hint">Историческое направление политики</span>' : ''}<span class="choice-detail">${esc(c.detail)}</span><span class="choice-why"><b>Зачем этот выбор:</b> ${esc(c.why || c.detail)}</span>${deltas(p.delta)}${deltas(p.strategicDelta,D.strategic,true)}${fiscalPreview(c)}${p.notes.length ? `<span class="choice-detail">${p.notes.map(esc).join(' ')}</span>` : ''}${blocked ? `<span class="lock-reason">${esc(blocked)}</span>` : ''}</span><span class="choice-arrow" aria-hidden="true">↗</span></button>`;
    }).join('')}</div><p class="model-note">Можно выбрать клавишами 1, 2, 3. Показатели — условная модель. Напряжённость 100 или прямое столкновение открывают военную развилку; нулевой бюджет останавливает курс.</p>`;
  }
  function result(ep) {
    const h = state.history.at(-1), c = h.selected;
    const next = state.ending || state.pendingWar || state.index === D.episodes.length-1 ? null : E.advance(state);
    const nextScene = next?.phase === 'decision' ? E.current(next) : null;
    return `<section class="consequence" id="result-panel" tabindex="-1"><span class="eyebrow">ПОСЛЕДСТВИЯ В ВАШЕЙ ВЕТКЕ</span><h3>${esc(c.title)}</h3><p>${esc(c.outcome)}</p>${deltas(h.delta)}${deltas(h.strategicDelta,D.strategic,true)}${h.notes.map(n => `<p>${esc(n)}</p>`).join('')}<span class="historical-badge ${c.historical ? '' : 'alternative'}">${c.historical ? 'Близко к реальному направлению политики' : 'Альтернативный ход · условный сценарий'}</span>${state.pendingWar ? '<p class="warning-line">Началось прямое столкновение. Следующий шаг — решение о пределах войны.</p>' : state.ending ? '<p class="warning-line">Доступный бюджет исчерпан. Дальше — итог курса.</p>' : ''}</section>${nextScene ? `<section class="next-preview"><span class="eyebrow">СЛЕДУЮЩИЙ ШАГ / ${nextScene.year}</span><h3>${esc(nextScene.title)}</h3><p>${esc(nextScene.branch?.reason || next.transition)}</p>${E.carry(next).slice(0,1).map(t=>`<p>${esc(t)}</p>`).join('')}</section>` : ''}${historyBox(D.episodes[state.index])}<div class="next-row"><span class="micro">Реальные события показаны отдельно. В вашей ветке сохраняются договоры, реформы, обязательства и изменения будущих сцен.</span><button class="primary" data-action="next">${state.pendingWar ? 'Решить судьбу столкновения' : state.ending || state.index === D.episodes.length-1 ? 'Посмотреть итоги' : 'Следующая глава'} <span>→</span></button></div>`;
  }
  function campaign() {
    view = 'game';
    if(state.phase === 'ending') { ending(); return; }
    if(['war','war_result'].includes(state.phase)) { warScreen(); return; }
    const ep = E.current(state);
    const risk = state.stats.tension >= 80 ? 'КРИТИЧЕСКАЯ НАПРЯЖЁННОСТЬ' : state.stats.tension >= 55 ? 'ОПАСНОЕ ПРОТИВОСТОЯНИЕ' : state.stats.tension >= 30 ? 'НЕУСТОЙЧИВОЕ РАВНОВЕСИЕ' : 'ЕСТЬ ПРОСТРАНСТВО ДЛЯ ДИАЛОГА';
    app.innerHTML = `<section class="campaign"><div class="campaign-top"><div><div class="eyebrow">КАМПАНИЯ / ${D.sides[state.side]}</div><h1>Хроника вашего курса</h1></div><div class="tools"><button class="secondary" data-action="journal">Журнал решений</button><span class="save-state">${storageOK ? '● Автосохранение' : '○ Без сохранения'}</span></div></div>${timeline()}<div class="game-layout"><aside class="sidebar" aria-label="Показатели кампании"><div class="side-label">${flag(state.side)}<span><b>${D.sides[state.side]}</b><small>${esc(ep.leaders[state.side])}</small></span></div>${metrics()}<div class="sidebar-note"><strong>${risk}</strong><br>Все шкалы условные: 0–100.</div>${strategicPanel()}</aside><div class="episode"><div class="stage"><img src="assets/world.svg" alt="" aria-hidden="true">${sceneArt(ep.motif)}<div class="stage-meta"><span>ГЛАВА ${String(state.index+1).padStart(2,'0')} / ${D.episodes.length}</span><span>${esc(ep.category).toUpperCase()}</span></div><div class="stage-title"><div class="year">${ep.year}</div><h2>${esc(ep.title)}</h2><p>${esc(ep.place)} · ${esc(ep.date)}</p></div></div><p class="transition">${esc(state.transition)}</p>${branchContext(ep)}<div class="narrative">${esc(ep.context)}</div>${state.phase === 'decision' ? decisions(ep) : result(ep)}</div></div></section>`;
    const current = app.querySelector('.time-node.current');
    if(current) current.parentElement.scrollLeft = Math.max(0,current.offsetLeft-current.parentElement.offsetLeft-current.parentElement.clientWidth/2);
  }
  function warScreen() {
    const h = state.history.at(-1), w = h.war, own = w?.before.strategic || state.strategic, rival = w?.rivalBefore || state.rival;
    app.innerHTML = `<section class="campaign war-screen"><div class="eyebrow">${D.episodes[state.index].year} / ВОЕННАЯ РАЗВИЛКА / ${D.sides[state.side]}</div><h1>Сдерживание сорвалось</h1><p class="war-intro">Ваш курс привёл к прямому столкновению. У обеих сторон остаётся ядерное оружие. Можно попытаться договориться, удержать большую войну в рамках обычных вооружений или перейти к ядерному применению.</p><section class="history-box"><h3>С чем стороны вошли в кризис</h3><table class="comparison"><thead><tr><th>Основа военных возможностей</th><th>${D.sides[state.side]}</th><th>${D.sides[state.side === 'usa' ? 'ussr' : 'usa']}</th></tr></thead><tbody>${['economy','allies','readiness'].map(k=>`<tr><th>${D.strategic[k]}</th><td>${own[k]}</td><td>${rival[k]}</td></tr>`).join('')}<tr><th>Условная сила</th><td>${w?.own ?? E.power(own)}</td><td>${w?.enemy ?? E.power(rival)}</td></tr></tbody></table><p class="micro">Формула: готовность × 40% + экономика × 30% + союзная поддержка × 30%, округление до целого. Преимущество от 8 пунктов даёт победу в обычной войне; меньше — истощение и перемирие. Эта формула — игровое допущение.</p></section>${state.phase === 'war' ? `<div class="choice-list">${E.warOptions(state).map((o,i)=>`<button class="choice" data-action="war-choice" data-choice="${i}" ${o.blocked?'disabled':''}><span class="choice-number">0${i+1}</span><span class="choice-main"><span class="choice-title">${o.title}</span><span class="choice-detail">${o.detail}</span>${o.blocked?`<span class="lock-reason">${o.blocked}</span>`:''}</span></button>`).join('')}</div>` : `<section class="consequence" id="result-panel" tabindex="-1"><h3>${esc(w.title)}</h3><p>${esc(w.text)}</p>${deltas(w.delta)}${deltas(w.strategicDelta,D.strategic,true)}</section><button class="primary" data-action="next">${state.ending?'Посмотреть итоги':'Продолжить после перемирия'} →</button>`}<section class="history-box war-evidence"><h3>Граница исторического знания</h3><p>Реальной полномасштабной войны СССР и США не было. Её победитель не установлен историками. Архивы Карибского кризиса показывают, что участники не знали обо всех средствах противника. Сохранение неядерного предела здесь — явное условие альтернативного сценария.</p>${sourceLinks(['nuclearRisk','cubaArchive'])}</section></section>`;
  }
  function chart() {
    const values = [32, ...state.history.map(h => h.war?.after.stats.tension ?? h.after.tension)];
    const points = values.map((v, i) => `${30 + i * 440 / Math.max(1, values.length - 1)},${150 - v * 1.2}`).join(' ');
    return `<div class="chart"><span class="eyebrow">ВАША ТРАЕКТОРИЯ</span><svg viewBox="0 0 500 190" role="img" aria-label="Напряжённость после решений: ${values.join(', ')}"><g stroke="#bac3b72b"><path d="M30 30h440M30 90h440M30 150h440"/></g><g fill="#b6c0b5" font-family="monospace" font-size="9"><text x="2" y="33">100</text><text x="8" y="93">50</text><text x="14" y="153">0</text><text x="30" y="178">1945</text><text x="440" y="178">${D.episodes[state.index].year}</text></g><polyline points="${points}" fill="none" stroke="#d89b77" stroke-width="2.5"/>${values.map((v, i) => `<circle cx="${30+i*440/Math.max(1,values.length-1)}" cy="${150-v*1.2}" r="3" fill="#e2b38f"/>`).join('')}</svg><p>Напряжённость после каждого решения · равный шаг эпизодов</p></div>`;
  }
  function journalRows() {
    return state.history.length ? state.history.map(h => `<div class="journal-row"><span>${h.scene.year}</span><div><strong>${esc(h.scene.title)}</strong><p>${esc(h.selected.title)}</p>${h.scene.branch ? `<p class="journal-branch">Ветка: ${esc(h.scene.branch.reason)}</p>` : ''}${deltas(h.delta)}${deltas(h.strategicDelta,D.strategic,true)}${h.war ? `<p><b>Военная развилка:</b> ${esc(h.war.title)}</p>${deltas(h.war.delta)}${deltas(h.war.strategicDelta,D.strategic,true)}` : ''}</div><small>${h.selected.historical ? 'ИСТОРИЧЕСКИЙ КУРС' : 'АЛЬТЕРНАТИВА'}</small></div>`).join('') : '<p>Ваши решения появятся после первого выбора.</p>';
  }
  function ending() {
    view='game';
    const e=E.endings[state.ending],matched=state.history.filter(h=>h.selected.historical).length;
    const retry=state.ending==='exhaustion'||state.ending==='nuclear'||state.ending.startsWith('war_');
    app.innerHTML=`<section class="ending"><div class="ending-grid"><div><div class="eyebrow">${state.historical?'ИСТОРИЧЕСКАЯ КОНЦОВКА':'АЛЬТЕРНАТИВНАЯ КОНЦОВКА'} / ${D.sides[state.side]} / ${D.episodes[state.index].year}</div><h1>${e.title}</h1><p>${e.text}</p><p>Пройдено глав: <b>${state.history.length} из ${D.episodes.length}</b>. Исторических направлений политики: <b>${matched}</b>. Изменённых сцен: <b>${state.history.filter(h=>h.scene.branch).length}</b>.</p><div class="ending-actions"><button class="primary" data-action="export">Скачать журнал ↓</button><button class="secondary" data-action="home">В главное меню</button>${retry?'<button class="secondary" data-action="retry">Пересмотреть последнее решение</button>':''}</div><section class="ending-causes"><h3>Почему получился этот финал</h3><p>Подготовка реформ: ${state.flags.reforms}. Союзный договор: ${state.flags.unionAgreement?'согласован':'не закреплён'}. Добровольные партнёрства: ${state.flags.voluntaryBloc?'сформированы':'не сформированы'}. Экономика: ${state.strategic.economy}, поддержка союзников: ${state.strategic.allies}, устойчивость: ${state.strategic.stability}.</p><p>${state.historical?'Все главы пройдены по историческим направлениям; для каждой стороны предусмотрен собственный реальный итог.':'Исторические справки остаются в архиве. Данный итог — результат правил и допущений вашей ветки.'}</p></section></div><div>${chart()}<div class="ending-stats">${metrics()}</div><div class="ending-stats">${metrics(state.strategic,D.strategic)}</div></div></div><section class="journal"><div class="section-heading"><h2>След ваших решений</h2><span>ЛИЧНОЕ ДОСЬЕ</span></div>${journalRows()}</section></section>`;
  }
  function openModal(content) {
    document.querySelector('#modal-content').innerHTML = content;
    if (!modal.open) modal.showModal();
    modal.scrollTop = 0;
  }
  function archive() {
    openModal(`<h2 id="modal-title">Архив и объяснения</h2><p>Здесь — реальная история. Изменённые обстоятельства вашей кампании отмечаются непосредственно в главах.</p><h3>Словарь для первого знакомства</h3>${D.glossary.map(([term,text])=>`<details><summary>${esc(term)}</summary><p>${esc(text)}</p></details>`).join('')}<h3>Исторические главы</h3>${D.episodes.map(ep=>`<details><summary><span>${ep.year}</span>${esc(ep.title)}</summary><p>${esc(ep.exposition.origin)}</p><p>${esc(ep.history)}</p>${sourceLinks(ep.sources)}</details>`).join('')}<h3>Исследования и альтернативы</h3>${D.research.map(r=>`<details><summary>${esc(r.title)}</summary><h4>Что говорят источники</h4><p>${esc(r.evidence)}</p><h4>Что допущено в игре</h4><p>${esc(r.inference)}</p>${sourceLinks(r.sources)}</details>`).join('')}<p class="micro">Справки — авторский пересказ документов и исследований. Эксперты не рецензировали игру и не подтверждали её формулы. Лидеры и календарь сохранены как условные опорные точки; экономические и политические обстоятельства могут меняться.</p>`);
  }
  function guide() {
    openModal(`<h2 id="modal-title">Как меняется история</h2><p>Кампания включает ${D.episodes.length} глав. Перед выбором объясняются причины конфликта, интересы участников и ставки решения. Архив помогает с терминами и реальными событиями.</p><ol class="guide-list"><li><b>Прошлое меняет следующие сцены.</b> Общая программа восстановления может предотвратить блокаду Берлина; открытый город и доверие — создать превентивные гарантии по Кубе. Реформы, расходы и договоры сохраняются до финала.</li><li><b>Бюджет и экономика различаются.</b> Бюджет тратится сейчас. Поступления за главу: 5 + целая часть экономики / 15; научная программа добавляет 2. Из них вычитаются содержание армии, внешние обязательства и отложенные расходы. Точный расчёт виден под иллюстрацией.</li><li><b>Союзники и готовность.</b> Поддержка союзников — условный вес сотрудничества, не количество стран. Силовое давление может повышать влияние, одновременно уменьшать поддержку. Готовность отражает обычную армию и её снабжение.</li><li><b>Устойчивость.</b> Показывает внутреннюю способность проводить курс. Неподготовленные реформы и длительные обязательства её уменьшают. Для договора республик нужны экономика ≥55, устойчивость ≥45 и два этапа подготовки.</li><li><b>Исторический финал.</b> Нужно последовательно выбирать историческое направление во всех главах. Включите подсказки над решениями. Возвращение к отдельному реальному решению не отменяет уже сделанного альтернативного выбора.</li><li><b>Сохранение СССР.</b> Подготовьте экономику, заключите союзный договор в 1990 году и исполните его в 1991-м. Для сохранения нужны экономика ≥55 и устойчивость ≥50. Для победы СССР дополнительно: экономика ≥75, союзники ≥65, влияние ≥45, сумма экономики и союзников выше суммы соперника минимум на 20.</li><li><b>Военная развилка.</b> Напряжённость 100 или прямое столкновение на Кубе открывают чрезвычайный выбор. Переговоры требуют доверия ≥25 или канала связи. Обычная война учитывает 40% готовности, 30% экономики и 30% союзной поддержки. Ядерное применение ведёт к отдельной катастрофической концовке.</li></ol><p>Шкалы ограничены 0–100. Между главами напряжённость меняется на поправку нового события −5; канал связи добавляет снижение на 2. При доверии ниже 20 положительная эскалация получает +3; после трёх силовых решений следующие такие решения получают ещё +2. Числа не являются вероятностями или исторической статистикой.</p><p><b>Управление:</b> кнопки или клавиши 1–3; Tab и Enter; Esc закрывает окно. Автосохранение хранится в этом браузере. Сохранения версии 1 оставлены отдельно: новый сценарий начинается новой кампанией.</p><p>Для игры без интернета откройте index.html. Для чтения источников нужен интернет. «Журнал решений» сохраняет выбранные ветки, последствия и исторические справки в TXT.</p>`);
  }
  function exportJournal() {
    const lines=['НА ГРАНИ — ЖУРНАЛ КАМПАНИИ, ВЕРСИЯ 2',`Сторона: ${D.sides[state.side]}`,'Численные эффекты и альтернативные исходы — условная модель.',''];
    for(const h of state.history){
      const ep=h.scene,c=h.selected,real=D.episodes.find(e=>e.id===h.episode);
      lines.push(`${ep.year}. ${ep.title}`,`Руководитель: ${ep.leaders[state.side]}`,`Обстоятельства: ${ep.context}`,`Ветка: ${ep.branch?.reason||'историческая исходная ситуация'}`,`Решение: ${c.title}`,`Почему важно: ${c.why||c.detail}`,`Курс: ${c.historical?'историческое направление':'альтернативный'}`,`В вашей ветке: ${c.outcome}`,Object.entries(D.metrics).map(([k,l])=>`${l}: ${h.before[k]} → ${h.after[k]} (${sign(h.delta[k])})`).join('; '),Object.entries(D.strategic).map(([k,l])=>`${l}: ${h.beforeStrategic[k]} → ${h.afterStrategic[k]} (${sign(h.strategicDelta[k])})`).join('; '),...h.notes);
      if(h.war)lines.push(`Военная развилка: ${h.war.title}`,h.war.text,Object.entries(D.metrics).map(([k,l])=>`${l} ${sign(h.war.delta[k])}`).join('; '));
      lines.push(`В действительности: ${real.history}`,...[...new Set([...real.sources,...(ep.branch?.sources||[])])].map(id=>`${D.sources[id].title}: ${D.sources[id].url}`),'');
    }
    if(state.ending)lines.push(`Итог: ${E.endings[state.ending].title}`,E.endings[state.ending].text);
    const blob=new Blob(['﻿'+lines.join('\r\n')],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`На грани — журнал ${D.sides[state.side]}.txt`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function focusTop() { app.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function start(side) { modal.close(); clearTimeout(toastTimer); document.querySelector('#notice').hidden = true; state = E.initial(side); persist(); campaign(); focusTop(); }
  function makeChoice(index) {
    if (view !== 'game' || state?.phase !== 'decision') return;
    try { state = E.choose(state, index); persist(); campaign(); app.querySelector('#result-panel').focus({ preventScroll: true }); app.querySelector('#result-panel').scrollIntoView({ block: 'start', behavior: 'instant' }); }
    catch (error) { notice(error.message); }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    switch (button.dataset.action) {
      case 'start':
        if (state) openModal(`<h2 id="modal-title">Начать новую кампанию?</h2><p>Текущее прохождение за ${D.sides[state.side]} будет заменено. При необходимости сначала скачайте журнал.</p><div class="ending-actions"><button class="primary" data-action="confirm-start" data-side="${button.dataset.side}">Начать за ${D.sides[button.dataset.side]}</button><button class="secondary" data-action="export">Скачать журнал</button><button class="secondary" data-action="close">Вернуться</button></div>`);
        else start(button.dataset.side);
        break;
      case 'confirm-start': start(button.dataset.side); break;
      case 'resume': campaign(); focusTop(); break;
      case 'choose': makeChoice(Number(button.dataset.choice)); break;
      case 'historical-hints': showHistoricalHints=!showHistoricalHints; campaign(); break;
      case 'war-choice': if(state?.phase==='war') { state=E.chooseWar(state,Number(button.dataset.choice)); persist(); campaign(); focusTop(); } break;
      case 'next': if (['result','war_result'].includes(state?.phase)) { state = E.advance(state); persist(); campaign(); focusTop(); } break;
      case 'home': home(); focusTop(); break;
      case 'journal': openModal(`<h2 id="modal-title">Журнал решений</h2>${journalRows()}<div class="ending-actions"><button class="primary" data-action="export">Скачать журнал ↓</button></div>`); break;
      case 'export': if (state) exportJournal(); break;
      case 'close': modal.close(); break;
      case 'retry': {
        if (!state || !(state.ending === 'exhaustion' || state.ending === 'nuclear' || state.ending?.startsWith('war_'))) break;
        const save = JSON.parse(E.serialize(state)); save.decisions.pop(); save.phase = 'decision';
        const restored = E.restore(JSON.stringify(save));
        if (restored) { state = restored; persist(); campaign(); focusTop(); }
        break;
      }
    }
  });
  document.querySelector('#archive-button').addEventListener('click', archive);
  document.querySelector('#guide-button').addEventListener('click', guide);
  document.querySelector('#home-link').addEventListener('click', event => { event.preventDefault(); home(); focusTop(); });
  document.querySelector('#close-modal').addEventListener('click', () => modal.close());
  document.addEventListener('keydown', event => {
    if (modal.open || event.repeat || event.ctrlKey || event.altKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (/^[123]$/.test(event.key) && view === 'game') { if(state?.phase === 'decision') { event.preventDefault(); makeChoice(Number(event.key)-1); } else if(state?.phase === 'war') { event.preventDefault(); const button=app.querySelector('[data-action="war-choice"][data-choice="'+(Number(event.key)-1)+'"]'); if(button && !button.disabled) button.click(); } }
  });
  home();
})();
