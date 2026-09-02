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

  var show = function (page) {
    if (page === current) return false;
    current = page;
    root.setAttribute("data-page", page);
    doc.title = titles[page];
    onPageShown.forEach(function (fn) { fn(); });
    return true;
  };

  var scrollToAnchor = function (anchor, instant) {
    var el = anchor ? doc.getElementById(anchor) : null;
    var top = el ? el.getBoundingClientRect().top + win.scrollY - 60 : 0;
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
    go(parts[0], parts[1] || "");
  });

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  win.addEventListener("popstate", function () {
    show(pageFromLocation());
    var anchor = location.hash.slice(1);
    win.requestAnimationFrame(function () { scrollToAnchor(anchor, true); kick(); });
  });

  show(pageFromLocation());

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

  /* ---- The scene ------------------------------------------------------- */
  var scene = doc.querySelector("space-scene");
  var fallback = doc.getElementById("mark-fallback");
  if (scene) {
    var sceneUp = function () { root.classList.add("has-scene"); };
    if (scene.hasAttribute("ready")) sceneUp();
    scene.addEventListener("scene-ready", sceneUp);
  }

  /* ---- One tick a frame ------------------------------------------------
     Coalesced from scroll, resize and page changes. Drives the camera, the
     hero beats, every approach panel and the nebula tint from scrollY. */
  var hero = doc.getElementById("top");
  var beats = [
    /* element, start, end, lift in px, whether it takes clicks */
    [doc.getElementById("hero-kicker"), 0.05, 0.26, 24, false],
    [doc.getElementById("hero-lede"),   0.09, 0.30, 24, false],
    [doc.getElementById("hero-ctas"),   0.13, 0.34, 24, true],
    [doc.getElementById("hero-title"),  0.24, 0.52, 56, false],
    [doc.getElementById("hero-ann"),    0.28, 0.46, 0,  false]
  ];
  var neb = {
    green: doc.getElementById("neb-green"),
    electric: doc.getElementById("neb-electric"),
    brass: doc.getElementById("neb-brass")
  };
  var panels = Array.prototype.slice.call(doc.querySelectorAll("[data-approach]"));

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
      var k = Math.pow(0.08, 1 - q) * (1 + 0.9 * x);   /* 8% far off, 1 landed, 1.9 leaving */
      var z = PERSP * (1 - 1 / k);
      var dy = (1 - q) * (vh * 0.5 - (top + h / 2)) / k;   /* far panels gather at the vanishing point */
      el.style.opacity = String(Math.pow(q, 0.6) * (1 - x));
      el.style.zIndex = String(1 + Math.round(q * 4 + x * 4));
      el.style.transform =
        "perspective(" + PERSP + "px) translateY(" + dy.toFixed(1) + "px) translateZ(" + z.toFixed(1) + "px)" +
        " rotateX(" + (26 * (1 - q) - 12 * x).toFixed(2) + "deg)";
    });

    /* The nebula shifts tint over the journey: green, then teal, then brass. */
    var total = Math.max(1, root.scrollHeight - vh);
    var P = clamp(y / total);
    if (neb.green) neb.green.style.opacity = String(1 - 0.55 * P);
    if (neb.electric) neb.electric.style.opacity = String(0.55 + 0.45 * Math.sin(P * Math.PI));
    if (neb.brass) neb.brass.style.opacity = String(0.4 + 0.6 * P);
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

  /* ---- Screenshot carousels ---------------------------------------------
     One capture holds the middle at full size. Its neighbours sit either
     side, faded and a touch smaller, scaled from their inner edge so the gap
     between cells stays put. Everything further out waits unseen. */
  doc.querySelectorAll("[data-carousel]").forEach(function (car) {
    var cells = Array.prototype.slice.call(car.querySelectorAll(".car-cell"));
    var prev = car.querySelector(".car-prev");
    var next = car.querySelector(".car-next");
    if (cells.length < 2 || !prev || !next) return;

    var active = parseInt(car.getAttribute("data-carousel"), 10) || 0;
    var GAP = 16;

    var paint = function () {
      var w = cells[0].offsetWidth;
      cells.forEach(function (cell, i) {
        var d = i - active;
        var a = Math.abs(d);
        var s = a === 0 ? 1 : a === 1 ? 0.94 : 0.9;
        var o = a === 0 ? 1 : a === 1 ? 0.45 : a === 2 ? 0.3 : 0;
        cell.style.transformOrigin = d < 0 ? "100% 50%" : d > 0 ? "0% 50%" : "50% 50%";
        cell.style.transform = "translateX(calc(-50% + " + (d * (w + GAP)).toFixed(1) + "px)) scale(" + s + ")";
        cell.style.opacity = String(o);
        cell.classList.toggle("is-active", a === 0);
        cell.setAttribute("aria-hidden", a === 0 ? "false" : "true");
      });
    };

    var step = function (dir) {
      active = (active + dir + cells.length) % cells.length;
      paint();
    };

    /* It walks itself through the screens, slowly, so the project reads as a
       tour rather than one still with arrows nobody presses. Every reason to
       stop is a reason someone is looking at it: the pointer is over it, it
       has focus, the tab is in the background, it is off screen, or it is on
       the page you are not on. Under reduced motion it holds still and the
       arrows do the work. */
    var DWELL = 4500;
    var held = { hover: false, hidden: doc.hidden, off: true, away: false };
    var owner = car.closest("main[data-page]");
    var timer = 0;
    var sync = function () {
      win.clearInterval(timer);
      timer = 0;
      if (still || held.hover || held.hidden || held.off || held.away) return;
      timer = win.setInterval(function () { step(1); }, DWELL);
    };
    var hold = function (key, on) { held[key] = on; sync(); };
    /* A press restarts the dwell, so the next automatic move is a full beat
       away rather than however long was left on the clock. */
    var drive = function (dir) { step(dir); sync(); };

    prev.addEventListener("click", function () { drive(-1); });
    next.addEventListener("click", function () { drive(1); });
    car.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { drive(-1); e.preventDefault(); }
      if (e.key === "ArrowRight") { drive(1); e.preventDefault(); }
    });
    car.addEventListener("pointerenter", function () { hold("hover", true); });
    car.addEventListener("pointerleave", function () { hold("hover", false); });
    car.addEventListener("focusin", function () { hold("hover", true); });
    car.addEventListener("focusout", function () { hold("hover", false); });
    doc.addEventListener("visibilitychange", function () { hold("hidden", doc.hidden); });
    if ("IntersectionObserver" in win) {
      new win.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { hold("off", !entry.isIntersecting); });
      }, { threshold: 0.2 }).observe(car);
    } else {
      held.off = false;
    }

    win.addEventListener("resize", paint, { passive: true });
    win.addEventListener("load", paint);
    onPageShown.push(function () {
      paint();
      hold("away", !!owner && owner.getAttribute("data-page") !== current);
    });
    onStillChange.push(sync);
    held.away = !!owner && owner.getAttribute("data-page") !== current;
    paint();
    sync();
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
      this.owner = frame.closest("main[data-page]");
      this.index = 0;
      this.timer = 0;
      this.running = false;
    }

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
      if (reel.onScreen && !doc.hidden && onPage) reel.start();
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
