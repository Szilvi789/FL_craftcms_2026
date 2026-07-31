const clamp = (minimum, value, maximum) => Math.min(maximum, Math.max(minimum, value));

const wrapCentered = (value, size) => {
  if (!size) {
    return value;
  }

  const wrapped = (((value + (size / 2)) % size) + size) % size;
  return wrapped - (size / 2);
};

export function createInfiniteGrid(viewport) {
  const gsap = window.gsap;
  const container = viewport?.querySelector("[data-home-infinite-container]");
  const grid = container?.querySelector("[data-home-infinite-grid-scene]");
  const sourceCells = Array.from(grid?.querySelectorAll("[data-home-grid-cell]") || []);

  if (!viewport || !container || !grid || !sourceCells.length) {
    return null;
  }

  const getMediaAspectRatio = (cell) => {
    const activeImage = cell.querySelector("img");
    const video = cell.querySelector("video");

    if (activeImage?.naturalWidth && activeImage?.naturalHeight) {
      return activeImage.naturalWidth / activeImage.naturalHeight;
    }

    if (video?.videoWidth && video?.videoHeight) {
      return video.videoWidth / video.videoHeight;
    }

    return 4 / 5;
  };

  sourceCells.forEach((cell, index) => {
    cell.dataset.homeGridSource = String(index);
  });

  const abortController = new AbortController();
  const { signal } = abortController;
  const cameraOffset = { x: 0, y: 0 };
  const targetOffset = { x: 0, y: 0 };
  const pointer = {
    active: false,
    id: null,
    startX: 0,
    startY: 0,
    previousX: 0,
    previousY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    velocityX: 0,
    velocityY: 0,
    distance: 0,
    dragged: false,
  };
  const sourceAspects = sourceCells.map(getMediaAspectRatio);
  const sourceTemplates = sourceCells.map((cell) => cell.cloneNode(true));
  let records = [];
  let itemWidth = 0;
  let maximumItemHeight = 0;
  let pitchX = 0;
  let pitchY = 0;
  let gridWidth = 0;
  let gridHeight = 0;
  let columnCount = 0;
  let rowCount = 0;
  let resizeFrame = 0;
  let enabled = false;
  let panelOpen = false;
  let animationFrame = 0;
  let suppressClick = false;

  const prepareClone = (clone, index) => {
    clone.dataset.homeGridClone = "true";
    clone.dataset.homeGridSource = String(index % sourceTemplates.length);
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("a, button, input, select, textarea, video").forEach((element) => {
      element.setAttribute("tabindex", "-1");
    });
    return clone;
  };

  const syncCellCount = (targetCount) => {
    let cells = Array.from(grid.querySelectorAll("[data-home-grid-cell]"));

    while (cells.length < targetCount) {
      const sourceIndex = cells.length % sourceTemplates.length;
      const clone = prepareClone(sourceTemplates[sourceIndex].cloneNode(true), sourceIndex);
      grid.appendChild(clone);
      cells.push(clone);
    }

    while (cells.length > targetCount && cells[cells.length - 1]?.dataset.homeGridClone === "true") {
      cells.pop().remove();
    }

    return cells;
  };

  const updateItemPositions = () => {
    records.forEach((record) => {
      const x = wrapCentered(record.baseX - cameraOffset.x, gridWidth);
      const y = wrapCentered(record.baseY - cameraOffset.y, gridHeight);
      record.cell.style.transform = `translate3d(${(x - (record.width / 2)).toFixed(2)}px, ${(y - (record.height / 2)).toFixed(2)}px, 0)`;
    });
  };

  const animate = () => {
    const deltaX = targetOffset.x - cameraOffset.x;
    const deltaY = targetOffset.y - cameraOffset.y;

    if (Math.abs(deltaX) > 0.01 || Math.abs(deltaY) > 0.01) {
      cameraOffset.x += deltaX * 0.105;
      cameraOffset.y += deltaY * 0.105;
      updateItemPositions();
    }

    animationFrame = window.requestAnimationFrame(animate);
  };

  const layout = () => {
    const rect = viewport.getBoundingClientRect();
    const viewportWidth = Math.max(1, rect.width || window.innerWidth);
    const viewportHeight = Math.max(1, rect.height || window.innerHeight);
    const compact = viewportWidth < 700;

    itemWidth = compact
      ? clamp(145, viewportWidth * 0.46, 205)
      : clamp(165, viewportWidth * 0.17, 265);
    maximumItemHeight = Math.max(...sourceAspects.map((aspect) => itemWidth / aspect));
    pitchX = itemWidth + clamp(76, viewportWidth * 0.085, 148);
    pitchY = maximumItemHeight + clamp(84, viewportHeight * 0.12, 148);
    columnCount = Math.max(5, Math.ceil(viewportWidth / pitchX) + 2);
    rowCount = Math.max(5, Math.ceil(viewportHeight / pitchY) + 2);

    while ((columnCount * rowCount) < sourceCells.length) {
      rowCount += 1;
    }

    gridWidth = columnCount * pitchX;
    gridHeight = rowCount * pitchY;

    const cells = syncCellCount(columnCount * rowCount);
    const centerColumn = (columnCount - 1) / 2;
    const centerRow = (rowCount - 1) / 2;

    records = cells.map((cell, index) => {
      const column = index % columnCount;
      const row = Math.floor(index / columnCount);
      const sourceIndex = Number.parseInt(cell.dataset.homeGridSource || `${index % sourceAspects.length}`, 10);
      const aspect = sourceAspects[sourceIndex] || (4 / 5);
      const height = itemWidth / aspect;
      cell.style.width = `${itemWidth}px`;
      cell.style.height = `${height}px`;

      return {
        cell,
        baseX: (column - centerColumn) * pitchX,
        baseY: (row - centerRow) * pitchY,
        width: itemWidth,
        height,
      };
    });

    updateItemPositions();
  };

  const onWheel = (event) => {
    if (!enabled || panelOpen) {
      return;
    }

    event.preventDefault();
    const multiplier = event.deltaMode === 1 ? 16 : (event.deltaMode === 2 ? window.innerHeight : 1);
    const horizontalDelta = event.shiftKey && Math.abs(event.deltaX) < Math.abs(event.deltaY)
      ? event.deltaY
      : event.deltaX;

    targetOffset.x += horizontalDelta * multiplier;
    targetOffset.y += event.deltaY * multiplier;
  };

  const onPointerDown = (event) => {
    if (!enabled || panelOpen || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    pointer.active = true;
    pointer.id = event.pointerId;
    pointer.startX = event.clientX;
    pointer.startY = event.clientY;
    pointer.previousX = event.clientX;
    pointer.previousY = event.clientY;
    pointer.startOffsetX = targetOffset.x;
    pointer.startOffsetY = targetOffset.y;
    pointer.velocityX = 0;
    pointer.velocityY = 0;
    pointer.distance = 0;
    pointer.dragged = false;
    suppressClick = false;
  };

  const onPointerMove = (event) => {
    if (!pointer.active || event.pointerId !== pointer.id) {
      return;
    }

    const deltaX = event.clientX - pointer.previousX;
    const deltaY = event.clientY - pointer.previousY;
    pointer.previousX = event.clientX;
    pointer.previousY = event.clientY;
    pointer.velocityX = deltaX;
    pointer.velocityY = deltaY;
    pointer.distance = Math.hypot(
      event.clientX - pointer.startX,
      event.clientY - pointer.startY
    );

    if (!pointer.dragged && pointer.distance > 6) {
      pointer.dragged = true;
      viewport.classList.add("is-dragging");
      viewport.setPointerCapture?.(event.pointerId);
    }

    if (pointer.dragged) {
      targetOffset.x = pointer.startOffsetX - (event.clientX - pointer.startX);
      targetOffset.y = pointer.startOffsetY - (event.clientY - pointer.startY);
    }
  };

  const endPointer = (event) => {
    if (!pointer.active || event.pointerId !== pointer.id) {
      return;
    }

    pointer.active = false;
    pointer.id = null;
    viewport.classList.remove("is-dragging");
    if (viewport.hasPointerCapture?.(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }

    if (pointer.dragged) {
      suppressClick = true;
      targetOffset.x -= pointer.velocityX * 8;
      targetOffset.y -= pointer.velocityY * 8;
      window.setTimeout(() => {
        suppressClick = false;
      }, 0);
    }
  };

  const guardProjectNavigation = (event) => {
    if (suppressClick && event.target.closest?.("[data-home-grid-cell] a")) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }
  };

  const preventNativeDrag = (event) => {
    if (event.target.closest?.("[data-home-grid-cell]")) {
      event.preventDefault();
    }
  };

  const setEnabled = (nextEnabled) => {
    enabled = Boolean(nextEnabled) && !panelOpen;
    viewport.classList.toggle("is-grid-interactive", enabled);
    viewport.setAttribute("aria-disabled", enabled ? "false" : "true");
  };

  const setPanelOpen = (open) => {
    panelOpen = Boolean(open);
    viewport.classList.toggle("is-panel-hidden", panelOpen);

    if (panelOpen) {
      setEnabled(false);
    }

    if (gsap) {
      gsap.to(container, {
        autoAlpha: panelOpen ? 0 : 1,
        duration: panelOpen ? 0.32 : 0.4,
        ease: panelOpen ? "power2.inOut" : "power2.out",
        overwrite: true,
      });
    } else {
      container.style.opacity = panelOpen ? "0" : "1";
      container.style.visibility = panelOpen ? "hidden" : "visible";
    }
  };

  const onResize = () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(layout);
  };

  viewport.classList.add("is-flat-infinite-grid");
  viewport.setAttribute("role", "region");
  viewport.setAttribute("aria-label", "Projects. Drag, swipe, or scroll to explore, or click a photograph to open its project.");
  viewport.addEventListener("wheel", onWheel, { passive: false, signal });
  viewport.addEventListener("pointerdown", onPointerDown, { signal });
  viewport.addEventListener("pointermove", onPointerMove, { signal });
  viewport.addEventListener("pointerup", endPointer, { signal });
  viewport.addEventListener("pointercancel", endPointer, { signal });
  viewport.addEventListener("click", guardProjectNavigation, { capture: true, signal });
  viewport.addEventListener("dragstart", preventNativeDrag, { signal });
  window.addEventListener("resize", onResize, { signal });
  layout();
  animate();

  return {
    setEnabled,
    setPanelOpen,
    destroy() {
      abortController.abort();
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(resizeFrame);
      gsap?.killTweensOf(container);
      grid.querySelectorAll("[data-home-grid-clone='true']").forEach((clone) => clone.remove());
      sourceCells.forEach((cell) => {
        cell.style.removeProperty("width");
        cell.style.removeProperty("height");
        cell.style.removeProperty("transform");
      });
      container.style.removeProperty("opacity");
      container.style.removeProperty("visibility");
      container.style.removeProperty("transform");
      viewport.classList.remove("is-flat-infinite-grid", "is-grid-interactive", "is-dragging", "is-panel-hidden");
      viewport.removeAttribute("role");
      viewport.removeAttribute("aria-label");
      viewport.removeAttribute("aria-disabled");
    },
  };
}
