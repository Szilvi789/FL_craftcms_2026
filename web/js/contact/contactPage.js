export function initContactPage(root = document) {
  const page = root.querySelector("[data-contact-page]");
  const panel = page?.querySelector("[data-contact-form-panel]");
  const content = page?.querySelector(".contact-page__content");
  const transitionWindow = document.querySelector(".page-transition__window");
  const html = document.documentElement;
  const gsap = window.gsap;

  if (!page || !panel) {
    return null;
  }

  const stageTargets = [content, panel].filter(Boolean);
  const ENTER_OFFSET_Y = 44;
  const LEAVE_OFFSET_Y = 44;
  const LEAVE_DURATION = 0.42;
  let autoOpenTimer = 0;
  let hasScheduledAutoOpen = false;
  let isEntranceStaged = false;

  const tweenTo = (targets, vars) => {
    if (!gsap || !targets.length) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      gsap.to(targets, {
        ...vars,
        onComplete: resolve,
        onInterrupt: resolve,
      });
    });
  };

  const syncBoxSize = () => {
    const measuredSize = transitionWindow?.getBoundingClientRect?.().width;
    const panelRect = panel.getBoundingClientRect();

    if (!measuredSize || !Number.isFinite(measuredSize)) {
      return;
    }

    const panelSize = Math.min(panelRect.width || 0, panelRect.height || 0);

    if (!panelSize) {
      return;
    }

    page.style.setProperty("--contact-form-scale", `${measuredSize / panelSize}`);
  };

  const setOpen = (open) => {
    page.dataset.contactFormOpen = open ? "true" : "false";
    page.classList.toggle("is-form-open", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
  };

  const isOpen = () => page.dataset.contactFormOpen === "true";

  const scheduleAutoOpen = (delay = 220) => {
    if (hasScheduledAutoOpen || isOpen()) {
      return Promise.resolve();
    }

    hasScheduledAutoOpen = true;

    return new Promise((resolve) => {
      autoOpenTimer = window.setTimeout(() => {
        autoOpenTimer = 0;
        setOpen(true);
        resolve();
      }, delay);
    });
  };

  const stageEntrance = () => {
    if (!gsap || isOpen() || !html.classList.contains("is-barba-transitioning")) {
      return;
    }

    isEntranceStaged = true;
    gsap.killTweensOf(stageTargets);
    gsap.set(stageTargets, {
      autoAlpha: 0,
      y: ENTER_OFFSET_Y,
      force3D: true,
    });
  };

  const runEntrance = () => {
    if (!isEntranceStaged) {
      return Promise.resolve();
    }

    isEntranceStaged = false;

    return tweenTo(stageTargets, {
      autoAlpha: 1,
      y: 0,
      duration: 0.72,
      ease: "power2.out",
      stagger: 0.08,
      clearProps: "opacity,visibility,transform",
    });
  };

  const runLeave = () => {
    if (!gsap || !stageTargets.length) {
      return Promise.resolve();
    }

    gsap.killTweensOf(stageTargets);

    return tweenTo(stageTargets, {
      autoAlpha: 0,
      y: LEAVE_OFFSET_Y,
      duration: LEAVE_DURATION,
      ease: "power2.inOut",
      stagger: 0.03,
    });
  };

  setOpen(isOpen());
  syncBoxSize();
  stageEntrance();

  if (!isOpen() && !html.classList.contains("is-barba-transitioning")) {
    scheduleAutoOpen(260);
  }

  window.addEventListener("resize", syncBoxSize);

  return {
    async animateEnter() {
      const hadStagedEntrance = isEntranceStaged;

      await runEntrance();
      await scheduleAutoOpen(hadStagedEntrance ? 140 : 180);
    },
    async animateLeave() {
      if (autoOpenTimer) {
        window.clearTimeout(autoOpenTimer);
        autoOpenTimer = 0;
      }

      await runLeave();
    },
    destroy() {
      if (autoOpenTimer) {
        window.clearTimeout(autoOpenTimer);
        autoOpenTimer = 0;
      }

      if (gsap) {
        gsap.killTweensOf(stageTargets);
      }

      window.removeEventListener("resize", syncBoxSize);
    },
  };
}
