[⬅️ Back to Overview](../README.md)

 

# 📜 SP-CellBots Changelog

---

- **1.9.3** (02.07.2026)  
**Extended Resilience Controller & Failure Injection**  
  - 18 fault types identified, injectable and diagnosable – see [Resilience & Error Recovery](resilience.md) for details  
  - `config_corrupt_msg`, `config_msg_delay`, `config_max_msgqueue`: New ClusterSim failure-injection commands  
  - `config_duplicate_msg`, `config_disable_forwarding`, `config_fakeid`: Extended failure injection

- **1.9.2** (27.06.2026)  
**ClusterSim Obstacles & Slot Reliability**  
  - `set_obstacle true/false <x> <y> <z>`: Place/remove obstacles in ClusterSim – blocks MOV and SPIN commands (functional mesh blocking). Use `forbidden_add` on BotController side for path planner awareness  
  - `config_slot <bot_id> "<slot>:<prob>"`: Configure per-slot reliability (0.0–1.0) on individual bots to simulate dirty/corrupted link interfaces – affects both outgoing and incoming traffic  
  - `verify_bot_position`, `trace_move_path`, `integrate_bot`: New resilience diagnostics  
  - ClusterSim failure-injection API (port 3101): `disable_bot`, `enable_bot`, `set_mobility`, `get_bot_info`, `describe`, `teleport_bot_to`, `add_bot_to`, `set_move_interruption`, `config_slot`, `set_obstacle`, `get_status`

- **1.9.1** (24.06.2026)  
**Resilience Controller & World Model Consistency Tools**  
  - `resilience_controller.js`: Central event collector framework for unusual bot behaviour – designed for future error-handling extensions (timeout detection, ping verification, automatic recovery)  
  - `diagnose_bot_address <bot_id>`: Walks the mesh address path of any bot hop by hop and checks each intermediate position for inactive bots via targeted CHECK commands. Detected inactive bots are automatically registered and addresses are recalibrated – no full Level 2 scan required  
  - `set_active <bot_id> <true|false>`: Activate or deactivate a bot in the world model. Deactivated bots are excluded from morph donor selection and their positions are treated as forbidden by the path planner  
  - `set_mobility <bot_id> <true|false>`: Set a bot's mobility flag. Immobile bots remain in the mesh for signal forwarding but are excluded from morph operations  
  - `check_if_inactive <x> <y> <z>`: Surgical offline-check – finds a neighbor bot, sends a targeted CHECK command, and registers the position as inactive if an OFFL status is detected  
  - ClusterSim failure-injection API (port 3101): `disable_bot`, `enable_bot`, `set_mobility`, `get_bot_info`, `describe`  
  - First automatic self-repair: Resilience Controller detected hMB2 (or another helper-MasterBot) contact loss, disabled the MB and redistributed bots via `adc_assign_proximity`

- **1.9** (19.06.2026)  
**AccessDomainController (ADC) – Multi-MB infrastructure**  
  - Legacy single-MasterBot replaced by primary MB + helper MBs (hMB1, hMB2)  
  - Each MB connected via dedicated connector (shared/exclusive WebSocket slots)  
  - Configuration via `config_mb.xml`  
  - Parallel cluster scanning across all MBs for higher throughput  
  - Automatic proximity-based bot-to-MB assignment (`adc_assign_proximity`)  
  - Disable/enable MBs at runtime (`disable_mb`, `enable_mb`) with automatic bot redistribution  
  - `adc_auto_assign_proximity` config flag for post-move reassignment  
  - FullEdge BFS wavefront morphing fully operational over new ADC infrastructure  
  - Vehicle kinematics morphing runs stably over ADC  
  - New API: `generate_detour_address`, `adc_assign_proximity`, `disable_mb`, `enable_mb`

- **1.8** (07.06.2026)  
**NightWatch – watch_region auto-ping system for world model consistency**  
  - `watch_region`: Create/update observed 3D regions with periodic random pings  
  - `create_watch_region`: High-level shortcut with auto-ID and outer_bots filter  
  - `ping_position` / `ping_status`: Ping a coordinate and verify bot presence  
  - `watch_region poll`: Detects BOT_MISSING, UNEXPECTED_BOT changes vs snapshot  
  - Auto-snapshot on region creation, masterbot excluded from pings  
  - `outer_bots`: Only monitors cluster-surface bots (<6 neighbors)

- **1.7.9** (05.06.2026)  
**ping_position / ping_status API – BotController world model improvements**  
  - `ping_position x y z`: Ping a coordinate via INFO opcode, returns tmpid  
  - `ping_status tmpid`: Check if a bot responded (bot_found, bot_id, position)  

- **1.7.8** (31.05.2026)  
**Shepherd experiments, get_bot_info API, test structures**  
  - New: `get_bot_info <id>` – position, orientation, adress, payload, neighbors in one call  
  - New: shepherd experiment prompts (exp03–exp09) in botcontroller/  
  - New: test structures (target1–4, pins.json)  
  - `grab_bot` uses B-slot (back) in VK mode

- **1.7.7** (23.05.2026)  
**get_bots_in_region API, would_split_cluster in diagnose, CLI fixes**  
  - `get_bots_in_region x1 y1 z1 x2 y2 z2`: 3D bounding-box scan  
  - `diagnose_move_bot_to`: would_split_cluster + disconnected_bots  
  - CLI: fixed get_bots, get_neighbors, morph_get_* output  
  - JSON offline error (instead of console.error)  
 

- **1.7.6** (23.05.2026)  
**Parallel Vehicle-Kinematics Morph & Auto Structurescan**
  - **Parallel VK Morph:** Multiple bots can now move simultaneously in the same wave. Collect-execute phase with up to 10 non-colliding paths per wave
  - **Successfully tested:** base_72 → 72_table, 25_cross, 72_wall, 25_arch and back
  - **Start position isolation:** Prevents adjacent path starts to avoid RALIFE deadlocks  
  - **Auto structurescan:** `auto_structurescan = true` triggers scan ~3s after startup
  - **Improved diagnostics:** Detailed morph plan log for debugging
  - **RALIFE robustness:** Excludes simultaneously moving bots from return-address routing

- **1.7.5** (18.05.2026)  
**3D Cursor for rapid Vehicle-Kinematics Moves & LLM Collaboration Guide**
  - **3D Cursor:** Selected bots can be moved to any reachable position and orientation directly from the BotController WebGUI
  - **Ghost Preview + Orientation Arrow:** Target position and direction are shown interactively in the 3D view
  - **LLM Collaboration Guide:** New documentation `docs/llm_collaboration.md` with a recorded example dialogue

- **1.7.4** (17.05.2026)  
**Vehicle Kinematics Payload — B-Slot Transport & WebGUI API CLI**
  - **B-Slot Payload:** In `vehicle_kinematics` mode, a carried payload bot is now always attached to the carrier's back (B-Slot). This leaves the F-Slot free for climbing walls and stairs, making payload transport and terrain navigation compatible  
  - **World model sync:** BotController and ClusterSim correctly update the payload's **position and orientation** after carrier moves and rotations (90° and 180°), even when the payload started with a different facing direction  
  - **API CLI in BotController WebGUI:** The BotController WebGUI (`http://localhost:3010`) now has a built-in **API CLI panel** — type `node api.js` commands directly into the browser, see JSON responses live. Click any bot in the 3D view to auto-fill its ID into the command. Includes a dropdown of example commands for quick experimentation  
  - **Primary demo:** `node api.js structurescan` then switch to BotController WebGUI and try the API CLI examples

- **1.7.3** (12.05.2026)  
**Hybrid Kinematics mobility mode (API preview)**
  - Added `mobility_mode = hybrid_kinematics` as the new default mode (preview)
  - For morph demos, set `mobility_mode = full_edge` in `config.cfg` of both botcontroller and cluster_sim
  - In this mode, SP-CellBots can move in 3D including ceiling (upside-down) positions — path planning supports horizontal, vertical, wall, step, and climb primitives
  - Mode is currently only active for the LLM-facing API command `move_bot_to` (NOT for morphing)
  - Primary demo: `"node api.js move_bot_to B26 4 2 3"`
  - Fixed several inconsistencies in vehicle-kinematics movement primitives
  - Extended `tools/voxeledit/` with new features and added test constructs for 300-bot morphing experiments

- **1.7.2** (03.05.2026)  
**Sequential Vehicle Kinematics Morph**
  - Added `SequentialVKMorph` algorithm — morphing under vehicle-kinematics constraints using A* path planning on movement states (position + rotation)
  - Path planning now supports `find_path_for_bot` and `move_bot_to` with VK-aware rotation insertion
  - Default construct changed to `base_100.xml` for larger morph experiments
  - Tested and morphable structures: `base_100`, `25_arch`, `25_cross`
  - Added dedicated documentation chapter: **[Vehicle Kinematics](vehicle_kinematics.md)**

- **1.7.1** (29.04.2026)  
**VoxelEdit integration**
  - Added `tools/voxeledit/` – a standalone 3D voxel editor for SP-CellBots
  - Three.js-based editor with Construct (XML), Structure (JSON), and Overlay modes
  - Place, delete, rename, and visually edit bot positions in a 3D viewport
  - Separate target-file workflow for TRGT markers
  - Express server on port 5175, start with `cd tools/voxeledit && node server.js`

- **1.7** (28.04.2026)  
**Vehicle Kinematics mobility mode (preview)**
  - Added `mobility_mode = vehicle_kinematics` as the new default mode (preview)
  - In this mode, SP-CellBots can only drive forward/backward in a straight line, and can climb walls/stairs only in that direction — path planning accounts for this constraint
  - Mode is currently only active for the LLM-facing API command `move_bot_to` (NOT for morphing)
  - Goal: preparation for simpler, more realistic hardware as a stepping stone toward `full_edge` mobility
  - Primary demo: `node api.js structurescan` + `node api.js move_bot_to B26 5 2 4 0 0 -1`
  - Test batch sequence: `node api.js batch ./tests/batch02.json`
  - Additional changes: minor bugfixes and sequential batch processing in `api.js`

- **1.6** (18.04.2026)  
**Direct-Radio transition layer and API architecture refactor**
  - Added preparation for a simpler hardware transition path with **direct radio communication** (`communication_mode = direct_radio`) while keeping `mesh_opcode` as default reference mode
  - Added configurable **Radio IDs (`rid`)** and static radio mapping flow for direct addressing in both ClusterSim and BotController
  - Introduced and documented the new **NBH / RNBH OP-codes** for direct-radio neighborhood discovery, enabling precise bot relocalization (position/orientation sync) without mesh route addressing
  - Refactored BotController API implementation from a monolithic `botcontroller_class.js` block into structured runtime/service modules for better maintainability and faster extension
  - Migrated and stabilized core API command paths for `direct_radio`, including scan, level-2 scan, movement, rotation, targeted resync (`search_bot`), and crater build/fill execution flows
  - Added dedicated documentation chapter: **[Direct Radio](direct_radio.md)**
  - LLM testing and interactive API control during this phase were performed with **Codex GPT-5.4**

- **1.5.4** (08.04.2026)  
**Repair workflow expansion: crater build/fill and rescue tooling**
  - Added API-first crater workflow for repair scenarios: **`calc_crater`**, **`crater_start`**, **`crater_check_progress`**, **`crater_fill`**, **`crater_list`**
  - Implemented asynchronous crater execution with progress/state tracking (similar to morph progress handling)
  - Added automatic reverse-fill support for named crater sessions to close previously opened access shafts
  - Extended API diagnostics and planning helpers for repair/rescue flows, including **`get_grab_positions`**, **`get_turn_positions`**, **`get_bots_by_prefix`**, and **`get_inactive_bots`**
  - Improved runtime role handling for **Forbidden** and **ServiceBay** cells in practical API workflows
  - Expanded API docs with a dedicated crater-build section and repair demo visuals
  - LLM testing and interactive API control during this phase were performed with **Codex GPT-5.4**

- **1.5.3** (05.04.2026)  
**Hotfix: release/payload edge case in ClusterSim**
  - Bugfix in `cluster_sim/bot_class.js` for release flow with carried payloads near servicebay extraction

- **1.5.2** (05.04.2026)  
**Servicebay lifecycle and payload recycle semantics**
  - Improved runtime role application so **Apply F-Bots** now also applies **X / service-bay** cells consistently in BotController
  - Extended WebGUI feedback to show both applied **F-Bot** and **X-Bot** counts after runtime role application
  - Hardened ClusterSim queue stepping to avoid crashes when bots are removed during iteration (servicebay extraction while processing bot queues)
  - Introduced a clearer payload recycle protocol in BotController:
    - payload bots reaching **X** while still grabbed are marked as **pending recycle**
    - final recycle is executed on **release** (or release-timeout recovery fallback)
  - Verified that carried-payload transport to servicebay no longer causes premature local deletion and now resolves in a controlled release step
  - LLM testing and interactive API control during this phase were performed with **Codex GPT-5.4**

- **1.5.1** (04.04.2026)  
**Communication and address stability update**
  - Added address-focused API helpers such as **`safe_mode`**, **`recalibrate_bot_address`**, **`recalibrate_bot_addresses`**, and **`diagnose_ack_route`**
  - Introduced a staged **safe mode** model for BotController actions, including global address recalibration after confirmed structural changes
  - Stabilized temporary ACK route planning by fixing numeric coordinate normalization inside the internal return-address search
  - Added an optional **`minimal`** recalibration mode to prefer shorter and simpler local bot addresses in stable structures such as **`base_25`**
  - Hardened MOVE path-to-primitive translation so the diagnostic primitive grouping is now much closer to the legacy translator used for real execution
  - Improved confidence that direct API stacking, restacking, and remorphing flows can be executed without constantly resetting the test setup
  - LLM testing and interactive API control during this phase were performed with **Codex GPT-5.4**

- **1.5** (04.04.2026)  
**API V1 becomes practically usable**
  - Expanded the BotController API into a much more complete control layer for humans, scripts, and LLM tooling
  - Added high-level transport helpers such as **`move_carrier_to`** and **`diagnose_move_carrier_to`**
  - Added small Morph API building blocks such as **`morph_get_structures`**, **`morph_get_algos`**, **`morph_start`**, and **`morph_check_progress`**
  - Improved payload-aware path planning, payload synchronization after carrier rotations, and bundled rotation execution with cleaner ACK routing
  - Fixed important simulator/controller consistency issues around payload transport, blocked rotations, ACK routing after rotations, and morph progress reporting
  - LLM testing and interactive API control during this phase were performed with **Codex GPT-5.4**

- **1.4.2** (30.03.2026)  
**Inactive Bot Detection, Universal Scan, and X-Ray Visualization**
  - Added a two-stage scan workflow in BotController WebGUI: **`Start Scan`** for active structure discovery and **`Scan Level 2`** for secondary inactive-bot diagnostics
  - Implemented first end-to-end detection of **inactive bots** across **ClusterSim** and **BotController**: inactive bots now drop out of the normal active scan but can be detected and reinserted as diagnostic placeholders
  - Extended **`CHECK` / `RCHECK`** with a backward-compatible universal scan mode using **`.`** as wildcard target and compact slot-state reports in **`FRBLTD`** order
  - Added BotController frontend visualization for detected inactive bots as **semi-transparent red markers**
  - Added **X-Ray Mode** in the BotController frontend: active bots are rendered transparent while inactive bots are highlighted more clearly for diagnostics
  - Unified the command parser into a single shared implementation in **`/common/cmd_parser_class.js`** so ClusterSim and BotController use the same protocol parser


- **1.4.1** (26.03.2026)  
**Preparatory Structure Extension for Planned Repair Demo**
  - Added initial support in BotController for an optional object-based structure format in **`/botcontroller/structures/[structure].json`**
  - Existing plain voxel-array JSON files remain compatible; object-based files now use **`structure`** as the primary target voxel set
  - Introduced preparatory role fields for extended structure definitions: **`carrier`**, **`reserve`**, **`x`** (planned storage area for inactive bots), **`forbidden`** (blocked voxel positions), and BotController-side handling of **`inactive`**
  - Added minimal example file **`/botcontroller/structures/base_25_forbidden.json`** as a first extended-format demo structure
  - BotController now keeps extended structure-role data separate from the main target bot coordinates for future repair and scenario logic
  - Added initial WebGUI visualization for **`forbidden`** positions: exemplar voxels are rendered as semi-transparent dark wine-red markers

- **1.4** (11.12.2025)  
**Stability & Compatibility Update for Node.js v23.11.0**
  - Updated entire codebase for compatibility with **Node.js v23.11.0**
  - Fixed **RSA signing** (stable PKCS8 flow) and added **PEM compression / restore helpers**
  - Centralized signature logic in **`/common/signature/`**
  - Resolved ED25519 Base64 encoding/decoding inconsistencies
  - Added **`system_utils.js`** with automatic Node.js version validation
  - Introduced **MasterBot auto-connect / reconnect** mechanism
  - Cleanly decoupled WebGUI websocket (`ws_gui`) from ClusterSim TCP client
  - Reworked shutdown handling — no more double termination of processes
  - Internal refactoring for long-term extensibility  
    (multiple MasterBots, persistent hardware targets, async pipeline)



- **1.3.1** (29.11.2025):  
  – Added new **Research Notes** section under '/docs/research'  
  – Included first two research entries:  
    • **GPU vs. CPU Pathfinding Studies**  
    • **Floodfill-Morph Approach (Early Experiments)**  
  – Research Notes provide an informal but structured space for documenting  
    experimental ideas, performance studies, and conceptual branches that  
    extend beyond the main implementation.

- **1.3** (15.08.2025):  
  – Added **Target Preview** feature in BotController frontend — displays a semi-transparent, slightly enlarged (scale 1.1) visualization of the target structure for improved visibility during planning and debugging  


- **1.2** (11.08.2025):  
  – Added **Voxelizer 1.2** under 'tools/voxelizer' — a Node.js script with a web-based frontend for voxelizing 3D objects ('.glb' format)  
  – Supports configurable grid size, inside/outside detection via raycasting, optional shell extraction, progress display, and JSON export for use as CellBots target structures


- **1.1** (23.07.2025):  
  – MasterBot can now sign messages using **HMAC**, **ED25519**, or **RSA** (configurable)  
  – Added 'SYS#LOCK' command to selectively disable CellBot communication slots  
  – Added 'SYS#UPDATEKEY' command to securely update shared secrets or public keys at runtime  
  – The 'MOVE' command now supports a 'NONCE;(number)' subcommand as preparation for replay protection (not yet active in ClusterSim)



- **1.0** (19.07.2025): First MVP released

  ✅ First MVP released  
  – Core modules: ClusterSim, BotController, Frontends  
  – Movement system with 'MOVE' OP-code and anchors  
  – Quaternion-based rotation, morphing logic, replay system  
  – Basic communication via OP-code messages  
  – Export to Blender and logging support
  
---

[⬅️ Back to Overview](../README.md)  
 
