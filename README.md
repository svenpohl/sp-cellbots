# SP-CellBots – A Simulator for Programmable Matter

Sven Pohl B.Sc. <sven.pohl@zen-systems.de> — MIT License © 2026  
This project is licensed under the [MIT License](./LICENSE).

**SP-CellBots** is an open simulation and control system for programmable matter.  
It is based on a fictional hardware model: the **SP-CellBot**, a modular unit capable of moving across identical elements, stacking, and forming fixed connections in order to *morph* into arbitrary 
structures. 

**Features:**

- **Mobility Modes:** `vehicle_kinematics`, `full_edge` and `hybrid_kinematics` — each with dedicated path planning and movement primitives  
- **Rich API:** Numerous manipulation and diagnostic tools, optimized for LLM-driven control via Codex, Deepseek or Gemini CLI  
- **Structure Morphing:** Support for `full_edge`, sequential and **parallel** VK morphing algorithms  
- **Cryptographic Signatures:** ED25519-based message signing to protect against unauthorized access (pre-configured; generate your own keys before practical deployment)

<table>
  <tr>
    <td align="center">
      <img src="docs/img/ai_cellbot.png" width="180"/><br>
      <sub>
        AI-generated CellBot concept<br>
        <sup><i>Image generated with OpenAI (ChatGPT/DALL·E)</i></sup>
      </sub>
    </td>
    <td align="center">
      <img src="docs/img/webgui.png" width="180"/><br>
      <sub>
        WebGUI BotController<br>
        <sub>(Screenshot)</sub>
      </sub>
    </td>
    <td align="center">
      <img src="docs/img/stick_figure_blender.png" width="180"/><br>
      <sub>
        Animated Blender export<br>
        <sub>(Rendering)</sub>
      </sub>
    </td>
  </tr>
</table>

---

## 📚 Contents

- [Description](docs/description.md)  
- [Installation & Quickstart](docs/install.md)  
- [CellBot Protocol and OP-Codes](docs/protocol.md)  
- [CellBot Hardware Blueprint (Virtual)](docs/hardware_blueprint.md)  
- [Direct Radio](docs/direct_radio.md)  
- [Vehicle Kinematics](docs/vehicle_kinematics.md)  
- [Usage & Examples](docs/usage.md)  
- [API](docs/api.md)  
- [LLM Collaboration](docs/llm_collaboration.md)  
- [Morphing](docs/morphing.md)  
- [Blender Replay and Animation](docs/blender.md)  
- [Tools (Scripts)](docs/tools.md)  
- [Vision & Future Applications](docs/vision.md)
- [Research Notes](docs/research.md)

---



## 🧩 Version

Current version: **1.7.8**  
Developed and tested on **Node.js v26.0.0**.  
Due to rapid ecosystem changes, newer or older versions may cause incompatibilities.

Latest changes:

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
  - **Parallel VK Morph:** Multiple bots can now move simultaneously in the same wave. A collect-execute phase gathers up to 10 non-colliding paths before dispatching them together. Includes `securityShell` (orthogonal path expansion) and heuristics (free Y+, free Y-) to minimize conflicts
  - **Successfully tested:** base_72 → 72_table, 25_cross, 72_wall, 25_arch and back – with parallel waves up to 3 bots moving simultaneously
  - **Start position isolation:** Both the A* planner and the collect phase now ensure that no two paths start adjacent to each other, preventing RALIFE deadlocks
  - **Auto structurescan:** New config flag `auto_structurescan = true` triggers a scan ~3s after BotController startup – no more manual scan needed
  - **Improved diagnostics:** Detailed wave-by-wave morph plan written to `morph_vehicle_kinematics_parallel_morphplan.txt` for debugging
  - **Robustness:** The RALIFE return-address calculation now excludes simultaneously moving bots from the routing table, eliminating the main source of stuck parallel morphs

- **1.7.5** (18.05.2026)  
**3D Cursor for rapid Vehicle-Kinematics Moves & LLM Collaboration Guide**
  - **3D Cursor:** Selected bots can now be moved to any reachable position and orientation directly from the BotController WebGUI using the 3D cursor. Place the cursor with a mouse click, set the target orientation via the 'r' key or the ↻ button, and execute the move through the integrated API CLI
  - **Ghost Preview:** A translucent wireframe cursor shows the planned target position on hover — derived from the free neighbor grid of the most recently marked anchor bot
  - **Orientation Arrow:** The target vector is visualized as a red 3D arrow on the cursor, toggled through the four main directions via click or 'r' key
  - **LLM Collaboration Guide:** New documentation `docs/llm_collaboration.md` featuring a recorded example dialogue — from scan through move and grab to stacking bots, ideal as an entry point for AI-assisted control

- **1.7.4** (17.05.2026)  
**Vehicle Kinematics Payload — B-Slot Transport & WebGUI API CLI**
  - **B-Slot Payload:** In `vehicle_kinematics` mode, a carried payload bot is now always attached to the carrier's back (B-Slot). This leaves the F-Slot free for climbing walls and stairs, making payload transport and terrain navigation compatible  
  - **World model sync:** BotController and ClusterSim correctly update the payload's **position and orientation** after carrier moves and rotations (90° and 180°), even when the payload started with a different facing direction  
  - **API CLI in BotController WebGUI:** The BotController WebGUI (`http://localhost:3010`) now has a built-in **API CLI panel** — type `node api.js` commands directly into the browser, see JSON responses live. Click any bot in the 3D view to auto-fill its ID into the command. Includes a dropdown of example commands for quick experimentation  
  - **Primary demo:** `node api.js structurescan` then switch to BotController WebGUI and try the API CLI examples

- **1.7.3** (12.05.2026) — **Hybrid Kinematics mobility mode (API preview)**
- **1.7.2** (03.05.2026) — **Sequential Vehicle Kinematics Morph**
- **1.7.1** (29.04.2026) — **VoxelEdit integration**
- **1.7** (28.04.2026) — **Vehicle Kinematics mobility mode (preview)**
- **1.6** (18.04.2026) — **Direct-Radio transition layer and API architecture refactor**
- **1.5** (04.04.2026) — **API V1 becomes practically usable**

👉 Full changelog is available at:  
➡️ [docs/changelog.md](docs/changelog.md)

---

## 📖 How to cite

If you use SP-CellBots in your work, please cite one (or more) of the following:

- **Software (GitHub / CITATION.cff):**  
  Use the repository citation metadata (GitHub “Cite this repository” / `CITATION.cff`).

- **Core concept and opcode protocol:**  
  Pohl, S. (2026). *A Modular and Secure Opcode Protocol for Programmable Matter*. Zenodo.  
  [https://doi.org/10.5281/zenodo.19509605](https://doi.org/10.5281/zenodo.19509605)

- **Applied benchmark / follow-up study:**  
  Pohl, S. (2026). *A Qualitative Benchmark Comparison of Full-Edge and Vehicle Kinematics in SP-CellBots*. Zenodo.  
  [https://doi.org/10.5281/zenodo.20074691](https://doi.org/10.5281/zenodo.20074691)
  
---

## 🚧 Planned Features

- **Decentralized AntMorph algorithm (planned):**  
  A lightweight, swarm-based morphing system is in development, inspired by ant behavior.  
  Bots will attempt to fill free target positions without global coordination, based on local visibility and optional heuristics (e.g., cluster center proximity).  
  Goal: support fast and distributed formation of arbitrary patterns in constrained environments.


---

## 🤝 Contributing

Pull requests are welcome!

<div align="center"><strong>„Morph. Code. Forge.“</strong></div>

## 💛 Support / Donate

If you enjoy this project and want to support ongoing development, feel free to send a Bitcoin donation to:

**BTC address:**  
'bc1qr49kr0cn92wmtne4tasdqe9qzfhj0jqvpxjhha'

> *"If you’d like to say thanks: Even a few sats are appreciated!"*

🙏 Thank you!

---

📬 **Feedback welcome**  
If you're experimenting with CellBots or building something on top of it, I'd love to hear from you.  
Even a short message helps with motivation and future planning.

Feel free to drop a quick note to:  
'sven.pohl@zen-systems.de'
