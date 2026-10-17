/** Set while an editor with unsaved changes is mounted. */
let askBeforeLeaving: ((run: () => void) => void) | null = null;

/** Lets an editor with unsaved changes confirm `leaveSafely` calls first. */
export function setLeaveHandler(handler: ((run: () => void) => void) | null) {
  askBeforeLeaving = handler;
}

export function getLeaveHandler() {
  return askBeforeLeaving;
}

/**
 * Runs `leave` now, or once the author confirms leaving unsaved changes. For
 * code which navigates away without a link, such as logging out.
 */
export function leaveSafely(leave: () => void) {
  if (askBeforeLeaving === null) {
    leave();
  } else {
    askBeforeLeaving(leave);
  }
}
