import { addRandomLetterEffect, createReflowText } from "../reflowLetters.js?v=6";
import { createInfiniteGrid } from "./infiniteGrid.js?v=5";

export function initHomeHero(root = document) {
  const body = document.body;
  const gsap = window.gsap;
  const abortController = new AbortController();
  const { signal } = abortController;
  const homeRevealApiKey = "__siteHomeReveal";
  const hero = root.querySelector(".home-hero");
  const hole = hero?.querySelector(".home-hero__hole");
  const introTitle = hero?.querySelector(".intro-title");
  const introName = introTitle?.querySelector("h1");
  const introRole = introTitle?.querySelector("h2");
  const loader = hero?.querySelector("[data-home-loader]");
  const loaderCounter = loader?.querySelector("[data-home-loader-counter]");
  const selectedWorkSection = root.querySelector("[data-home-selected-work]");
  const backgroundName = selectedWorkSection?.querySelector(".home-selected-work__background-name");
  const gridViewport = root.querySelector("[data-home-infinite-grid]");
  const siteNav = root.querySelector(".site-nav");
  const homeLink = root.querySelector(".site-home-link");
  const navTextTargets = Array.from(siteNav?.querySelectorAll(".site-nav__link, .site-nav__separator") || [])
    .filter((element) => element.childElementCount === 0 && element.textContent.trim());
  const cardVideos = Array.from(root.querySelectorAll("[data-home-grid-cell] video"));
  const mediaElements = Array.from(root.querySelectorAll(
    "[data-home-grid-cell] img, [data-home-grid-cell] video"
  ));
  const counterState = { value: 0 };
  let introLetterEffects = [];
  let navLetterEffects = [];
  let backgroundNameEffect = null;
  let backgroundNameTimeline = null;
  let infiniteGrid = null;
  let openingTimeline = null;
  let openingPromise = null;
  let mediaReadyPromise = null;
  let isPanelOpen = false;
  let isOpeningComplete = false;
  let isBackgroundInitials = false;

  const setNavRevealed = (revealed) => {
    body.classList.toggle("home-nav-revealed", revealed);

    if (revealed && siteNav && gsap) {
      gsap.killTweensOf(siteNav);
      gsap.set(siteNav, {
        clearProps: "opacity,visibility,transform",
      });
    }
  };

  const setCounter = (value) => {
    counterState.value = value;

    if (loaderCounter) {
      loaderCounter.textContent = String(Math.round(value));
    }
  };

  const wait = (milliseconds) => new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

  const tweenTo = (target, vars) => new Promise((resolve) => {
    gsap.to(target, {
      ...vars,
      onComplete: resolve,
      onInterrupt: resolve,
    });
  });

  const scaleToCoverViewport = () => {
    gsap.set(hole, { scale: 1 });

    const rect = hole.getBoundingClientRect();
    const centerX = rect.left + (rect.width / 2);
    const centerY = rect.top + (rect.height / 2);
    const maxDistance = Math.max(
      Math.hypot(centerX, centerY),
      Math.hypot(window.innerWidth - centerX, centerY),
      Math.hypot(centerX, window.innerHeight - centerY),
      Math.hypot(window.innerWidth - centerX, window.innerHeight - centerY)
    );

    return Math.max(1, (maxDistance * 2.08) / Math.max(rect.width, 1));
  };

  const waitForMedia = () => {
    if (mediaReadyPromise) {
      return mediaReadyPromise;
    }

    mediaReadyPromise = new Promise((resolve) => {
      const total = mediaElements.length;
      const completed = new Set();
      let timeoutId = 0;

      if (!total) {
        setCounter(100);
        resolve();
        return;
      }

      const updateProgress = () => {
        const progress = (completed.size / total) * 100;

        gsap.to(counterState, {
          value: progress,
          duration: 0.24,
          ease: "power1.out",
          overwrite: true,
          onUpdate: () => setCounter(counterState.value),
        });

        if (completed.size >= total) {
          window.clearTimeout(timeoutId);
          resolve();
        }
      };

      const markComplete = (media) => {
        if (completed.has(media)) {
          return;
        }

        completed.add(media);
        updateProgress();
      };

      mediaElements.forEach((media) => {
        if (media instanceof HTMLImageElement) {
          media.loading = "eager";
          media.addEventListener("load", () => markComplete(media), { once: true, signal });
          media.addEventListener("error", () => markComplete(media), { once: true, signal });

          if (media.complete) {
            window.queueMicrotask(() => markComplete(media));
          }
          return;
        }

        media.preload = "auto";
        media.addEventListener("loadeddata", () => markComplete(media), { once: true, signal });
        media.addEventListener("error", () => markComplete(media), { once: true, signal });

        if (media.readyState >= 2) {
          window.queueMicrotask(() => markComplete(media));
        } else {
          media.load?.();
        }
      });

      timeoutId = window.setTimeout(() => {
        mediaElements.forEach(markComplete);
      }, 12000);
    });

    return mediaReadyPromise;
  };

  const initCardVideos = () => {
    cardVideos.forEach((video) => {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      const playPromise = video.play();

      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    });
  };

  const initGrid = () => {
    if (infiniteGrid) {
      return infiniteGrid;
    }

    infiniteGrid = createInfiniteGrid(gridViewport);
    infiniteGrid?.setEnabled(false);
    initCardVideos();
    return infiniteGrid;
  };

  const setBackgroundNameState = (initialsOnly) => {
    if (!backgroundNameEffect) {
      return;
    }

    const removedLetters = backgroundNameEffect.letters
      .filter(({ isProtected }) => !isProtected)
    const removedLetterTargets = removedLetters.map(({ element }) => element);
    const spaces = backgroundNameEffect.spaces;
    const spaceTargets = spaces.map(({ element }) => element);

    gsap.set(removedLetterTargets, {
      autoAlpha: initialsOnly ? 0 : 1,
      width: (index) => initialsOnly ? 0 : removedLetters[index].width,
    });
    gsap.set(spaceTargets, {
      autoAlpha: initialsOnly ? 0 : 1,
      width: (index) => initialsOnly ? 0 : spaces[index].width,
    });
  };

  const animateBackgroundName = (initialsOnly) => {
    if (!backgroundNameEffect || isBackgroundInitials === initialsOnly) {
      return;
    }

    isBackgroundInitials = initialsOnly;
    backgroundNameTimeline?.kill();
    backgroundNameTimeline = null;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setBackgroundNameState(initialsOnly);
      return;
    }

    backgroundNameTimeline = gsap.timeline();
    addRandomLetterEffect({
      timeline: backgroundNameTimeline,
      gsap,
      effects: backgroundNameEffect,
      mode: initialsOnly ? "out" : "in",
      start: 0,
      totalDuration: 0.52,
      instant: true,
      preserveProtected: true,
    });
  };

  const finishWithoutMotion = () => {
    initGrid();
    setCounter(100);
    gsap.set(loader, { autoAlpha: 0 });
    gsap.set(hole, { scale: scaleToCoverViewport() });
    gsap.set(introTitle, { autoAlpha: 0 });
    gsap.set(hero, { autoAlpha: 0 });
    gsap.set(selectedWorkSection, { autoAlpha: 1 });
    setNavRevealed(true);
    isOpeningComplete = true;
    infiniteGrid?.setEnabled(!isPanelOpen);
    return true;
  };

  const runOpeningSequence = async () => {
    if (openingPromise) {
      return openingPromise;
    }

    openingPromise = (async () => {
      await Promise.all([waitForMedia(), wait(700)]);
      await tweenTo(counterState, {
        value: 100,
        duration: 0.28,
        ease: "power1.out",
        overwrite: true,
        onUpdate: () => setCounter(counterState.value),
      });

      initGrid();
      gsap.set(selectedWorkSection, { autoAlpha: 1 });

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return finishWithoutMotion();
      }

      openingTimeline = gsap.timeline({
        onComplete: () => {
          gsap.set(hero, { autoAlpha: 0 });
          isOpeningComplete = true;
          infiniteGrid?.setEnabled(!isPanelOpen);
        },
      });

      openingTimeline.to(loader, {
        autoAlpha: 0,
        duration: 0.22,
        ease: "power2.out",
      }, 0);

      openingTimeline.to(hole, {
        scale: scaleToCoverViewport,
        duration: 1.42,
        ease: "power3.inOut",
        force3D: true,
      }, 0.03);

      addRandomLetterEffect({
        timeline: openingTimeline,
        gsap,
        effects: introLetterEffects[0],
        mode: "out",
        start: 0.08,
        totalDuration: 0.56,
        instant: true,
      });

      addRandomLetterEffect({
        timeline: openingTimeline,
        gsap,
        effects: introLetterEffects[1],
        mode: "out",
        start: 0.1,
        totalDuration: 0.48,
        instant: true,
      });

      openingTimeline.call(() => setNavRevealed(true), [], 0.52);

      addRandomLetterEffect({
        timeline: openingTimeline,
        gsap,
        effects: navLetterEffects,
        mode: "in",
        start: 0.5,
        totalDuration: 0.58,
        letterDuration: 0.04,
        ease: "power2.out",
      });

      await new Promise((resolve) => {
        openingTimeline.eventCallback("onComplete", () => {
          gsap.set(hero, { autoAlpha: 0 });
          isOpeningComplete = true;
          infiniteGrid?.setEnabled(!isPanelOpen);
          resolve(true);
        });
      });

      return true;
    })();

    return openingPromise;
  };

  const destroy = () => {
    abortController.abort();
    openingTimeline?.kill();
    openingTimeline = null;
    backgroundNameTimeline?.kill();
    backgroundNameTimeline = null;
    infiniteGrid?.destroy();
    infiniteGrid = null;
    introLetterEffects.forEach((effect) => effect.destroy());
    navLetterEffects.forEach((effect) => effect.destroy());
    backgroundNameEffect?.destroy();
    introLetterEffects = [];
    navLetterEffects = [];
    backgroundNameEffect = null;
    gsap?.killTweensOf(counterState);
    gsap?.killTweensOf([loader, hole, hero, selectedWorkSection, siteNav]);
    gsap?.set([loader, hole, hero, selectedWorkSection, siteNav], { clearProps: "opacity,visibility,transform" });
    setNavRevealed(false);
    body.classList.remove("home-grid-active");

    if (window[homeRevealApiKey]) {
      delete window[homeRevealApiKey];
    }
  };

  if (!gsap || !hero || !hole || !introTitle || !loader || !loaderCounter || !selectedWorkSection || !gridViewport || !siteNav) {
    setNavRevealed(true);
    return { destroy };
  }

  body.classList.add("home-grid-active");
  setNavRevealed(false);
  setCounter(0);
  gsap.set(hero, { autoAlpha: 1 });
  gsap.set(hole, { scale: 1 });
  gsap.set(loader, { autoAlpha: 1 });
  gsap.set(selectedWorkSection, { autoAlpha: 0 });

  introLetterEffects = [introName, introRole]
    .map((element) => createReflowText(element, {
      collapse: true,
      protectWordInitials: true,
    }))
    .filter(Boolean);
  backgroundNameEffect = createReflowText(backgroundName, {
    collapse: true,
    protectWordInitials: true,
  });
  navLetterEffects = navTextTargets
    .map((element) => createReflowText(element, {
      collapse: true,
      reserveElementWidth: true,
    }))
    .filter(Boolean);

  root.addEventListener("site:home-panel-state", (event) => {
    isPanelOpen = Boolean(event.detail?.open);
    animateBackgroundName(isPanelOpen);
    infiniteGrid?.setPanelOpen(isPanelOpen);

    if (!isPanelOpen && isOpeningComplete) {
      infiniteGrid?.setEnabled(true);
    }
  }, { signal });

  if (homeLink && window.location.pathname === new URL(homeLink.href, window.location.href).pathname) {
    homeLink.addEventListener("click", (event) => {
      const targetUrl = new URL(homeLink.href, window.location.href);
      const isSameDocument = targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search;

      if (isSameDocument) {
        event.preventDefault();
      }
    }, { signal });
  }

  window[homeRevealApiKey] = () => runOpeningSequence();
  runOpeningSequence();

  return {
    destroy,
    reveal: runOpeningSequence,
    prepareRevealForTransition: async () => {
      await runOpeningSequence();
    },
    animateEnter: runOpeningSequence,
  };
}
