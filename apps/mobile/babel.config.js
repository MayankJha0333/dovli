// Babel for the phone app: Expo's own preset, plus one fix for Excalidraw (whiteboards, and
// flowcharts inside pages).
//
// Expo builds DOM components (the editor and the whiteboard, which run in a web view) for old
// Android web views, so it rewrites every /…/u regular expression into an older form. Excalidraw
// glues some of those expressions together by their text (`[${a.source}${b.source}]`), and the
// rewritten text isn't valid there: the whiteboard crashed with "Invalid regular expression:
// unmatched ] or } bracket for Unicode pattern". So for Excalidraw's files only, a /…/u literal
// becomes `new RegExp("…", "u")`, which the rewrite leaves alone. Every web view the app supports
// understands these expressions as they are.

const path = require("path");

const EXCALIDRAW = `${path.sep}@excalidraw${path.sep}`;

function keepExcalidrawUnicodeRegexes({ types: t }) {
  return {
    name: "dovli-keep-excalidraw-unicode-regexes",
    visitor: {
      RegExpLiteral(p, state) {
        const file = state.filename || state.file?.opts?.filename || "";
        if (!file.includes(EXCALIDRAW)) return;
        const { pattern, flags } = p.node;
        if (!flags.includes("u") && !flags.includes("v")) return;
        p.replaceWith(t.newExpression(t.identifier("RegExp"), [t.stringLiteral(pattern), t.stringLiteral(flags)]));
      },
    },
  };
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [keepExcalidrawUnicodeRegexes],
  };
};
