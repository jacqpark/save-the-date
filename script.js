// ===============================================
// Wavy marquee — text rides a static wave
// (animates startOffset on the textPath, so individual
// letters rise and fall as they travel along the wave,
// instead of the whole SVG translating like a rigid banner)
// ===============================================
(function () {
  const ribbon = document.querySelector("[data-ribbon]");
  if (!ribbon) return;
  const tp = ribbon.querySelector(".ribbon__textPath");
  if (!tp) return;
  const svg = ribbon.querySelector(".ribbon__svg");

  const reps = parseInt(tp.getAttribute("data-reps") || "12", 10);
  const VIEWBOX_WIDTH = 1300;
  const BASE_SPEED = 28; // visual pixels/sec target at desktop scale
  function computeSpeed() {
    const renderWidth = (svg && svg.getBoundingClientRect().width) || window.innerWidth;
    if (!renderWidth) return BASE_SPEED;
    return BASE_SPEED * (VIEWBOX_WIDTH / renderWidth);
  }
  let SPEED = computeSpeed();
  let unit = 0;
  let offset = 0;
  let last = 0;
  let paused = false;
  let ready = false;
  let prevWidth = window.innerWidth;

  function measure() {
    const total = tp.getComputedTextLength();
    if (total > 0 && reps > 0) {
      unit = total / reps;
      // start at multiple units in so the visible region is fully covered with text
      offset = unit * 4;
      return true;
    }
    return false;
  }

  function setOffset(v) {
    tp.startOffset.baseVal.value = v;
  }

  function frame(now) {
    if (ready && !paused && last) {
      let dt = (now - last) / 1000;
      if (dt > 0.1) dt = 0.1;
      offset -= SPEED * dt;
      // simple wrap by exactly one unit when offset crosses zero
      if (offset < 0) offset += unit;
      setOffset(offset);
    }
    last = now;
    requestAnimationFrame(frame);
  }

  function start() {
    if (ready) return;
    if (!measure()) {
      // text not laid out yet; retry shortly
      setTimeout(start, 50);
      return;
    }
    ready = true;
    setOffset(offset);
  }

  // wait for fonts BEFORE the first measurement so unit is correct from the start
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start);
  } else {
    start();
  }
  requestAnimationFrame(frame);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) last = 0;
  });

  // only re-measure when viewport width actually changes (avoid mobile-scroll resize fires)
  window.addEventListener("resize", () => {
    if (window.innerWidth === prevWidth) return;
    prevWidth = window.innerWidth;
    SPEED = computeSpeed();
    if (!ready) return;
    const total = tp.getComputedTextLength();
    if (total > 0) {
      const newUnit = total / reps;
      const phase = ((offset % unit) + unit) % unit;
      offset = (phase / unit) * newUnit;
      unit = newUnit;
      setOffset(offset);
    }
  });

  ribbon.addEventListener("mouseenter", () => { paused = true; });
  ribbon.addEventListener("mouseleave", () => { paused = false; last = 0; });
})();

// ===============================================
// Gallery cover: stacked booklet that opens and folds the carousel
// ===============================================
(function () {
  const cover = document.querySelector("[data-cover]");
  const carousel = document.querySelector("[data-carousel]");
  if (!cover || !carousel) return;

  let opened = false;

  function openCarousel() {
    if (opened) return;
    opened = true;
    // Instant cover hide so the carousel lands at the correct flow position
    // immediately (no settle / re-position flash).
    cover.style.display = "none";
    carousel.hidden = false;
    carousel.classList.add("is-fading-in");
    if (window.__carouselRefresh) window.__carouselRefresh();
    // next frame: remove fade class so opacity transitions 0 → 1
    requestAnimationFrame(() => requestAnimationFrame(() => {
      carousel.classList.remove("is-fading-in");
    }));
  }

  function foldBack() {
    if (!opened) return;
    opened = false;
    carousel.hidden = true;
    carousel.classList.remove("is-fading-in");
    cover.style.display = "";
    // bring the cover back into view smoothly
    cover.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  cover.addEventListener("click", openCarousel);
  cover.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCarousel(); }
  });

  const foldBtn = document.querySelector("[data-fold-back]");
  if (foldBtn) foldBtn.addEventListener("click", foldBack);
})();

// ===============================================
// Gallery carousel
// ===============================================
(function () {
  const carousel = document.querySelector("[data-carousel]");
  if (!carousel) return;

  const viewport = carousel.querySelector("[data-viewport]");
  const track = carousel.querySelector("[data-track]");
  const prevBtn = carousel.querySelector("[data-prev]");
  const nextBtn = carousel.querySelector("[data-next]");
  const countEl = carousel.querySelector("[data-count]");

  const total = 21;
  const slides = [];

  for (let i = 0; i < total; i++) {
    const slide = document.createElement("figure");
    slide.className = "carousel__slide";
    slide.setAttribute("role", "group");
    slide.setAttribute("aria-roledescription", "slide");
    slide.setAttribute("aria-label", `${i + 1} of ${total}`);

    const img = document.createElement("img");
    img.src = `images/car-${i}.webp?v=20260605e`;
    img.alt = `Jongheum & Jihye — photo ${i + 1}`;
    img.loading = i < 3 ? "eager" : "lazy";
    img.decoding = "async";
    img.draggable = false;
    img.addEventListener("contextmenu", (e) => e.preventDefault());
    img.addEventListener("dragstart", (e) => e.preventDefault());

    slide.appendChild(img);
    track.appendChild(slide);
    slides.push(slide);
  }

  let active = 0;

  function update() {
    const viewportWidth = viewport.clientWidth;
    const slide = slides[active];
    const slideRect = slide.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    const slideLeftInTrack = slideRect.left - trackRect.left + parseFloat(getComputedStyle(track).transform.split(",")[4] || 0);

    // simpler approach: compute by offsetLeft
    const offsetLeft = slide.offsetLeft;
    const slideWidth = slide.offsetWidth;
    const targetX = -(offsetLeft - (viewportWidth - slideWidth) / 2);

    track.style.transform = `translate3d(${targetX}px, 0, 0)`;

    slides.forEach((s, i) => {
      s.classList.remove("is-active", "is-neighbor");
      if (i === active) s.classList.add("is-active");
      else if (i === active - 1 || i === active + 1) s.classList.add("is-neighbor");
    });

    countEl.textContent = `${String(active + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  }

  function go(delta) {
    active = (active + delta + total) % total;
    update();
  }

  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));

  // click a slide: jump to it if neighbor, expand to lightbox if active
  slides.forEach((s, i) => {
    s.addEventListener("click", () => {
      if (i !== active) {
        active = i;
        update();
      } else if (window.__openLightbox) {
        window.__openLightbox(i);
      }
    });
  });
  // expose for lightbox sync
  window.__carouselGoTo = (i) => { active = ((i % total) + total) % total; update(); };
  window.__carouselTotal = total;
  // expose for the booklet cover, which reveals the carousel after first paint
  window.__carouselRefresh = () => {
    requestAnimationFrame(() => {
      update();
      requestAnimationFrame(update);
    });
  };

  // keyboard
  carousel.tabIndex = 0;
  carousel.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { go(-1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { go(1); e.preventDefault(); }
  });

  // swipe (touch)
  let startX = 0;
  let startY = 0;
  let swiping = false;
  viewport.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    swiping = true;
  }, { passive: true });
  viewport.addEventListener("touchend", (e) => {
    if (!swiping) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? 1 : -1);
    }
    swiping = false;
  });

  // recompute on resize
  let resizeRaf = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(update);
  });

  // first load: wait a tick for images to begin loading so widths are stable
  // (slides are flex with fixed width, so this is mostly instant)
  requestAnimationFrame(update);
  // re-run once first image is in to refine
  const firstImg = slides[0].querySelector("img");
  if (firstImg && !firstImg.complete) {
    firstImg.addEventListener("load", update, { once: true });
  }
})();

// ===============================================
// Lightbox: click active slide -> expand
// ===============================================
(function () {
  const lb = document.querySelector("[data-lightbox]");
  if (!lb) return;
  const img = lb.querySelector("[data-lightbox-img]");
  const count = lb.querySelector("[data-lightbox-count]");
  const btnClose = lb.querySelector("[data-lightbox-close]");
  const btnPrev = lb.querySelector("[data-lightbox-prev]");
  const btnNext = lb.querySelector("[data-lightbox-next]");
  const total = (window.__carouselTotal || 21);
  let idx = 0;

  function render() {
    img.src = `images/full/car-${idx}.webp?v=20260605e`;
    img.alt = `Jongheum & Jihye — photo ${idx + 1}`;
    count.textContent = `${String(idx + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    if (window.__carouselGoTo) window.__carouselGoTo(idx);
  }
  function open(i) {
    idx = ((i % total) + total) % total;
    render();
    document.body.classList.add("lightbox-lock");
    lb.style.display = "flex";
    lb.setAttribute("aria-hidden", "false");
    // next frame so the opacity / scale transitions actually run
    requestAnimationFrame(() => requestAnimationFrame(() => lb.classList.add("is-open")));
  }
  function close() {
    lb.classList.remove("is-open");
    lb.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-lock");
    setTimeout(() => { if (!lb.classList.contains("is-open")) lb.style.display = "none"; }, 380);
  }
  function step(delta) { idx = ((idx + delta) % total + total) % total; render(); }

  window.__openLightbox = open;

  img.draggable = false;
  img.addEventListener("contextmenu", (e) => e.preventDefault());
  img.addEventListener("dragstart", (e) => e.preventDefault());
  lb.addEventListener("contextmenu", (e) => e.preventDefault());

  btnClose.addEventListener("click", close);
  btnPrev.addEventListener("click", (e) => { e.stopPropagation(); step(-1); });
  btnNext.addEventListener("click", (e) => { e.stopPropagation(); step(1); });
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });

  // touch swipe inside lightbox
  let sx = 0, sy = 0, swiping = false;
  lb.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; swiping = true;
  }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (!swiping) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) close();
    swiping = false;
  });
})();

// ===============================================
// Footer share: open banner with KakaoTalk + copy link options
// ===============================================
(function () {
  const trigger = document.querySelector("[data-share-link]");
  const sheet = document.querySelector("[data-share-sheet]");
  if (!trigger || !sheet) return;

  const closeBtn = sheet.querySelector("[data-share-close]");
  const kakaoBtn = sheet.querySelector("[data-share-kakao]");
  const copyBtn = sheet.querySelector("[data-share-copy]");
  const copyLabel = sheet.querySelector("[data-share-copy-label]");
  const copyOriginal = copyLabel ? copyLabel.textContent : "링크 복사하기";
  let resetTimer = 0;

  function open() {
    sheet.style.display = "flex";
    sheet.setAttribute("aria-hidden", "false");
    document.body.classList.add("share-lock");
    requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add("is-open")));
  }
  function close() {
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    document.body.classList.remove("share-lock");
    setTimeout(() => { if (!sheet.classList.contains("is-open")) sheet.style.display = "none"; }, 320);
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    ta.style.left = "0";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  async function writeClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; }
      catch (e) { return fallbackCopy(text); }
    }
    return fallbackCopy(text);
  }

  function flashCopy(ok, customMsg) {
    if (!copyLabel) return;
    copyBtn.classList.toggle("is-copied", ok);
    copyLabel.textContent = customMsg || (ok ? "복사되었습니다" : "복사 실패");
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copyBtn.classList.remove("is-copied");
      copyLabel.textContent = copyOriginal;
    }, 1800);
  }

  async function onCopy() {
    const ok = await writeClipboard(window.location.href);
    flashCopy(ok);
  }

  async function onKakao() {
    const pageUrl = window.location.href;
    if (window.Kakao && window.Kakao.isInitialized && window.Kakao.isInitialized() && window.Kakao.Share) {
      try {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: "종흠과 지혜의 결혼식에 초대합니다",
            description: "2026.08.15 (토) 오후 1시 · 노블발렌티 삼성",
            imageUrl: "https://jihyepark.me/save-the-date/assets/og-image-v3.jpg",
            link: { mobileWebUrl: pageUrl, webUrl: pageUrl },
          },
          buttons: [
            { title: "청첩장 열기", link: { mobileWebUrl: pageUrl, webUrl: pageUrl } },
          ],
        });
        return;
      } catch (e) {
        console.warn("Kakao share failed, falling back", e);
      }
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: "종흠과 지혜의 결혼식에 초대합니다",
          text: "2026.08.15 (토) 오후 1시 · 노블발렌티 삼성",
          url: pageUrl,
        });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    const ok = await writeClipboard(pageUrl);
    flashCopy(ok, ok ? "링크 복사됨, 카카오톡에 붙여넣기" : "복사 실패");
  }

  trigger.addEventListener("click", open);
  closeBtn && closeBtn.addEventListener("click", close);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) close(); });
  document.addEventListener("keydown", (e) => {
    if (sheet.classList.contains("is-open") && e.key === "Escape") close();
  });
  kakaoBtn && kakaoBtn.addEventListener("click", onKakao);
  copyBtn && copyBtn.addEventListener("click", onCopy);
})();

// ===============================================
// Account-number copy: digits-only to clipboard
// ===============================================
(function () {
  const buttons = document.querySelectorAll("[data-copy]");
  if (!buttons.length) return;

  function fallback(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    ta.style.left = "0";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  async function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; }
      catch (e) { return fallback(text); }
    }
    return fallback(text);
  }

  buttons.forEach((btn) => {
    const raw = btn.getAttribute("data-copy") || "";
    const digits = raw.replace(/\D+/g, "");
    const label = btn.querySelector("[data-copy-label]");
    const original = label ? label.textContent : "";
    let timer = 0;

    btn.addEventListener("click", async () => {
      const ok = await copy(digits);
      btn.classList.toggle("is-copied", ok);
      if (label) label.textContent = ok ? "복사되었습니다" : "복사 실패";
      clearTimeout(timer);
      timer = setTimeout(() => {
        btn.classList.remove("is-copied");
        if (label) label.textContent = original;
      }, 1800);
    });
  });
})();

// ===============================================
// Nav scroll-state: turn yellow once user scrolls past the hero
// ===============================================
(function () {
  const nav = document.querySelector(".nav");
  const hero = document.querySelector(".hero");
  const eyebrow = document.querySelector(".hero__eyebrow");
  if (!nav || !hero) return;
  let threshold = 0;
  function measureThreshold() {
    if (eyebrow) {
      const r = eyebrow.getBoundingClientRect();
      threshold = r.top + window.scrollY + r.height - 30;
    } else {
      threshold = hero.offsetTop + 200;
    }
  }
  function onScroll() {
    nav.classList.toggle("is-scrolled", window.scrollY > threshold);
  }
  measureThreshold();
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { measureThreshold(); onScroll(); });
})();

// ===============================================
// Account cards: only one open at a time (optional UX nicety)
// ===============================================
(function () {
  const cards = document.querySelectorAll(".account-card");
  cards.forEach((card) => {
    card.addEventListener("toggle", () => {
      if (card.open) {
        cards.forEach((other) => {
          if (other !== card) other.open = false;
        });
      }
    });
  });
})();

// ===============================================
// Leaflet map — Noble Valenti Samseong
// Defer init until #map is near the viewport, so Leaflet only ever
// measures the container at its final layout size.
// ===============================================
(function () {
  function waitForLeaflet(cb) {
    if (typeof L !== "undefined") return cb();
    window.addEventListener("load", () => {
      if (typeof L !== "undefined") cb();
    }, { once: true });
  }

  function scheduleInit() {
    const mapEl = document.getElementById("map");
    if (!mapEl) return;
    if (mapEl._leaflet_id) return;

    if (typeof IntersectionObserver === "undefined") {
      waitForLeaflet(() => initMap(mapEl));
      return;
    }
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        obs.disconnect();
        waitForLeaflet(() => initMap(mapEl));
      });
    }, { rootMargin: "200px 0px" });
    io.observe(mapEl);
  }

  function initMap(mapEl) {
    if (mapEl._leaflet_id) return;
    const venue = [37.5149836, 127.0647181];
    const station = [37.514253, 127.060275]; // 영동대로 × 봉은사로 intersection
    // Center between venue and station (slight venue bias) so both pins
    // stay in frame even on narrow mobile map containers.
    const center = [37.5146500, 127.0628000];

    const map = L.map(mapEl, {
      center: center,
      zoom: 16,
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
      fadeAnimation: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap, &copy; CARTO',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    const mobile = window.innerWidth < 768;

    // Station platform — a lean gold box along the real Bongeunsa-ro centreline
    // (OSM node coords). Same thickness everywhere, but trimmed at both ends on
    // small screens so it doesn't run the full width of the narrow map.
    const platformFull = [
      [37.513999, 127.058907],
      [37.514124, 127.059601],
      [37.514223, 127.060103],
      [37.514282, 127.060447],
      [37.514317, 127.060624],
      [37.514432, 127.061251],
    ];
    const platformShort = [
      [37.514153, 127.059750], // trimmed west end
      [37.514223, 127.060103],
      [37.514282, 127.060447],
      [37.514362, 127.060870], // trimmed east end
    ];
    const platform = mobile ? platformShort : platformFull;
    L.polyline(platform, { color: "#aa9872", weight: 9, opacity: 1, lineCap: "butt", lineJoin: "round", interactive: false }).addTo(map);

    // Exit 4 stub — a hairline gold passage from the top-middle of the bar's
    // RIGHT half (clear of the station marker): a short diagonal up, then a
    // short flat run kept parallel to Bongeunsa-ro (slope ~0.186). Built from
    // scaled direction vectors so the length shrinks with the viewport on
    // small screens. The exit marker sits at the flat end.
    const exitStart = mobile ? [37.514311, 127.060590] : [37.514325, 127.060665];
    const lenScale = mobile ? Math.max(0.40, Math.min(0.60, window.innerWidth / 680)) : 0.60;
    const vDiag = [0.000351, 0.000385]; // diagonal direction (up-right)
    const vFlat = [0.000121, 0.000650]; // flat direction, parallel to the road
    const exitElbow = [exitStart[0] + vDiag[0] * lenScale, exitStart[1] + vDiag[1] * lenScale];
    const exitEnd = [exitElbow[0] + vFlat[0] * lenScale, exitElbow[1] + vFlat[1] * lenScale];
    const exitStub = [exitStart, exitElbow, exitEnd];
    L.polyline(exitStub, { color: "#aa9872", weight: 2, opacity: 1, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);

    const icon = L.divIcon({
      className: "naver-pin",
      html: '<span class="naver-pin__bubble">노블발렌티 삼성</span><span class="naver-pin__dot"></span>',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    L.marker(venue, { icon }).addTo(map);

    // Bongeunsa Station (봉은사역, Line 9) — transit reference, ~500m west
    const stationIcon = L.divIcon({
      className: "station-pin",
      html: '<span class="station-pin__dot">9</span><span class="station-pin__bubble">봉은사역</span>',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    L.marker(station, { icon: stationIcon, keyboard: false }).addTo(map);

    // Exit 4 (4번 출구) — pinned to the flat end of the gold stub above.
    const exit4 = exitEnd;
    const exitIcon = L.divIcon({
      className: "exit-pin",
      html: '<span class="exit-pin__dot">4</span>',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    L.marker(exit4, { icon: exitIcon, keyboard: false, zIndexOffset: 1000 }).addTo(map);

    const lockBtn = document.querySelector("[data-map-lock]");
    const handlers = ["dragging", "scrollWheelZoom", "touchZoom", "doubleClickZoom", "boxZoom", "keyboard"];
    function applyLockState(locked) {
      handlers.forEach((h) => {
        if (!map[h]) return;
        if (locked) map[h].disable();
        else map[h].enable();
      });
      if (map.tap) {
        if (locked) map.tap.disable();
        else map.tap.enable();
      }
      if (lockBtn) {
        lockBtn.classList.toggle("is-locked", locked);
        lockBtn.setAttribute("aria-pressed", String(locked));
        lockBtn.setAttribute("aria-label", locked ? "지도 잠금 해제" : "지도 잠그기");
      }
    }
    applyLockState(true);
    if (lockBtn) {
      lockBtn.addEventListener("click", () => {
        applyLockState(!lockBtn.classList.contains("is-locked"));
      });
    }

    const refresh = () => map.invalidateSize({ animate: false });
    requestAnimationFrame(refresh);
    setTimeout(refresh, 200);
    setTimeout(refresh, 600);
    window.addEventListener("resize", refresh, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(refresh).observe(mapEl);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleInit, { once: true });
  } else {
    scheduleInit();
  }
})();

// ===============================================
// Subtle reveal on scroll (no library)
// ===============================================
(function () {
  if (!("IntersectionObserver" in window)) return;
  const targets = document.querySelectorAll(
    ".invitation__body, .gallery__header, .adventure__header, .location__label, .accounts__header, .account-card"
  );
  targets.forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(24px)";
    el.style.transition = "opacity 1s cubic-bezier(.22,.61,.36,1), transform 1s cubic-bezier(.22,.61,.36,1)";
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
  targets.forEach((el) => io.observe(el));
})();

// ===============================================
// Our Adventure — captions (chronological order)
// ===============================================
window.__advCaptions = [
  "일리노이주 시카고 · 과학산업박물관",
  "나이아가라 폭포",
  "오하이오주 클리블랜드",
  "뉴욕주 펜필드 · 호박농장",
  "워싱턴 D.C. · 국회의사당",
  "워싱턴 D.C. · 워싱턴 기념탑",
  "일리노이주 시카고 · 리글리 필드",
  "일리노이주 시카고 · 시카고강",
  "뉴욕주 버팔로 · 빌스 경기장",
  "뉴욕주 버팔로 · 빌스 경기장",
  "펜실베이니아주 필라델피아 · 시티즌스 뱅크 파크",
  "뉴욕주 펜필드 · 호박농장",
  "뉴욕주 코닝 · 유리 박물관",
  "뉴욕주 시러큐스 · 메탈리카 콘서트",
  "뉴욕주 로체스터 · 이스트만 극장",
  "뉴욕주 로체스터 · 이스트만 극장",
  "스페인 세고비아 · 수도교",
  "스페인 마드리드 · 왕궁",
  "스위스 리기산",
  "스위스 리기산",
  "프랑스 리옹 · 올랭피크 리옹",
  "프랑스 샤모니 · 몽블랑"
];

// ===============================================
// Adventure cover: scrapbook book that opens the carousel
// ===============================================
(function () {
  const cover = document.querySelector("[data-adv-cover]");
  const carousel = document.querySelector("[data-adv-carousel]");
  if (!cover || !carousel) return;

  let opened = false;

  function openCarousel() {
    if (opened) return;
    opened = true;
    cover.style.display = "none";
    carousel.hidden = false;
    carousel.classList.add("is-fading-in");
    if (window.__advCarouselRefresh) window.__advCarouselRefresh();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      carousel.classList.remove("is-fading-in");
    }));
  }

  function foldBack() {
    if (!opened) return;
    opened = false;
    carousel.hidden = true;
    carousel.classList.remove("is-fading-in");
    cover.style.display = "";
    cover.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  cover.addEventListener("click", openCarousel);
  cover.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCarousel(); }
  });

  const foldBtn = document.querySelector("[data-adv-fold-back]");
  if (foldBtn) foldBtn.addEventListener("click", foldBack);
})();

// ===============================================
// Adventure carousel (with location captions)
// ===============================================
(function () {
  const carousel = document.querySelector("[data-adv-carousel]");
  if (!carousel) return;

  const viewport = carousel.querySelector("[data-adv-viewport]");
  const track = carousel.querySelector("[data-adv-track]");
  const prevBtn = carousel.querySelector("[data-adv-prev]");
  const nextBtn = carousel.querySelector("[data-adv-next]");
  const countEl = carousel.querySelector("[data-adv-count]");

  const captions = window.__advCaptions || [];
  const total = captions.length;
  const slides = [];

  for (let i = 0; i < total; i++) {
    const slide = document.createElement("figure");
    slide.className = "carousel__slide";
    slide.setAttribute("role", "group");
    slide.setAttribute("aria-roledescription", "slide");
    slide.setAttribute("aria-label", `${i + 1} of ${total}`);

    const frame = document.createElement("span");
    frame.className = "carousel__frame";

    const img = document.createElement("img");
    img.src = `images/adv-${i}.webp?v=20260605c`;
    img.alt = `${captions[i]} — 종흠 & 지혜`;
    img.loading = i < 3 ? "eager" : "lazy";
    img.decoding = "async";
    img.draggable = false;
    img.addEventListener("contextmenu", (e) => e.preventDefault());
    img.addEventListener("dragstart", (e) => e.preventDefault());
    frame.appendChild(img);

    const cap = document.createElement("figcaption");
    cap.className = "carousel__loc";
    cap.textContent = captions[i];

    slide.appendChild(frame);
    slide.appendChild(cap);
    track.appendChild(slide);
    slides.push(slide);
  }

  let active = 0;

  function update() {
    const viewportWidth = viewport.clientWidth;
    const slide = slides[active];
    const offsetLeft = slide.offsetLeft;
    const slideWidth = slide.offsetWidth;
    const targetX = -(offsetLeft - (viewportWidth - slideWidth) / 2);

    track.style.transform = `translate3d(${targetX}px, 0, 0)`;

    slides.forEach((s, i) => {
      s.classList.remove("is-active", "is-neighbor");
      if (i === active) s.classList.add("is-active");
      else if (i === active - 1 || i === active + 1) s.classList.add("is-neighbor");
    });

    countEl.textContent = `${String(active + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  }

  function go(delta) {
    active = (active + delta + total) % total;
    update();
  }

  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));

  slides.forEach((s, i) => {
    s.addEventListener("click", () => {
      if (i !== active) {
        active = i;
        update();
      } else if (window.__advOpenLightbox) {
        window.__advOpenLightbox(i);
      }
    });
  });

  window.__advCarouselGoTo = (i) => { active = ((i % total) + total) % total; update(); };
  window.__advCarouselTotal = total;
  window.__advCarouselRefresh = () => {
    requestAnimationFrame(() => {
      update();
      requestAnimationFrame(update);
    });
  };

  carousel.tabIndex = 0;
  carousel.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { go(-1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { go(1); e.preventDefault(); }
  });

  let startX = 0, startY = 0, swiping = false;
  viewport.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    swiping = true;
  }, { passive: true });
  viewport.addEventListener("touchend", (e) => {
    if (!swiping) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? 1 : -1);
    }
    swiping = false;
  });

  let resizeRaf = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(update);
  });

  requestAnimationFrame(update);
  const firstImg = slides[0].querySelector("img");
  if (firstImg && !firstImg.complete) {
    firstImg.addEventListener("load", update, { once: true });
  }
})();

// ===============================================
// Adventure lightbox (with caption)
// ===============================================
(function () {
  const lb = document.querySelector("[data-adv-lightbox]");
  if (!lb) return;
  const img = lb.querySelector("[data-adv-lightbox-img]");
  const loc = lb.querySelector("[data-adv-lightbox-loc]");
  const count = lb.querySelector("[data-adv-lightbox-count]");
  const btnClose = lb.querySelector("[data-adv-lightbox-close]");
  const btnPrev = lb.querySelector("[data-adv-lightbox-prev]");
  const btnNext = lb.querySelector("[data-adv-lightbox-next]");
  const captions = window.__advCaptions || [];
  const total = (window.__advCarouselTotal || captions.length);
  let idx = 0;

  function render() {
    img.src = `images/full/adv-${idx}.webp?v=20260605c`;
    img.alt = `${captions[idx]} — 종흠 & 지혜`;
    loc.textContent = captions[idx] || "";
    count.textContent = `${String(idx + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    if (window.__advCarouselGoTo) window.__advCarouselGoTo(idx);
  }
  function open(i) {
    idx = ((i % total) + total) % total;
    render();
    document.body.classList.add("lightbox-lock");
    lb.style.display = "flex";
    lb.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => requestAnimationFrame(() => lb.classList.add("is-open")));
  }
  function close() {
    lb.classList.remove("is-open");
    lb.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-lock");
    setTimeout(() => { if (!lb.classList.contains("is-open")) lb.style.display = "none"; }, 380);
  }
  function step(delta) { idx = ((idx + delta) % total + total) % total; render(); }

  window.__advOpenLightbox = open;

  img.draggable = false;
  img.addEventListener("contextmenu", (e) => e.preventDefault());
  img.addEventListener("dragstart", (e) => e.preventDefault());
  lb.addEventListener("contextmenu", (e) => e.preventDefault());

  btnClose.addEventListener("click", close);
  btnPrev.addEventListener("click", (e) => { e.stopPropagation(); step(-1); });
  btnNext.addEventListener("click", (e) => { e.stopPropagation(); step(1); });
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });

  let sx = 0, sy = 0, swiping = false;
  lb.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; swiping = true;
  }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (!swiping) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) close();
    swiping = false;
  });
})();
