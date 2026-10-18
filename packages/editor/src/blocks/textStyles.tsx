// Craft-style text styles that BlockNote doesn't have on its own:
// - Caption: a small, quiet line of text (for notes under pictures, dates, sources).
// - Font: a text style that sets the font of a run of text (System, Serif, Mono or Round).

import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec, createReactStyleSpec } from "@blocknote/react";

export const captionBlock = createReactBlockSpec(
  { type: "caption", propSchema: { ...defaultProps }, content: "inline" },
  {
    render: ({ contentRef }) => <p ref={contentRef} className="dovli-caption m-0" />,
    toExternalHTML: ({ contentRef }) => <p ref={contentRef} style={{ fontSize: "0.85em", opacity: 0.7 }} />,
  },
);

export const FONT_IDS = ["system", "serif", "mono", "round"] as const;
export type FontId = (typeof FONT_IDS)[number];

export const fontStyle = createReactStyleSpec(
  { type: "font", propSchema: "string" },
  { render: ({ value, contentRef }) => <span data-font={value} ref={contentRef} /> },
);
