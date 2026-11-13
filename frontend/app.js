/* Cinéscope — front-end controller
   Vanilla JS, no build step. Talks to FastAPI through /api (nginx proxy)
   or through an explicit ?api=https://host:port override for local dev. */

(() => {
  "use strict";

  // --------------------------------------------------------------------- //
  // Configuration
  // --------------------------------------------------------------------- //

  const MAX_CHARS = 2000;
  const MAX_LOG_ENTRIES = 8;
  const REQUEST_TIMEOUT_MS = 45_000;
  const HEALTH_TIMEOUT_MS = 4_000;

  const STORAGE = {
    lang: "cinescope.lang",
    log: "cinescope.log.v1",
  };

  function resolveApiBase() {
    const params = new URLSearchParams(window.location.search);
    const override = params.get("api") || safeStorageGet("cinescope.api");

    if (override) return override.replace(/\/+$/, "");
    if (window.location.protocol === "file:") return "http://localhost:8088";
    return "/api";
  }

  const API_BASE = resolveApiBase();

  // --------------------------------------------------------------------- //
  // Copy
  // --------------------------------------------------------------------- //

  const I18N = {
    fr: {
      "doc.title": "Cinéscope · Analyse de sentiment de critiques de films",
      "meta.description":
        "Collez une critique de film : un BERT affiné sur IMDb mesure si elle penche vers l'éloge ou la démolition.",
      skip: "Aller au contenu",
      "brand.label": "Cinéscope, accueil",
      "brand.sub": "Cabine de projection",
      "api.check": "Vérifier l'état de l'API",
      "api.checking": "Vérification",
      "api.online": "API en ligne",
      "api.offline": "API hors ligne",
      "lang.label": "Langue de l'interface",
      "hero.title": "Chaque critique a sa <em>lumière</em>.",
      "hero.lede":
        "Un BERT affiné sur 2\u00a0000 critiques IMDb mesure la température de votre texte\u00a0: éloge ou démolition. Collez, projetez, lisez.",
      "form.label": "Votre critique",
      "form.placeholder":
        "Collez ici une critique de film, en anglais de préférence…",
      "form.submit": "Analyser la critique",
      "form.loading": "Projection en cours",
      "form.enter": "Entrée",
      "form.error.empty":
        "La pellicule est vide. Écrivez au moins une phrase avant de projeter.",
      "form.error.offline":
        "La cabine ne répond pas. Vérifiez que l'API est démarrée, puis réessayez.",
      "form.error.timeout":
        "La projection a pris trop de temps. Réessayez avec un texte plus court.",
      "form.error.generic":
        "La projection a échoué. Réessayez dans un instant.",
      "note.model":
        "Entraîné sur l'anglais. Écrivez dans cette langue pour un verdict fiable\u00a0; 89\u00a0% de précision en validation.",
      "screen.label": "Écran de projection",
      "idle.title": "En attente d'une critique",
      "idle.sub": "La pellicule est prête. Chargez un texte à gauche.",
      "loading.title": "Projection en cours",
      "loading.sub.one": "Lecture d'un mot…",
      "loading.sub.other": "Lecture des {count} mots…",
      "result.label": "Verdict",
      "result.confidence": "de certitude",
      "result.temp.positive": "Lumière chaude",
      "result.temp.negative": "Lumière froide",
      "result.copy.positive": "La critique penche vers l'éloge.",
      "result.copy.negative": "La critique penche vers la démolition.",
      "verdict.positive": "Positif",
      "verdict.negative": "Négatif",
      "error.title": "La cabine ne répond pas",
      "error.copy":
        "Vérifiez que l'API est démarrée, puis réessayez.",
      "error.failed.title": "La projection a échoué",
      "error.failed.copy":
        "Le serveur a renvoyé une erreur. Réessayez dans un instant.",
      "error.timeout.title": "La projection s'est interrompue",
      "error.timeout.copy":
        "Le modèle a mis trop de temps à répondre. Réessayez avec un texte plus court.",
      "error.retry": "Réessayer",
      "readout.label": "Lecture du modèle",
      "meter.positive": "Positif",
      "meter.negative": "Négatif",
      "stats.words": "Mots",
      "stats.chars": "Caractères",
      "stats.model": "Modèle",
      "samples.title": "Bandes-annonces",
      "samples.lede":
        "Trois critiques pour tester la cabine sans écrire une ligne.",
      "samples.meta": "Exemples fictifs · anglais",
      "samples.load": "Charger l'exemple",
      "log.title": "Registre des séances",
      "log.lede":
        "Les huit dernières projections, conservées dans ce navigateur.",
      "log.clear": "Effacer le registre",
      "log.empty.title": "Le registre est vierge.",
      "log.empty.sub":
        "Chaque analyse viendra s'y inscrire avec son heure, son verdict et sa certitude.",
      "log.row.title": "Recharger cette critique",
      "footer.credit":
        'Cinéscope · BERT-base affiné sur <a href="https://huggingface.co/datasets/stanfordnlp/imdb" target="_blank" rel="noreferrer">IMDb</a>. Interface HTML/CSS/JS, API FastAPI.',
      "footer.docs": "Documentation API",
      "footer.health": "Santé de l'API",
      noscript:
        "Cette cabine a besoin de JavaScript pour projeter un verdict.",
      "live.result":
        "Verdict\u00a0: {verdict}, {confidence} de certitude.",
      "live.error": "La projection a échoué.",
      "live.loaded": "Critique chargée. Prêt à projeter.",
      "live.cleared": "Registre effacé.",
    },
    en: {
      "doc.title": "Cinéscope · Movie review sentiment analysis",
      "meta.description":
        "Paste a movie review: a BERT model fine-tuned on IMDb measures whether it leans toward praise or demolition.",
      skip: "Skip to content",
      "brand.label": "Cinéscope, home",
      "brand.sub": "Screening booth",
      "api.check": "Check API status",
      "api.checking": "Checking",
      "api.online": "API online",
      "api.offline": "API offline",
      "lang.label": "Interface language",
      "hero.title": "Every review has its own <em>light</em>.",
      "hero.lede":
        "A BERT model fine-tuned on 2,000 IMDb reviews reads the temperature of your text: praise or demolition. Paste, project, read.",
      "form.label": "Your review",
      "form.placeholder":
        "Paste a movie review here (English preferred)…",
      "form.submit": "Analyze the review",
      "form.loading": "Projecting",
      "form.enter": "Enter",
      "form.error.empty":
        "The reel is blank. Write at least one sentence before projecting.",
      "form.error.offline":
        "The booth is not responding. Check that the API is running, then try again.",
      "form.error.timeout":
        "The projection took too long. Try again with a shorter text.",
      "form.error.generic": "The projection failed. Please try again in a moment.",
      "note.model":
        "Trained on English. Write in that language for a reliable verdict; 89% validation accuracy.",
      "screen.label": "Screening screen",
      "idle.title": "Waiting for a review",
      "idle.sub": "The reel is loaded. Add a text on the left.",
      "loading.title": "Projection in progress",
      "loading.sub.one": "Reading 1 word…",
      "loading.sub.other": "Reading {count} words…",
      "result.label": "Verdict",
      "result.confidence": "confidence",
      "result.temp.positive": "Warm light",
      "result.temp.negative": "Cold light",
      "result.copy.positive": "The review leans toward praise.",
      "result.copy.negative": "The review leans toward demolition.",
      "verdict.positive": "Positive",
      "verdict.negative": "Negative",
      "error.title": "The booth is not responding",
      "error.copy": "Check that the API is running, then try again.",
      "error.failed.title": "The projection failed",
      "error.failed.copy":
        "The server returned an error. Please try again in a moment.",
      "error.timeout.title": "The projection stalled",
      "error.timeout.copy":
        "The model took too long to answer. Try again with a shorter text.",
      "error.retry": "Try again",
      "readout.label": "Model readout",
      "meter.positive": "Positive",
      "meter.negative": "Negative",
      "stats.words": "Words",
      "stats.chars": "Characters",
      "stats.model": "Model",
      "samples.title": "Trailers",
      "samples.lede":
        "Three reviews to test the booth without writing a line.",
      "samples.meta": "Fictional samples · English",
      "samples.load": "Load sample",
      "log.title": "Screening log",
      "log.lede": "The last eight projections, kept in this browser.",
      "log.clear": "Clear log",
      "log.empty.title": "The log is empty.",
      "log.empty.sub":
        "Every analysis will be recorded here with its time, verdict and confidence.",
      "log.row.title": "Reload this review",
      "footer.credit":
        'Cinéscope · BERT-base fine-tuned on <a href="https://huggingface.co/datasets/stanfordnlp/imdb" target="_blank" rel="noreferrer">IMDb</a>. HTML/CSS/JS interface, FastAPI backend.',
      "footer.docs": "API docs",
      "footer.health": "API health",
      noscript: "This booth needs JavaScript to project a verdict.",
      "live.result": "Verdict: {verdict}, {confidence} confidence.",
      "live.error": "The projection failed.",
      "live.loaded": "Review loaded. Ready to project.",
      "live.cleared": "Log cleared.",
    },
  };

  // --------------------------------------------------------------------- //
  // State and elements
  // --------------------------------------------------------------------- //

  const state = {
    lang: "fr",
    loading: false,
    api: "checking",
    device: "",
    healthPending: false,
    log: [],
    lastAttempt: "",
    lastResult: null,
    wordCount: 0,
    errorKind: null,
    formErrorKey: null,
    activeController: null,
    countdownTimer: null,
    timecodeTimer: null,
    animationToken: 0,
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const els = {
    form: $("#review-form"),
    review: $("#review"),
    charCount: $("#char-count"),
    formError: $("#form-error"),
    submit: $("#submit-button"),
    submitLabel: $("#submit-label"),
    screen: $("#screen"),
    states: $$("[data-screen]"),
    timecode: $("#timecode"),
    countdown: $("#countdown"),
    loadingSub: $("#loading-sub"),
    verdict: $("#verdict"),
    resultTemp: $("#result-temp"),
    confidence: $("#confidence"),
    confidenceUnit: $(".confidence__unit"),
    resultCopy: $("#result-copy"),
    errorTitle: $("#error-title"),
    errorCopy: $("#error-copy"),
    retry: $("#retry-button"),
    latency: $("#latency"),
    probPositive: $("#prob-positive"),
    probNegative: $("#prob-negative"),
    barPositive: $("#bar-positive"),
    barNegative: $("#bar-negative"),
    statWords: $("#stat-words"),
    statChars: $("#stat-chars"),
    api: $("#api-status"),
    apiLabel: $("#api-status-label"),
    logList: $("#log-list"),
    logEmpty: $("#log-empty"),
    clearLog: $("#clear-log"),
    live: $("#live-status"),
    metaDescription: $('meta[name="description"]'),
    langButtons: $$(".lang-switch button"),
  };

  // --------------------------------------------------------------------- //
  // Utilities
  // --------------------------------------------------------------------- //

  function t(key, vars = {}) {
    const dictionary = I18N[state.lang] || I18N.fr;
    let value = dictionary[key] ?? I18N.fr[key] ?? key;
    return value.replace(/\{(\w+)\}/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : `{${name}}`
    );
  }

  const locale = () => (state.lang === "fr" ? "fr-FR" : "en-US");

  function formatDecimal(value) {
    return new Intl.NumberFormat(locale(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);
  }

  function formatInteger(value) {
    return new Intl.NumberFormat(locale()).format(value);
  }

  function formatPercent(value) {
    return formatDecimal(value) + (state.lang === "fr" ? "\u00a0%" : "%");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function countWords(text) {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function safeStorageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* private mode or storage disabled: the app still works */
    }
  }

  const pad2 = (value) => String(value).padStart(2, "0");

  function formatTimecode(ms) {
    const safe = Math.max(0, ms);
    const totalSeconds = Math.floor(safe / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const frames = Math.floor(((safe % 1000) / 1000) * 24);
    return [hours, minutes, seconds, frames].map(pad2).join(":");
  }

  function setLiveStatus(message) {
    els.live.textContent = "";
    // Let assistive tech pick up a repeated message as a new announcement.
    window.setTimeout(() => {
      els.live.textContent = message;
    }, 30);
  }

  // --------------------------------------------------------------------- //
  // Language
  // --------------------------------------------------------------------- //

  function detectInitialLanguage() {
    const stored = safeStorageGet(STORAGE.lang);
    if (stored === "fr" || stored === "en") return stored;
    const browser = (navigator.language || "fr").toLowerCase();
    return browser.startsWith("fr") ? "fr" : "en";
  }

  function applyLanguage(lang, { persist = true } = {}) {
    state.lang = lang;
    if (persist) safeStorageSet(STORAGE.lang, lang);

    document.documentElement.lang = lang;
    document.title = t("doc.title");
    if (els.metaDescription) {
      els.metaDescription.setAttribute("content", t("meta.description"));
    }

    $$("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    $$("[data-i18n-html]").forEach((node) => {
      node.innerHTML = t(node.dataset.i18nHtml);
    });
    $$("[data-i18n-placeholder]").forEach((node) => {
      node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
    });
    $$("[data-i18n-aria-label]").forEach((node) => {
      node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
    });
    $$("[data-i18n-title]").forEach((node) => {
      node.setAttribute("title", t(node.dataset.i18nTitle));
    });

    els.langButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
    });

    updateSubmitLabel();
    updateCharCount();
    renderApiStatus();
    renderFormError();
    renderLog();

    if (state.loading) {
      els.loadingSub.textContent = loadingCaption(state.wordCount);
    }

    if (els.screen.dataset.state === "result" && state.lastResult) {
      renderResultStatic(state.lastResult);
    }

    if (els.screen.dataset.state === "error") {
      renderErrorCopy();
    }
  }

  // --------------------------------------------------------------------- //
  // Form state
  // --------------------------------------------------------------------- //

  function updateCharCount() {
    const length = els.review.value.length;
    els.charCount.textContent = `${formatInteger(length)} / ${formatInteger(MAX_CHARS)}`;
    els.charCount.classList.toggle("is-near", length >= MAX_CHARS * 0.9 && length < MAX_CHARS);
    els.charCount.classList.toggle("is-max", length >= MAX_CHARS);
  }

  function updateSubmitLabel() {
    els.submitLabel.textContent = state.loading ? t("form.loading") : t("form.submit");
  }

  function renderFormError() {
    if (!state.formErrorKey) {
      els.formError.hidden = true;
      els.formError.textContent = "";
      els.form.classList.remove("has-error");
      return;
    }

    els.formError.textContent = t(state.formErrorKey);
    els.formError.hidden = false;
    els.form.classList.add("has-error");
  }

  function setFormError(key) {
    state.formErrorKey = key || null;
    renderFormError();
  }

  function setLoading(loading) {
    state.loading = loading;
    els.submit.disabled = loading;
    els.submit.classList.toggle("is-loading", loading);
    els.submit.setAttribute("aria-busy", String(loading));
    els.review.readOnly = loading;
    updateSubmitLabel();
  }

  function loadingCaption(words) {
    if (words === 1) return t("loading.sub.one");
    return t("loading.sub.other", { count: formatInteger(words) });
  }

  // --------------------------------------------------------------------- //
  // Screen and readout
  // --------------------------------------------------------------------- //

  function setScreenState(name) {
    els.screen.dataset.state = name;
    els.states.forEach((node) => {
      node.hidden = node.dataset.screen !== name;
    });
    els.screen.setAttribute("aria-busy", name === "loading" ? "true" : "false");
  }

  function resetReadout() {
    els.latency.textContent = "–";
    els.probPositive.textContent = "–";
    els.probNegative.textContent = "–";
    els.barPositive.style.clipPath = "inset(0 100% 0 0)";
    els.barNegative.style.clipPath = "inset(0 100% 0 0)";
    els.statWords.textContent = "–";
    els.statChars.textContent = "–";
  }

  function startCountdown() {
    stopCountdown();
    if (prefersReducedMotion()) {
      els.countdown.textContent = "1";
      return;
    }

    let value = 3;
    els.countdown.textContent = String(value);
    state.countdownTimer = window.setInterval(() => {
      if (value > 1) {
        value -= 1;
        els.countdown.textContent = String(value);
      }
    }, 230);
  }

  function stopCountdown() {
    if (state.countdownTimer) {
      window.clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    }
  }

  function startTimecode() {
    stopTimecode();
    els.timecode.textContent = "00:00:00:00";
    const startedAt = performance.now();
    state.timecodeTimer = window.setInterval(() => {
      els.timecode.textContent = formatTimecode(performance.now() - startedAt);
    }, 80);
  }

  function stopTimecode(finalMs) {
    if (state.timecodeTimer) {
      window.clearInterval(state.timecodeTimer);
      state.timecodeTimer = null;
    }
    els.timecode.textContent = formatTimecode(finalMs);
  }

  function animateNumber(element, target, duration, formatter) {
    const token = ++state.animationToken;
    if (prefersReducedMotion() || duration <= 0) {
      element.textContent = formatter(target);
      return;
    }

    const startedAt = performance.now();
    const from = 0;

    function frame(now) {
      if (token !== state.animationToken) return;
      const progress = clamp((now - startedAt) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = formatter(from + (target - from) * eased);
      if (progress < 1) window.requestAnimationFrame(frame);
    }

    window.requestAnimationFrame(frame);
  }

  function updateConfidenceUnit() {
    els.confidenceUnit.textContent = state.lang === "fr" ? "\u00a0%" : "%";
  }

  function renderResult(data, text, latencyMs) {
    const sentiment = data.sentiment;
    const confidence = clamp(Number(data.confidence) || 0, 0, 1);
    const probabilities = data.probabilities;
    const positive = clamp(Number(probabilities.positive) || 0, 0, 1);
    const negative = clamp(Number(probabilities.negative) || 0, 0, 1);

    state.lastResult = {
      sentiment,
      confidence,
      positive,
      negative,
      text,
      latencyMs,
    };

    els.screen.dataset.sentiment = sentiment;
    setScreenState("result");

    els.verdict.textContent = t(`verdict.${sentiment}`);
    els.resultTemp.textContent = t(`result.temp.${sentiment}`);
    els.resultCopy.textContent = t(`result.copy.${sentiment}`);
    updateConfidenceUnit();
    animateNumber(els.confidence, confidence * 100, 720, formatDecimal);

    els.probPositive.textContent = formatPercent(positive * 100);
    els.probNegative.textContent = formatPercent(negative * 100);
    els.barPositive.style.clipPath = `inset(0 ${(100 - positive * 100).toFixed(2)}% 0 0)`;
    els.barNegative.style.clipPath = `inset(0 ${(100 - negative * 100).toFixed(2)}% 0 0)`;

    els.latency.textContent = String(Math.round(latencyMs));
    els.statWords.textContent = formatInteger(countWords(text));
    els.statChars.textContent = formatInteger(text.length);

    setLiveStatus(
      t("live.result", {
        verdict: t(`verdict.${sentiment}`),
        confidence: formatPercent(confidence * 100),
      })
    );

    if (window.matchMedia("(max-width: 980px)").matches) {
      const panel = els.screen.closest(".screen-panel") || els.screen;
      panel.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "center",
      });
    }
  }

  function renderResultStatic(result) {
    state.animationToken += 1; // stop a count-up that may still be running
    els.verdict.textContent = t(`verdict.${result.sentiment}`);
    els.resultTemp.textContent = t(`result.temp.${result.sentiment}`);
    els.resultCopy.textContent = t(`result.copy.${result.sentiment}`);
    els.confidence.textContent = formatDecimal(result.confidence * 100);
    updateConfidenceUnit();
    els.probPositive.textContent = formatPercent(result.positive * 100);
    els.probNegative.textContent = formatPercent(result.negative * 100);
    els.latency.textContent = String(Math.round(result.latencyMs));
    els.statWords.textContent = formatInteger(countWords(result.text));
    els.statChars.textContent = formatInteger(result.text.length);
  }

  function errorPrefix(kind) {
    if (kind === "offline") return "error";
    if (kind === "timeout") return "error.timeout";
    return "error.failed";
  }

  function renderErrorCopy() {
    const prefix = errorPrefix(state.errorKind);
    els.errorTitle.textContent = t(`${prefix}.title`);
    els.errorCopy.textContent = t(`${prefix}.copy`);
  }

  // --------------------------------------------------------------------- //
  // API health
  // --------------------------------------------------------------------- //

  function renderApiStatus() {
    const label = t(`api.${state.api}`);
    els.api.dataset.state = state.api;
    els.apiLabel.textContent = label;

    const withDevice =
      state.api === "online" && state.device ? `${label} · ${state.device}` : label;
    els.api.title = state.api === "online" ? withDevice : t("api.check");
    // The text label is visually hidden on very narrow screens; keep a name.
    els.api.setAttribute("aria-label", withDevice);
  }

  async function checkHealth(silent = false) {
    if (state.healthPending) return;
    state.healthPending = true;

    if (!silent) {
      state.api = "checking";
      renderApiStatus();
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE}/health`, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`health ${response.status}`);
      const data = await response.json();
      state.api = "online";
      state.device = typeof data.device === "string" ? data.device.toUpperCase() : "";
    } catch {
      state.api = "offline";
      state.device = "";
    } finally {
      window.clearTimeout(timeout);
      state.healthPending = false;
      renderApiStatus();
    }
  }

  // --------------------------------------------------------------------- //
  // Screening log
  // --------------------------------------------------------------------- //

  function loadLog() {
    const raw = safeStorageGet(STORAGE.log);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (entry) =>
            entry &&
            typeof entry.text === "string" &&
            (entry.sentiment === "positive" || entry.sentiment === "negative") &&
            Number.isFinite(Number(entry.confidence)) &&
            Number.isFinite(Number(entry.ts))
        )
        .slice(0, MAX_LOG_ENTRIES)
        .map((entry) => ({
          text: entry.text,
          sentiment: entry.sentiment,
          confidence: clamp(Number(entry.confidence), 0, 1),
          ts: Number(entry.ts),
        }));
    } catch {
      return [];
    }
  }

  function saveLog() {
    safeStorageSet(STORAGE.log, JSON.stringify(state.log));
  }

  function addLogEntry(result) {
    state.log.unshift({
      text: result.text,
      sentiment: result.sentiment,
      confidence: result.confidence,
      ts: Date.now(),
    });
    state.log = state.log.slice(0, MAX_LOG_ENTRIES);
    saveLog();
    renderLog();
  }

  function formatLogTime(timestamp) {
    try {
      return new Intl.DateTimeFormat(locale(), {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(timestamp));
    } catch {
      return "--:--";
    }
  }

  function renderLog() {
    els.logList.replaceChildren();
    const hasEntries = state.log.length > 0;

    els.logEmpty.hidden = hasEntries;
    els.logList.hidden = !hasEntries;
    els.clearLog.hidden = !hasEntries;

    if (!hasEntries) return;

    const fragment = document.createDocumentFragment();

    state.log.forEach((entry) => {
      const item = document.createElement("li");
      const row = document.createElement("button");
      row.type = "button";
      row.className = "log__row";
      row.dataset.sentiment = entry.sentiment;
      row.title = t("log.row.title");

      const excerpt = entry.text.replace(/\s+/g, " ").trim();

      const time = document.createElement("span");
      time.className = "log__time";
      time.textContent = formatLogTime(entry.ts);

      const text = document.createElement("span");
      text.className = "log__excerpt";
      text.textContent = excerpt;

      const verdict = document.createElement("span");
      verdict.className = "log__verdict";
      verdict.textContent = t(`verdict.${entry.sentiment}`);

      const confidence = document.createElement("span");
      confidence.className = "log__confidence";
      confidence.textContent = formatPercent(entry.confidence * 100);

      row.append(time, text, verdict, confidence);
      row.addEventListener("click", () => loadReview(entry.text));

      item.append(row);
      fragment.append(item);
    });

    els.logList.append(fragment);
  }

  function clearLog() {
    state.log = [];
    saveLog();
    renderLog();
    setLiveStatus(t("live.cleared"));
  }

  // --------------------------------------------------------------------- //
  // Review flow
  // --------------------------------------------------------------------- //

  function loadReview(text) {
    if (state.loading) return;

    els.review.value = text;
    updateCharCount();
    setFormError(null);
    state.lastAttempt = text;

    els.review.focus({ preventScroll: true });
    els.form.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "center",
    });
    setLiveStatus(t("live.loaded"));
  }

  function beginProjection(text) {
    state.lastAttempt = text;
    state.wordCount = countWords(text);
    state.errorKind = null;
    state.animationToken += 1; // cancel any running count-up
    setFormError(null);

    els.screen.dataset.sentiment = "";
    setScreenState("loading");
    els.loadingSub.textContent = loadingCaption(state.wordCount);
    resetReadout();
    els.statWords.textContent = formatInteger(state.wordCount);
    els.statChars.textContent = formatInteger(text.length);

    setLoading(true);
    startCountdown();
    startTimecode();
    setLiveStatus(t("loading.title"));
  }

  function endProjectionUi() {
    stopCountdown();
    setLoading(false);
  }

  function showFailure(kind, elapsedMs) {
    stopTimecode(elapsedMs);
    endProjectionUi();
    state.errorKind = kind;
    els.screen.dataset.sentiment = "";
    setScreenState("error");
    renderErrorCopy();

    if (kind === "offline") {
      setFormError("form.error.offline");
      state.api = "offline";
      state.device = "";
      renderApiStatus();
    } else if (kind === "timeout") {
      setFormError("form.error.timeout");
    } else {
      setFormError("form.error.generic");
    }

    setLiveStatus(t("live.error"));
  }

  function normalizePrediction(payload) {
    if (!payload || (payload.sentiment !== "positive" && payload.sentiment !== "negative")) {
      throw new Error("Invalid sentiment payload");
    }

    const confidence = Number(payload.confidence);
    if (!Number.isFinite(confidence)) {
      throw new Error("Invalid confidence payload");
    }

    const rawProbabilities = payload.probabilities || {};
    let positive = Number(rawProbabilities.positive);
    let negative = Number(rawProbabilities.negative);

    if (!Number.isFinite(positive) || !Number.isFinite(negative)) {
      positive = payload.sentiment === "positive" ? confidence : 1 - confidence;
      negative = 1 - positive;
    }

    return {
      sentiment: payload.sentiment,
      confidence: clamp(confidence, 0, 1),
      probabilities: {
        positive: clamp(positive, 0, 1),
        negative: clamp(negative, 0, 1),
      },
    };
  }

  async function requestPrediction(text) {
    const controller = new AbortController();
    state.activeController = controller;
    let timedOut = false;

    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new Error(`Predict failed with ${response.status}`);
        error.httpStatus = response.status;
        throw error;
      }

      return normalizePrediction(await response.json());
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error("Request timed out");
        timeoutError.kind = timedOut ? "timeout" : "offline";
        throw timeoutError;
      }

      if (!error.httpStatus) {
        error.kind = "offline";
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
      if (state.activeController === controller) state.activeController = null;
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (state.loading) return;

    const text = els.review.value.trim();

    if (!text) {
      setFormError("form.error.empty");
      els.review.focus();
      return;
    }

    beginProjection(text);

    const startedAt = performance.now();
    let apiElapsed = 0;

    try {
      const prediction = await requestPrediction(text);
      apiElapsed = performance.now() - startedAt;

      // Give the leader countdown a moment to play on fast responses.
      const minimumDuration = prefersReducedMotion() ? 220 : 960;
      const remaining = minimumDuration - apiElapsed;
      if (remaining > 0) await delay(remaining);

      const totalElapsed = performance.now() - startedAt;
      stopCountdown();
      stopTimecode(totalElapsed);
      setLoading(false);
      state.errorKind = null;
      state.api = "online";
      renderApiStatus();
      renderResult(prediction, text, apiElapsed);
      state.lastResult.latencyMs = apiElapsed;
      addLogEntry(state.lastResult);
    } catch (error) {
      const elapsed = performance.now() - startedAt;
      const kind = error.kind === "timeout" ? "timeout" : error.kind === "offline" ? "offline" : "failed";
      showFailure(kind, elapsed);
    }
  }

  // --------------------------------------------------------------------- //
  // Wiring
  // --------------------------------------------------------------------- //

  function init() {
    state.log = loadLog();

    els.review.addEventListener("input", () => {
      updateCharCount();
      if (state.formErrorKey) setFormError(null);
    });

    els.review.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        els.form.requestSubmit();
      }
    });

    els.form.addEventListener("submit", handleSubmit);

    document.addEventListener("click", (event) => {
      const sample = event.target.closest("[data-sample]");
      if (!sample) return;
      const text = sample.dataset.review;
      if (text) loadReview(text);
    });

    els.retry.addEventListener("click", () => {
      if (state.loading) return;
      if (!els.review.value.trim() && state.lastAttempt) {
        els.review.value = state.lastAttempt;
        updateCharCount();
      }
      if (!els.review.value.trim()) {
        els.review.focus();
        return;
      }
      els.form.requestSubmit();
    });

    els.clearLog.addEventListener("click", clearLog);

    els.api.addEventListener("click", () => {
      if (!state.healthPending) checkHealth(false);
    });

    els.langButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.lang !== state.lang) {
          applyLanguage(button.dataset.lang);
        }
      });
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && state.api === "offline") checkHealth(true);
    });

    window.setInterval(() => {
      if (!document.hidden) checkHealth(true);
    }, 30_000);

    els.timecode.textContent = "00:00:00:00";
    applyLanguage(detectInitialLanguage(), { persist: false });
    renderLog();
    checkHealth(false);
  }

  init();
})();
