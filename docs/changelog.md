[⬅️ Back to Overview](../README.md)

 

# 📜 SP-CellBots Changelog

---


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
 
