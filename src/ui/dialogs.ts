import './confirm-dialog.ts';
import './snackbar.ts';
import type { ConfirmOptions, M3ConfirmDialog } from './confirm-dialog.ts';
import type { M3Snackbar } from './snackbar.ts';

/**
 * Create a confirmation dialog on demand. Self-contained so any component can
 * ask for confirmation without the shell owning the dialog.
 */
export async function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  const element = document.createElement('m3-confirm-dialog') as M3ConfirmDialog;
  document.body.append(element);
  try {
    return await element.ask(options);
  } finally {
    element.remove();
  }
}

let snackbarElement: M3Snackbar | null = null;

/** Show a transient message, optionally with a single action. */
export function notify(message: string, actionLabel?: string, action?: () => void): void {
  if (!snackbarElement || !snackbarElement.isConnected) {
    snackbarElement = document.createElement('m3-snackbar') as M3Snackbar;
    document.body.append(snackbarElement);
  }
  snackbarElement.show(message, actionLabel, action);
}
