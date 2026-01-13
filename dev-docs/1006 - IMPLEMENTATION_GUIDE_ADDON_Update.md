You’re in a really strong place now. What you’ve built through Pass 4 + playhead is basically:

- one authoritative stream
    
- multiple projections
    
- narrative mode as “movie mode”
    
- semantic toolbar
    
- asset packs
    
- voxel bridge
    
- timeline with FPS/EPS + markers
    

That’s already a usable creative system.

Here’s how I’d suggest you steer your coding agent next—very deliberately, without blowing up what’s working.

---

## Phase 5 — Editing as Storycraft (not geometry)

Now that you have:

- playhead
    
- markers
    
- narrative beats
    
- semantic roles
    

You should focus on **editing meaning through time**, not adding more rendering tricks.

Tell your agent:

> Next focus: make the timeline an editor of meaning, not just a player.

Concrete steps:

- Markers become:
    
    - keyframes for narrative actions
        
    - beat boundaries
        
    - cut points between modes
        
- Each marker can optionally store:
    
    - semantic role changes
        
    - narrative actions (spawn, fade, align, etc.)
        
- Clicking a marker:
    
    - shows what changes at that moment
        
    - allows editing those changes
        

So the timeline becomes:

> “At this moment, this meaning changes.”

Not:

> “At this frame, move this pixel.”

---

## Phase 6 — Movie Mode as First-Class

You already said:

> Narrative mode should be like movie mode.

So refine that:

Movie mode means:

- canvas is minimal
    
- UI fades out
    
- playhead auto-plays
    
- Prelude and Covenant dominate
    
- beats flow without manual toggling
    

Tell your agent:

> Add a “Present” or “Movie” mode:
> 
> - hides editing UI
>     
> - locks toolbar
>     
> - auto-plays from selected marker
>     
> - uses Prelude → Articles → Covenant path
>     

This turns your system into something you can _show_, not just build with.

---

## Phase 7 — Typed Coordinates (when you’re ready)
[[1005 - Typed Coordinate System for Meaning and Projection]]

You were right to delay `{x,y,z | w,a,b,c,d}`.

Don’t add it until:

- editing through timeline feels natural
    
- semantic roles feel stable
    
- asset packs feel sufficient
    

Then introduce typed coordinates as:

- optional metadata on nodes or beats
    
- never required for rendering
    
- mostly for analysis, equilibrium, and future physics
    

Instruction later:

> Add typed coordinate slots as structured metadata, not as required geometry.

---

## Phase 8 — Collaboration Light

Before big networking:

- add export/import of:
    
    - narrative series
        
    - asset packs
        
    - timelines with markers
        
- allow:
    
    - “send me your story as JSON”
        
    - load it and replay
        

That gives you collaboration without infrastructure hell.
