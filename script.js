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

  const reps = parseInt(tp.getAttribute("data-reps") || "12", 10);
  const SPEED = 28; // slower = less frequent wrap event
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

  const total = 22;
  const slides = [];

  for (let i = 0; i < total; i++) {
    const slide = document.createElement("figure");
    slide.className = "carousel__slide";
    slide.setAttribute("role", "group");
    slide.setAttribute("aria-roledescription", "slide");
    slide.setAttribute("aria-label", `${i + 1} of ${total}`);

    const img = document.createElement("img");
    img.src = `images/car-${i}.webp`;
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
  const total = (window.__carouselTotal || 22);
  let idx = 0;

  function render() {
    img.src = `images/full/car-${idx}.webp`;
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
            imageUrl: "https://jihyepark.me/save-the-date/assets/og-image.jpg",
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
    const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

    const map = L.map(mapEl, {
      center: venue,
      zoom: 16,
      zoomControl: !isTouch,
      scrollWheelZoom: false,
      attributionControl: true,
      dragging: !isTouch,
      touchZoom: false,
      doubleClickZoom: !isTouch,
      tap: false,
      fadeAnimation: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap, &copy; CARTO',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    const icon = L.divIcon({
      className: "naver-pin",
      html: '<span class="naver-pin__bubble">노블발렌티 삼성</span><span class="naver-pin__dot"></span>',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    L.marker(venue, { icon }).addTo(map);

    map.on("click", () => map.scrollWheelZoom.enable());
    map.on("mouseout", () => map.scrollWheelZoom.disable());

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
    ".invitation__body, .gallery__header, .location__label, .accounts__header, .account-card"
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
