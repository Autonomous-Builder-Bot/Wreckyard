# Wreckyard

A mobile-friendly, browser-based robot scrapyard management game built with Three.js and vanilla JavaScript.

## Current milestone — Step 2: Modular Robot Builder

- Interactive 3D hangar and assembly platform.
- Navigable stations for assembly, workshop, research, missions, warehouse, hangar, and factory.
- Persistent local save data and resource readouts.
- Socket-based robot assembly: three chassis, 28 interchangeable parts, live 3D equipment previews.
- Build diagnostics for weight, energy, speed, hull, armor, combat, salvage and cargo.
- Assemble new robots or refit existing units using materials and spare inventory; save/load/delete blueprints.
- Automatic migration of existing Step 1 saves without erasing factory layouts.
- Factory layout planner: place, rotate, and remove conveyors, forges, builders, storage, and generators on a grid; every edit is mirrored in the 3D factory area. Production networks are deliberately **not simulated yet**.
- Mouse, touch, and keyboard-friendly controls; no build step.

## Run

Open with a local static file server (e.g. `python -m http.server 8000`) and visit `http://localhost:8000`. This project uses the Three.js ES module CDN, so an internet connection is needed for the 3D scene. The static site can also be published directly through GitHub Pages (Deploy from branch: `main` / `/`).

## Planned milestones

1. **Hangar & factory planning** — environments, navigation, persistent saves, and machine layout placement.
2. **Robot builder** — implemented: modular chassis, attachment sockets, live models, part stats, material costs, refits and blueprints.
3. **Living economy** — actual factory crafting chains, conveyors, scavenging, robot repairs, research unlocks, and progression. Step 2 supports manual part fabrication, not running factory lines. Combat is a later milestone.

## Design rules

- The factory and robot builder share a unified component catalog and inventory once implemented.
- Keep simulation state separate from visual rendering so the UI remains efficient on mobile.
- Robot parts are actual equipment, not merely cosmetic; mass, power, durability, cargo, and hardpoint constraints matter.
- Saved factory layout is versioned to support later migration.

## License

No license has been specified yet. All original code is currently all rights reserved by the repository owner.

## Factory interaction

Open **Factory** from the sidebar or 3D station hotspot. Select a machine type, tap a tile to place it, rotate conveyor direction with **Rotate** (or **R**), and use **Remove** to erase machines. The Three.js hangar updates to match the saved layout. **Reset Layout** restores only factory machines and preserves inventory and fleet. This is blueprint mode: no resource consumption or manufacturing simulation yet.

## Robot assembly controls

Open **Assembly** from the station navigation. Select an owned robot to refit it, or **New design** to plan another unit. Choose one of the three chassis, then select a mount and a compatible part. The main Three.js assembly platform previews the changes immediately. **View Robot in 3D** closes the editor panel temporarily; **Edit Robot** reopens it.

The diagnostics panel checks paired drives, a power core, mass and power budgets. **Save Blueprint** records the current design; **Build New Robot** manufactures a valid new machine and registers it in the fleet. **Apply Refit** reuses existing components, spends spare parts first, manufactures any missing ones using scrap/alloy, and returns unequipped components to spare inventory. Blueprint editing is free; resources are spent only on actual fabrication. The initial robot remains available and old saved factories are migrated. Factory conveyors are still visual/planning-only.

## Tests

With Node.js installed, run `npm test`. This uses built-in Node tests; no dependencies or build step are required. Game modules themselves run directly in supported browsers using the CDN import map.
