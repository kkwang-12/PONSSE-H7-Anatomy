# PONSSE H7 · anatomy demo

## Scope

Hero: a detailed, local, framework-free SVG assembly explainer. The silhouette follows the user's front and three-quarter H7 photographs. Explosion is a presentation of major assemblies, not a service disassembly procedure. No hidden motor/valve internals, exact dimensions, or interchangeable part numbers are asserted.

## Evidence

- `assets/Ponsse H7.png`: front, hanging orientation; frame, yellow knives, two side rollers, inboard rollers, measuring assembly, lower saw box.
- `182197-11836048.webp`: three-quarter product view; roller guards, knife curvature, exposed pivots and saw arrangement.
- `assets/65caaa77-2509-475f-8e15-cfa9aa786d15.png`: multiple product views and operating orientation.
- `assets/e62792a0bbfb6c1c1547e91798c249dc.jpg`: photographed Chinese manual section 2.3, component identification. This is an annotated assembly view, not a complete parts exploded drawing.
- `assets/e0343ae8f26d7837fa9bfdd980e7a02d.jpg`: section 3.7.2, optional multi-stem feed rollers. These optional roller patterns are not treated as the base machine specification.
- `assets/8245cd135c93ecf88dd02df9ecf229b1.jpg`: drive motor identification and upper body.
- `assets/Ponsse_Harvester_Heads_EN.pdf`: p. 10 describes NEW H7. Its specifications are not attached to this older photograph-based reconstruction.
- https://news.ponsse.com/en/the-popular-h7-harvester-head-renewed/ (2024-11-14): confirms revised roller geometry, knife order and larger measuring wheel. Used to avoid combining generations.

## Mechanism and assemblies

In structure mode the head stays in its hanging pose. Major assemblies translate away from their mounts to expose the frame and the central feed path. Shared animation progress drives both geometry and the readout. The independent processing mode is described below.

1. Main frame: spine, two side cheeks, upper bridge, lower bridge, bearing pedestals, welded reinforcement webs, attachment tabs.
2. Suspension and rotator: lower flange, motor body, flange rings, bolt circle, upper shaft, link cheeks, pin.
3. Tilt frame: two rear uprights, upper cross member, lower pivots, two cylinder barrels, rods, clevises, pin caps.
4. Service cover: sculpted upper shell, side panels, top ridge, edge lips, ventilation slots, panel fasteners.
5–6. Left/right feed assemblies: swing arm, motor, bearing flange, hub, drum, face ring, recessed apertures, bolt circle, spikes, guard and guard ribs.
7–8. Upper left/right knives: curved blade, cutting edge, pivot barrel, bushing, cap, carrier plate, cylinder body, rod.
9. Lower knives: two curved blades, two pivots, carrier lugs, pin caps and actuators.
10. Inboard feeding and measurement: two toothed drums, shafts, brackets, measuring wheel, swing link, spring, encoder enclosure.
11. Saw cassette: lower carrier, saw motor housing, drive cover, guide bar, chain, nose sprocket, underside guard, fasteners.

Blade profiles, guard curvature, bolt counts, internal roller geometry and concealed mounting details are authored approximations for visual explanation. Hydraulic hoses are left at the assembly level in this first study rather than inventing the full circuit.

## Delivery

`index.html` opens directly with no server or network. `node build.mjs` rebuilds it. All runtime code, SVG and styles are embedded; reference photos/PDF remain in assets and are only opened on request. Anatomy's MIT kit is in `vendor/` with its license.

## Detail and presentation revision · 2026-10-15

User approved neutral grayscale in two themes and the compact Raptor layout: one bordered figure, corner labels, minimal lower controls, eleven component pills and a caption. Desktop hover opens, leaving the stage/labels closes after 260 ms, touch supports deliberate taps, and keyboard navigation remains available. A small explicit toggle can hold the pose open. This replaces the previous dashboard layout; no public theme toggle, sidebar, zoom toolbar, autoplay controls or reference dialog remains.

The new `assets/细节/` set contains 12 photographed manual pages. CT+ chain-tensioner §3.6.2.1 (`微信图片_20261015105834_158_356.jpg`) informs the drive bearing cover, sealing rings, clamping shoe and tensioning piston. Measurement §3.9.1 and its bearing drawings (`微信图片_20261015105842_163_356.jpg`, `微信图片_20261015105927_167_356.jpg`, `微信图片_20261015105928_169_356.jpg`) inform the fluted measuring wheel, bearing housing/cover, encoder cover, gland and grease fitting. The head and knife assembly views inform retaining collars, pin fasteners, inspection flanges and manifold connections. These are illustrative exterior details within the same eleven moving groups, not a claim of exact CT+ internals or a part-for-part reconstruction. Roller variants and optional arrangements are not universal H7 specifications.

## Animation performance revision · 2026-10-15

The detailed SVG had 12,654 connected SVG nodes, 7,543 paths and 846 clip paths. Profiling showed layout, style and paint dominated frame time. Geometry is unchanged. Each rigid assembly is now rasterised once into transparent normal/selected textures and drawn in the same depth order onto a single Canvas 2D surface. Pixel alpha masks retain accurate component hit testing, including empty gaps. Source textures use up to 2x sampling and a 12-million-pixel budget; screen rendering caps device pixel ratio at 2. Strokes scale with cached artwork instead of remaining screen-constant at every zoom. Very high browser zoom can therefore reveal the bitmap resolution limit.

Only the original inline SVG is used to prepare images: no external assets, service, build dependency or network request was added. If image preparation fails, the original SVG remains interactive. On success its detached nodes and temporary SVG strings are released. The static SVG also remains the no-script representation.

Repeated requests for an already-settled pose no longer schedule frames. Unchanged selection/text/pose avoids redundant updates. Exponential easing uses real elapsed time, so a slow frame does not stretch the animation; hidden/offscreen intervals are excluded on resume. Touch, keyboard, hover and reduced-motion controls remain shared across both renderers. Performance results, transparent-corner checks, all eleven hit regions and interaction evidence are in the `checks/performance-*` files.

## Processing mode · 2026-10-15

The processing mode pitches the working body 90 degrees about the suspension pivot while the suspension stays upright. It uses closed source meshes, a calibrated open feed channel, a separate bar and chain, articulated knives and feed arms, spinning roller bodies, and endpoint-driven cylinders. Native WebGL2 depth testing replaces painter sorting for this mode. The cached structure view remains independent. Both themes embed the complete runtime and mesh data and work from a local HTML file.

One pure 31-second state model drives nine stages. Material intervals remain in a common coordinate system across two cuts. Nominal lengths 240 / 200 / 350 and nominal diameter 80 are illustrative model units. At cut-through, each product becomes an independent interval immediately; separation and return follow. Visual kerf insets are deliberately enlarged for readability and do not change the nominal lengths. Branch-cut events derive from the material crossing a knife station. Roller turns derive from feed distance, including taper at the contact station. Clamp, feed and saw interlocks are enforced by the timeline.

For this working pose some display geometry is rebuilt: knife curves, side roller contact placement, U-shaped saw carrier opening, actuator mounts and tilt supports. Exterior details are based on the same photos and manual pages; concealed joints and trajectories are authored approximations. Source upper knives map to front knives and the lower pair to rear knives along the chosen feed direction; screen position alone does not define these names. Wood exits axially before the final remainder falls to avoid the suspension. There is no pickup sequence, hydraulic solver, cutting-force model or general rigid-body collision solver.

UI validation covers actual playback, pausing, rates, seeking, replay, both modes, picking, mobile touch, reduced motion, offscreen suspension and missing-WebGL fallback. Numeric tests cover feed/saw interlocks, material continuity, taper-driven rollers, branch events, actuator endpoints and saw coverage; sampled geometry checks inspect wood contact clearances at representative poses. These checks are not a continuous collision proof. Processing performance is recorded separately and has no acceptance threshold in this functionality-first revision.
