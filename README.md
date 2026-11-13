# Wreckyard

A mobile-friendly, browser-based robot scrapyard management game built with Three.js and vanilla JavaScript.

## Current milestone — Step 1: The Hangar

- Interactive 3D hangar and assembly platform.
- Navigable stations for assembly, workshop, research, missions, warehouse, hangar, and factory.
- Persistent local save data and resource readouts.
- Factory layout planner: place, rotate, and remove conveyors, forges, builders, storage, and generators on a grid; every edit is mirrored in the 3D factory area. Production networks are deliberately **not simulated yet**.
- Mouse, touch, and keyboard-friendly controls; no build step.

## Run

Open with a local static file server (e.g. `python -m http.server 8000`) and visit `http://localhost:8000`. This project uses the Three.js ES module CDN, so an internet connection is needed for the 3D scene. The static site can also be published directly through GitHub Pages (Deploy from branch: `main` / `/`).

## Planned milestones

1. **Hangar & factory planning** — environments, navigation, persistent saves, and machine layout placement.
2. **Robot builder** — modular chassis, attachment sockets, part stats, material costs, customizable designs and blueprints.
3. **Living economy** — actual factory crafting chains, conveyors, scavenging, robot repairs, research unlocks, resources, and progression. Combat is a later milestone.

## Design rules

- The factory and robot builder share a unified component catalog and inventory once implemented.
- Keep simulation state separate from visual rendering so the UI remains efficient on mobile.
- Robot parts are actual equipment, not merely cosmetic; mass, power, durability, cargo, and hardpoint constraints matter.
- Saved factory layout is versioned to support later migration.

## License

No license has been specified yet. All original code is currently all rights reserved by the repository owner.

## Factory interaction

Open **Factory** from the sidebar or 3D station hotspot. Select a machine type, tap a tile to place it, rotate conveyor direction with **Rotate** (or **R**), and use **Remove** to erase machines. The Three.js hangar updates to match the saved layout. **Reset Layout** restores only factory machines and preserves inventory and fleet. This is blueprint mode: no resource consumption or manufacturing simulation yet.
