import { initSiteUI } from "./scripts.js?v=13";
import { initHomeHero } from "./home/homeHero.js?v=55";
import { initProjectPage } from "./project/project.js?v=5";
import { init404Gallery } from "./404/404Gallery.js?v=2";
import { initContactPage } from "./contact/contactPage.js?v=5";
import { initPageTransition } from "./transition/pageTransition.js?v=5";
import { initCustomCursor } from "./customCursor.js?v=2";

const pageInitializers = {
  home: initHomeHero,
  project: initProjectPage,
  contact: initContactPage,
  "not-found": init404Gallery,
};

let activePageApi = null;
let cleanupFns = [];

const getContainerNamespace = (container) => container?.dataset.barbaNamespace || "default";

const destroyCurrentPage = () => {
  while (cleanupFns.length) {
    const cleanup = cleanupFns.pop();

    try {
      cleanup?.();
    } catch (error) {
      console.error("Page cleanup failed", error);
    }
  }

  activePageApi = null;
};

const mountPage = (container) => {
  const namespace = getContainerNamespace(container);
  const siteUiCleanup = initSiteUI(container);
  cleanupFns.push(siteUiCleanup);

  const pageInitializer = pageInitializers[namespace];

  if (!pageInitializer) {
    activePageApi = null;
    return null;
  }

  const pageApi = pageInitializer(container);
  activePageApi = pageApi || null;

  if (typeof pageApi === "function") {
    cleanupFns.push(pageApi);
  } else if (pageApi?.destroy) {
    cleanupFns.push(() => pageApi.destroy());
  }

  return activePageApi;
};

const initialContainer = document.querySelector('[data-barba="container"]');
const initialNamespace = getContainerNamespace(initialContainer);
initCustomCursor();
const initialPageApi = mountPage(initialContainer);

if (
  initialNamespace === "home" &&
  window.location.hash === "#home-reveal" &&
  initialPageApi &&
  typeof initialPageApi.reveal === "function"
) {
  initialPageApi.reveal();
}

initPageTransition({
  mountPage,
  destroyCurrentPage,
  getActivePageApi: () => activePageApi,
});
