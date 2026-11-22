/** Narrower than this, the preview is a phone's. */
const PHONE_VIEWPORT = 640;

/** A page being marked is drawn at least this wide, near the statement's own type size. */
export const TEACH_PAGE_WIDTH = 600;

/**
 * The width a PDF page is drawn at in a preview `viewportWidth` wide. A phone
 * fits the whole page inside the viewport's own 20px gutters: the 520px floor
 * of wider screens made it wider than the screen, cut off. Marking a page
 * (`teaching`), a phone draws it at least TEACH_PAGE_WIDTH wide and scrolls.
 */
export function pdfPageWidth(viewportWidth: number, teaching: boolean): number {
  const width = Math.floor(viewportWidth - (viewportWidth < PHONE_VIEWPORT ? 40 : 120));
  if (viewportWidth < PHONE_VIEWPORT) {
    return teaching ? Math.max(TEACH_PAGE_WIDTH, width) : width;
  }
  return Math.max(520, Math.min(1080, width));
}
