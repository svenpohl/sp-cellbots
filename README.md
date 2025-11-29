# SP-CellBots – A Simulator for Programmable Matter

Sven Pohl B.Sc. <sven.pohl@zen-systems.de> — MIT License © 2025  
This project is licensed under the [MIT License](./LICENSE).

**SP-CellBots** is an open simulation and control system for programmable matter.  
It is based on a fictional hardware model: the **SP-CellBot**, a modular unit capable of moving across identical elements, stacking, and forming fixed connections in order to *morph* into arbitrary 
structures. 

> ⚠️ Note: The term "CellBots" is used here in a descriptive, non-commercial context and is not affiliated with any external research groups or trademarks.

<div align="center"><strong>„Morph. Code. Forge.“</strong></div>


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
- [Usage & Examples](docs/usage.md)  
- [Morphing](docs/morphing.md)  
- [Blender Replay and Animation](docs/blender.md)  
- [Tools (Scripts)](docs/tools.md)  
- [Vision & Future Applications](docs/vision.md)
- [Research Notes](docs/research.md)

---

## 🧩 Version

Current version: **1.3.1**

---


## 📝 Changelog

- **1.3.1** (29.11.2025):  
  – Added new **Research Notes** section under `/docs/research`  
  – Included first two research entries:  
    • **GPU vs. CPU Pathfinding Studies**  
    • **Floodfill-Morph Approach (Early Experiments)**  
  – Research Notes provide an informal but structured space for documenting  
    experimental ideas, performance studies, and conceptual branches that  
    extend beyond the main implementation.

- **1.3** (15.08.2025):  
  – Added **Target Preview** feature in BotController frontend — displays a semi-transparent, slightly enlarged (scale 1.1) visualization of the target structure for improved visibility during planning and debugging  


- **1.2** (11.08.2025):  
  – Added **Voxelizer 1.2** under `tools/voxelizer` — a Node.js script with a web-based frontend for voxelizing 3D objects (`.glb` format)  
  – Supports configurable grid size, inside/outside detection via raycasting, optional shell extraction, progress display, and JSON export for use as CellBots target structures


- **1.1** (23.07.2025):  
  – MasterBot can now sign messages using **HMAC**, **ED25519**, or **RSA** (configurable)  
  – Added `SYS#LOCK` command to selectively disable CellBot communication slots  
  – Added `SYS#UPDATEKEY` command to securely update shared secrets or public keys at runtime  
  – The `MOVE` command now supports a `NONCE;(number)` subcommand as preparation for replay protection (not yet active in ClusterSim)



- **1.0** (19.07.2025): First MVP released

  ✅ First MVP released  
  – Core modules: ClusterSim, BotController, Frontends  
  – Movement system with `MOVE` OP-code and anchors  
  – Quaternion-based rotation, morphing logic, replay system  
  – Basic communication via OP-code messages  
  – Export to Blender and logging support
  
---

## 🚧 Planned Features

- **Decentralized AntMorph algorithm (planned):**  
  A lightweight, swarm-based morphing system is in development, inspired by ant behavior.  
  Bots will attempt to fill free target positions without global coordination, based on local visibility and optional heuristics (e.g., cluster center proximity).  
  Goal: support fast and distributed formation of arbitrary patterns in constrained environments.


---

## 🤝 Contributing

Pull requests are welcome!


## 💛 Support / Donate

If you enjoy this project and want to support ongoing development, feel free to send a Bitcoin donation to:

**BTC address:**  
`bc1qr49kr0cn92wmtne4tasdqe9qzfhj0jqvpxjhha`

> *"If you’d like to say thanks: Even a few sats are appreciated!"*

🙏 Thank you!

---

📬 **Feedback welcome**  
If you're experimenting with CellBots or building something on top of it, I'd love to hear from you.  
Even a short message helps with motivation and future planning.

Feel free to drop a quick note to:  
`sven.pohl@zen-systems.de`
