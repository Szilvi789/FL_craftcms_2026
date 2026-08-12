export function initProjectPage(root = document) {
  const abortController = new AbortController();
  const { signal } = abortController;
  const { gsap } = window;
  const pageRoot = root.querySelector(".project");
  const heroBackgroundFrame = root.querySelector(".project-intro__background-frame");
  const primaryIntroTargets = Array.from(root.querySelectorAll(".project-intro__content > *:not(.project-description)"))
    .filter((item) => window.getComputedStyle(item).display !== "none");
  const secondaryIntroTargets = Array.from(root.querySelectorAll(".project-description, .project-link"))
    .filter((item) => window.getComputedStyle(item).display !== "none");
  const bodyTextTargets = Array.from(root.querySelectorAll(".text-block, figcaption"))
    .filter((item) => window.getComputedStyle(item).display !== "none");
  const projectVideos = Array.from(root.querySelectorAll(".project video"));
  const ENTER_OFFSET_Y = -44;
  const ENTER_DURATION = 0.75;
  const LEAVE_DURATION = 0.4;
  const SCROLL_TO_TOP_DURATION = 0.8;
  const HERO_EXPAND_DURATION = 0.82;
  let isPreparedForTransition = false;
  let hasRunEnterAnimation = false;
  const getAnimatedTargets = () => Array
    .from(root.querySelectorAll(".project-intro__content > *, .text-block, figcaption"))
    .filter((item) => window.getComputedStyle(item).display !== "none");

  const tweenTo = (target, vars) => new Promise((resolve) => {
    if (!gsap || !target || (Array.isArray(target) && target.length === 0)) {
      resolve();
      return;
    }

    gsap.to(target, {
      ...vars,
      onComplete: resolve,
      onInterrupt: resolve,
    });
  });

  const animateScrollToTop = async () => {
    if (!gsap) {
      window.scrollTo(0, 0);
      return;
    }

    const currentScrollY = window.scrollY;

    if (currentScrollY <= 1) {
      window.scrollTo(0, 0);
      return;
    }

    const scrollState = { y: currentScrollY };

    await tweenTo(scrollState, {
      y: 0,
      duration: SCROLL_TO_TOP_DURATION,
      ease: "power3.inOut",
      onUpdate: () => {
        window.scrollTo(0, scrollState.y);
      },
    });

    window.scrollTo(0, 0);
  };

  const setEnterStartState = () => {
    const targets = getAnimatedTargets();

    pageRoot?.classList.add("project--transition-prep");

    if (!gsap || !targets.length) {
      return;
    }

    gsap.killTweensOf(targets);
    gsap.set(targets, {
      autoAlpha: 0,
      y: ENTER_OFFSET_Y,
    });
  };

  const clearEnterPrepState = () => {
    pageRoot?.classList.remove("project--transition-prep");
  };

  const isDesktopLayout = () => window.matchMedia("(min-width: 901px)").matches;

  const getDockedBackgroundState = () => {
    const gutter = Math.max(window.innerWidth * 0.035, 18);
    const top = Math.max(window.innerHeight * 0.11, 84);
    const targetWidth = Math.min(window.innerWidth * 0.60, 1560);
    const targetHeight = Math.max(
      Math.min(window.innerHeight - top - gutter, window.innerHeight * 0.8),
      420
    );
    const left = Math.max(window.innerWidth - gutter - targetWidth, 0);

    return {
      top,
      left,
      width: targetWidth,
      height: targetHeight,
    };
  };

  const syncDockedBackground = () => {
    if (!gsap || !heroBackgroundFrame || !isDesktopLayout()) {
      return;
    }

    gsap.set(heroBackgroundFrame, getDockedBackgroundState());
  };

  const getFullscreenBackgroundState = () => ({
    top: 0,
    left: 0,
    right: "auto",
    bottom: "auto",
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const runEnterAnimation = async () => {
    const targets = getAnimatedTargets();

    if (!gsap || !targets.length) {
      clearEnterPrepState();
      return;
    }

    setEnterStartState();
    syncDockedBackground();

    const timeline = gsap.timeline();

    if (primaryIntroTargets.length) {
      timeline.to(primaryIntroTargets, {
        autoAlpha: 1,
        y: 0,
        duration: ENTER_DURATION,
        ease: "power2.out",
        stagger: 0.05,
      }, 0);
    }

    if (secondaryIntroTargets.length) {
      timeline.to(secondaryIntroTargets, {
        autoAlpha: 1,
        y: 0,
        duration: ENTER_DURATION,
        ease: "power2.out",
        stagger: 0.05,
      }, 0.12);
    }

    if (bodyTextTargets.length) {
      timeline.to(bodyTextTargets, {
        autoAlpha: 1,
        y: 0,
        duration: ENTER_DURATION,
        ease: "power2.out",
        stagger: 0.04,
      }, 0.08);
    }
    await new Promise((resolve) => {
      timeline.eventCallback("onComplete", resolve);
      timeline.eventCallback("onInterrupt", resolve);
    });

    clearEnterPrepState();
    gsap.set(targets, {
      clearProps: "opacity,visibility,transform",
    });
    hasRunEnterAnimation = true;
  };

  projectVideos.forEach((video) => {
    video.play().catch(() => {});
  });

  if (heroBackgroundFrame) {
    window.addEventListener("resize", () => {
      if (!hasRunEnterAnimation) {
        return;
      }

      if (!isDesktopLayout()) {
        gsap.set(heroBackgroundFrame, {
          clearProps: "top,right,bottom,left,width,height",
        });
        return;
      }

      syncDockedBackground();
    }, { signal });
  }

  if (gsap && !document.documentElement.classList.contains("is-barba-transitioning")) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!isPreparedForTransition && !hasRunEnterAnimation) {
          runEnterAnimation();
        }
      });
    });
  }

  return {
    prepareEnterForTransition() {
      isPreparedForTransition = true;
      setEnterStartState();
      syncDockedBackground();
    },
    async animateEnter() {
      isPreparedForTransition = false;
      await runEnterAnimation();
    },
    async animateLeave() {
      const targets = getAnimatedTargets();
      const timeline = gsap?.timeline();

      if (!gsap || !timeline) {
        return;
      }

      gsap.killTweensOf(targets);

      if (heroBackgroundFrame && isDesktopLayout()) {
        gsap.killTweensOf(heroBackgroundFrame);
        timeline.to(heroBackgroundFrame, {
          ...getFullscreenBackgroundState(),
          duration: HERO_EXPAND_DURATION,
          ease: "power3.inOut",
        }, 0);
      }

      if (targets.length) {
        timeline.to(targets, {
          autoAlpha: 0,
          y: ENTER_OFFSET_Y,
          duration: LEAVE_DURATION,
          ease: "power2.inOut",
          stagger: 0.025,
        }, 0);
      }

      await new Promise((resolve) => {
        timeline.eventCallback("onComplete", resolve);
        timeline.eventCallback("onInterrupt", resolve);
      });
    },
    async beforeLeave() {
      await animateScrollToTop();
    },
    destroy() {
      clearEnterPrepState();
      abortController.abort();
      if (gsap) {
        gsap.killTweensOf(getAnimatedTargets());
        if (heroBackgroundFrame) {
          gsap.killTweensOf(heroBackgroundFrame);
          gsap.set(heroBackgroundFrame, {
            clearProps: "top,right,bottom,left,width,height",
          });
        }
      }
      projectVideos.forEach((video) => {
        video.pause();
      });
    },
  };
}
