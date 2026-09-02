/* haydnmcintyre.ca v2 behaviour. No dependencies.
   The whole site is one document with two pages in it, one continuous push
   forward through the space scene, and every section arriving from the
   vanishing point as you scroll. Everything below reads scroll position
   once a frame and writes the result; nothing stores scroll state. */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  var win = window;

  var motionQuery = win.matchMedia("(prefers-reduced-motion: reduce)");
  /* Reduced motion pins every panel in place and skips the camera ride.
     ?still does the same on demand, so a headless capture can show every
     section rather than the eight percent specks they are before they land. */
  var capture = /[?&]still\b/.test(location.search);
  var still = motionQuery.matches || capture;
  var isFile = location.protocol === "file:";

  /* ---- Email, assembled at runtime so it is not sitting in the markup ---- */
  var mailUser = ["haydn", "mcintyre"].join("");
  var mailHost = ["yahoo", "ca"].join(".");
  var EMAIL = mailUser + "@" + mailHost;
  doc.querySelectorAll("[data-mail]").forEach(function (el) {
    el.setAttribute("href", "mailto:" + EMAIL);
    if (el.getAttribute("data-mail") === "text") el.textContent = EMAIL;
  });

  var year = doc.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---- Pages ------------------------------------------------------------
     Home and Portfolio are both in the document. The head script has already
     picked one from the URL before first paint; this keeps the choice, the
     title and the address bar in step from here on. */
  var pages = {
    home: doc.getElementById("home"),
    portfolio: doc.getElementById("portfolio-page")
  };
  var titles = {
    home: "Haydn McIntyre, Full Stack Developer",
    portfolio: "Haydn McIntyre Portfolio"
  };
  var current = null;

  var pageFromLocation = function () {
    if (/^\/portfolio\/?$/.test(location.pathname)) return "portfolio";
    if (/[?&]p=portfolio\b/.test(location.search)) return "portfolio";
    return "home";
  };
  var pathFor = function (page, anchor) {
    var base = page === "portfolio" ? "/portfolio" : "/";
    return base + (anchor ? "#" + anchor : "");
  };

  /* Anything that measures itself in pixels has to measure again once its
     page is showing; a hidden page lays out at zero. */
  var onPageShown = [];

  /* Anything that has to reconsider itself when the motion preference flips. */
  var onStillChange = [];

  /* Set by the preview reels once they exist, so the scroll tick can start
     them the moment their panel finishes arriving. */
  var syncReels = null;

  var show = function (page) {
    if (page === current) return false;
    current = page;
    root.setAttribute("data-page", page);
    doc.title = titles[page];
    onPageShown.forEach(function (fn) { fn(); });
    return true;
  };

  /* A section's box begins at its top padding, and that padding is large on
     purpose: 180px everywhere, and a third of a screen above Websites so it is
     nowhere near the opening. Aiming at the box therefore stopped a screen or
     two short of the thing being linked to, worst of all for Websites. Aim at
     the panel that holds the content instead, and leave the fixed header its
     own height plus a little air. */
  var scrollToAnchor = function (anchor, instant) {
    var el = anchor ? doc.getElementById(anchor) : null;
    var top = 0;
    if (el) {
      /* The panel carries a 3D transform until it lands, and a rect is the
         transformed box, so it cannot be measured directly. Its offsetTop is
         layout and is not affected, so read it off the section, which is
         never transformed. The scroll tick does the same thing. */
      var panel = el.querySelector(":scope > .approach");
      var base = el.getBoundingClientRect().top + win.scrollY;
      top = base + (panel ? panel.offsetTop : 0) - 110;
    }
    win.scrollTo({ top: Math.max(0, top), behavior: still || instant ? "auto" : "smooth" });
  };

  /* Prevents the default, sets the page, then after a frame scrolls to the
     anchor. The frame matters: the new page has to lay out before its
     anchor has a position. */
  var go = function (page, anchor) {
    var changed = show(page);
    if (!isFile) {
      history.pushState({ page: page, anchor: anchor || "" }, "", pathFor(page, anchor));
    }
    /* The dropdown opens on focus as well as hover. Dropping focus closes it. */
    if (doc.activeElement && doc.activeElement.blur) doc.activeElement.blur();
    if (changed) {
      win.requestAnimationFrame(function () { scrollToAnchor(anchor); kick(); });
    } else {
      scrollToAnchor(anchor);
    }
  };

  doc.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a[data-go]") : null;
    if (!a || e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var parts = a.getAttribute("data-go").split(":");
    e.preventDefault();
    setMenu(false);
    go(parts[0], parts[1] || "");
  });

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  win.addEventListener("popstate", function () {
    show(pageFromLocation());
    var anchor = location.hash.slice(1);
    win.requestAnimationFrame(function () { scrollToAnchor(anchor, true); kick(); });
  });

  show(pageFromLocation());

  /* ---- The menu on a narrow screen --------------------------------------
     A panel from the right, holding everything the wide nav can reach. It
     closes on a link, on the scrim, on Escape, and if the window grows wide
     enough for the real nav to come back. */
  var menuBtn = doc.getElementById("menu-toggle");
  var menuPanel = doc.getElementById("mobile-nav");
  var menuScrim = doc.getElementById("nav-scrim");
  var setMenu = function (open) {
    if (!menuBtn || !menuPanel || !menuScrim) return;
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    doc.body.classList.toggle("is-locked", open);
    if (open) {
      menuPanel.hidden = false;
      menuScrim.hidden = false;
      /* A frame between unhiding and the class, or the transition has no
         start state to move from and the panel simply appears. */
      win.requestAnimationFrame(function () {
        menuPanel.classList.add("is-open");
        menuScrim.classList.add("is-open");
      });
    } else {
      menuPanel.classList.remove("is-open");
      menuScrim.classList.remove("is-open");
      win.setTimeout(function () {
        if (menuBtn.getAttribute("aria-expanded") === "false") {
          menuPanel.hidden = true;
          menuScrim.hidden = true;
        }
      }, 360);
    }
  };
  if (menuBtn && menuPanel && menuScrim) {
    menuBtn.addEventListener("click", function () {
      setMenu(menuBtn.getAttribute("aria-expanded") !== "true");
    });
    menuScrim.addEventListener("click", function () { setMenu(false); });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuBtn.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        menuBtn.focus();
      }
    });
    win.addEventListener("resize", function () {
      if (win.innerWidth > 900) setMenu(false);
    }, { passive: true });
  }

  /* ---- Nav highlighting -------------------------------------------------
     The link for wherever you are. On the portfolio page that is Portfolio
     however far you have scrolled; on the home page it follows the section
     in view. The Contact button is left alone, it is already brass. */
  var navLinks = Array.prototype.slice.call(doc.querySelectorAll(".nav a[data-sec]"));
  var setCurrent = function (id) {
    navLinks.forEach(function (a) {
      a.classList.toggle("is-current", a.getAttribute("data-sec") === id);
    });
  };
  var syncCurrent = function () {
    if (current === "portfolio") setCurrent("portfolio");
    else setCurrent(win.scrollY < win.innerHeight * 0.6 ? "top" : "");
  };
  if (navLinks.length && "IntersectionObserver" in win) {
    var spy = new win.IntersectionObserver(function (entries) {
      if (current !== "home") return;
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setCurrent(entry.target.id);
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    navLinks.forEach(function (a) {
      var sec = doc.getElementById(a.getAttribute("data-sec"));
      /* Portfolio also names a whole page; only watch it as a section here. */
      if (sec && sec.closest('main[data-page="home"]')) spy.observe(sec);
    });
  }
  onPageShown.push(syncCurrent);
  syncCurrent();

  /* ---- The scene, and the opening ---------------------------------------
     The cover lifts when the scene reports itself ready. A cap on the wait
     means a slow connection or a machine without WebGL still gets in rather
     than staring at the ground colour, and the static mark is only raised
     when the scene has actually said it failed. */
  var scene = doc.querySelector("space-scene");
  var fallback = doc.getElementById("mark-fallback");
  var booted = false;
  var boot = function () {
    if (booted) return;
    booted = true;
    win.clearTimeout(bootTimer);
    root.classList.remove("booting");
  };
  var bootTimer = win.setTimeout(boot, 2200);

  if (scene) {
    var sceneUp = function () { root.classList.add("has-scene"); boot(); };
    var sceneDown = function () { root.classList.add("no-scene"); boot(); };
    if (scene.hasAttribute("ready")) sceneUp();
    else if (scene.hasAttribute("failed")) sceneDown();
    scene.addEventListener("scene-ready", sceneUp);
    scene.addEventListener("scene-failed", sceneDown);
  } else {
    boot();
  }

  /* ---- One tick a frame ------------------------------------------------
     Coalesced from scroll, resize and page changes. Drives the camera, the
     hero beats, every approach panel and the nebula tint from scrollY. */
  var hero = doc.getElementById("top");
  var beats = [
    /* element, start, end, lift in px, whether it takes clicks */
    /* Outward from the name: whatever sits furthest from it goes first, so
       the two lines of the title are the last thing left as you approach. */
    [doc.getElementById("hero-ctas"),   0.05, 0.26, 24, true],
    [doc.getElementById("hero-lede"),   0.09, 0.30, 24, false],
    [doc.getElementById("hero-kicker"), 0.13, 0.34, 24, false],
    [doc.getElementById("hero-title"),  0.24, 0.52, 56, false],
    [doc.getElementById("hero-ann"),    0.28, 0.46, 0,  false]
  ];
  var neb = {
    green: doc.getElementById("neb-green"),
    electric: doc.getElementById("neb-electric"),
    brass: doc.getElementById("neb-brass")
  };
  var panels = Array.prototype.slice.call(doc.querySelectorAll("[data-approach]"));

  /* ---- The paragraph you are reading ------------------------------------
     Whichever body paragraph sits over the middle of the screen goes chalk;
     the rest sit back in mist. A column of copy then reads a line at a time
     as it goes past, rather than all shouting at once. Kickers, the role line
     and the service cells are left out: the services are a grid, so several
     share a height and lighting one of them says nothing. */
  var litParas = Array.prototype.slice.call(
    doc.querySelectorAll(".prose p:not(.kicker):not(.role), .blurb")
  );
  var litNow = null;
  var lightParagraphs = function (vh) {
    var mid = vh / 2;
    var best = null;
    /* Nothing is lit unless something is genuinely near the middle, so the
       hero and the big empty runs between sections leave the copy alone. */
    var bestD = vh * 0.35;
    litParas.forEach(function (para) {
      /* offsetParent is null on the page you are not looking at. */
      if (!para.offsetParent) return;
      var r = para.getBoundingClientRect();
      /* Distance to the nearest edge, so a paragraph tall enough to span the
         middle counts as nought rather than being measured from its centre. */
      var d = mid < r.top ? r.top - mid : (mid > r.bottom ? mid - r.bottom : 0);
      if (d < bestD) { bestD = d; best = para; }
    });
    if (best === litNow) return;
    if (litNow) litNow.classList.remove("is-lit");
    if (best) best.classList.add("is-lit");
    litNow = best;
  };

  var clamp = function (v) { return Math.max(0, Math.min(1, v)); };
  var ease = function (v) { return v * v * (3 - 2 * v); };   /* smoothstep */
  var PERSP = 1100;
  var raf = 0;

  var tick = function () {
    raf = 0;
    var vh = win.innerHeight;
    var y = win.scrollY;
    var onHome = current === "home" && hero;
    var gate = onHome ? Math.max(1, hero.offsetHeight - vh) : 1000;

    /* Without a hero (the portfolio) the camera starts already past the mark. */
    if (scene) {
      scene.setAttribute("gate", String(gate));
      scene.setAttribute("scroll", String(onHome ? y : y + gate * 1.6));
    }

    /* Hero beats fade out in order as you approach the mark. */
    var p = clamp(y / gate);
    if (onHome) {
      beats.forEach(function (b) {
        var el = b[0];
        if (!el) return;
        var k = clamp((p - b[1]) / (b[2] - b[1]));
        el.style.opacity = String(1 - k);
        el.style.transform = "translateY(" + (-b[3] * k).toFixed(1) + "px)";
        if (b[4]) el.style.pointerEvents = k >= 1 ? "none" : "auto";
      });
    }
    if (fallback) fallback.style.opacity = onHome ? String(1 - ease(p)) : "0";

    /* Sections fly in from deep space: small, far back and tilted like a
       crawl, standing upright as they reach you, then sweeping past overhead.
       Layout position is read from the untransformed parent so the projection
       never feeds back into itself. */
    panels.forEach(function (el) {
      var h = el.offsetHeight;
      if (!h) return;   /* on the page that is not showing */
      var top = el.parentElement.getBoundingClientRect().top + el.offsetTop;
      var bottom = top + h;
      var start = parseFloat(el.getAttribute("data-approach")) || 1.7;
      var q = still ? 1 : ease(clamp((vh * start - top) / (vh * (start - 0.3))));
      var x = still ? 0 : ease(clamp((vh * 0.22 - bottom) / (vh * 0.4)));
      /* Arriving it grows from a speck to full size. Leaving it shrinks away
         again rather than swelling overhead: the handoff had it grow to 1.9 on
         the way out, which read as something lunging at you in the corner of
         your eye while it faded. Receding is quieter and says the same thing.  */
      var k = Math.pow(0.08, 1 - q) * (1 - 0.4 * x);   /* 8% far off, 1 landed, 0.6 leaving */
      var z = PERSP * (1 - 1 / k);
      var dy = (1 - q) * (vh * 0.5 - (top + h / 2)) / k;   /* far panels gather at the vanishing point */
      el.style.opacity = String(Math.pow(q, 0.6) * (1 - x));
      el.style.zIndex = String(1 + Math.round(q * 4 + x * 4));

      /* Standing still at full size, drop the transform entirely rather than
         write an identity one. Under perspective the panel keeps a composited
         layer that is re-rasterised every time the transform is rewritten, and
         the preview scrolling inside it flickered the whole way down the page.
         Only written on the change, so this is not a per-frame style write. */
      if (q >= 0.999 && x <= 0.001) {
        if (el.dataset.settled !== "1") {
          el.dataset.settled = "1";
          el.style.transform = "none";
          el.style.willChange = "auto";
        }
      } else {
        if (el.dataset.settled === "1") {
          el.dataset.settled = "";
          el.style.willChange = "transform, opacity";
        }
        el.style.transform =
          "perspective(" + PERSP + "px) translateY(" + dy.toFixed(1) + "px) translateZ(" + z.toFixed(1) + "px)" +
          " rotateX(" + (26 * (1 - q) - 12 * x).toFixed(2) + "deg)";
      }
    });

    /* The nebula shifts tint over the journey: green, then teal, then brass. */
    var total = Math.max(1, root.scrollHeight - vh);
    var P = clamp(y / total);
    if (neb.green) neb.green.style.opacity = String(1 - 0.55 * P);
    if (neb.electric) neb.electric.style.opacity = String(0.55 + 0.45 * Math.sin(P * Math.PI));
    if (neb.brass) neb.brass.style.opacity = String(0.4 + 0.6 * P);

    lightParagraphs(vh);

    /* A preview only starts once its panel has actually arrived, so its
       scroll is not spent while it is still a speck at the vanishing point. */
    if (syncReels) syncReels();
  };

  var kick = function () {
    if (!raf) raf = win.requestAnimationFrame(tick);
  };
  win.addEventListener("scroll", kick, { passive: true });
  win.addEventListener("resize", kick);
  win.addEventListener("load", kick);
  if (typeof motionQuery.addEventListener === "function") {
    motionQuery.addEventListener("change", function (e) { still = e.matches; kick(); onStillChange.forEach(function (fn) { fn(); }); });
  }
  /* One synchronous pass so the first paint already has every panel where
     it belongs, rather than a frame of everything sitting upright. */
  tick();

  /* Entrance animations hand control back to the scroll beats once they
     finish. An animation outranks an inline style for as long as it runs. */
  doc.querySelectorAll("[data-settle]").forEach(function (el) {
    el.addEventListener("animationend", function (e) {
      if (e.target === el) el.style.animation = "none";
    });
  });

  /* Deep links land on their section once the page has laid out. */
  if (location.hash.length > 1) {
    win.addEventListener("load", function () { scrollToAnchor(location.hash.slice(1), true); });
  }

  /* ---- The rule under a section label -----------------------------------
     Draws itself across once the label is on screen, and stays drawn. */
  (function () {
    var rules = Array.prototype.slice.call(
      doc.querySelectorAll(".prose > .kicker, .pf-head .kicker, .services-grid > header .kicker")
    );
    if (!rules.length) return;
    if (!("IntersectionObserver" in win)) {
      rules.forEach(function (r) { r.classList.add("is-drawn"); });
      return;
    }
    var watch = new win.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-drawn");
        watch.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    rules.forEach(function (r) { watch.observe(r); });
  })();

  /* ---- Lightbox ---------------------------------------------------------
     A capture at full size over the page. Returns focus to whatever opened
     it, which for a carousel is the capture you clicked. */
  var lightbox = (function () {
    var dialog = doc.getElementById("lightbox");
    var big = doc.getElementById("lightbox-img");
    var close = doc.getElementById("lightbox-close");
    if (!dialog || !big || !close || typeof dialog.showModal !== "function") {
      return { open: function () {} };
    }
    var opener = null;

    var shut = function () { if (dialog.open) dialog.close(); };
    close.addEventListener("click", shut);
    /* a click that lands on the dialog itself is a click on the backdrop */
    dialog.addEventListener("click", function (e) { if (e.target === dialog) shut(); });
    /* close is delivered asynchronously, so closing one capture and clicking
       the next in quick succession let this run after the new one had already
       opened: it wiped the image and unlocked the page, leaving an empty
       lightbox over an unscrollable-looking document. If it has been reopened
       by the time this arrives, there is nothing to tidy. */
    dialog.addEventListener("close", function () {
      if (dialog.open) return;
      doc.body.classList.remove("is-locked");
      big.removeAttribute("src");
      big.alt = "";
      if (opener) { opener.focus(); opener = null; }
    });

    return {
      open: function (img, from) {
        if (!img) return;
        opener = from || null;
        big.src = img.currentSrc || img.src;
        big.alt = img.alt || "";
        /* showModal throws if it is already open, which would abort the rest
           of this and leave the previous picture up. */
        if (!dialog.open) dialog.showModal();
        doc.body.classList.add("is-locked");
        close.focus();
      }
    };
  })();

  /* ---- Screenshot carousels ---------------------------------------------
     A slow endless drift. One capture holds the middle at full size; the rest
     sit further back, smaller and dimmer, and slide forward into focus as the
     strip moves. The cells are cloned so the run repeats seamlessly: when the
     scroll passes the end of the first set the position jumps back by exactly
     one set width, which is invisible because the pixels either side of the
     seam are identical, and it means there is no last picture that cannot
     reach the middle.

     The drift runs on scroll position rather than a transform, so a swipe, a
     trackpad and the arrows all share one coordinate system. It pauses on
     hover, on focus, while a pointer is down, when the tab is hidden, when
     the strip is off screen and while you are on the other page, and it does
     not run at all under reduced motion, where the strip is a plain scroller
     with working arrows. */
  doc.querySelectorAll("[data-strip]").forEach(function (strip) {
    var view = strip.querySelector(".car-view");
    var track = strip.querySelector(".car-track");
    var prev = strip.querySelector(".car-prev");
    var next = strip.querySelector(".car-next");
    if (!view || !track || !prev || !next) return;

    var originals = Array.prototype.slice.call(track.children);
    if (originals.length < 2) return;

    /* Three sets, with the drift held in the middle one, so there is always a
       whole set of pictures laid out to the left and to the right of the
       view. Two sets left a hole on the left every time the position wrapped
       back to the start, because nothing existed before the first cell. */
    for (var copies = 0; copies < 2; copies++) {
      originals.forEach(function (cell) {
        var copy = cell.cloneNode(true);
        copy.setAttribute("aria-hidden", "true");
        copy.setAttribute("tabindex", "-1");
        copy.classList.add("is-clone");
        track.appendChild(copy);
      });
    }

    var cells = Array.prototype.slice.call(track.children);
    var setWidth = 0;
    var measure = function () {
      /* distance from the first cell to its own clone: one whole set */
      setWidth = cells[originals.length].offsetLeft - cells[0].offsetLeft;
    };

    /* The drift keeps its own position because a fractional increment written
       straight to scrollLeft can be rounded away, and at this speed every
       frame moves less than a quarter of a pixel: the rounding would eat the
       whole movement and the strip would sit still. Reset to null whenever
       something else moves the strip, so the next frame re-reads it. */
    var pos = null;
    var DRIFT = 40; /* px per second: about ten seconds a picture, so the
                       motion reads as motion straight away rather than as a
                       still that occasionally jumps */

    /* Held inside the middle set. The jump is invisible because the pixels a
       whole set apart are identical. */
    var wrap = function () {
      if (setWidth <= 0) return;
      if (pos === null) pos = view.scrollLeft;
      if (pos >= setWidth * 2) pos -= setWidth;
      else if (pos < setWidth) pos += setWidth;
      view.scrollLeft = pos;
    };

    /* Move the strip into the middle set from wherever it sits, so it opens
       with pictures on both sides instead of flush against nothing. */
    var normalise = function () {
      if (setWidth <= 0) return;
      var p = pos === null ? view.scrollLeft : pos;
      pos = setWidth + (((p % setWidth) + setWidth) % setWidth);
      view.scrollLeft = pos;
    };

    /* Depth: each cell shrinks and dims by how far it sits from the middle. */
    var paint = function () {
      if (motionQuery.matches) return;
      var mid = view.scrollLeft + view.clientWidth / 2;
      var span = view.clientWidth;
      if (!span) return;
      cells.forEach(function (cell) {
        var off = cell.offsetLeft + cell.offsetWidth / 2 - mid;
        var d = Math.abs(off) / span;
        var scale = Math.max(0.84, 1 - d * 0.38);
        var fade = Math.max(0.38, 1 - d * 1.5);
        /* Shrink towards the middle of the strip rather than towards each
           cell's own centre, which dragged the ones at the sides further out
           of the view and left barely a sliver of them showing. Sliding the
           origin across keeps it continuous: a cell passing the middle would
           otherwise jump the width of its own scale. */
        var t = Math.max(-1, Math.min(1, off / (span * 0.5)));
        cell.style.transformOrigin = (50 - t * 50).toFixed(1) + "% 50%";
        cell.style.transform = "scale(" + scale.toFixed(3) + ")";
        cell.style.opacity = fade.toFixed(3);
        cell.classList.toggle("is-focus", d < 0.14);
      });
    };

    /* Reasons the drift is currently stopped. It runs only when none hold. */
    var owner = strip.closest("main[data-page]");
    var held = {
      hover: false, press: false, hidden: doc.hidden, off: true, step: false,
      away: !!owner && owner.getAttribute("data-page") !== current
    };
    var running = false, last = 0, raf = 0;

    var frame = function (now) {
      if (!running) return;
      var dt = Math.min((now - last) / 1000, 0.05); /* clamp after a stall */
      last = now;
      if (pos === null) pos = view.scrollLeft;
      pos += DRIFT * dt;
      wrap();
      paint();
      raf = win.requestAnimationFrame(frame);
    };

    var sync = function () {
      var should = !motionQuery.matches && !capture &&
        !held.hover && !held.press && !held.hidden && !held.off &&
        !held.step && !held.away;
      if (should === running) return;
      running = should;
      if (running) {
        last = win.performance.now();
        pos = null; /* something else may have moved it while we were stopped */
        raf = win.requestAnimationFrame(frame);
      } else {
        win.cancelAnimationFrame(raf);
      }
    };

    var hold = function (key, on) { held[key] = on; sync(); };

    /* Arrows step one capture and hand back to the drift once it has landed. */
    var stepTimer = 0;
    var step = function (dir) {
      var mid = view.scrollLeft + view.clientWidth / 2;
      var best = null, dist = Infinity;
      cells.forEach(function (cell, i) {
        var d = Math.abs(cell.offsetLeft + cell.offsetWidth / 2 - mid);
        if (d < dist) { dist = d; best = i; }
      });
      var target = cells[Math.min(cells.length - 1, Math.max(0, best + dir))];
      if (!target) return;
      hold("step", true);
      view.scrollTo({
        left: target.offsetLeft + target.offsetWidth / 2 - view.clientWidth / 2,
        behavior: motionQuery.matches ? "auto" : "smooth"
      });
      win.clearTimeout(stepTimer);
      stepTimer = win.setTimeout(function () {
        /* the arrow moved it, so the drift position is stale: re-read before
           wrapping, or the wrap writes the old position straight back */
        pos = null;
        wrap();
        hold("step", false);
      }, 700);
    };
    prev.addEventListener("click", function () { step(-1); });
    next.addEventListener("click", function () { step(1); });
    view.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { step(-1); e.preventDefault(); }
      if (e.key === "ArrowRight") { step(1); e.preventDefault(); }
    });

    /* Clicking a capture brings it to the middle and opens it full size, so a
       dim one at the edge is a target rather than something you have to walk
       the arrows to. The last image in a cell is the page itself; the first,
       where there are two, is the application header above it. */
    var centreOn = function (cell) {
      hold("step", true);
      view.scrollTo({
        left: cell.offsetLeft + cell.offsetWidth / 2 - view.clientWidth / 2,
        behavior: motionQuery.matches ? "auto" : "smooth"
      });
      win.clearTimeout(stepTimer);
      stepTimer = win.setTimeout(function () {
        pos = null;
        wrap();
        hold("step", false);
      }, 700);
    };
    track.addEventListener("click", function (e) {
      var cell = e.target.closest && e.target.closest(".car-cell");
      if (!cell) return;
      centreOn(cell);
      var imgs = cell.querySelectorAll("img");
      lightbox.open(imgs[imgs.length - 1], cell);
    });

    view.addEventListener("scroll", paint, { passive: true });
    strip.addEventListener("pointerenter", function () { hold("hover", true); });
    strip.addEventListener("pointerleave", function () { hold("hover", false); });
    strip.addEventListener("focusin", function () { hold("hover", true); });
    strip.addEventListener("focusout", function () { hold("hover", false); });
    view.addEventListener("pointerdown", function () { hold("press", true); });
    win.addEventListener("pointerup", function () { hold("press", false); }, { passive: true });
    doc.addEventListener("visibilitychange", function () { hold("hidden", doc.hidden); });

    var settle = function () {
      measure();
      normalise();
      if (motionQuery.matches) {
        cells.forEach(function (cell) {
          cell.style.transform = ""; cell.style.opacity = "";
          cell.classList.add("is-focus");
        });
      } else {
        paint();
      }
      sync();
    };
    win.addEventListener("resize", function () { win.setTimeout(settle, 120); }, { passive: true });
    if (typeof motionQuery.addEventListener === "function") {
      motionQuery.addEventListener("change", settle);
    }
    /* A strip on the page you are not looking at measures zero, so it has to
       measure again once that page is showing. */
    onPageShown.push(function () {
      held.away = !!owner && owner.getAttribute("data-page") !== current;
      settle();
    });

    if ("IntersectionObserver" in win) {
      new win.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { hold("off", !entry.isIntersecting); });
      }, { threshold: 0.15 }).observe(strip);
    } else {
      held.off = false;
    }

    /* Images arrive late, and the set width depends on them. */
    win.addEventListener("load", settle);
    settle();
  });

  /* ---- Animated previews ------------------------------------------------
     Each [data-reel] frame holds .reel-slide units. A slide is one page of
     the thing being shown: an optional .reel-head that stays pinned the way a
     real sticky header does, and a .reel-page that scrolls underneath it.

     Every slide runs on the same beat regardless of how tall its page is, so
     a desktop frame and the phone frame beside it stay in step while they
     browse the same site. The cursor moves to a real target named by the
     slide's data-click, clicks it, and only then does the next slide come up,
     so the cut reads as the click that caused it. Frames with no cursor wait
     out the same interval rather than running ahead.

     A frame only runs while it is on screen, on the page you are looking at,
     and in a foreground tab. Under reduced motion it still moves between
     slides, but it crossfades: no scrolling, no cursor. */
  (function () {
    var frames = Array.prototype.slice.call(doc.querySelectorAll("[data-reel]"));
    if (!frames.length || capture) return;
    if (!("IntersectionObserver" in win)) return;

    /* One slide: settle, scroll the page, rest, then point and click. A page
       with nothing to scroll skips only the scroll. */
    var HOLD_TOP = 450;
    var SCROLL_MS = 12000;
    var HOLD_END = 1700;
    /* A page has to overflow its frame by a real amount to be worth
       scrolling. Below this it is held still, so a capture that only spills a
       few pixels does not crawl for twelve seconds. */
    var SCROLL_MIN = 0.25;
    var CURSOR_MOVE = 1000;
    var CLICK_HOLD = 620;
    var REDUCED_HOLD = 5000;

    function Reel(frame) {
      this.frame = frame;
      this.screen = frame.querySelector(".screen");
      this.slides = Array.prototype.slice.call(frame.querySelectorAll(".reel-slide"));
      this.cursor = frame.querySelector(".reel-cursor");
      this.panel = frame.closest("[data-approach]");
      this.owner = frame.closest("main[data-page]");
      this.index = 0;
      this.timer = 0;
      this.running = false;
    }

    /* Frames inside an approach panel spend most of their life tiny and faded
       at the vanishing point. Running there would burn the whole twelve second
       scroll before anyone could see it, and the preview would arrive parked
       at the bottom of its page, only ever crossfading. Wait until the panel
       has essentially landed. */
    Reel.prototype.arrived = function () {
      if (!this.panel) return true;
      var o = parseFloat(this.panel.style.opacity);
      return isNaN(o) ? true : o >= 0.85;
    };

    Reel.prototype.wait = function (ms, next) {
      var self = this;
      this.timer = win.setTimeout(function () {
        if (self.running) next();
      }, ms);
    };

    /* How far this slide's page can travel before its bottom edge is reached.
       The pinned header takes its height out of the space the page gets. */
    Reel.prototype.overflow = function (slide) {
      var page = slide.querySelector(".reel-page");
      var head = slide.querySelector(".reel-head");
      if (!page) return 0;
      var room = this.screen.clientHeight - (head ? head.offsetHeight : 0);
      /* Nothing has laid out yet: the page this frame lives on is not showing,
         or the captures have not sized. Measuring now reads the image at its
         natural height and would scroll it thousands of pixels. */
      if (room <= 0) return 0;
      return Math.max(0, page.offsetHeight - room);
    };

    /* The slide names its click target as percentages of whichever element
       the target lives in: the pinned header if there is one, otherwise the
       screen. That keeps the cursor on the actual link at any frame size. */
    Reel.prototype.target = function (slide) {
      var spec = (slide.getAttribute("data-click") || "").split(",");
      if (spec.length !== 2) return null;
      var ref = slide.querySelector(".reel-head") || this.screen;
      var refBox = ref.getBoundingClientRect();
      var frameBox = this.frame.getBoundingClientRect();
      if (!refBox.width) return null;
      return {
        x: refBox.left - frameBox.left + (refBox.width * parseFloat(spec[0])) / 100,
        y: refBox.top - frameBox.top + (refBox.height * parseFloat(spec[1])) / 100
      };
    };

    Reel.prototype.click = function (slide, next) {
      var self = this;
      var spot = this.cursor && this.target(slide);
      /* No cursor, or nowhere honest to point: wait out the same beat so a
         paired frame does not run ahead. */
      if (!spot) return this.wait(CURSOR_MOVE + CLICK_HOLD, next);

      this.cursor.style.transition =
        "transform " + CURSOR_MOVE + "ms var(--ease-out), opacity 0.3s linear";
      this.cursor.style.transform = "translate(" + spot.x.toFixed(1) + "px," + spot.y.toFixed(1) + "px)";
      this.cursor.classList.add("is-on");
      this.wait(CURSOR_MOVE, function () {
        self.cursor.classList.remove("is-click");
        void self.cursor.offsetWidth; /* restart the ring on every click */
        self.cursor.classList.add("is-click");
        self.wait(CLICK_HOLD, next);
      });
    };

    /* The scroll is a CSS transition rather than a per-frame loop: it runs on
       the compositor and costs no JavaScript while it plays. Every slide
       takes the same time whatever its height, which is what keeps two frames
       showing the same site in step. */
    Reel.prototype.scroll = function (slide, distance, next) {
      var page = slide.querySelector(".reel-page");
      page.style.transition = "transform " + SCROLL_MS + "ms cubic-bezier(0.4, 0, 0.35, 1)";
      page.style.transform = "translateY(" + -distance + "px)";
      this.wait(SCROLL_MS + 80, next);
    };

    Reel.prototype.play = function () {
      var self = this;
      var slide = this.slides[this.index];
      var page = slide.querySelector(".reel-page");
      var distance = this.overflow(slide);

      if (page) {
        page.style.transition = "none";
        page.style.transform = "translateY(0)";
        void page.offsetWidth; /* commit the snap before a new transition is set */
        page.style.transition = "";
      }
      this.slides.forEach(function (s) { s.classList.toggle("is-live", s === slide); });

      if (motionQuery.matches) {
        this.wait(REDUCED_HOLD, function () { self.advance(); });
        return;
      }

      /* A slide can ask for its own dwell. A run of frames that differ by one
         ticked checkbox reads as the action happening, not as a slideshow,
         but only if they come through quickly. */
      var hold = parseInt(slide.getAttribute("data-hold"), 10);
      if (hold > 0) {
        this.wait(hold, function () { self.advance(); });
        return;
      }

      this.wait(HOLD_TOP, function () {
        if (distance > self.screen.clientHeight * SCROLL_MIN) {
          self.scroll(slide, distance, function () { self.rest(slide); });
        } else {
          self.rest(slide);
        }
      });
    };

    Reel.prototype.advance = function () {
      if (this.cursor) this.cursor.classList.remove("is-on");
      this.index = (this.index + 1) % this.slides.length;
      this.play();
    };

    Reel.prototype.rest = function (slide) {
      var self = this;
      this.wait(HOLD_END, function () {
        self.click(slide, function () { self.advance(); });
      });
    };

    Reel.prototype.start = function () {
      /* A frame on the page you are not looking at measures zero. Starting it
         there would set its scroll from nonsense and leave it wrong when you
         arrive; resyncAll brings it up once the page is showing. */
      if (this.running || !this.screen.clientHeight) return;
      this.running = true;
      this.play();
    };

    Reel.prototype.stop = function () {
      this.running = false;
      win.clearTimeout(this.timer);
      if (this.cursor) this.cursor.classList.remove("is-on", "is-click");
    };

    var reels = [];
    frames.forEach(function (frame) {
      var reel = new Reel(frame);
      if (!reel.screen || !reel.slides.length) return;
      reels.push(reel);
    });

    var syncOne = function (reel) {
      var onPage = !reel.owner || reel.owner.getAttribute("data-page") === current;
      if (reel.onScreen && !doc.hidden && onPage && reel.arrived()) reel.start();
      else reel.stop();
    };

    var watcher = new win.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        reels.forEach(function (reel) {
          if (reel.frame !== entry.target) return;
          reel.onScreen = entry.isIntersecting;
          syncOne(reel);
        });
      });
    }, { threshold: 0.25 });
    reels.forEach(function (reel) { watcher.observe(reel.frame); });

    /* A background tab throws off the timers, a resize invalidates both the
       scroll distances and the cursor targets (measured in rendered pixels),
       and a page change means a frame that measured at zero can now measure
       properly. All three restart the frames from the top. */
    var refresh = function () { reels.forEach(syncOne); };
    syncReels = refresh;

    var resyncAll = function () {
      reels.forEach(function (reel) { reel.stop(); syncOne(reel); });
    };
    doc.addEventListener("visibilitychange", resyncAll);
    if (typeof motionQuery.addEventListener === "function") {
      motionQuery.addEventListener("change", resyncAll);
    }
    onPageShown.push(resyncAll);
    var resizeTimer;
    win.addEventListener("resize", function () {
      win.clearTimeout(resizeTimer);
      resizeTimer = win.setTimeout(resyncAll, 250);
    }, { passive: true });
    win.addEventListener("load", resyncAll);
  })();

  /* ---- Contact form ----------------------------------------------------- */
  var form = doc.getElementById("enquiry");
  if (!form) return;

  var status = doc.getElementById("form-status");
  var submit = form.querySelector('button[type="submit"]');

  var showError = function (input, show) {
    var msg = form.querySelector('.err[data-for="' + input.id + '"]');
    if (msg) msg.hidden = !show;
    if (show) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  };

  var validate = function () {
    var ok = true;
    var first = null;
    ["f-name", "f-email", "f-msg"].forEach(function (id) {
      var input = doc.getElementById(id);
      if (!input) return;
      var bad = !input.value.trim() || (input.type === "email" && !input.checkValidity());
      showError(input, bad);
      if (bad && !first) first = input;
      if (bad) ok = false;
    });
    if (first) first.focus();
    return ok;
  };

  form.addEventListener("input", function (e) {
    if (e.target.getAttribute("aria-invalid") === "true") showError(e.target, false);
  });

  var setStatus = function (text, state) {
    if (!status) return;
    status.textContent = text;
    if (state) status.setAttribute("data-state", state);
    else status.removeAttribute("data-state");
  };

  /* Used by the spam trap in the endpoint: a real person cannot fill this in
     and submit within two seconds of the page loading. */
  var openedAt = Date.now();

  /* Last resort when the endpoint is missing or unreachable. The message the
     visitor typed is never thrown away, it just goes out through their own
     mail app instead. */
  var handOffToMailApp = function (data, note) {
    var body = "Name: " + data.name + "\n" + "Email: " + data.email + "\n\n" + data.message;
    win.location.href =
      "mailto:" + EMAIL +
      "?subject=" + encodeURIComponent("Message from " + data.name) +
      "&body=" + encodeURIComponent(body);
    setStatus(note || "Opening your email app with the message ready to send.");
  };

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate()) {
      setStatus("Check the highlighted fields.", "bad");
      return;
    }

    var fields = new FormData(form);
    var data = {
      name: String(fields.get("name") || "").trim(),
      email: String(fields.get("email") || "").trim(),
      message: String(fields.get("message") || "").trim(),
      _gotcha: fields.get("_gotcha") || "",
      _t: openedAt
    };

    submit.disabled = true;
    setStatus("Sending...");

    fetch(form.action, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        if (res.ok) {
          form.reset();
          setStatus("Sent. Thanks, I will get back to you.", "ok");
          return;
        }
        /* 501 means the endpoint is live but no mail provider is configured. */
        if (res.status === 501) {
          handOffToMailApp(data);
          return;
        }
        setStatus("That did not send. You can email me instead.", "bad");
      })
      .catch(function () {
        /* No endpoint at all: opened as a local file, or the network is down. */
        handOffToMailApp(data, "Could not reach the server. Opening your email app instead.");
      })
      .finally(function () {
        submit.disabled = false;
      });
  });
})();
