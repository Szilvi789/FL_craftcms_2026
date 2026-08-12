let isInitialized = false;

export function initCustomCursor() {
  if (isInitialized) {
    return;
  }

  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    return;
  }

  const cursor = document.querySelector(".site-cursor");

  if (!cursor) {
    return;
  }

  isInitialized = true;

  const interactiveSelector = [
    "a",
    "button",
    "[role='button']",
    "input",
    "textarea",
    "select",
    "summary",
    "label[for]",
  ].join(", ");
  let isVisible = false;
  let pointerX = -32;
  let pointerY = -32;
  let positionFrame = 0;

  const renderPosition = () => {
    cursor.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;
    positionFrame = 0;
  };

  const schedulePosition = (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;

    if (!positionFrame) {
      positionFrame = window.requestAnimationFrame(renderPosition);
    }
  };

  const setInteractiveState = (target) => {
    const isInteractive = Boolean(target?.closest?.(interactiveSelector));
    cursor.classList.toggle("is-active", isInteractive);
  };

  const showCursor = () => {
    if (isVisible) {
      return;
    }

    isVisible = true;
    cursor.classList.add("is-visible");
  };

  const hideCursor = () => {
    isVisible = false;
    cursor.classList.remove("is-visible", "is-active");
  };

  window.addEventListener("pointermove", (event) => {
    schedulePosition(event);
    showCursor();
    setInteractiveState(event.target);
  }, { passive: true });

  window.addEventListener("pointerdown", (event) => {
    setInteractiveState(event.target);
  }, { passive: true });

  document.documentElement.addEventListener("mouseleave", hideCursor);
  window.addEventListener("blur", hideCursor);
}
