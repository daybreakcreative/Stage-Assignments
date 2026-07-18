# Multi-select front edge + active-tool indication — design

**Date:** 2026-07-17
**Status:** Approved (design), pending build
**File:** `index.html` (stage geometry `getStageShape`/`getVoxPositions`, outline editor `openPolygonStageEditor`, front-edge highlight, saved stages)

## Problem

The stage outline editor lets you mark exactly **one** edge as the "front" (where vocalists
line up, facing the audience). Two gaps:

1. **Only one front edge.** On an angled/peaked stage (the front is two or more segments), you
   can't mark the whole angled front — so vocalists line up along just one segment.
2. **No indication the Front-edge tool is active.** When you click "Front edge" and are in
   pick mode, nothing signals it — no cursor change, no button state — so it's unclear you're
   in "pick the front" mode.

Approved behavior (via brainstorm): support **multiple** front edges, and **spread vocalists
across all of them as one continuous run** following the angle/peak. Plus a clear active-tool
indication.

## Current model (for reference)

- Front edge stored as `state.config.stageFrontEdge` — a single int edge index, or null = auto.
- `resolveFrontEdgeIndex(pts)` → the explicit int if valid, else `autoFrontEdgeIndex(pts)`
  (most-forward edge = lowest midpoint y).
- `getStageShape()` (custom-polygon branch) derives `P0` (stage-right end), `P1` (control/mid),
  `P2` (stage-left end), `edge` (SVG path), `inward` normal, `frontEdgeIndex`, `centroid`.
- `getVoxPositions(count)` distributes vocalists along the quadratic bezier `P0→P1→P2`, each
  offset inward by `shape.inward * MARGIN`.
- `frontEdgeHighlightSvg(shape)` strokes `shape.edge` + a "FRONT" label; `syncFrontEdgeHighlight`
  mounts it in stage/display SVGs.
- Outline editor: `openPolygonStageEditor`; the `#saPolyFront` button enters single-edge pick
  mode; instruction text at the "Click the edge vocalists line up along…" line.
- Saved stages persist `frontEdge` (int|null); wizard uses `wizardData.stageFrontEdge`.

## Design

### A. Storage & back-compat
- New: `state.config.stageFrontEdges` — array of edge indices (sorted, e.g. `[0,1]`).
- `resolveFrontEdges(pts)`:
  1. If `stageFrontEdges` is a non-empty array of valid indices → use it (filtered to valid).
  2. Else if legacy `stageFrontEdge` is a valid int → `[stageFrontEdge]`.
  3. Else → `[autoFrontEdgeIndex(pts)]`.
  Returns indices ordered by their position along the polygon perimeter (ascending index).
- On every write, also set legacy `stageFrontEdge = frontEdges[0]` (or null) so any old reader
  and the single-edge path keep working. `resolveFrontEdgeIndex` stays (returns `frontEdges[0]`).
- **Saved stages:** store `frontEdges` (array) in the saved-stage record, plus legacy `frontEdge`
  = first element. Load maps: `frontEdges` if array, else `[frontEdge]` if int, else `[]`. Wizard:
  `wizardData.stageFrontEdges`.

### B. Geometry — vocalists spread across all fronts
- `getStageShape()` custom branch, when `resolveFrontEdges` yields ≥1 edges:
  - Build the **front polyline**: the ordered vertices spanning the selected edges. For edge set
    `E`, the polyline is the sequence of `pts` vertices touched by those edges, ordered around the
    polygon; contiguous edges → one continuous vertex run. Orient the polyline **stage-right →
    stage-left** (by x for horizontal-ish fronts, by y for vertical-ish) so vocal ordering matches
    today (VOCAL 1 at right).
  - Expose on the shape:
    - `frontPolyline`: `[{x,y}, …]` ordered right→left.
    - `frontInward`: per-segment inward unit normals (parallel array, length = segments), each
      flipped to point toward the centroid.
    - `edge`: a multi-segment SVG path (`M … L … L …`) covering all front segments (for the
      highlight). For a single edge this equals today's bezier/line edge.
    - `P0`/`P1`/`P2`: right end / midpoint of the polyline / left end (back-compat; unchanged for
      the single-edge case).
    - `frontEdgeIndex`: `frontEdges[0]` (back-compat); add `frontEdgeIndices`: the full array.
  - Single selected edge → identical output to today (bezier edge, one inward), so nothing
    regresses.
- `getVoxPositions(count)`:
  - If `shape.frontPolyline` has ≥3 points (≥2 segments) → distribute by **arc length**: compute
    segment lengths + cumulative length `L`; for each vocalist's parameter `t∈[inset,1-inset]`
    (same rtl/ltr + inset math as today), find the point at distance `t*L` along the polyline and
    offset it inward by that segment's normal × `MARGIN`. Hand-placed `customStagePositions`
    still override per slot (unchanged).
  - Else (single edge or slider shape) → current bezier distribution (unchanged).

### C. Outline editor — multi-select + active-tool indication
- `#saPolyFront` "Front edge" button toggles **front-pick mode** (a boolean editor state,
  replacing the current single-shot pick):
  - **Active indication:** button gets an `.active` class (accent fill/outline); the editor SVG
    gets `cursor: crosshair` (via a body/container class while active); the instruction line
    switches to: *"Click edges to add or remove them as the front (pick several for an angled
    front). Click Front edge to finish."*
  - While active, clicking an **edge** toggles that edge index in/out of the working
    `stageFrontEdges` set, re-renders the editor, and every front edge draws with the accent
    "front" stroke + a small FRONT tick so the selection is visible live.
  - Clicking "Front edge" again (or Save/Done) exits pick mode (removes `.active`, restores
    cursor, restores the default instruction).
- Non-front-edge interactions (drag vertices, add/remove points) are disabled or ignored while
  in front-pick mode to avoid mis-clicks (match current single-pick behavior).

### D. Highlight everywhere
- `frontEdgeHighlightSvg(shape)` strokes **each** front segment (iterate `frontPolyline`
  segments or the multi-segment `edge` path) and places **one** "FRONT" label near the polyline
  midpoint. Used by `syncFrontEdgeHighlight` in stage + display SVGs (already called there).

## Testing (`tests/frontedge.js`, jsdom)

1. `resolveFrontEdges`: array wins; legacy int → `[int]`; neither → `[auto]`; invalid indices
   filtered.
2. Multi-edge stage: `getStageShape().frontPolyline` spans the selected edges' vertices ordered
   right→left; `frontEdgeIndices` matches.
3. `getVoxPositions(n)` on a 2-segment (peaked) front: returns `n` points spread by arc length
   (first near the right end, last near the left end, roughly even spacing along the combined
   length), each inset inward (not on the raw edge).
4. Single front edge and slider shape: `getVoxPositions` output is byte-for-byte unchanged
   (regression guard).
5. Front highlight: `frontEdgeHighlightSvg` emits one stroked path per selected segment + a
   single FRONT label.
6. Editor: activating `#saPolyFront` sets the active class + instruction text; clicking two edges
   adds both to `stageFrontEdges`; clicking one again removes it; legacy `stageFrontEdge` tracks
   `frontEdges[0]`.
7. Saved-stage round-trip: save with `frontEdges:[0,1]`, reload → both restored; loading an old
   record with only `frontEdge:2` → `frontEdges:[2]`.
8. Full `npm test` green (allow the known `curve.js` false-fail). Existing stage tests
   (`stagepreview`, `stagelayout`, `smoke2`, `editlayout`) still pass.

## Scope / notes

- **Contiguous** front edges (an angled peak) give one clean continuous line — the common case.
  **Non-contiguous** picks still distribute across the segments in polygon order (with a visual
  gap between runs); unusual but handled, not blocked.
- Right/left orientation of the combined front uses the polyline's two extreme endpoints
  (x-dominant → by x; y-dominant → by y), matching the existing single-edge right/left logic.
- No change to the slider (non-custom) stage shape path.
