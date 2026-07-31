export function initSiteUI(root = document) {
  const abortController = new AbortController();
  const { signal } = abortController;
  const fullscreenToggles = Array.from(root.querySelectorAll(".site-fullscreen-toggle"));
  const toggles = Array.from(root.querySelectorAll(".site-panel-toggle"));
  const siteNav = root.querySelector(".site-nav");
  let pairs = [];
  let originalNavTop = null;
  let activeHomeTrackedPanel = null;
  let lastScrollY = window.scrollY;
  let isNavHiddenByScroll = false;
  let isScrollTicking = false;
  const NAV_HIDE_TRIGGER_Y = 72;
  const NAV_SCROLL_DELTA = 8;
  const HOME_TRACKED_PANEL_FADE_DISTANCE = 220;

  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const canEnterFullscreen = () => Boolean(
    document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen
  );
  const revealHomeHero = (behavior = "smooth") => {
    if (
      !siteNav ||
      !siteNav.classList.contains("site-nav--behavior-home-reveal") ||
      typeof window.__siteHomeReveal !== "function"
    ) {
      return Promise.resolve(false);
    }

    return window.__siteHomeReveal(behavior);
  };
  const hasOpenPanel = () => pairs.some(({ panel }) => panel.classList.contains("is-open"));
  const hasScrollablePage = () => (document.documentElement.scrollHeight - window.innerHeight) > 8;
  const isHomeRevealNav = () => Boolean(siteNav?.classList.contains("site-nav--behavior-home-reveal"));
  const isTrackedPanel = (panel) => panel?.matches?.(".site-info-panel, .site-imprint-panel, .site-privacy-panel") || false;
  const isTrackedHomePanel = (panel) => isHomeRevealNav() && isTrackedPanel(panel);
  const announceHomePanelState = (open) => {
    root.dispatchEvent(new CustomEvent("site:home-panel-state", {
      detail: { open: Boolean(open) },
    }));
  };
  const resetHomeTrackedPanelState = (panel = activeHomeTrackedPanel?.panel) => {
    if (!panel) {
      activeHomeTrackedPanel = null;
      return;
    }

    panel.classList.remove("is-home-tracked-panel", "is-scroll-fading");
    panel.style.removeProperty("--site-home-panel-opacity");
    activeHomeTrackedPanel = activeHomeTrackedPanel?.panel === panel ? null : activeHomeTrackedPanel;
  };

  const syncHomeTrackedPanelFade = () => {
    if (!activeHomeTrackedPanel?.panel) {
      return false;
    }

    const distance = Math.max(0, window.scrollY - activeHomeTrackedPanel.anchorScrollY);
    const progress = Math.min(distance / HOME_TRACKED_PANEL_FADE_DISTANCE, 1);
    const opacity = Math.max(0, 1 - progress);

    activeHomeTrackedPanel.panel.style.setProperty("--site-home-panel-opacity", opacity.toFixed(3));
    activeHomeTrackedPanel.panel.classList.toggle("is-scroll-fading", progress > 0);

    return progress >= 1;
  };

  const setNavHiddenByScroll = (hidden) => {
    if (!siteNav || isNavHiddenByScroll === hidden) {
      return;
    }

    isNavHiddenByScroll = hidden;
    siteNav.classList.add("site-nav--scroll-aware");
    siteNav.classList.toggle("is-hidden-by-scroll", hidden);
  };

  const canAutoHideNav = () => {
    if (!siteNav || !hasScrollablePage() || hasOpenPanel()) {
      return false;
    }

    if (document.documentElement.classList.contains("is-barba-transitioning")) {
      return false;
    }

    if (siteNav.classList.contains("site-nav--behavior-home-reveal")) {
      return false;
    }

    return true;
  };

  const syncNavOnScroll = () => {
    if (!siteNav) {
      return;
    }

    const currentScrollY = window.scrollY;

    if (syncHomeTrackedPanelFade()) {
      closeAll();
      lastScrollY = currentScrollY;
      return;
    }

    if (isHomeRevealNav()) {
      siteNav.style.top = "";
    }

    if (!canAutoHideNav() || currentScrollY <= NAV_HIDE_TRIGGER_Y) {
      setNavHiddenByScroll(false);
      lastScrollY = currentScrollY;
      return;
    }

    if (currentScrollY > lastScrollY + NAV_SCROLL_DELTA) {
      setNavHiddenByScroll(true);
    } else if (currentScrollY < lastScrollY - NAV_SCROLL_DELTA) {
      setNavHiddenByScroll(false);
    }

    lastScrollY = currentScrollY;
  };

  const handleWindowScroll = () => {
    if (isScrollTicking) {
      return;
    }

    isScrollTicking = true;
    window.requestAnimationFrame(() => {
      syncNavOnScroll();
      isScrollTicking = false;
    });
  };

  const syncFullscreenButtons = () => {
    if (!fullscreenToggles.length) {
      return;
    }

    const isFullscreen = Boolean(fullscreenElement());

    fullscreenToggles.forEach((toggle) => {
      toggle.setAttribute("aria-pressed", isFullscreen ? "true" : "false");
      toggle.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
      toggle.setAttribute("title", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
    });
  };

  if (fullscreenToggles.length) {
    if (!canEnterFullscreen()) {
      fullscreenToggles.forEach((toggle) => {
        toggle.hidden = true;
      });
    } else {
      fullscreenToggles.forEach((toggle) => {
        toggle.addEventListener("click", async () => {
          try {
            if (fullscreenElement()) {
              if (document.exitFullscreen) {
                await document.exitFullscreen();
              } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
              }
            } else if (document.documentElement.requestFullscreen) {
              await document.documentElement.requestFullscreen();
            } else if (document.documentElement.webkitRequestFullscreen) {
              document.documentElement.webkitRequestFullscreen();
            }
          } catch (error) {
            console.error("Fullscreen toggle failed", error);
          } finally {
            syncFullscreenButtons();
          }
        }, { signal });
      });

      document.addEventListener("fullscreenchange", syncFullscreenButtons, { signal });
      document.addEventListener("webkitfullscreenchange", syncFullscreenButtons, { signal });
      syncFullscreenButtons();
    }
  }

  if (siteNav) {
    siteNav.classList.add("site-nav--scroll-aware");
    syncNavOnScroll();
    window.addEventListener("scroll", handleWindowScroll, { passive: true, signal });
    window.addEventListener("resize", syncNavOnScroll, { signal });
  }

  if (!toggles.length) {
    return () => {
      if (siteNav) {
        siteNav.classList.remove("site-nav--scroll-aware", "is-hidden-by-scroll");
      }
      abortController.abort();
    };
  }

  pairs = toggles
    .map((toggle) => {
      const panelId = toggle.getAttribute("aria-controls");
      const panel = panelId ? root.querySelector(`#${panelId}`) : null;
      return panel ? { toggle, panel } : null;
    })
    .filter(Boolean);

  if (!pairs.length) {
    return () => {
      abortController.abort();
    };
  }

  const isPhoneViewport = () => window.matchMedia("(max-width: 500px)").matches;

  const resetNavPosition = () => {
    if (!siteNav || originalNavTop === null) {
      return;
    }

    siteNav.style.top = originalNavTop;
    originalNavTop = null;
  };

  const moveNavIntoView = () => {
    if (!siteNav || !isPhoneViewport()) {
      return;
    }

    const desiredTop = 14;
    const computedTop = Number.parseFloat(window.getComputedStyle(siteNav).top);
    const currentTop = Number.isNaN(computedTop) ? 0 : computedTop;
    const rect = siteNav.getBoundingClientRect();
    const topDelta = desiredTop - rect.top;

    if (Math.abs(topDelta) < 1) {
      return;
    }

    if (originalNavTop === null) {
      originalNavTop = siteNav.style.top;
    }

    siteNav.style.top = `${currentTop + topDelta}px`;
  };

  const closeAll = ({ announce = true } = {}) => {
    pairs.forEach(({ toggle, panel }) => {
      toggle.setAttribute("aria-expanded", "false");
      panel.setAttribute("aria-hidden", "true");
      panel.classList.remove("is-open");
      resetHomeTrackedPanelState(panel);
    });

    resetNavPosition();
    if (announce) {
      announceHomePanelState(false);
    }
    syncNavOnScroll();
  };

  const setOpen = async (selectedToggle, open) => {
    const selectedPair = pairs.find(({ toggle }) => toggle === selectedToggle);
    closeAll({ announce: false });
    announceHomePanelState(Boolean(open && selectedPair && isTrackedHomePanel(selectedPair.panel)));

    if (!open) {
      return;
    }

    await revealHomeHero("smooth");

    if (!selectedPair) {
      announceHomePanelState(false);
      return;
    }

    selectedPair.toggle.setAttribute("aria-expanded", "true");
    selectedPair.panel.setAttribute("aria-hidden", "false");
    selectedPair.panel.classList.add("is-open");
    setNavHiddenByScroll(false);

    if (isTrackedHomePanel(selectedPair.panel)) {
      activeHomeTrackedPanel = {
        panel: selectedPair.panel,
        anchorScrollY: window.scrollY,
      };
      selectedPair.panel.classList.add("is-home-tracked-panel");
      selectedPair.panel.style.setProperty("--site-home-panel-opacity", "1");
      syncNavOnScroll();
      return;
    }

    moveNavIntoView();
  };

  pairs.forEach(({ toggle, panel }) => {
    toggle.addEventListener("click", async () => {
      await setOpen(toggle, !panel.classList.contains("is-open"));
    }, { signal });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAll();
    }
  }, { signal });

  document.addEventListener("click", (event) => {
    const clickedToggle = pairs.some(({ toggle }) => toggle.contains(event.target));
    const clickedPanel = pairs.some(({ panel }) => panel.contains(event.target));

    if (!clickedToggle && !clickedPanel) {
      closeAll();
    }
  }, { signal });

  window.addEventListener("resize", () => {
    const openPair = pairs.find(({ panel }) => panel.classList.contains("is-open"));

    if (!openPair) {
      syncNavOnScroll();
      return;
    }

    if (isTrackedHomePanel(openPair.panel)) {
      syncNavOnScroll();
      return;
    }

    if (!isPhoneViewport()) {
      resetNavPosition();
      return;
    }

    moveNavIntoView();
  }, { signal });

  return () => {
    closeAll();
    if (siteNav) {
      siteNav.classList.remove("site-nav--scroll-aware", "is-hidden-by-scroll");
    }
    abortController.abort();
  };
}
