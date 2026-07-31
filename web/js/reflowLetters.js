const graphemeSegmenter = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;

const splitGraphemes = (value) => {
  if (!graphemeSegmenter) {
    return Array.from(value);
  }

  return Array.from(graphemeSegmenter.segment(value), ({ segment }) => segment);
};

const shuffle = (items) => {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
};

const toEffectList = (effects) => (Array.isArray(effects) ? effects : [effects]).filter(Boolean);

export function createReflowText(element, {
  collapse = true,
  protectWordInitials = false,
  reserveElementWidth = false,
} = {}) {
  if (!element || element.childElementCount > 0) {
    return null;
  }

  const text = element.textContent.replace(/\s+/gu, " ").trim();

  if (!text) {
    return null;
  }

  const originalMarkup = element.innerHTML;
  const originalAriaLabel = element.getAttribute("aria-label");
  const originalInlineWidth = element.style.width;
  const elementWidth = element.getBoundingClientRect().width;
  const hadEffectClass = element.classList.contains("reflow-text");
  const fragment = document.createDocumentFragment();
  const letters = [];
  const spaces = [];

  text.split(" ").forEach((word, wordIndex, words) => {
    const wordElement = document.createElement("span");
    wordElement.className = "reflow-text__word";
    wordElement.setAttribute("aria-hidden", "true");

    splitGraphemes(word).forEach((character, characterIndex) => {
      const letterElement = document.createElement("span");
      const isProtected = protectWordInitials && characterIndex === 0;

      letterElement.className = "reflow-letter";
      letterElement.textContent = character;
      letterElement.dataset.reflowCharacter = character;
      wordElement.appendChild(letterElement);
      letters.push({
        element: letterElement,
        character,
        isProtected,
        wordIndex,
        characterIndex,
      });
    });

    fragment.appendChild(wordElement);

    if (wordIndex < words.length - 1) {
      const spaceElement = document.createElement("span");
      spaceElement.className = "reflow-text__space";
      spaceElement.setAttribute("aria-hidden", "true");
      spaceElement.textContent = " ";
      fragment.appendChild(spaceElement);
      spaces.push({ element: spaceElement });
    }
  });

  element.replaceChildren(fragment);
  element.classList.add("reflow-text");

  if (!originalAriaLabel) {
    element.setAttribute("aria-label", text);
  }

  letters.forEach((letter) => {
    const width = letter.element.getBoundingClientRect().width;
    letter.width = width;
    letter.element.style.width = `${width}px`;
  });
  spaces.forEach((space) => {
    const width = space.element.getBoundingClientRect().width;
    space.width = width;
    space.element.style.width = `${width}px`;
  });

  if (reserveElementWidth) {
    element.style.width = `${elementWidth}px`;
  }

  return {
    collapse,
    element,
    letters,
    spaces,
    destroy() {
      element.innerHTML = originalMarkup;
      element.style.width = originalInlineWidth;

      if (!hadEffectClass) {
        element.classList.remove("reflow-text");
      }

      if (originalAriaLabel === null) {
        element.removeAttribute("aria-label");
      } else {
        element.setAttribute("aria-label", originalAriaLabel);
      }
    },
  };
}

export function addRandomLetterEffect({
  timeline,
  gsap,
  effects,
  mode,
  start = 0,
  totalDuration = 0.4,
  letterDuration = 0.07,
  ease = "power2.inOut",
  instant = false,
  preserveProtected = false,
}) {
  const effectList = toEffectList(effects);
  const allLetters = effectList.flatMap((effect) => (
    effect.letters.map((letter) => ({ ...letter, collapse: effect.collapse }))
  ));
  const letters = preserveProtected
    ? allLetters.filter(({ isProtected }) => !isProtected)
    : allLetters;
  const spaces = preserveProtected
    ? effectList.flatMap((effect) => effect.spaces || [])
    : [];

  if (!timeline || !gsap || (!letters.length && !spaces.length) || !["in", "out"].includes(mode)) {
    return [];
  }

  const ordinaryLetters = shuffle(letters.filter(({ isProtected }) => !isProtected));
  const protectedLetters = shuffle(letters.filter(({ isProtected }) => isProtected));
  const orderedLetters = [...ordinaryLetters, ...protectedLetters];
  const targets = letters.map(({ element }) => element);
  const transitionDuration = instant ? 0 : letterDuration;
  const stagger = orderedLetters.length > 1
    ? Math.max(0, (totalDuration - transitionDuration) / (orderedLetters.length - 1))
    : 0;

  orderedLetters.forEach(({ element }, orderIndex) => {
    element.dataset.reflowOrder = `${orderIndex + 1}`;
  });

  if (mode === "in") {
    gsap.set(targets, {
      autoAlpha: 0,
      scaleX: instant ? 1 : 0.55,
      width: (index) => (letters[index].collapse ? 0 : letters[index].width),
      transformOrigin: "center center",
    });
  }

  orderedLetters.forEach(({ element, collapse, width }, orderIndex) => {
    const position = start + (stagger * orderIndex);
    const properties = mode === "in"
      ? {
        autoAlpha: 1,
        ...(!instant ? { scaleX: 1 } : {}),
        ...(collapse ? { width } : {}),
      }
      : {
        autoAlpha: 0,
        ...(!instant ? { scaleX: 0.55 } : {}),
        ...(collapse ? { width: 0 } : {}),
      };

    if (instant) {
      timeline.set(element, properties, position);
    } else {
      timeline.to(element, {
        ...properties,
        duration: letterDuration,
        ease,
      }, position);
    }
  });

  if (preserveProtected && spaces.length) {
    const spacesPosition = mode === "in"
      ? start
      : orderedLetters.length
        ? start + (stagger * (orderedLetters.length - 1)) + transitionDuration
        : start;
    const spaceTargets = spaces.map(({ element }) => element);
    const spaceProperties = mode === "in"
      ? {
        autoAlpha: 1,
        width: (index) => spaces[index].width,
      }
      : {
        autoAlpha: 0,
        width: 0,
      };

    if (instant) {
      timeline.set(spaceTargets, spaceProperties, spacesPosition);
    } else {
      timeline.to(spaceTargets, {
        ...spaceProperties,
        duration: letterDuration,
        ease,
      }, spacesPosition);
    }
  }

  return orderedLetters;
}
