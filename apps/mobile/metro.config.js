// Expo's default Metro setup already understands pnpm/Turborepo monorepos
// (it watches the repo root and resolves our workspace packages).
const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The shared editor includes Excalidraw (for flowcharts). Its stylesheet is only listed under the
// "development"/"production" conditions, and it loads its own UI font from relative files, which
// Metro's CSS support can't bundle. Give Metro a copy without those font files; the editor
// uses the theme's font for Excalidraw's UI anyway.
const excalidrawCss = path.resolve(__dirname, "../../node_modules/@excalidraw/excalidraw/dist/prod/index.css");
const patchedCss = path.resolve(__dirname, "generated/excalidraw.css");
function excalidrawStylesheet() {
  const source = fs.statSync(excalidrawCss);
  if (!fs.existsSync(patchedCss) || fs.statSync(patchedCss).mtimeMs < source.mtimeMs) {
    const css = fs.readFileSync(excalidrawCss, "utf8").replace(/@font-face\{[^}]*url\(["']?\.\/fonts\/[^}]*\}/g, "");
    fs.mkdirSync(path.dirname(patchedCss), { recursive: true });
    fs.writeFileSync(patchedCss, css);
  }
  return patchedCss;
}
// Written before Metro scans the project, so Metro can see it. The folder is git-ignored.
excalidrawStylesheet();

const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@excalidraw/excalidraw/index.css") {
    return { type: "sourceFile", filePath: patchedCss };
  }
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
