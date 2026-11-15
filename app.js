/* ============================================================
   MeloVerse — client app (vanilla JS, no build step)
   ============================================================ */
const API_BASE = (new URLSearchParams(location.search).get('api') || localStorage.getItem('mv_api') || '').replace(/\/$/, '');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = {
  token: localStorage.getItem('mv_token') || '',
  user: null,
  quota: null,
  cache: new Map()
};

/* ------------------------------ helpers ------------------------------ */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => (t.className = 'toast' + (err ? ' err' : '')), 2600);
}
async function api(path, opts = {}) {
  const headers = Object.assign({}, opts.headers);
  if (opts.body && !(opts.body instanceof FormData)) headers['content-type'] = 'application/json';
  if (state.token) headers.authorization = 'Bearer ' + state.token;
  const res = await fetch(API_BASE + '/api' + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (res.status === 401 && state.token && !path.startsWith('/auth/login')) { logout(true); }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'تعذّر الاتصال');
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}
const img = (u, fallback) => u ? (API_BASE + '/api/img?u=' + encodeURIComponent(u))
  : (fallback || 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect width="200" height="300" fill="#1d2130"/><text x="100" y="150" fill="#4b5069" font-size="16" text-anchor="middle" font-family="sans-serif">MeloVerse</text></svg>`));
const numFmt = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n || 0);
const timeAgo = (s) => {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T') + (String(s).includes('Z') ? '' : 'Z'));
  const diff = (Date.now() - d.getTime()) / 1000;
  if (isNaN(diff)) return '';
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
  if (diff < 2592000) return `قبل ${Math.floor(diff / 86400)} يوم`;
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
};
const TYPE_AR = { manga: 'مانجا', manhwa: 'مانهوا', manhua: 'مانها' };
const ROLE_AR = { admin: 'مدير عام', moderator: 'مشرف', user: 'عضو' };

function vBadge(role, verified) {
  if (!verified && !['admin', 'moderator'].includes(role)) return '';
  return `<span class="vbadge" style="position:static;border:0;width:15px;height:15px;vertical-align:middle;margin-inline-start:3px" title="موثّق">
    <svg viewBox="0 0 24 24" width="10" height="10"><path d="M20.3 6.7 9.8 17.2 4.4 11.8" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
}
const avatarOf = (u) => u && u.avatar ? u.avatar : 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#241f3a"/><circle cx="32" cy="24" r="11" fill="#7c5cff"/><path d="M9 60c3-12 11-18 23-18s20 6 23 18z" fill="#7c5cff"/></svg>`);

/* ------------------------------ session ------------------------------ */
function saveSession(d) {
  state.token = d.token || state.token;
  state.user = d.user || state.user;
  state.quota = (d.user && d.user.quota) || state.quota;
  if (state.token) localStorage.setItem('mv_token', state.token);
  paintShell();
}
function logout(silent) {
  state.token = ''; state.user = null; state.quota = null;
  localStorage.removeItem('mv_token');
  paintShell();
  if (!silent) { toast('تم تسجيل الخروج'); location.hash = '#/home'; render(); }
}
async function boot() {
  const saved = localStorage.getItem('mv_theme');
  document.body.dataset.theme = saved || 'dark';
  if (state.token) {
    try { const d = await api('/auth/me'); state.user = d.user; state.quota = d.user.quota; }
    catch (_) { state.token = ''; localStorage.removeItem('mv_token'); }
  }
  paintShell();
  window.addEventListener('hashchange', render);
  if (!location.hash) location.hash = '#/home';
  render();
}

function paintShell() {
  const u = state.user;
  const isStaff = u && ['admin', 'moderator'].includes(u.role);
  $('#drawerName').textContent = u ? u.username : 'زائر';
  $('#drawerRole').textContent = u ? ROLE_AR[u.role] || 'عضو' : 'اضغط لتسجيل الدخول';
  $('#drawerRole').className = 'dp-sub' + (u ? ' role' : '');
  $('#drawerAvatar').src = avatarOf(u);
  $('#drawerBadge').classList.toggle('hidden', !(u && (u.verified || isStaff)));
  $('#navAdmin').classList.toggle('hidden', !isStaff);
  const q = state.quota;
  $('#drawerQuota').innerHTML = u && q
    ? `قراءة اليوم: <b>${q.read_used}/${q.read_limit}</b>${q.read_bonus ? ` (+${q.read_bonus} إعلان)` : ''}<br>تحميل اليوم: <b>${q.dl_used}/${q.dl_limit}</b>`
    : '<b>سجّل الدخول</b> لمزامنة مكتبتك';
}

/* ------------------------------ shell UI ------------------------------ */
function openDrawer(on) {
  $('#drawer').classList.toggle('open', on);
  $('#drawer').setAttribute('aria-hidden', String(!on));
  $('#scrim').classList.toggle('show', on);
}
$('#btnMenu').onclick = () => openDrawer(!$('#drawer').classList.contains('open'));
$('#scrim').onclick = () => openDrawer(false);
$('#drawerClose').onclick = () => openDrawer(false);
if (window.matchMedia('(max-width:760px)').matches) { /* bottom nav visible */ }
$('#btnTheme').onclick = () => {
  const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = next;
  localStorage.setItem('mv_theme', next);
  document.querySelector('meta[name=theme-color]').setAttribute('content', next === 'dark' ? '#0E0F16' : '#F6F7FB');
};
$('#btnSearchTop').onclick = () => { location.hash = '#/search'; };
$('#drawerProfile').onclick = () => { openDrawer(false); location.hash = state.user ? '#/settings' : '#/login'; };
document.addEventListener('click', (e) => {
  const a = e.target.closest('.nav-item');
  if (a && $('#drawer').classList.contains('open')) setTimeout(() => openDrawer(false), 80);
});

function modal(html) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="sheet">${html}</div>`;
  root.classList.add('show');
  root.onclick = (e) => { if (e.target === root) closeModal(); };
  return root.querySelector('.sheet');
}
function closeModal() { $('#modalRoot').classList.remove('show'); $('#modalRoot').innerHTML = ''; }

/* ------------------------------ components ------------------------------ */
function card(s) {
  const badge = s.chapters_count ? `<span class="badge-num">${s.chapters_count} فصل</span>` : '';
  const type = s.type ? `<span class="badge-type">${TYPE_AR[s.type] || s.type}</span>` : '';
  return `<a class="card" href="#/series/${s.id}">
    <div class="thumb"><img loading="lazy" src="${img(s.cover)}" alt="${esc(s.title)}"
        onerror="this.src='${img('')}'">${badge}${type}</div>
    <div class="c-title" dir="auto">${esc(s.title)}</div>
    <div class="c-sub" dir="auto">${esc(s.category || s.source_name || '')}</div>
  </a>`;
}
function shelf(title, items, href) {
  if (!items || !items.length) return '';
  return `<section class="section">
    <div class="section-head"><h2>${esc(title)}</h2>${href ? `<a href="${href}">الكل</a>` : ''}</div>
    <div class="shelf">${items.map(card).join('')}</div>
  </section>`;
}
function rowItem(s, extra = '') {
  return `<a class="row" href="#/series/${s.id}">
    <img loading="lazy" src="${img(s.cover)}" alt="">
    <div class="r-body">
      <div class="r-title" dir="auto">${esc(s.title)}</div>
      <div class="r-sub">${s.chapter_number ? `<span>الفصل ${s.chapter_number}</span>` : ''}
        <span>${s.chapters_count || 0} فصل</span><span>${esc(s.category || '')}</span></div>
      ${extra}
    </div>
  </a>`;
}
function hero(s) {
  if (!s) return '';
  return `<a class="hero" href="#/series/${s.id}" style="display:block">
    <img class="hero-img" src="${img(s.cover)}" alt="">
    <div class="hero-grad"></div>
    <div class="hero-body">
      <h2 class="hero-title" dir="auto">${esc(s.title)}</h2>
      <div class="hero-meta"><span class="tag brand">${TYPE_AR[s.type] || 'مانجا'}</span>
        <span>${s.chapters_count || 0} فصل</span><span>·</span><span>${esc(s.status === 'completed' ? 'مكتمل' : 'مستمر')}</span></div>
    </div>
  </a>`;
}
function loader() { return `<div class="loading"><div class="spinner"></div></div>`; }
function empty(ico, txt) { return `<div class="empty"><span class="e-ico">${ico}</span>${txt}</div>`; }

/* ------------------------------ router ------------------------------ */
const routes = [];
function route(pattern, fn) { routes.push({ pattern, fn }); }

async function render() {
  const hash = location.hash.replace(/^#/, '') || '/home';
  const [path, qs] = hash.split('?');
  const query = new URLSearchParams(qs || '');
  const view = $('#view');
  view.innerHTML = loader();
  window.scrollTo({ top: 0 });

  for (const r of routes) {
    const m = path.match(r.pattern);
    if (m) {
      const isReader = path.startsWith('/read/');
      document.body.classList.toggle('no-nav', isReader);
      document.body.classList.toggle('reading', isReader);
      $('#topbar').classList.toggle('hidden', isReader);
      $('#bottomNav').classList.toggle('hidden', isReader);
      try { await r.fn({ el: view, params: m.slice(1), query }); }
      catch (e) { view.innerHTML = empty('⚠️', esc(e.message || 'حدث خطأ')); }
      paintShell();
      return;
    }
  }
  view.innerHTML = empty('🧭', 'الصفحة غير موجودة');
}

/* ------------------------------ views ------------------------------ */
route(/^\/home$/, async ({ el }) => {
  const d = await api('/home');
  const isNew = state.user && (d.continueReading || []).length;
  el.innerHTML = `
    <div class="page-head">
      <div><h1>مرحباً${state.user ? '، ' + esc(state.user.username.split(' ')[0]) : ''} 👋</h1>
        <div class="sub">تابع أحدث الفصول من ${d.latest.length ? 'مصادرك' : 'مصادرك المضافة'}</div></div>
    </div>
    ${d.featured[0] ? hero(d.featured[0]) : ''}
    ${isNew ? `<section class="section"><div class="section-head"><h2>أكمل القراءة</h2></div>
      ${d.continueReading.slice(0, 4).map((s) => rowItem(s, `<div style="margin-top:6px"><span class="badge brand">تابع القراءة</span></div>`)).join('')}
    </section>` : ''}
    ${shelf('أحدث التحديثات', d.latest)}
    ${shelf('أضيف حديثاً', d.fresh)}
    ${shelf('الأكثر حفظاً', d.popular)}
    ${!d.latest.length ? empty('📚', 'لا يوجد محتوى بعد. اطلب من الأدمن تشغيل سحب من غرفة الإدارة.') : ''}
  `;
});

route(/^\/series\/(\d+)$/, async ({ el, params }) => {
  const id = params[0];
  const d = await api('/series/' + id);
  const s = d.series, mine = d.mine || { lists: [] };
  const has = (l) => mine.lists.includes(l);
  el.innerHTML = `
    <div class="detail-hero">
      <img class="detail-cover" src="${img(s.cover)}" alt="">
      <div class="detail-info">
        <h1 dir="auto">${esc(s.title)}</h1>
        <div class="meta-chips">
          <span class="tag brand">${TYPE_AR[s.type] || 'مانجا'}</span>
          <span class="tag">${s.status === 'completed' ? 'مكتمل' : 'مستمر'}</span>
          <span class="tag">${d.chapters.length} فصل</span>
          ${s.source_name ? `<span class="tag">${esc(s.source_name)}</span>` : ''}
        </div>
        ${s.category ? `<div class="meta-chips">${s.category.split(',').slice(0, 6).map((c) => `<span class="tag">${esc(c.trim())}</span>`).join('')}</div>` : ''}
      </div>
    </div>
    <div class="detail-actions">
      <button class="btn btn-primary" id="btnRead">${d.chapters[0] ? 'ابدأ القراءة' : 'لا فصول'}</button>
      <button class="btn btn-ghost" id="btnFav">${has('favorite') ? '❤️ في المفضلة' : '🤍 المفضلة'}</button>
      <button class="btn btn-ghost" id="btnLater">${has('later') ? '🔖 محفوظ' : '🔖 لاحقاً'}</button>
      <button class="btn btn-ghost" id="btnReport">⚑ بلاغ</button>
    </div>
    <div class="desc clamped" id="desc">${esc(s.description || 'لا يوجد وصف لهذا العمل.')}</div>
    <button class="btn btn-soft btn-sm" id="moreDesc">عرض المزيد</button>

    <section class="section">
      <div class="section-head"><h2>الفصول</h2><span class="badge">${d.chapters.length}</span></div>
      <div class="chapter-list">
        ${d.chapters.length ? d.chapters.map((c) => `<div class="ch-item" data-ch="${c.id}">
          <span class="n">الفصل ${c.number}${c.title ? ' — ' + esc(c.title) : ''}</span>
          <span class="d">${timeAgo(c.published_at)}</span></div>`).join('') : empty('📄', 'لا فصول متاحة')}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>التعليقات</h2><span class="badge">${d.comments}</span></div>
      <div id="comments">${loader()}</div>
    </section>
  `;

  $('#moreDesc').onclick = (e) => {
    const d2 = $('#desc');
    d2.classList.toggle('clamped');
    e.target.textContent = d2.classList.contains('clamped') ? 'عرض المزيد' : 'عرض أقل';
  };
  if (d.chapters[0]) $('#btnRead').onclick = () => (location.hash = '#/read/' + d.chapters[0].id);
  $('#btnFav').onclick = () => toggleList(id, 'favorite', $('#btnFav'), ['❤️ في المفضلة', '🤍 المفضلة']);
  $('#btnLater').onclick = () => toggleList(id, 'later', $('#btnLater'), ['🔖 محفوظ', '🔖 لاحقاً']);
  $('#btnReport').onclick = () => reportDialog('series', id, s.title);
  $$('.ch-item', el).forEach((b) => (b.onclick = () => (location.hash = '#/read/' + b.dataset.ch)));
  loadComments(id, null, $('#comments'));
});

async function toggleList(seriesId, list, btn, labels) {
  if (!state.user) return (location.hash = '#/login');
  try {
    const d = await api('/library/toggle', { method: 'POST', body: { seriesId: Number(seriesId), list } });
    btn.textContent = d.active ? labels[0] : labels[1];
    toast(d.active ? 'تمت الإضافة' : 'تمت الإزالة');
  } catch (e) { toast(e.message, true); }
}

function reportDialog(type, id, label) {
  if (!state.user) return (location.hash = '#/login');
  const sheet = modal(`<h3>إبلاغ عن ${esc(label || '')}</h3>
    <div class="field"><label>سبب البلاغ</label>
      <textarea class="textarea" id="rpReason" placeholder="اشرح المشكلة..."></textarea></div>
    <div class="inline"><button class="btn btn-primary btn-block" id="rpSend">إرسال البلاغ</button>
      <button class="btn btn-ghost" id="rpCancel">إلغاء</button></div>`);
  sheet.querySelector('#rpCancel').onclick = closeModal;
  sheet.querySelector('#rpSend').onclick = async () => {
    try {
      await api('/reports', { method: 'POST', body: { targetType: type, targetId: Number(id), reason: sheet.querySelector('#rpReason').value } });
      closeModal(); toast('تم إرسال البلاغ للمراجعة');
    } catch (e) { toast(e.message, true); }
  };
}

/* ------------------------- comments ------------------------- */
async function loadComments(seriesId, chapterId, box) {
  const d = await api(`/series/${seriesId}/comments${chapterId ? '?chapterId=' + chapterId : ''}`);
  box.innerHTML = `
    ${state.user ? `<div class="panel" style="padding:12px">
      <textarea class="textarea" id="cmtBody" placeholder="اكتب تعليقاً..." style="min-height:70px"></textarea>
      <div class="inline" style="margin-top:8px;justify-content:space-between">
        <label class="switch"><input type="checkbox" id="cmtSpoiler"><span>يحتوي حرق</span></label>
        <button class="btn btn-primary btn-sm" id="cmtSend">نشر</button>
      </div></div>`
      : `<div class="panel" style="padding:12px;text-align:center"><span style="color:var(--muted);font-size:13px">سجّل الدخول للتعليق</span>
         <a class="btn btn-primary btn-sm" href="#/login" style="margin-inline-start:8px">دخول</a></div>`}
    <div id="cmtList">${d.items.length ? d.items.map((c) => cmtHtml(c)).join('') : empty('💬', 'لا تعليقات بعد — كن الأول')}</div>`;

  if (state.user) {
    box.querySelector('#cmtSend').onclick = async () => {
      const body = box.querySelector('#cmtBody').value.trim();
      if (!body) return toast('اكتب شيئاً', true);
      try {
        await api('/comments', { method: 'POST', body: { seriesId: Number(seriesId), chapterId, body, spoiler: box.querySelector('#cmtSpoiler').checked } });
        box.querySelector('#cmtBody').value = '';
        loadComments(seriesId, chapterId, box);
      } catch (e) { toast(e.message, true); }
    };
  }
  bindCommentActions(box, seriesId, chapterId);
}

function cmtHtml(c) {
  const isStaff = ['admin', 'moderator'].includes(c.user.role);
  return `<div class="cmt" data-id="${c.id}">
    <img class="av" src="${avatarOf(c.user)}" alt="">
    <div class="cmt-body">
      <div class="cmt-top">
        <span class="cmt-name" dir="auto" style="${isStaff ? 'color:var(--brand-text,var(--brand))' : ''}">${esc(c.user.username)}</span>
        ${vBadge(c.user.role, c.user.verified)}
        ${isStaff ? `<span class="badge brand">${ROLE_AR[c.user.role]}</span>` : ''}
        <span class="cmt-time">${timeAgo(c.created_at)}</span>
      </div>
      <div class="cmt-text ${c.spoiler ? 'spoiler' : ''}" dir="auto">${esc(c.body).replace(/\n/g, '<br>')}</div>
      <div class="cmt-acts">
        <button data-act="reply">رد</button>
        <button data-act="report">إبلاغ</button>
        ${state.user && (state.user.id === c.user.id || ['admin', 'moderator'].includes(state.user.role)) ? '<button data-act="del" style="color:var(--danger)">حذف</button>' : ''}
      </div>
      <div class="reply-box hidden"></div>
      ${c.replies && c.replies.length ? `<div class="replies">${c.replies.map((r) => cmtHtml(r)).join('')}</div>` : ''}
    </div>
  </div>`;
}

function bindCommentActions(box, seriesId, chapterId) {
  $$('.spoiler', box).forEach((s) => (s.onclick = () => s.classList.toggle('show')));
  $$('.cmt-acts button', box).forEach((b) => (b.onclick = async () => {
    const cmt = b.closest('.cmt');
    const id = Number(cmt.dataset.id);
    const act = b.dataset.act;
    if (act === 'del') {
      if (!confirm('حذف التعليق؟')) return;
      try { await api('/comments/' + id, { method: 'DELETE' }); loadComments(seriesId, chapterId, box); } catch (e) { toast(e.message, true); }
    } else if (act === 'report') {
      reportDialog('comment', id, 'تعليق');
    } else if (act === 'reply') {
      const rb = cmt.querySelector(':scope > .cmt-body > .reply-box');
      rb.classList.toggle('hidden');
      if (rb.classList.contains('hidden')) return;
      rb.innerHTML = `<textarea class="textarea" style="min-height:60px" placeholder="اكتب رداً..."></textarea>
        <div class="inline" style="margin-top:6px"><button class="btn btn-primary btn-sm">إرسال</button></div>`;
      rb.querySelector('button').onclick = async () => {
        const body = rb.querySelector('textarea').value.trim();
        if (!body) return;
        try {
          await api('/comments', { method: 'POST', body: { seriesId: Number(seriesId), chapterId, body, parentId: id } });
          loadComments(seriesId, chapterId, box);
        } catch (e) { toast(e.message, true); }
      };
    }
  }));
}

/* ------------------------- reader ------------------------- */
route(/^\/read\/(\d+)$/, async ({ el, params }) => {
  if (!state.user) { location.hash = '#/login'; return; }
  el.innerHTML = `<div class="reader"><div class="reader-bar">
      <button class="icon-btn" id="rBack">✕</button>
      <div class="rb-title">جارٍ التحميل…</div></div><div class="loading"><div class="spinner"></div></div></div>`;
  $('#rBack').onclick = () => history.back();

  let d;
  try {
    d = await api('/chapters/' + params[0] + '/read', { method: 'POST' });
  } catch (e) {
    if (e.status === 402) { adDialog('read', () => render()); return; }
    el.innerHTML = `<div class="reader"><div class="reader-bar"><button class="icon-btn" onclick="history.back()">✕</button>
      <div class="rb-title">خطأ</div></div><div class="empty" style="color:#9aa">${esc(e.message)}</div></div>`;
    return;
  }
  const ch = await api('/chapters/' + params[0]);
  // cache for offline reading
  try { localStorage.setItem('mv_offline_' + params[0], JSON.stringify({ pages: d.pages, title: ch.chapter.series_title })); } catch (_) {}

  el.innerHTML = `<div class="reader">
    <div class="reader-bar">
      <button class="icon-btn" id="rBack2">✕</button>
      <div class="rb-title">${esc(ch.chapter.series_title)} — فصل ${ch.chapter.number}</div>
      <button class="icon-btn" id="rDownload" title="تحميل">⬇</button>
    </div>
    <div class="reader-pages" id="pages">${d.pages.map((p, i) =>
      `<img loading="lazy" src="${API_BASE}/api/img?u=${encodeURIComponent(p)}" alt="page ${i + 1}">`).join('')}</div>
    <div class="reader-foot">
      ${ch.prev ? `<a class="btn btn-ghost" href="#/read/${ch.prev.id}">→ السابق</a>` : ''}
      ${ch.next ? `<a class="btn btn-primary" href="#/read/${ch.next.id}">التالي ←</a>` : `<span class="badge">آخر فصل</span>`}
    </div>
    <div class="reader-progress"><i id="rp"></i></div>
  </div>`;
  $('#rBack2').onclick = () => (history.length > 1 ? history.back() : (location.hash = '#/series/' + ch.chapter.series_id));
  const q = d.quota;
  if (q) { state.quota = q; paintShell(); }
  $('#rDownload').onclick = async () => {
    try { await api('/downloads/' + params[0], { method: 'POST' }); toast('تم التحميل للقراءة دون اتصال'); }
    catch (e) { if (e.status === 402) adDialog('download'); else toast(e.message, true); }
  };
  window.onscroll = () => {
    const h = document.documentElement;
    const p = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
    const bar = $('#rp'); if (bar) bar.style.width = Math.min(100, p) + '%';
  };
});

/* ------------------------- ad / limit dialog ------------------------- */
function adDialog(kind, onDone) {
  const isDl = kind === 'download';
  const sheet = modal(`<h3>وصلت للحد اليومي</h3>
    <p style="color:var(--muted);font-size:13.5px;line-height:1.7">
      ${isDl ? 'حد التحميل المجاني اليومي انتهى.' : 'حد القراءة المجانية اليومي انتهى.'}
      شاهد إعلاناً قصيراً للحصول على رصيد إضافي.</p>
    <div id="adSlot" style="height:132px;border-radius:14px;background:var(--card-2);display:grid;place-items:center;
      font-size:13px;color:var(--muted);margin:14px 0;border:1px dashed var(--line)">مساحة إعلان</div>
    <button class="btn btn-primary btn-block" id="adWatch" disabled>انتظر…</button>
    <button class="btn btn-ghost btn-block" id="adClose" style="margin-top:8px">إغلاق</button>`);
  sheet.querySelector('#adClose').onclick = closeModal;
  const btn = sheet.querySelector('#adWatch');
  let left = 5;
  btn.textContent = `شاهد الإعلان (${left})`;
  const t = setInterval(() => {
    left--;
    if (left <= 0) {
      clearInterval(t);
      btn.disabled = false;
      btn.textContent = 'استلم الرصيد';
      btn.onclick = async () => {
        try {
          const r = await api('/ads/reward', { method: 'POST', body: { kind } });
          toast(`+${r.added} رصيد إضافي`);
          state.quota = r.state; paintShell(); closeModal();
          if (onDone) onDone();
        } catch (e) { toast(e.message, true); }
      };
    } else btn.textContent = `شاهد الإعلان (${left})`;
  }, 1000);
}

/* ------------------------- search / new / recs ------------------------- */
route(/^\/search$/, async ({ el, query }) => {
  const q0 = query.get('q') || '';
  el.innerHTML = `
    <div class="page-head"><h1>البحث</h1></div>
    <div class="inline" style="margin-bottom:10px">
      <input class="input" id="q" placeholder="اسم العمل، تصنيف، كلمات مفتاحية…" value="${esc(q0)}">
      <button class="btn btn-primary" id="go">بحث</button>
    </div>
    <div class="chips" id="types">
      <button class="chip on" data-t="">الكل</button>
      <button class="chip" data-t="manga">مانجا</button>
      <button class="chip" data-t="manhwa">مانهوا</button>
      <button class="chip" data-t="manhua">مانها</button>
    </div>
    <div class="chips" id="cats"></div>
    <div id="results" style="margin-top:14px"></div>`;
  let type = '', cat = '';
  const run = async () => {
    const r = $('#results');
    r.innerHTML = loader();
    const d = await api(`/series?query=${encodeURIComponent($('#q').value)}&type=${type}&category=${encodeURIComponent(cat)}&per=36`);
    r.innerHTML = d.items.length
      ? `<div class="grid">${d.items.map(card).join('')}</div><div class="empty" style="padding:16px">${d.total} نتيجة</div>`
      : empty('🔍', 'لا نتائج — جرّب كلمة أخرى');
  };
  $('#go').onclick = run;
  $('#q').onkeydown = (e) => { if (e.key === 'Enter') run(); };
  $$('#types .chip').forEach((c) => (c.onclick = () => {
    $$('#types .chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); type = c.dataset.t; run();
  }));
  api('/categories').then((d) => {
    $('#cats').innerHTML = d.items.slice(0, 14).map((c) => `<button class="chip" data-c="${esc(c.name)}">${esc(c.name)}</button>`).join('');
    $$('#cats .chip').forEach((c) => (c.onclick = () => {
      const on = c.classList.contains('on');
      $$('#cats .chip').forEach((x) => x.classList.remove('on'));
      if (!on) c.classList.add('on');
      cat = on ? '' : c.dataset.c; run();
    }));
  }).catch(() => {});
  if (q0) run(); else run();
});

route(/^\/new$/, async ({ el }) => {
  const d = await api('/series?sort=newest&per=42');
  el.innerHTML = `<div class="page-head"><div><h1>جديد المانجا</h1><div class="sub">أحدث الأعمال المضافة من كل المصادر</div></div></div>
    <div class="grid">${d.items.map(card).join('')}</div>`;
});

route(/^\/recs$/, async ({ el }) => {
  const d = await api('/recommendations');
  el.innerHTML = `<div class="page-head"><div><h1>التوصيات</h1><div class="sub">مبنية على ${esc(d.reason || 'الأكثر قراءة')}</div></div></div>
    <div class="grid">${d.items.length ? d.items.map(card).join('') : empty('🎯', 'أضف أعمالاً للمفضلة لنقترح عليك')}</div>`;
});

/* ------------------------- history / library ------------------------- */
route(/^\/history$/, async ({ el }) => {
  if (!state.user) return (location.hash = '#/login');
  const d = await api('/history');
  el.innerHTML = `<div class="page-head"><div><h1>سجل المشاهدة</h1><div class="sub">${d.items.length} عمل</div></div></div>
    ${d.items.length ? d.items.map((s) => rowItem(s, `<div class="r-sub">آخر قراءة ${timeAgo(s.read_at)}</div>`)).join('') : empty('🕘', 'لم تقرأ شيئاً بعد')}`;
});

route(/^\/library\/(favorite|reading|later|read)$/, async ({ el, params }) => {
  if (!state.user) return (location.hash = '#/login');
  const list = params[0];
  const all = await api('/library');
  const titles = { favorite: 'المفضلة', reading: 'أقرأها الآن', later: 'للقراءة لاحقاً', read: 'القوائم المقروءة' };
  const d = all[list] || [];
  el.innerHTML = `<div class="page-head"><h1>مكتبتي</h1></div>
    <div class="tabs" id="ltabs">
      ${Object.keys(titles).map((k) => `<button class="${k === list ? 'on' : ''}" data-l="${k}">${titles[k]}</button>`).join('')}
    </div>
    <div id="libList">${d.length ? d.map((s) => rowItem(s, `<div class="r-actions">
        <button class="btn btn-soft btn-sm" data-remove="${s.id}">إزالة</button></div>`)).join('') : empty('📚', 'القائمة فارغة')}</div>`;
  $$('#ltabs button').forEach((b) => (b.onclick = () => (location.hash = '#/library/' + b.dataset.l)));
  $$('[data-remove]', el).forEach((b) => (b.onclick = async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    await api(`/library/${list}/${b.dataset.remove}`, { method: 'DELETE' });
    b.closest('.row').remove(); toast('تمت الإزالة');
  }));
});

/* ------------------------- notifications ------------------------- */
route(/^\/notifications$/, async ({ el }) => {
  if (!state.user) return (location.hash = '#/login');
  const d = await api('/notifications');
  el.innerHTML = `<div class="page-head"><div><h1>الإشعارات</h1><div class="sub">${d.unread} غير مقروء</div></div>
    <button class="btn btn-soft btn-sm" id="readAll">تحديد الكل كمقروء</button></div>
    ${d.items.length ? d.items.map((n) => `<div class="panel" style="padding:13px;${n.read_at ? 'opacity:.65' : ''}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
        <b style="font-size:13.5px">${esc(n.title)}</b><span style="font-size:11px;color:var(--muted)">${timeAgo(n.created_at)}</span></div>
      <div style="font-size:12.5px;color:var(--muted);margin-top:4px">${esc(n.body || '')}</div>
      ${n.user_id === null ? '<span class="badge brand" style="margin-top:6px">تعميم</span>' : ''}
    </div>`).join('') : empty('🔔', 'لا إشعارات')}`;
  $('#readAll').onclick = async () => { await api('/notifications/read', { method: 'POST', body: {} }); render(); };
});

route(/^\/downloads$/, async ({ el }) => {
  if (!state.user) return (location.hash = '#/login');
  const d = await api('/downloads');
  el.innerHTML = `<div class="page-head"><div><h1>التحميلات</h1>
    <div class="sub">اليوم: ${d.quota.dl_used}/${d.quota.dl_limit}${d.quota.dl_bonus ? ` (+${d.quota.dl_bonus})` : ''}</div></div></div>
    ${d.items.length ? d.items.map((x) => `<div class="row">
      <img src="${img(x.cover)}" alt="">
      <div class="r-body"><div class="r-title">${esc(x.series_title)}</div>
        <div class="r-sub"><span>الفصل ${x.number}</span><span>${timeAgo(x.created_at)}</span></div></div>
      <div class="r-actions"><a class="btn btn-primary btn-sm" href="#/read/${x.chapter_id}">قراءة</a>
        <button class="btn btn-soft btn-sm" data-del="${x.chapter_id}">حذف</button></div></div>`).join('')
      : empty('⬇️', 'لا تحميلات بعد')}`;
  $$('[data-del]', el).forEach((b) => (b.onclick = async () => {
    await api('/downloads/' + b.dataset.del, { method: 'DELETE' }); b.closest('.row').remove();
  }));
});

/* ------------------------- settings / privacy / login ------------------------- */
route(/^\/settings$/, async ({ el }) => {
  if (!state.user) return (location.hash = '#/login');
  const u = state.user, q = state.quota || {};
  el.innerHTML = `
    <div class="page-head"><h1>الإعدادات</h1></div>
    <div class="panel">
      <div style="display:flex;gap:12px;align-items:center">
        <img class="avatar" src="${avatarOf(u)}" style="width:62px;height:62px" alt="">
        <div style="min-width:0"><div style="font-weight:800;font-size:16px">${esc(u.username)} ${vBadge(u.role, u.verified)}</div>
          <div style="font-size:12px;color:var(--muted)">${esc(u.email)}</div>
          <span class="badge ${u.role === 'user' ? '' : 'brand'}" style="margin-top:4px">${ROLE_AR[u.role]}</span></div>
      </div>
      <div style="margin-top:14px">
        <div class="quota-mini">قراءة اليوم: <b>${q.read_used}/${q.read_limit}</b> — تحميل اليوم: <b>${q.dl_used}/${q.dl_limit}</b>
          ${q.read_bonus || q.dl_bonus ? `<br>رصيد إعلانات: <b>+${q.read_bonus}</b> قراءة، <b>+${q.dl_bonus}</b> تحميل` : ''}</div>
      </div>
      ${['admin', 'moderator'].includes(u.role) ? `<a class="btn btn-primary btn-block" href="#/admin" style="margin-top:12px">🛠️ غرفة الإدارة</a>` : ''}
    </div>

    <div class="panel"><h3>تعديل الملف الشخصي</h3>
      <div class="field"><label>الاسم</label><input class="input" id="uname" value="${esc(u.username)}"></div>
      <div class="field"><label>رابط الصورة الشخصية</label><input class="input" id="uavatar" value="${esc(u.avatar || '')}" placeholder="https://..."></div>
      <button class="btn btn-primary" id="saveProfile">حفظ</button>
    </div>

    <div class="panel"><h3>الأمان</h3>
      <div class="field"><label>كلمة المرور الحالية</label><input class="input" type="password" id="cur"></div>
      <div class="field"><label>كلمة المرور الجديدة</label><input class="input" type="password" id="new"></div>
      <button class="btn btn-soft" id="savePass">تغيير كلمة المرور</button>
    </div>

    <div class="panel"><h3>المظهر</h3>
      <label class="switch"><input type="checkbox" id="th" ${document.body.dataset.theme === 'dark' ? 'checked' : ''}><span>الوضع الليلي</span></label>
    </div>

    <div class="panel"><h3>الحساب</h3>
      <a class="btn btn-ghost btn-block" href="#/privacy" style="margin-bottom:8px">سياسة الخصوصية</a>
      <button class="btn btn-danger btn-block" id="logout">تسجيل الخروج</button>
    </div>`;
  $('#saveProfile').onclick = async () => {
    try {
      const d = await api('/auth/me', { method: 'PATCH', body: { username: $('#uname').value, avatar: $('#uavatar').value } });
      state.user = d.user; paintShell(); toast('تم الحفظ');
    } catch (e) { toast(e.message, true); }
  };
  $('#savePass').onclick = async () => {
    try {
      await api('/auth/me', { method: 'PATCH', body: { password: $('#new').value, current_password: $('#cur').value } });
      toast('تم تغيير كلمة المرور'); $('#cur').value = ''; $('#new').value = '';
    } catch (e) { toast(e.message, true); }
  };
  $('#th').onchange = () => $('#btnTheme').click();
  $('#logout').onclick = () => { if (confirm('تسجيل الخروج؟')) logout(); };
});

route(/^\/privacy$/, async ({ el }) => {
  let s = { privacy_policy: 'لا نجمع بيانات أكثر من اللازم.' };
  try { s = (await api('/site')).settings; } catch (_) {}
  el.innerHTML = `<div class="page-head"><h1>سياسة الخصوصية</h1></div>
    <div class="panel" style="line-height:1.9;font-size:13.5px">${esc(s.privacy_policy).replace(/\n/g, '<br>')}</div>
    <div class="panel"><h3>ما نحفظه</h3>
      <div style="font-size:13px;color:var(--muted);line-height:1.9">
      • البريد الإلكتروني وكلمة مرور مشفّرة (bcrypt).<br>
      • قوائمك (المفضلة/أقرأها الآن/لاحقاً/المقروءة) وسجل القراءة والتحميلات.<br>
      • لا نستخدم أي متتبعات خارجية، ولا نبيع بياناتك.</div></div>`;
});

route(/^\/login$/, async ({ el, query }) => {
  const mode0 = query.get('mode') === 'register' ? 'register' : 'login';
  const paint = (mode) => {
    el.innerHTML = `<div class="auth-wrap"><div class="auth-card">
      <div style="text-align:center;margin-bottom:14px">
        <span class="brand-mark" style="display:inline-grid;width:46px;height:46px;font-size:22px">M</span>
        <h2 style="margin-top:10px">${mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}</h2>
        <p class="hint">مزامنة مكتبتك وسجل قراءتك على كل أجهزتك</p>
      </div>
      <div class="tabs"><button class="${mode === 'login' ? 'on' : ''}" data-m="login">دخول</button>
        <button class="${mode === 'register' ? 'on' : ''}" data-m="register">حساب جديد</button></div>
      ${mode === 'register' ? '<div class="field"><label>الاسم</label><input class="input" id="rname" placeholder="اسمك"></div>' : ''}
      <div class="field"><label>البريد الإلكتروني</label><input class="input" id="email" type="email" placeholder="you@mail.com" autocomplete="email"></div>
      <div class="field"><label>كلمة المرور</label><input class="input" id="pass" type="password" placeholder="••••••" autocomplete="current-password"></div>
      <button class="btn btn-primary btn-block" id="submit">${mode === 'login' ? 'دخول' : 'إنشاء الحساب'}</button>
      <div style="text-align:center;font-size:12px;color:var(--muted);margin-top:12px">
        بالمتابعة أنت توافق على <a href="#/privacy" style="color:var(--brand)">سياسة الخصوصية</a></div>
    </div></div>`;
    $$('.tabs button', el).forEach((b) => (b.onclick = () => paint(b.dataset.m)));
    $('#submit').onclick = async () => {
      const body = { email: $('#email').value.trim(), password: $('#pass').value };
      if (mode === 'register') body.username = $('#rname').value.trim() || body.email.split('@')[0];
      try {
        const d = await api('/auth/' + mode, { method: 'POST', body });
        saveSession(d);
        toast('مرحباً ' + d.user.username);
        location.hash = '#/home';
      } catch (e) { toast(e.message, true); }
    };
  };
  paint(mode0);
});

/* ------------------------- boot ------------------------- */
document.addEventListener('DOMContentLoaded', boot);
if (document.readyState !== 'loading') boot();
