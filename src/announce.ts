/**
 * What's said aloud as stickers are handled from the keyboard: one polite live region for the
 * page, out of sight, there from the first sticker (a region has to be in the page before what it
 * says changes, or it isn't read) and gone with the last.
 */

let region: HTMLElement | null = null;
let users = 0;
let timer = 0;

/** Keeps the page's region while a sticker needs it. Returns a function to let go of it. */
export function keepRegion(): () => void {
  if (typeof document === "undefined") return () => {};
  users++;
  if (!region) {
    region = document.createElement("div");
    region.dataset.stickerAnnouncer = "";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    Object.assign(region.style, { position: "absolute", width: "1px", height: "1px", margin: "-1px", padding: "0", overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap", border: "0" });
    document.body.appendChild(region);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    users--;
    if (users > 0 || !region) return;
    clearTimeout(timer);
    region.remove();
    region = null;
  };
}

/** Says `words`: emptied first and written a moment later, so the same words twice are read twice. */
export function announce(words: string) {
  if (!region || !words) return;
  const said = region;
  said.textContent = "";
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    said.textContent = words;
  }, 50);
}
