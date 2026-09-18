# Bugfix Requirements Document

## Introduction

Text boxes on the poster canvas cannot be clicked, moved, or modified at their visual position. Users must click at an offset location (typically far to the left) to interact with elements. The misalignment is caused by the `ResponsiveManager` applying a CSS `transform: scale()` to the Fabric.js canvas wrapper without informing Fabric.js of the coordinate transform. This results in Fabric.js calculating mouse hit-test positions based on the unscaled coordinate space while objects render at their scaled visual positions. The severity increases with smaller scale factors (larger browser windows where the canvas is scaled down more), and partially resolves when the window is narrow enough that the scale approaches 1.0.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the canvas is scaled down via CSS `transform: scale()` by the ResponsiveManager THEN the system registers click/mouse coordinates at incorrect positions that do not correspond to the visual location of text box objects

1.2 WHEN a user clicks directly on a visually rendered text box THEN the system does not select, move, or activate editing for that text box

1.3 WHEN a user attempts to drag or resize a text box at its visual position THEN the system does not respond to the interaction at that location

1.4 WHEN the browser window is wide (causing a smaller scale factor) THEN the system exhibits a larger offset between visual object positions and interactive hit areas

### Expected Behavior (Correct)

2.1 WHEN the canvas is scaled for responsive display THEN the system SHALL translate mouse/pointer coordinates correctly so that click positions correspond to the visual locations of canvas objects

2.2 WHEN a user clicks directly on a visually rendered text box THEN the system SHALL select that text box and allow interaction (move, resize, edit)

2.3 WHEN a user drags or resizes a text box at its visual position THEN the system SHALL respond accurately to the pointer position throughout the interaction

2.4 WHEN the browser window is resized (changing the scale factor) THEN the system SHALL maintain correct coordinate alignment between visual positions and interactive hit areas at all scale values

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the browser viewport is large enough that the canvas does not need scaling (scale = 1.0) THEN the system SHALL CONTINUE TO allow clicking, dragging, and editing text boxes at their visual positions without offset

3.2 WHEN the browser viewport is below 768px (narrow/mobile layout) THEN the system SHALL CONTINUE TO display the toolbar in horizontal layout and scale the canvas appropriately

3.3 WHEN a text box is moved or resized THEN the system SHALL CONTINUE TO constrain the object within canvas boundaries

3.4 WHEN a text box is created via the "Add Text" button THEN the system SHALL CONTINUE TO place it centered on the canvas and make it immediately selectable

3.5 WHEN the user performs undo/redo operations THEN the system SHALL CONTINUE TO restore previous canvas states correctly

3.6 WHEN the canvas scale changes due to window resize THEN the system SHALL CONTINUE TO never upscale beyond 1.0 (the original canvas dimensions)
