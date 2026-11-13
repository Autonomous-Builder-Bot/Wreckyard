# Wreckyard

A mobile-friendly browser game where players design modular robots, operate a scrapyard factory, research technologies and send custom machines on scavenging expeditions. Built with Three.js and vanilla JavaScript.

## Current milestone — Step 3: Living Economy

- **Interactive 3D hangar:** assembly, workshop, research, missions, warehouse, factory and fleet stations
- **Modular robot designer:** three chassis, 28 interchangeable parts, socket-based construction, live 3D preview, stats and resource costs
- **Manufacturing:** place conveyors, forges, builders, storages and generators on a 12 × 8 grid; hovering a tile shows the full machine footprint ghost in 2D and 3D, with invalid placements highlighted red
- **Production simulation:** powered forges consume four scrap to make two alloy; builders select a part recipe and manufacture real inventory using scrap/alloy
- **Real routing:** directed conveyors must link machine input and output; completed batches visibly travel to their destination in the Three.js factory
- **Manual controls:** start/pause factory, enable/disable individual processors, select assembly recipes, view live output stats and power capacity
- **Scavenging missions:** assign an actual robot to an expedition; cargo, salvage tools, speed, and durability affect rewards and wear
- **Research:** seven permanent upgrades across industry and exploration, including boosted smelting, logistics, automation, new regions and factory efficiency
- **Maintenance:** repair damaged robots with resources before another expedition
- **Machine ownership:** place from purchased machine inventory; available counts appear at the top right of each factory palette item. Removing or clearing the layout returns machines to inventory.
- **Robot visuals:** unified chassis brackets, universal connector collars, support beams, rebuilt mobility modules, articulated tools, and separated turret/power mounting positions.
- **Persistence:** versioned local saves preserve machines, research, active expeditions, factory progress, inventories and blueprints; version 1/2/3 files migrate without being wiped
- **Offline expedition completion:** expeditions complete using timestamps, but factory production progresses only while the page is open and visible

### How to play

1. Open the **Factory** station. An entirely new game has a working starter production line; older saves keep their factory layout. If your previous layout is unconnected, choose **INSTALL STARTER LINE**. This reuses machines you own and purchases any missing components if affordable; no other progress is discarded.
2. Select an assembler recipe under **Machine operations**. The default starter recipe is a scrap wheel. Press **START PRODUCTION**. Forging and construction consume your resources and then deliver output to the shared warehouse. The glow of moving packages marks completed goods in transit.
3. Open **Missions**, select a scavenger robot and deploy it to **The Rust Flats**. The expedition completes on a timer. Better salvage tools, cargo space and speed improve the haul.
4. Collect returned materials and credits, research new technology under **Research**, fix wear in **Workshop**, and use built parts and resources in **Assembly** to refit or construct new machines.

### Factory routing rules

A storage, forge, or builder can hand off materials directly to an adjacent processor or via conveyors. A conveyor arrow always points **out** toward the next connected segment. Bends are supported, but attempting to feed a conveyor from its output face does not work. To operate:

- Forges require a directed input route from storage, an output route to a builder or storage, and enough generator capacity. **4 scrap → 2 alloy**, or 3 alloy after High-Yield Smelting.
- Builders require a directed input from storage or a forge, an output to storage, and generator power. Builders make **one selected robot component per cycle**. Their recipes consume discounted scrap/alloy compared with immediate manual assembly; Precision Manufacturing discounts them further.
- Generators each add **30 units** of facility power; conveyors draw 1 unit, forges 8, builders 10. Storage uses no power.
- In-production jobs reserve materials at the beginning of the cycle. Disconnecting a conveyor pauses its affected processor. Removing a machine refunds the resources reserved for its unfinished work. Replacing the factory floor also refunds unfinished jobs and deposits goods already produced but still in transit.
- Factory machines are owned equipment. **BUY +1** spends resources and adds an unplaced machine to stock. Placing one consumes stock, not additional scrap. **Remove** returns it to stock. **Clear Layout** refunds unfinished production inputs, deposits goods already made, and returns every placed machine to storage. **Install Starter Line** reuses machines on the floor and in storage, paying only for missing equipment, and never gives free duplicates.
- A green ghost shows the proposed footprint on valid grid space; red indicates an overlap, out-of-bounds placement or empty stock. Desktop users hover and click to place. On phones, the first tap previews and a second tap (or **Place at Preview**) confirms. The ghost also appears over the Three.js factory floor.

The current model uses shared warehouse totals rather than fully local, per-machine input buffers. Conveyor **output transport** is animated and delivery completion controls when products enter inventory. Per-item belt physics and complex logistics are possible later, but not yet part of this milestone.

### Missions, repairs and research

Scavenging requires a valid powered robot design with two drives, a battery, at least one salvage tool/scanner, cargo space and 20%+ condition. Expedition time and rewards derive from the zone and the assembled robot. Robots cannot be deployed twice or refitted during a mission. Damage persists and can be repaired using scrap and alloy.

Industrial research can increase forging output, speed up conveyor deliveries or machine cycles, and lower component production costs. Exploration research unlocks progressively more valuable and risky locations. Combat and interactive combat animation remain planned future milestones.

## Factory reliability and preview

The factory editor shows the selected machine's placement footprint before committing it. Placed equipment is rendered in both the 2D planner and the Three.js factory floor. The status line reports **3D: loaded / placed**, which should match when the 3D scene is ready.

Use **View Factory in 3D** to hide the editor and inspect equipment directly; **Back to Factory** restores the controls. The close-up view hides overhead beams and the assembly crane that would otherwise obstruct the machines. On touch devices, the factory panel is kept stable while simulations run, so buttons remain tappable.

**Clear Layout · Return Machines** removes placed equipment from the floor and returns it to machine stock. In-progress fabrication inputs are refunded, and completed goods are deposited into inventory. **Install Starter Line** reuses your inventory and purchases missing equipment only with your approval.

Browser regressions run in headless Chromium on desktop and mobile. They verify real Three.js loading, actual machine counts, placement previews, clearing the floor, inventory returns, starter-line restoration and the full-screen 3D view, supplementing Node gameplay tests.

## Development and tests

Run locally with a static server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. The Three.js ES module CDN requires an internet connection. GitHub Pages can deploy the root of `main` directly without a build step.

Run unit/regression tests with Node.js 22+:

```bash
npm test
```

The tests cover the robot builder, factory routing and resources, missions, research, and versioned save migrations. GitHub Actions runs them automatically on pushes and pull requests.

## Roadmap

1. **Step 1 — Hangar and station navigation:** complete.
2. **Step 2 — Modular robot construction and blueprints:** complete.
3. **Step 3 — Working factory, scavenging, research, and repairs:** implemented, including the factory machine inventory/placement overhaul.
4. **Next milestone — Visual overhaul and combat:** make procedural components fit more convincingly, improve attachment animation and visual coherence; then build animated combat scenarios.

## License

No license has been specified; original repository code currently remains all rights reserved by the repository owner.
