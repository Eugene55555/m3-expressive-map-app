/** Dispatch a bubbling, composed CustomEvent for cross-component actions. */
export function emit<T>(target: EventTarget, type: string, detail: T): void {
  target.dispatchEvent(new CustomEvent<T>(type, { detail, bubbles: true, composed: true }));
}
