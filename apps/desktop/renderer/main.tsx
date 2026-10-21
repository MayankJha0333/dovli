import "@/styles/globals.css";
import "./fonts/fonts.css";
import "./desktop.css";
import { createRoot } from "react-dom/client";
import { desktop } from "@/lib/desktop";
import { DesktopApp } from "./DesktopApp";

// The title bar's size and the window buttons' side depend on the system (see desktop.css).
document.documentElement.dataset.platform = desktop?.platform ?? "web";

createRoot(document.getElementById("root")!).render(<DesktopApp />);
