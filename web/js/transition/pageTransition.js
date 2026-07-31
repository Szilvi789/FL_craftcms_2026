export function initPageTransition({ mountPage, destroyCurrentPage, getActivePageApi }) {
  const barba = window.barba;
  const gsap = window.gsap;
  const html = document.documentElement;
  const transitionRoot = document.querySelector(".page-transition");
  const transitionWindow = transitionRoot?.querySelector(".page-transition__window");

  if (
    typeof mountPage !== "function" ||
    typeof destroyCurrentPage !== "function" ||
    typeof getActivePageApi !== "function"
  ) {
    return;
  }

  if (!barba || !gsap || !transitionRoot || !transitionWindow || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const NAV_OUT_DURATION = 420;
  const NAV_IN_DURATION = 420;
  const COVER_CLOSE_DURATION = 2000;
  const PAGE_CHANGE_HOLD_DURATION = 1000;
  const COVER_OPEN_DURATION = 2000;
  let isTransitioning = false;

  const wait = (ms) => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

  const nextFrame = () => new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });

  const tweenTo = (target, vars) => new Promise((resolve) => {
    gsap.to(target, {
      ...vars,
      onComplete: resolve,
      onInterrupt: resolve,
    });
  });

  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;

  const exitFullscreenIfNeeded = async () => {
    if (!fullscreenElement()) {
      return;
    }

    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } catch (error) {
      return;
    }
  };

  const getCoverScale = (oversizeMultiplier = 1) => {
    const rect = transitionWindow.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxDistance = Math.max(
      Math.hypot(centerX, centerY),
      Math.hypot(window.innerWidth - centerX, centerY),
      Math.hypot(centerX, window.innerHeight - centerY),
      Math.hypot(window.innerWidth - centerX, window.innerHeight - centerY)
    );

    return Math.max(1, ((maxDistance * 2) / rect.width) * oversizeMultiplier);
  };

  const getContainerNav = (container) => container?.querySelector(".site-nav") || null;
  const getNavAnimationTargets = (siteNav) => {
    if (!siteNav) {
      return [];
    }

    if (siteNav.classList.contains("site-nav--behavior-home-reveal")) {
      return [siteNav];
    }

    return Array.from(siteNav.querySelectorAll(".site-nav__link, .site-nav__button"));
  };
  const normalizeHash = (hash = "") => {
    if (!hash) {
      return "";
    }

    return hash.startsWith("#") ? hash : `#${hash}`;
  };

  const animateNavOut = async (container) => {
    const siteNav = getContainerNav(container);
    const targets = getNavAnimationTargets(siteNav);

    if (!siteNav || !targets.length) {
      return;
    }

    gsap.killTweensOf(targets);
    gsap.set(targets, {
      autoAlpha: 1,
    });

    await tweenTo(targets, {
      autoAlpha: 0,
      duration: NAV_OUT_DURATION / 1000,
      ease: "power2.inOut",
    });
  };

  const animateNavIn = async (container) => {
    const siteNav = getContainerNav(container);
    const targets = getNavAnimationTargets(siteNav);

    if (!siteNav || !targets.length) {
      return;
    }

    gsap.killTweensOf(targets);
    gsap.set(targets, {
      autoAlpha: 0,
    });

    await tweenTo(targets, {
      autoAlpha: 1,
      duration: NAV_IN_DURATION / 1000,
      ease: "power2.inOut",
    });

    gsap.set(targets, {
      clearProps: "opacity,visibility,transform",
    });
  };

  const resetTransitionState = () => {
    transitionRoot.classList.remove("is-active");
    html.classList.remove("is-barba-transitioning");
    gsap.killTweensOf(transitionWindow);
    gsap.set(transitionWindow, {
      clearProps: "transform",
    });
    isTransitioning = false;
  };

  const closeCover = async () => {
    const coverScale = getCoverScale(1.35);
    gsap.killTweensOf(transitionWindow);
    gsap.set(transitionWindow, {
      scale: coverScale,
      force3D: true,
    });
    transitionRoot.classList.add("is-active");
    html.classList.add("is-barba-transitioning");
    await nextFrame();

    await tweenTo(transitionWindow, {
      scale: 1,
      duration: COVER_CLOSE_DURATION / 1000,
      ease: "power2.inOut",
    });
  };

  const openCover = async () => {
    const coverScale = getCoverScale(1.35);

    await tweenTo(transitionWindow, {
      scale: coverScale,
      duration: COVER_OPEN_DURATION / 1000,
      ease: "power2.inOut",
    });

    transitionRoot.classList.remove("is-active");
    html.classList.remove("is-barba-transitioning");
    gsap.set(transitionWindow, {
      clearProps: "transform",
    });
  };

  const syncDocumentTitle = (nextHtml) => {
    if (!nextHtml) {
      return;
    }

    const parsedDocument = new DOMParser().parseFromString(nextHtml, "text/html");

    if (parsedDocument.title) {
      document.title = parsedDocument.title;
    }
  };

  const shouldRevealHome = (current, next, trigger) => {
    const nextHash = normalizeHash(next?.url?.hash || "");
    const triggeredFromHomeLink = Boolean(trigger?.classList?.contains("site-home-link"));
    const comingFromAnotherPage = Boolean(current?.namespace && current.namespace !== "home");

    return next?.namespace === "home" && (
      nextHash === "#home-reveal" ||
      triggeredFromHomeLink ||
      comingFromAnotherPage
    );
  };

  barba.init({
    preventRunning: true,
    prevent: ({ href }) => {
      if (!href) {
        return true;
      }

      const url = new URL(href, window.location.href);
      return (
        url.origin !== window.location.origin ||
        (url.pathname === window.location.pathname && url.search === window.location.search)
      );
    },
    transitions: [{
      name: "site-transition",
      async leave(data) {
        try {
          isTransitioning = true;
          await exitFullscreenIfNeeded();
          const currentPageApi = getActivePageApi();

          if (currentPageApi && typeof currentPageApi.beforeLeave === "function") {
            await currentPageApi.beforeLeave();
          }

          await Promise.all([
            animateNavOut(data.current.container),
            currentPageApi && typeof currentPageApi.animateLeave === "function"
              ? currentPageApi.animateLeave()
              : Promise.resolve(),
          ]);

          await closeCover();
          destroyCurrentPage();
          data.current.container.remove();
        } catch (error) {
          resetTransitionState();
          throw error;
        }
      },
      async enter(data) {
        let pageApi = null;

        try {
          syncDocumentTitle(data.next?.html);
          const nextNav = getContainerNav(data.next.container);
          const nextNavTargets = getNavAnimationTargets(nextNav);

          if (nextNavTargets.length) {
            gsap.set(nextNavTargets, {
              autoAlpha: 0,
              y: -24,
            });
          }

          pageApi = mountPage(data.next.container);

          if (pageApi && typeof pageApi.prepareEnterForTransition === "function") {
            pageApi.prepareEnterForTransition();
          }

          if (
            shouldRevealHome(data.current, data.next, data.trigger) &&
            pageApi &&
            typeof pageApi.prepareRevealForTransition === "function"
          ) {
            await pageApi.prepareRevealForTransition();
            await nextFrame();
          }

          await wait(PAGE_CHANGE_HOLD_DURATION);
          await openCover();

          if (data.next.namespace !== "home") {
            await Promise.all([
              animateNavIn(data.next.container),
              pageApi && typeof pageApi.animateEnter === "function"
                ? pageApi.animateEnter()
                : Promise.resolve(),
            ]);
          } else if (pageApi && typeof pageApi.animateEnter === "function") {
            await pageApi.animateEnter();
          }

          isTransitioning = false;
        } catch (error) {
          resetTransitionState();
          throw error;
        }
      },
    }],
  });

  window.addEventListener("beforeunload", () => {
    if (!isTransitioning) {
      return;
    }

    html.classList.remove("is-barba-transitioning");
  });
}
