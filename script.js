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

  for (let i = 1; i <= total; i++) {
    const slide = document.createElement("figure");
    slide.className = "carousel__slide";
    slide.setAttribute("role", "group");
    slide.setAttribute("aria-roledescription", "slide");
    slide.setAttribute("aria-label", `${i} of ${total}`);

    const img = document.createElement("img");
    img.src = `images/car-${i}.webp`;
    img.alt = `Jongheum & Jihye — photo ${i}`;
    img.loading = i <= 3 ? "eager" : "lazy";
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
    img.src = `images/full/car-${idx + 1}.webp`;
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
// Nav scroll-state: turn yellow once user scrolls past the hero
// ===============================================
(function () {
  const nav = document.querySelector(".nav");
  const hero = document.querySelector(".hero");
  const eyebrow = document.querySelector(".hero__eyebrow");
  if (!nav || !hero) return;
  const mq = window.matchMedia("(max-width: 720px)");
  let threshold = 0;
  function measureThreshold() {
    if (mq.matches && eyebrow) {
      const r = eyebrow.getBoundingClientRect();
      threshold = r.top + window.scrollY + r.height - 40;
    } else {
      threshold = hero.offsetTop + hero.offsetHeight - 90;
    }
  }
  function onScroll() {
    nav.classList.toggle("is-scrolled", window.scrollY > threshold);
  }
  measureThreshold();
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { measureThreshold(); onScroll(); });
  mq.addEventListener("change", () => { measureThreshold(); onScroll(); });
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
