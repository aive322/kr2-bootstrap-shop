/* Горизонт: тёмная тема, избранное, личный кабинет, отзывы и поиск по сайту.
   Данные хранятся в браузере (localStorage): серверной части у сайта нет. */
(function () {
  'use strict';

  var DATA = window.HZ_DATA || { tours: [], pages: [], faq: [] };
  var TOURS = DATA.tours;
  var NB = ' ';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₽'; }
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  function tourBySlug(slug) {
    for (var i = 0; i < TOURS.length; i++) if (TOURS[i].slug === slug) return TOURS[i];
    return null;
  }

  /* ---------- Хранилище ---------- */
  function load(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  function toast(text) {
    var el = $('#siteToast');
    if (!el || !window.bootstrap) return;
    $('.toast-body', el).textContent = text;
    window.bootstrap.Toast.getOrCreateInstance(el, { delay: 5000 }).show();
  }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Тёмная тема с плавным переходом ---------- */
  var root = document.documentElement;
  var themeBtn = $('#themeToggle');

  function currentTheme() { return root.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light'; }

  function paintThemeButton() {
    if (!themeBtn) return;
    var dark = currentTheme() === 'dark';
    themeBtn.innerHTML = dark ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon-stars"></i>';
    themeBtn.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
    themeBtn.setAttribute('title', dark ? 'Светлая тема' : 'Тёмная тема');
  }

  function applyTheme(theme) {
    root.setAttribute('data-bs-theme', theme);
    try { window.localStorage.setItem('hz_theme', theme); } catch (e) { /* без сохранения */ }
    paintThemeButton();
  }

  function switchTheme(origin) {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    if (reduceMotion) { applyTheme(next); return; }

    if (document.startViewTransition) {
      var rect = origin.getBoundingClientRect();
      var x = rect.left + rect.width / 2;
      var y = rect.top + rect.height / 2;
      var radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      var transition = document.startViewTransition(function () { applyTheme(next); });
      transition.ready.then(function () {
        root.animate(
          { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 650, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(function () { /* переход отменён */ });
    } else {
      root.classList.add('theme-fade');
      applyTheme(next);
      window.setTimeout(function () { root.classList.remove('theme-fade'); }, 600);
    }
  }

  paintThemeButton();
  if (themeBtn) themeBtn.addEventListener('click', function () { switchTheme(themeBtn); });

  /* ---------- Избранное ---------- */
  function getFavs() {
    var list = load('hz_favs', []);
    return Array.isArray(list) ? list.filter(function (s) { return !!tourBySlug(s); }) : [];
  }

  function paintFavs() {
    var favs = getFavs();
    $$('[data-fav]').forEach(function (btn) {
      var on = favs.indexOf(btn.getAttribute('data-fav')) !== -1;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var icon = $('i', btn);
      if (icon) icon.className = on ? 'bi bi-heart-fill' : 'bi bi-heart';
      var label = $('span', btn);
      if (label) label.textContent = on ? 'В избранном' : 'В избранное';
    });
    var badge = $('#favCount');
    if (badge) {
      badge.textContent = favs.length;
      badge.hidden = favs.length === 0;
    }
  }

  function toggleFav(slug) {
    var favs = getFavs();
    var i = favs.indexOf(slug);
    var t = tourBySlug(slug);
    if (i === -1) {
      favs.push(slug);
      toast('Добавлено в избранное: ' + (t ? t.place : ''));
    } else {
      favs.splice(i, 1);
      toast('Удалено из избранного');
    }
    save('hz_favs', favs);
    paintFavs();
    document.dispatchEvent(new CustomEvent('hz:favs'));
  }

  document.addEventListener('click', function (event) {
    var btn = event.target.closest ? event.target.closest('[data-fav]') : null;
    if (!btn) return;
    event.preventDefault();
    toggleFav(btn.getAttribute('data-fav'));
  });

  function tourCardHtml(t) {
    var label = t.label ? '<span class="badge ' + t.badge + ' tour-card__label">' + esc(t.label) + '</span>' : '';
    var old = t.old ? '<s class="text-muted small ms-2">' + money(t.old) + '</s>' : '';
    return '<div class="col-12 col-md-6 col-xl-4"><article class="card tour-card h-100 border-0 shadow-sm">' +
      '<div class="position-relative"><img src="' + esc(t.photo) + '" class="card-img-top" alt="' + esc(t.alt) + '" loading="lazy">' + label +
      '<button class="btn-fav" type="button" data-fav="' + t.slug + '" aria-pressed="false" aria-label="Убрать из избранного: ' + esc(t.place) + '"><i class="bi bi-heart"></i></button></div>' +
      '<div class="card-body d-flex flex-column">' +
      '<p class="text-muted small mb-1"><i class="bi bi-geo-alt me-1"></i>' + esc(t.place) + '</p>' +
      '<h3 class="h5 card-title"><a class="text-reset text-decoration-none" href="' + t.href + '">' + esc(t.title) + '</a></h3>' +
      '<p class="small text-muted mb-2">' + t.nights + NB + plural(t.nights, 'ночь', 'ночи', 'ночей') + ' · отель ' + t.stars + '★ · ' + esc(t.meals) + '</p>' +
      '<div class="mt-auto"><p class="mb-3"><span class="text-muted small">от</span> <span class="fs-4 fw-bold' + (t.old ? ' text-danger' : '') + '">' + money(t.price) + '</span>' + old +
      '<span class="text-muted small d-block">за человека</span></p>' +
      '<div class="d-flex gap-2"><a class="btn btn-primary" href="' + t.href + '">Подробнее</a></div></div></div></article></div>';
  }

  function renderFavorites(container, emptyBox) {
    if (!container) return;
    var favs = getFavs();
    container.innerHTML = favs.map(function (s) { return tourCardHtml(tourBySlug(s)); }).join('');
    if (emptyBox) emptyBox.hidden = favs.length > 0;
    paintFavs();
  }

  /* ---------- Пользователь (демо без сервера) ---------- */
  function sha(text) {
    var salt = 'hz:' + text;
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      });
    }
    var h = 5381;
    for (var i = 0; i < salt.length; i++) h = ((h << 5) + h + salt.charCodeAt(i)) | 0;
    return Promise.resolve('d' + h);
  }

  function users() { return load('hz_users', {}); }
  function sessionEmail() { return load('hz_session', null); }
  function currentUser() {
    var email = sessionEmail();
    var u = email ? users()[email] : null;
    return u ? { email: email, name: u.name, phone: u.phone || '' } : null;
  }
  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/);
    return ((parts[0] || '?').charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
  }

  function paintAccountLink() {
    var link = $('#accountLink');
    if (!link) return;
    var u = currentUser();
    var icon = $('i', link);
    if (u) {
      icon.className = 'bi bi-person-check-fill';
      link.classList.add('is-active');
      link.setAttribute('title', u.name);
      link.setAttribute('aria-label', 'Личный кабинет: ' + u.name);
    } else {
      icon.className = 'bi bi-person';
      link.classList.remove('is-active');
    }
  }

  function prefillForms() {
    var u = currentUser();
    if (!u) return;
    $$('form').forEach(function (form) {
      if (form.hasAttribute('data-no-prefill')) return;
      var map = { name: u.name, email: u.email, phone: u.phone };
      Object.keys(map).forEach(function (k) {
        var input = $('[name="' + k + '"]', form);
        if (input && !input.value && map[k] && input.type !== 'hidden' && !input.readOnly) input.value = map[k];
      });
    });
  }

  /* ---------- Заявки ---------- */
  function saveOrder(form) {
    var fd = new FormData(form);
    var u = currentUser();
    var product = String(fd.get('product') || '');
    var tour = tourBySlug(product);
    if (!tour) {
      TOURS.forEach(function (t) { if (!tour && t.place === product) tour = t; });
    }
    var contact = fd.getAll('contact');
    var order = {
      id: String(10000 + Math.floor(Math.random() * 89999)),
      createdAt: new Date().toISOString(),
      owner: u ? u.email : null,
      name: String(fd.get('name') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      email: String(fd.get('email') || '').trim().toLowerCase(),
      slug: tour ? tour.slug : null,
      tour: tour ? tour.place : (product || 'Подбор тура'),
      date: String(fd.get('date') || ''),
      adults: String(fd.get('adults') || ''),
      children: String(fd.get('children') || ''),
      budget: String(fd.get('budget') || ''),
      contact: contact.join(', '),
      comment: String(fd.get('comment') || '').trim()
    };
    var list = load('hz_orders', []);
    list.unshift(order);
    save('hz_orders', list.slice(0, 50));
    return u ? ' Номер заявки ' + order.id + ' — она сохранена в личном кабинете.' : ' Номер заявки ' + order.id + '.';
  }

  function myOrders() {
    var u = currentUser();
    if (!u) return [];
    return load('hz_orders', []).filter(function (o) {
      return o.owner === u.email || (o.email && o.email === u.email) || (u.phone && o.phone === u.phone);
    });
  }

  /* ---------- Отзывы пользователя ---------- */
  function allUserReviews() { return load('hz_reviews', []); }

  function reviewCardHtml(r, wide) {
    var t = tourBySlug(r.slug);
    var ini = initials(r.name);
    var stars = new Array(r.stars + 1).join('<i class="bi bi-star-fill"></i>') + new Array(6 - r.stars).join('<i class="bi bi-star"></i>');
    var tourLine = t ? '<figcaption class="small"><i class="bi bi-geo-alt text-primary me-1"></i>Тур: <a href="' + t.href + '">' + esc(t.place) + '</a></figcaption>' : '';
    var inner = '<figure class="review h-100 review--mine">' +
      '<div class="d-flex align-items-center gap-3 mb-3"><span class="avatar">' + esc(ini) + '</span>' +
      '<div class="flex-grow-1"><strong class="d-block">' + esc(r.name) + ' <span class="badge text-bg-primary ms-1">Ваш отзыв</span></strong><span class="small text-muted">' + esc(r.trip) + '</span></div>' +
      '<span class="text-warning text-nowrap" role="img" aria-label="Оценка ' + r.stars + ' из 5">' + stars + '</span></div>' +
      '<blockquote class="mb-3">' + esc(r.text) + '</blockquote>' + tourLine + '</figure>';
    if (!wide) return inner;
    return '<div class="col-12 col-lg-6 review-col" data-dest="' + (t ? t.dest : '') + '" data-stars="' + r.stars + '" data-mine="1">' + inner + '</div>';
  }

  function renderUserReviewsOnReviewsPage() {
    var list = $('#reviewList');
    if (!list) return;
    $$('[data-mine]', list).forEach(function (n) { n.remove(); });
    var html = allUserReviews().map(function (r) { return reviewCardHtml(r, true); }).join('');
    list.insertAdjacentHTML('afterbegin', html);
  }

  function renderUserReviewsOnTourPage() {
    var box = $('#userReviews');
    if (!box) return;
    var slug = box.getAttribute('data-slug');
    box.innerHTML = allUserReviews().filter(function (r) { return r.slug === slug; }).map(function (r) {
      return '<div class="mb-3">' + reviewCardHtml(r, false).replace('h-100 ', '') + '</div>';
    }).join('');
  }

  function initReviewForm() {
    var modalEl = $('#reviewModal');
    var form = $('#reviewForm');
    if (!modalEl || !form) return;

    // Выбор месяца поездки: последние 10 месяцев (всегда в прошлом)
    var monthSel = $('#rv-month');
    if (monthSel && !monthSel.options.length) {
      var now = new Date();
      for (var i = 1; i <= 10; i++) {
        var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        var label = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '');
        label = label.charAt(0).toUpperCase() + label.slice(1);
        monthSel.add(new Option(label, label));
      }
    }

    var modal = window.bootstrap ? window.bootstrap.Modal.getOrCreateInstance(modalEl) : null;
    var params = new URLSearchParams(window.location.search);
    if (params.get('review')) {
      var pre = $('#rv-tour');
      if (pre && tourBySlug(params.get('review'))) pre.value = params.get('review');
      prefillForms();
      if (modal) modal.show();
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.classList.add('was-validated');
        var bad = $(':invalid', form);
        if (bad) bad.focus();
        return;
      }
      var fd = new FormData(form);
      var u = currentUser();
      var review = {
        id: 'r' + Date.now(),
        createdAt: new Date().toISOString(),
        owner: u ? u.email : null,
        name: String(fd.get('name')).trim(),
        slug: String(fd.get('tour')),
        stars: parseInt(fd.get('stars'), 10),
        trip: String(fd.get('month')) + ' · ' + String(fd.get('kind')),
        text: String(fd.get('text')).trim()
      };
      var list = allUserReviews();
      list.unshift(review);
      save('hz_reviews', list.slice(0, 30));
      form.reset();
      form.classList.remove('was-validated');
      if (modal) modal.hide();
      renderUserReviewsOnReviewsPage();
      var filter = $('#reviewFilter');
      if (filter) {
        var dest = $('#r-dest'); if (dest) dest.value = '';
        var all = $('#r-all'); if (all) all.checked = true;
        filter.dispatchEvent(new Event('change', { bubbles: true }));
      }
      toast('Спасибо! Ваш отзыв опубликован.');
      var first = $('[data-mine]');
      if (first) first.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    });
  }

  /* ---------- Поиск по сайту ---------- */
  function tokens(q) { return q.toLowerCase().split(/[\s,.;:]+/).filter(function (w) { return w.length > 0; }); }

  function hay(item) { return (item._hay = item._hay || (item.place + ' ' + item.country + ' ' + item.title + ' ' + item.text + ' ' + item.dest + ' ' + item.meals).toLowerCase()); }

  function matchAll(text, words) {
    for (var i = 0; i < words.length; i++) if (text.indexOf(words[i]) === -1) return false;
    return true;
  }

  function mark(text, words) {
    var out = esc(text);
    words.forEach(function (w) {
      if (w.length < 2) return;
      var re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }

  function renderSearch(q) {
    var box = $('#siteSearchResults');
    if (!box) return;
    var words = tokens(q);
    if (!words.length) {
      box.innerHTML = '<p class="text-muted small mb-2">Попробуйте найти:</p><div class="d-flex flex-wrap gap-2">' +
        ['Турция', 'Египет', 'Италия', 'Таиланд', 'Мальдивы', 'виза', 'оплата'].map(function (w) {
          return '<button type="button" class="btn btn-outline-primary btn-sm" data-suggest="' + w + '">' + w + '</button>';
        }).join('') + '</div>';
      return;
    }
    var tours = TOURS.filter(function (t) { return matchAll(hay(t), words); }).slice(0, 5);
    var pages = DATA.pages.filter(function (p) { return matchAll((p.title + ' ' + p.text).toLowerCase(), words); }).slice(0, 4);
    var faq = DATA.faq.filter(function (f) { return matchAll((f.q + ' ' + f.a).toLowerCase(), words); }).slice(0, 3);

    if (!tours.length && !pages.length && !faq.length) {
      box.innerHTML = '<div class="alert alert-info mb-0">Ничего не найдено. Попробуйте другое слово или откройте <a href="catalog.html">каталог туров</a>.</div>';
      return;
    }
    var html = '';
    if (tours.length) {
      html += '<h3 class="h6 text-muted text-uppercase small mb-2">Туры</h3><div class="list-group mb-3">' + tours.map(function (t) {
        return '<a class="list-group-item list-group-item-action d-flex align-items-center gap-3" href="' + t.href + '">' +
          '<img class="search-thumb" src="' + esc(t.photo) + '" alt="" width="56" height="56">' +
          '<span class="flex-grow-1"><strong class="d-block">' + mark(t.title, words) + '</strong><span class="small text-muted">' + mark(t.place, words) + ' · ' + t.nights + NB + plural(t.nights, 'ночь', 'ночи', 'ночей') + '</span></span>' +
          '<span class="fw-bold text-nowrap">от ' + money(t.price) + '</span></a>';
      }).join('') + '</div>';
    }
    if (pages.length) {
      html += '<h3 class="h6 text-muted text-uppercase small mb-2">Разделы сайта</h3><div class="list-group mb-3">' + pages.map(function (p) {
        return '<a class="list-group-item list-group-item-action" href="' + p.url + '"><i class="bi bi-arrow-right-short me-1"></i>' + mark(p.title, words) + '</a>';
      }).join('') + '</div>';
    }
    if (faq.length) {
      html += '<h3 class="h6 text-muted text-uppercase small mb-2">Вопросы и ответы</h3><div class="list-group mb-3">' + faq.map(function (f) {
        return '<a class="list-group-item list-group-item-action" href="' + f.url + '"><strong class="d-block">' + mark(f.q, words) + '</strong><span class="small text-muted">' + esc(f.a) + '</span></a>';
      }).join('') + '</div>';
    }
    html += '<a class="btn btn-link px-0" href="catalog.html?q=' + encodeURIComponent(q.trim()) + '">Все туры по запросу «' + esc(q.trim()) + '»</a>';
    box.innerHTML = html;
  }

  var searchModal = $('#searchModal');
  var searchInput = $('#siteSearchInput');
  if (searchModal && searchInput) {
    searchInput.addEventListener('input', function () { renderSearch(searchInput.value); });
    searchModal.addEventListener('show.bs.modal', function () { renderSearch(searchInput.value); });
    searchModal.addEventListener('shown.bs.modal', function () { searchInput.focus(); });
    searchModal.addEventListener('click', function (e) {
      var s = e.target.closest ? e.target.closest('[data-suggest]') : null;
      if (!s) return;
      searchInput.value = s.getAttribute('data-suggest');
      renderSearch(searchInput.value);
      searchInput.focus();
    });
    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && window.bootstrap) {
        e.preventDefault();
        window.bootstrap.Modal.getOrCreateInstance(searchModal).show();
      }
    });
  }

  /* ---------- Личный кабинет ---------- */
  function initAccount() {
    var page = $('#accountPage');
    if (!page) return;
    var authView = $('#authView');
    var cabinet = $('#cabinetView');
    var guestFavs = $('#guestFavs');

    var showTab = function (id) {
      var btn = $('#' + id);
      if (btn && window.bootstrap) window.bootstrap.Tab.getOrCreateInstance(btn).show();
    };

    var renderOrders = function () {
      var box = $('#ordersList');
      var empty = $('#ordersEmpty');
      var list = myOrders();
      empty.hidden = list.length > 0;
      box.innerHTML = list.map(function (o) {
        var d = new Date(o.createdAt);
        var when = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        var t = o.slug ? tourBySlug(o.slug) : null;
        var guests = o.adults ? (o.adults + ' взр.' + (o.children && o.children !== '0' ? ', ' + o.children + ' дет.' : '')) : '';
        return '<div class="list-group-item p-3"><div class="d-flex flex-wrap justify-content-between align-items-start gap-2">' +
          '<div><strong class="d-block">Заявка № ' + esc(o.id) + '</strong>' +
          '<span class="text-muted small">от ' + when + '</span></div>' +
          '<span class="badge text-bg-success">Принята</span></div>' +
          '<p class="mb-1 mt-2">' + (t ? '<a href="' + t.href + '">' + esc(o.tour) + '</a>' : esc(o.tour)) + '</p>' +
          '<p class="small text-muted mb-0">' + [o.date ? 'Вылет: ' + esc(o.date) : '', guests, o.budget ? 'Бюджет: ' + esc(o.budget) : ''].filter(Boolean).join(' · ') + '</p>' +
          '<p class="small text-muted mb-0">Менеджер свяжется с вами в ближайшее время.</p></div>';
      }).join('');
    };

    var renderMyReviews = function () {
      var u = currentUser();
      var box = $('#myReviews');
      var empty = $('#myReviewsEmpty');
      var list = allUserReviews().filter(function (r) { return u && r.owner === u.email; });
      empty.hidden = list.length > 0;
      box.innerHTML = list.map(function (r) { return '<div class="col-12 col-lg-6">' + reviewCardHtml(r, false) + '</div>'; }).join('');
    };

    var paintProfile = function () {
      var u = currentUser();
      if (!u) return;
      $('#cabName').textContent = u.name;
      $('#cabEmail').textContent = u.email;
      $('#cabAvatar').textContent = initials(u.name);
      $('#p-name').value = u.name;
      $('#p-email').value = u.email;
      $('#p-phone').value = u.phone || '';
      var n = getFavs().length;
      $('#cabFavCount').textContent = n;
      $('#cabOrdersCount').textContent = myOrders().length;
    };

    var view = function () {
      var u = currentUser();
      authView.hidden = !!u;
      cabinet.hidden = !u;
      var wantFavs = window.location.hash === '#favorites';
      guestFavs.hidden = !!u || !wantFavs;
      if (u) {
        paintProfile();
        renderOrders();
        renderMyReviews();
        renderFavorites($('#favList'), $('#favEmpty'));
        if (wantFavs) showTab('tab-favs');
      } else if (wantFavs) {
        renderFavorites($('#guestFavList'), $('#guestFavEmpty'));
      }
      paintAccountLink();
      prefillForms();
    };

    document.addEventListener('hz:favs', function () {
      if (currentUser()) { renderFavorites($('#favList'), $('#favEmpty')); paintProfile(); } else { renderFavorites($('#guestFavList'), $('#guestFavEmpty')); }
    });
    window.addEventListener('hashchange', view);

    var showAlert = function (text) {
      var box = $('#authAlert');
      box.textContent = text;
      box.hidden = !text;
    };

    var phoneInputs = $$('input[type="tel"]', page);
    phoneInputs.forEach(function () { /* маска телефона подключается в main.js */ });

    $('#loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      if (!f.checkValidity()) { f.classList.add('was-validated'); return; }
      var email = $('[name="email"]', f).value.trim().toLowerCase();
      var pass = $('[name="password"]', f).value;
      var u = users()[email];
      sha(pass).then(function (h) {
        if (!u || u.hash !== h) { showAlert('Неверная почта или пароль.'); return; }
        showAlert('');
        save('hz_session', email);
        f.reset(); f.classList.remove('was-validated');
        view();
        toast('Добро пожаловать, ' + u.name + '!');
      });
    });

    $('#registerForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      if (!f.checkValidity()) { f.classList.add('was-validated'); return; }
      var email = $('[name="email"]', f).value.trim().toLowerCase();
      var all = users();
      if (all[email]) { showAlert('Пользователь с такой почтой уже зарегистрирован. Войдите в кабинет.'); return; }
      sha($('[name="password"]', f).value).then(function (h) {
        all[email] = { name: $('[name="name"]', f).value.trim(), phone: $('[name="phone"]', f).value.trim(), hash: h };
        save('hz_users', all);
        save('hz_session', email);
        showAlert('');
        f.reset(); f.classList.remove('was-validated');
        view();
        toast('Аккаунт создан. Добро пожаловать!');
      });
    });

    $('#logoutBtn').addEventListener('click', function () {
      try { window.localStorage.removeItem('hz_session'); } catch (err) { /* ничего */ }
      view();
      toast('Вы вышли из кабинета');
    });

    $('#profileForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      if (!f.checkValidity()) { f.classList.add('was-validated'); return; }
      var u = currentUser();
      var all = users();
      all[u.email].name = $('[name="name"]', f).value.trim();
      all[u.email].phone = $('[name="phone"]', f).value.trim();
      save('hz_users', all);
      view();
      toast('Профиль сохранён');
    });

    $('#clearDataBtn').addEventListener('click', function () {
      if (!window.confirm('Удалить аккаунт и все сохранённые в браузере данные (заявки, избранное, отзывы)?')) return;
      var u = currentUser();
      var all = users();
      if (u) delete all[u.email];
      save('hz_users', all);
      ['hz_session', 'hz_orders', 'hz_favs', 'hz_reviews'].forEach(function (k) {
        try { window.localStorage.removeItem(k); } catch (err) { /* ничего */ }
      });
      paintFavs();
      view();
      toast('Данные удалены');
    });

    view();
  }

  /* ---------- Запуск ---------- */
  window.HZ_APP = { saveOrder: saveOrder, user: currentUser, favs: getFavs };

  paintFavs();
  paintAccountLink();
  prefillForms();
  renderUserReviewsOnReviewsPage();
  renderUserReviewsOnTourPage();
  initReviewForm();
  initAccount();
})();
