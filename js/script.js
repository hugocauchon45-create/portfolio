const year = document.querySelector("[data-year]");

if (year) {
  year.textContent = new Date().getFullYear();
}

// Ouvrir les captures lorsqu’un lien de compétence pointe vers leur rubrique.
const revealEvidence = (hash) => {
  if (!hash) return;
  let target;
  try {
    target = document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return;
  }
  const section = target?.closest("details.evidence-section");
  if (section) section.open = true;
};
revealEvidence(location.hash);
window.addEventListener("hashchange", () => revealEvidence(location.hash));
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href^='#']");
  if (link) revealEvidence(link.hash);
});

const imageLinks = document.querySelectorAll(".evidence > a:has(img)");

if (imageLinks.length) {
  const preview = document.createElement("dialog");
  preview.className = "image-preview";

  const toolbar = document.createElement("div");
  toolbar.className = "image-preview__toolbar";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "image-preview__close";
  closeButton.setAttribute("aria-label", "Fermer l'aperçu");
  closeButton.textContent = "×";

  const frame = document.createElement("div");
  frame.className = "image-preview__frame";
  const fullImage = document.createElement("img");
  fullImage.draggable = false;
  frame.append(fullImage);
  toolbar.append(closeButton);
  preview.append(toolbar, frame);
  document.body.append(preview);

  imageLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const thumbnail = link.querySelector("img");
      fullImage.src = link.href;
      fullImage.alt = thumbnail?.alt || "Capture agrandie";
      preview.showModal();
    });
  });

  let dragStart = null;
  let dragged = false;

  fullImage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !preview.classList.contains("image-preview--zoomed")) return;
    dragStart = {
      x: event.clientX,
      y: event.clientY,
      left: frame.scrollLeft,
      top: frame.scrollTop,
    };
    dragged = false;
    fullImage.setPointerCapture(event.pointerId);
  });

  fullImage.addEventListener("pointermove", (event) => {
    if (!dragStart) return;
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragged = true;
    if (dragged) {
      frame.scrollLeft = dragStart.left - dx;
      frame.scrollTop = dragStart.top - dy;
    }
  });

  fullImage.addEventListener("pointerup", () => {
    dragStart = null;
  });
  fullImage.addEventListener("pointercancel", () => {
    dragStart = null;
  });
  fullImage.addEventListener("dragstart", (event) => event.preventDefault());

  fullImage.addEventListener("click", (event) => {
    if (dragged) {
      dragged = false;
      return;
    }
    if (preview.classList.contains("image-preview--zoomed")) {
      preview.classList.remove("image-preview--zoomed");
      frame.scrollTo(0, 0);
      return;
    }

    const before = fullImage.getBoundingClientRect();
    const pointX = (event.clientX - before.left) / before.width;
    const pointY = (event.clientY - before.top) / before.height;
    preview.classList.add("image-preview--zoomed");
    const after = fullImage.getBoundingClientRect();
    frame.scrollLeft += after.left + pointX * after.width - event.clientX;
    frame.scrollTop += after.top + pointY * after.height - event.clientY;
  });

  closeButton.addEventListener("click", () => preview.close());
  preview.addEventListener("close", () => {
    preview.classList.remove("image-preview--zoomed");
    dragStart = null;
    dragged = false;
    frame.scrollTo(0, 0);
    fullImage.removeAttribute("src");
  });
}
