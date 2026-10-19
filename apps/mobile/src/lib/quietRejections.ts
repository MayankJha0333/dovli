// One known, harmless error from Expo, kept out of the terminal and the error banner.
//
// When the page editor (or a whiteboard) opens, Expo sends it its settings straight away, a moment
// before its web view is ready. That first send fails with "Unable to find the 'DomWebView' view
// with tag …" (on Android: "… the class expo.modules.webview.DomWebView view with tag …"), and Expo
// sends the settings again once the web view has loaded, so nothing is lost.
// The failed send is a promise nobody waits on, so React Native reports it as an uncaught error.
//
// Every other unhandled promise error is reported exactly as React Native does it; only this one
// message is skipped.

const NOISE = /Unable to find the (?:'DomWebView'|class [\w.]*DomWebView) view with tag/;

type Options = { allRejections?: boolean; onUnhandled: (id: number, rejection?: unknown) => void; onHandled: (id: number) => void };
type Reporter = { reportError?: (error: Error) => void };

/** What React Native itself does with an unhandled promise error: report it (a red box in development). */
function report(id: number, rejection: unknown) {
  const message = rejection instanceof Error ? rejection.toString() : rejection === undefined ? "" : String(rejection);
  const error = new Error(`Uncaught (in promise, id: ${id})${message ? `: "${message}"` : ""}`, { cause: rejection });
  const utils = (globalThis as { ErrorUtils?: Reporter }).ErrorUtils;
  if (utils?.reportError) utils.reportError(error);
  else console.error(error);
}

export function quietDomWebViewRejections() {
  const hermes = (globalThis as { HermesInternal?: { enablePromiseRejectionTracker?: (o: Options) => void } }).HermesInternal;
  if (!hermes?.enablePromiseRejectionTracker) return;
  const skipped = new Set<number>();
  hermes.enablePromiseRejectionTracker({
    allRejections: true,
    onUnhandled(id, rejection) {
      // The Android wording sits in the error's "Caused by" chain, which String() includes.
      const message = rejection instanceof Error ? `${rejection.message}\n${String(rejection)}` : String(rejection ?? "");
      if (NOISE.test(message)) {
        skipped.add(id);
        return;
      }
      report(id, rejection);
    },
    onHandled(id) {
      if (skipped.delete(id)) return;
      console.warn(`Promise rejection handled (id: ${id})\nThis means you can ignore any previous messages of the form "Uncaught (in promise, id: ${id})"`);
    },
  });
}
