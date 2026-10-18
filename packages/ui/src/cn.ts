import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge needs to know Dovli's custom text sizes, radii and shadows,
// so "text-sm text-ink-3" keeps both classes instead of treating them as a clash.
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["2xs", "xs", "sm", "base", "md", "lg", "xl", "2xl", "3xl", "4xl"] }],
      rounded: [{ rounded: ["xs", "sm", "md", "lg", "xl", "shell", "sheet", "full", "none"] }],
      shadow: [{ shadow: ["sm", "card", "pop", "sheet", "active", "chip", "shell", "none"] }],
    },
  },
});

/** Join class names, letting later Tailwind classes win over earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
