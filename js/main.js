/* Скрипты сайта «Горизонт»: маска телефона, проверка форм, каталог, окно заявки. */
(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  /* ---------- Пагинация (общая для каталога и отзывов) ---------- */
  function renderPagination(pager, page, pages, goTo) {
    pager.innerHTML = '';
    if (pages < 2) return;
    var add = function (label, target, disabled, active, aria) {
      var li = document.createElement('li');
      li.className = 'page-item' + (disabled ? ' disabled' : '') + (active ? ' active' : '');
      var a = document.createElement('a');
      a.className = 'page-link';
      a.href = '#';
      a.textContent = label;
      if (aria) a.setAttribute('aria-label', aria);
      if (active) a.setAttribute('aria-current', 'page');
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (disabled || active) return;
        goTo(target);
      });
      li.appendChild(a);
      pager.appendChild(li);
    };
    add('\u2039', page - 1, page === 1, false, 'Предыдущая страница');
    for (var i = 1; i <= pages; i++) add(String(i), i, false, i === page);
    add('\u203a', page + 1, page === pages, false, 'Следующая страница');
  }

  /* ---------- Уведомление ---------- */
  function showToast(text) {
    var el = $('#siteToast');
    if (!el || !window.bootstrap) return;
    $('.toast-body', el).textContent = text;
    window.bootstrap.Toast.getOrCreateInstance(el, { delay: 6000 }).show();
  }

  /* ---------- Маска телефона ---------- */
  function formatPhone(value) {
    var d = value.replace(/\D/g, '');
    if (d.charAt(0) === '7' || d.charAt(0) === '8') d = d.slice(1);
    d = d.slice(0, 10);
    if (!d.length) return '';
    var out = '+7 (' + d.slice(0, 3);
    if (d.length > 3) out += ') ' + d.slice(3, 6);
    if (d.length > 6) out += '-' + d.slice(6, 8);
    if (d.length > 8) out += '-' + d.slice(8, 10);
    return out;
  }

  $$('input[type="tel"]').forEach(function (input) {
    input.addEventListener('input', function () {
      input.value = formatPhone(input.value);
    });
  });

  /* ---------- Проверка и отправка форм ---------- */
  $$('form.needs-validation').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.classList.add('was-validated');
        var bad = $(':invalid', form);
        if (bad) bad.focus();
        return;
      }
      var message = form.getAttribute('data-success') || 'Заявка отправлена.';
      if (form.hasAttribute('data-order') && window.HZ_APP) message += window.HZ_APP.saveOrder(form);
      var modalEl = form.closest('.modal');
      form.reset();
      form.classList.remove('was-validated');
      $$('select', form).forEach(function (s) { s.dispatchEvent(new Event('change')); });
      if (modalEl && window.bootstrap) {
        window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      }
      showToast(message);
    });
  });

  /* ---------- Окно быстрой заявки: подставляем название тура ---------- */
  var orderModal = $('#orderModal');
  if (orderModal) {
    orderModal.addEventListener('show.bs.modal', function (event) {
      var btn = event.relatedTarget;
      var field = $('[name="product"]', orderModal);
      if (btn && field) field.value = btn.getAttribute('data-tour') || '';
    });
    orderModal.addEventListener('shown.bs.modal', function () {
      var name = $('[name="name"]', orderModal);
      if (name) name.focus();
    });
  }

  /* ---------- Отзывы: «Показать ещё» ---------- */
  var moreReviews = $('#moreReviews');
  if (moreReviews) {
    var moreBtn = $('[data-bs-target="#moreReviews"]');
    moreReviews.addEventListener('shown.bs.collapse', function () { moreBtn.textContent = moreBtn.getAttribute('data-less'); });
    moreReviews.addEventListener('hidden.bs.collapse', function () { moreBtn.textContent = moreBtn.getAttribute('data-more'); });
  }

  /* ---------- Страница заявки ---------- */
  var orderSelect = $('#orderProduct');
  if (orderSelect) {
    var box = $('#tourSummary');
    var updateSummary = function () {
      var opt = orderSelect.options[orderSelect.selectedIndex];
      if (!opt || !opt.value) { box.hidden = true; return; }
      $('#sumImg').src = opt.getAttribute('data-img');
      $('#sumImg').alt = opt.getAttribute('data-place');
      $('#sumPlace').textContent = opt.getAttribute('data-place');
      var n = parseInt(opt.getAttribute('data-nights'), 10);
      $('#sumNights').textContent = n + ' ' + plural(n, 'ночь', 'ночи', 'ночей') + ', перелёт и проживание включены';
      $('#sumPrice').textContent = money(opt.getAttribute('data-price'));
      box.hidden = false;
    };
    orderSelect.addEventListener('change', updateSummary);

    var params = new URLSearchParams(window.location.search);
    var product = params.get('product');
    if (product) orderSelect.value = product;
    if (params.get('name')) $('#o-name').value = params.get('name');
    if (params.get('phone')) $('#o-phone').value = formatPhone(params.get('phone'));
    if (params.get('guests')) {
      var adults = $('#o-adults');
      if (adults) adults.value = params.get('guests');
    }
    updateSummary();

    var date = $('#o-date');
    if (date) date.min = new Date().toISOString().slice(0, 10);
  }

  /* ---------- Анимации: появление блоков, счётчики, шапка, «наверх» ---------- */
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function formatCount(value, decimals) {
    var str = decimals ? value.toFixed(decimals).replace('.', ',') : String(Math.round(value));
    var parts = str.split(',');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
    return parts.join(',');
  }

  function runCounter(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    if (reduceMotion || isNaN(target)) { el.textContent = formatCount(target, decimals); return; }
    var start = null, duration = 1400;
    var step = function (ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatCount(target * eased, decimals);
      if (p < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }

  var counters = $$('[data-count]');
  var revealSel = '.section-title, .feature, .step, .review, .dest, .team-card, .timeline__item, .about-photos, .about-stats, .cta, .tour-card, .stats';
  var revealEls = $$('main ' + revealSel.split(', ').join(', main ')).filter(function (el) {
    return !el.closest('#reviewList') && !el.closest('#tourList') && !el.closest('.tab-pane') && !el.closest('.modal');
  });

  if ('IntersectionObserver' in window && !reduceMotion) {
    revealEls.forEach(function (el) {
      el.classList.add('reveal');
      var col = el.closest('[class*="col-"]');
      var idx = col && col.parentElement ? Array.prototype.indexOf.call(col.parentElement.children, col) : 0;
      el.style.setProperty('--reveal-delay', (idx % 4) * 90 + 'ms');
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });

    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        cio.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  var siteNav = $('.site-nav');
  var setNavHeight = function () {
    if (siteNav) document.documentElement.style.setProperty('--nav-h', siteNav.offsetHeight + 'px');
  };
  setNavHeight();
  window.addEventListener('resize', setNavHeight);
  var toTop = $('#toTop');
  var onScroll = function () {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if (siteNav) siteNav.classList.toggle('is-scrolled', y > 8);
    if (toTop) {
      toTop.hidden = false;
      toTop.classList.toggle('is-shown', y > 600);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------- Страница отзывов: фильтры и страницы ---------- */
  var reviewList = $('#reviewList');
  if (reviewList) {
    var RPAGE = 12;
    var rform = $('#reviewFilter');
    var rcols = function () { return $$('.review-col', reviewList); };
    var rpager = $('#reviewPager');
    var rcount = $('#reviewCount');
    var rempty = $('#reviewEmpty');
    var rpage = 1;

    var rapply = function () {
      var dest = $('#r-dest').value;
      var starsEl = $('input[name="stars"]:checked', rform);
      var stars = starsEl ? starsEl.value : '';
      var found = rcols().filter(function (c) {
        return (!dest || c.getAttribute('data-dest') === dest) && (!stars || c.getAttribute('data-stars') === stars);
      });
      var pages = Math.max(1, Math.ceil(found.length / RPAGE));
      if (rpage > pages) rpage = pages;
      rcols().forEach(function (c) { c.classList.add('d-none'); });
      found.slice((rpage - 1) * RPAGE, rpage * RPAGE).forEach(function (c) { c.classList.remove('d-none'); });
      rcount.textContent = 'Найдено: ' + found.length + ' ' + plural(found.length, 'отзыв', 'отзыва', 'отзывов');
      rempty.hidden = found.length > 0;
      renderPagination(rpager, rpage, pages, function (target) {
        rpage = target;
        rapply();
        reviewList.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
    };

    var rparams = new URLSearchParams(window.location.search);
    if (rparams.get('dest')) $('#r-dest').value = rparams.get('dest');
    rform.addEventListener('change', function () { rpage = 1; rapply(); });
    rform.addEventListener('submit', function (e) { e.preventDefault(); });
    rapply();
  }

  /* ---------- Каталог: фильтры, сортировка, страницы ---------- */
  var list = $('#tourList');
  var form = $('#filterForm');
  if (list && form) {
    var PER_PAGE = 9;
    var cols = $$('.tour-col', list);
    var page = 1;

    var priceInput = $('#f-price');
    var priceOut = $('#f-price-out');
    var sortSel = $('#f-sort');
    var counter = $('#resultCount');
    var empty = $('#emptyState');
    var pager = $('#pagination');

    var nightsGroup = function (n) { return n <= 7 ? 'short' : (n <= 10 ? 'mid' : 'long'); };

    var readState = function () {
      var meals = $$('input[name="meal"]:checked', form).map(function (i) { return i.value; });
      var nights = $('input[name="nights"]:checked', form);
      return {
        q: $('#f-q').value.trim().toLowerCase(),
        dest: $('#f-dest').value,
        price: parseInt(priceInput.value, 10),
        nights: nights ? nights.value : '',
        meals: meals,
        hot: $('#f-hot').checked
      };
    };

    var matches = function (col, s) {
      if (s.q && col.getAttribute('data-search').indexOf(s.q) === -1) return false;
      if (s.dest && col.getAttribute('data-dest') !== s.dest) return false;
      if (parseInt(col.getAttribute('data-price'), 10) > s.price) return false;
      if (s.nights && nightsGroup(parseInt(col.getAttribute('data-nights'), 10)) !== s.nights) return false;
      if (s.meals.length && s.meals.indexOf(col.getAttribute('data-meals')) === -1) return false;
      if (s.hot && col.getAttribute('data-hot') !== '1') return false;
      return true;
    };

    var sorters = {
      'pop': function (a, b) { return a.getAttribute('data-pop') - b.getAttribute('data-pop'); },
      'price-asc': function (a, b) { return a.getAttribute('data-price') - b.getAttribute('data-price'); },
      'price-desc': function (a, b) { return b.getAttribute('data-price') - a.getAttribute('data-price'); },
      'rating': function (a, b) { return b.getAttribute('data-rating') - a.getAttribute('data-rating'); }
    };

    var renderPager = function (pages) {
      renderPagination(pager, page, pages, function (target) {
        page = target;
        apply();
        list.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    var apply = function () {
      var s = readState();
      priceOut.textContent = money(s.price);

      var sorted = cols.slice().sort(sorters[sortSel.value]);
      sorted.forEach(function (c) { list.appendChild(c); });

      var found = sorted.filter(function (c) { return matches(c, s); });
      var pages = Math.max(1, Math.ceil(found.length / PER_PAGE));
      if (page > pages) page = pages;

      cols.forEach(function (c) { c.classList.add('d-none'); });
      found.slice((page - 1) * PER_PAGE, page * PER_PAGE).forEach(function (c) { c.classList.remove('d-none'); });

      counter.textContent = 'Найдено: ' + found.length + ' ' + plural(found.length, 'тур', 'тура', 'туров');
      empty.hidden = found.length > 0;
      renderPager(pages);
    };

    var reset = function () {
      form.reset();
      sortSel.value = 'pop';
      page = 1;
      apply();
    };

    // Значения из адреса: catalog.html?dest=turkey&nights=short&q=рим
    var params = new URLSearchParams(window.location.search);
    if (params.get('dest')) $('#f-dest').value = params.get('dest');
    if (params.get('q')) $('#f-q').value = params.get('q');
    if (params.get('nights')) {
      var radio = $('input[name="nights"][value="' + params.get('nights') + '"]', form);
      if (radio) radio.checked = true;
    }

    form.addEventListener('input', function () { page = 1; apply(); });
    form.addEventListener('change', function () { page = 1; apply(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    form.addEventListener('reset', function () {
      window.setTimeout(function () { sortSel.value = 'pop'; page = 1; apply(); }, 0);
    });
    sortSel.addEventListener('change', function () { page = 1; apply(); });
    $('#emptyReset').addEventListener('click', reset);

    apply();
  }
})();
