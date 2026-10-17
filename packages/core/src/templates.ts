import { h2, h3, p, li, num, todo, toggle, quote, divider, table } from "./blocks";
import type { BoardData, PageKind } from "./types";

export interface Template {
  id: string;
  name: string;
  description: string;
  mark: string;
  kind: PageKind;
  group: "Work" | "Personal" | "Thinking";
  build: () => { title: string; blocks?: any[]; board?: BoardData };
}

const today = () => new Date().toLocaleDateString(undefined, { day: "numeric", month: "long" });

/* ---------- Whiteboard outlines (turned into real shapes when the board opens) ---------- */

// Clean, precise strokes (not the hand-drawn default) and the Nunito font (Excalidraw font id 6).
const LOOK = { roughness: 0, strokeWidth: 1, strokeColor: "#1e1e1e" };
const label = (text: string, fontSize = 16) => ({ text, fontSize, fontFamily: 6 });

const box = (id: string, x: number, y: number, text: string, w = 200, h = 72, extra: any = {}) => ({
  type: "rectangle",
  id,
  x,
  y,
  width: w,
  height: h,
  roundness: { type: 3 },
  label: label(text),
  ...LOOK,
  ...extra,
});
const arrow = (from: string, to: string, text?: string) => ({
  type: "arrow",
  start: { id: from },
  end: { id: to },
  endArrowhead: "triangle",
  ...LOOK,
  ...(text ? { label: label(text, 14) } : {}),
});

/** Point where the line from a shape's centre towards (tx, ty) leaves the shape's box, plus a small gap. */
function edgePoint(s: any, tx: number, ty: number, gap = 8) {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  const sx = dx === 0 ? Infinity : (s.width / 2 + gap) / Math.abs(dx);
  const sy = dy === 0 ? Infinity : (s.height / 2 + gap) / Math.abs(dy);
  const t = Math.min(sx, sy);
  return [cx + dx * t, cy + dy * t];
}

/** Give every arrow real start/end coordinates so it lands on the edges of the shapes it joins. */
export function placeArrows(items: any[]) {
  const byId = Object.fromEntries(items.filter((i) => i.id).map((i) => [i.id, i]));
  return items.map((i) => {
    if (i.type !== "arrow") return i;
    const a = byId[i.start.id];
    const b = byId[i.end.id];
    const [ax, ay] = edgePoint(a, b.x + b.width / 2, b.y + b.height / 2);
    const [bx, by] = edgePoint(b, a.x + a.width / 2, a.y + a.height / 2);
    return { ...i, x: ax, y: ay, width: bx - ax, height: by - ay, points: [[0, 0], [bx - ax, by - ay]] };
  });
}

const note = (id: string, x: number, y: number, color: string) =>
  box(id, x, y, "Idea", 170, 64, { backgroundColor: color, fillStyle: "solid", strokeColor: "#868e96" });

export const brainstormSkeleton = () =>
  placeArrows([
    { type: "ellipse", id: "topic", x: 300, y: 250, width: 250, height: 120, backgroundColor: "#dbe4ff", fillStyle: "solid", label: label("Main question", 20), ...LOOK },
    note("i1", 20, 60, "#fff3bf"),
    note("i2", 340, 30, "#fff3bf"),
    note("i3", 660, 60, "#fff3bf"),
    note("i4", 20, 500, "#d3f9d8"),
    note("i5", 340, 530, "#d3f9d8"),
    note("i6", 660, 500, "#d3f9d8"),
    arrow("topic", "i1"),
    arrow("topic", "i2"),
    arrow("topic", "i3"),
    arrow("topic", "i4"),
    arrow("topic", "i5"),
    arrow("topic", "i6"),
  ]);

/** The small flow a new flowchart block starts with. */
export const flowchartStarter = () =>
  placeArrows([
    { type: "ellipse", id: "s", x: 0, y: 10, width: 150, height: 64, label: label("Start"), ...LOOK },
    box("a", 220, 6, "First step", 180, 72),
    { type: "diamond", id: "q", x: 470, y: -14, width: 170, height: 112, label: label("Done?"), ...LOOK },
    box("b", 710, 6, "Finish", 160, 72, { backgroundColor: "#dbe4ff", fillStyle: "solid" }),
    arrow("s", "a"),
    arrow("a", "q"),
    arrow("q", "b", "Yes"),
  ]);

export const userFlowSkeleton = () =>
  placeArrows([
    box("land", 0, 140, "Landing page", 180),
    { type: "diamond", id: "acct", x: 260, y: 110, width: 180, height: 132, label: label("Has account?"), ...LOOK },
    box("signup", 540, 20, "Sign up"),
    box("login", 540, 260, "Log in"),
    box("onb", 840, 20, "Pick a template"),
    box("first", 840, 260, "Write first note", 200, 72, { backgroundColor: "#dbe4ff", fillStyle: "solid" }),
    arrow("land", "acct"),
    arrow("acct", "signup", "No"),
    arrow("acct", "login", "Yes"),
    arrow("signup", "onb"),
    arrow("onb", "first"),
    arrow("login", "first"),
  ]);

/* ---------- Templates ---------- */

export const templates: Template[] = [
  {
    id: "meeting",
    name: "Meeting notes",
    description: "Agenda, decisions and who does what next.",
    mark: "¶",
    kind: "doc",
    group: "Work",
    build: () => ({
      title: `Meeting notes, ${today()}`,
      blocks: [
        table([
          ["Date", today()],
          ["Attendees", ""],
          ["Goal", "What should be true when this meeting ends?"],
        ]),
        h2("Agenda"),
        num("Updates since last time"),
        num("Main topic"),
        num("Open questions"),
        h2("Notes"),
        p(""),
        h2("Decisions"),
        li("**Decided:** "),
        h2("Action items"),
        todo("Owner: task, due date"),
        todo("Owner: task, due date"),
      ],
    }),
  },
  {
    id: "brief",
    name: "Project brief",
    description: "Problem, goal, scope and timeline on one page.",
    mark: "§",
    kind: "doc",
    group: "Work",
    build: () => ({
      title: "Project brief",
      blocks: [
        p("*One paragraph anyone in the company could read and understand.*"),
        h2("Problem"),
        p("Who is struggling, with what, and how do we know?"),
        h2("Goal"),
        li("**Success looks like:** "),
        li("**We'll measure it by:** "),
        h2("Scope"),
        h3("In"),
        li(""),
        h3("Out"),
        li(""),
        h2("Timeline"),
        table([
          ["Milestone", "Owner", "Date"],
          ["Kick-off", "", ""],
          ["First version", "", ""],
          ["Launch", "", ""],
        ]),
        h2("Risks"),
        toggle("Risk: what could go wrong", [p("How we'll reduce it.")]),
        h2("Open questions"),
        todo(""),
      ],
    }),
  },
  {
    id: "spec",
    name: "Product spec",
    description: "User stories, requirements and a launch checklist.",
    mark: "✳",
    kind: "doc",
    group: "Work",
    build: () => ({
      title: "Product spec",
      blocks: [
        h2("Summary"),
        p("What we're building, in two sentences."),
        h2("User problem"),
        quote("As a ___, I want to ___ so that ___."),
        h2("Requirements"),
        table([
          ["Requirement", "Priority", "Notes"],
          ["", "Must have", ""],
          ["", "Should have", ""],
          ["", "Nice to have", ""],
        ]),
        h2("Design notes"),
        p("Link screens, flows or a whiteboard here. Type / and pick Whiteboard."),
        h2("Launch checklist"),
        todo("Design review"),
        todo("Engineering review"),
        todo("Help article written"),
        todo("Announcement drafted"),
      ],
    }),
  },
  {
    id: "decision",
    name: "Decision record",
    description: "The context, the options and why you picked one.",
    mark: "⁂",
    kind: "doc",
    group: "Thinking",
    build: () => ({
      title: "Decision: ",
      blocks: [
        table([
          ["Status", "Proposed"],
          ["Decider", ""],
          ["Date", today()],
        ]),
        h2("Context"),
        p("What's happening that forces a decision?"),
        h2("Options"),
        toggle("Option A", [li("**Pros:** "), li("**Cons:** ")]),
        toggle("Option B", [li("**Pros:** "), li("**Cons:** ")]),
        h2("Decision"),
        p("We chose ___ because ___."),
        h2("What changes"),
        li(""),
      ],
    }),
  },
  {
    id: "weekly",
    name: "Weekly review",
    description: "Look back at the week and set three priorities.",
    mark: "◐",
    kind: "doc",
    group: "Personal",
    build: () => ({
      title: `Weekly review, ${today()}`,
      blocks: [
        h2("What went well"),
        li(""),
        h2("What slipped"),
        li(""),
        h2("What I learned"),
        p(""),
        divider(),
        h2("Top three for next week"),
        todo(""),
        todo(""),
        todo(""),
      ],
    }),
  },
  {
    id: "journal",
    name: "Daily journal",
    description: "A short morning plan and an evening look back.",
    mark: "☾",
    kind: "doc",
    group: "Personal",
    build: () => ({
      title: today(),
      blocks: [
        h3("Morning"),
        li("**Grateful for:** "),
        li("**Most important thing today:** "),
        h3("Notes"),
        p(""),
        h3("Evening"),
        toggle("What happened today?", [p("")]),
        toggle("What would I do differently?", [p("")]),
      ],
    }),
  },
  {
    id: "reading",
    name: "Reading notes",
    description: "Key ideas, highlights and what you'll use.",
    mark: "❡",
    kind: "doc",
    group: "Thinking",
    build: () => ({
      title: "Reading notes: ",
      blocks: [
        table([
          ["Author", ""],
          ["Started", today()],
          ["Rating", ""],
        ]),
        h2("The book in three sentences"),
        p(""),
        h2("Key ideas"),
        num(""),
        h2("Highlights"),
        quote(""),
        h2("How I'll use this"),
        todo(""),
      ],
    }),
  },
  {
    id: "brainstorm",
    name: "Brainstorm board",
    description: "A central question with room for ideas around it.",
    mark: "◇",
    kind: "board",
    group: "Thinking",
    build: () => ({ title: "Brainstorm", board: { skeleton: brainstormSkeleton() } }),
  },
  {
    id: "userflow",
    name: "User flow",
    description: "Steps and decisions from first visit to first value.",
    mark: "△",
    kind: "board",
    group: "Work",
    build: () => ({ title: "User flow", board: { skeleton: userFlowSkeleton() } }),
  },
];
