# SP-CellBots – A Simulator for Programmable Matter

Sven Pohl B.Sc. <sven.pohl@zen-systems.de> — MIT License © 2026  
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
- [API](docs/api.md)  
- [Morphing](docs/morphing.md)  
- [Blender Replay and Animation](docs/blender.md)  
- [Tools (Scripts)](docs/tools.md)  
- [Vision & Future Applications](docs/vision.md)
- [Research Notes](docs/research.md)

---



## 🧩 Version

Current version: **1.5.1**  
Developed and tested on **Node.js v23.11.0**.  
Due to rapid ecosystem changes, newer or older versions may cause incompatibilities.

Latest changes:

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
  - Extended diagnostics and recovery behavior around MOVE planning, payload transport, and morph progress tracking
  - Fixed several smaller consistency and simulator/controller sync issues discovered during direct LLM-driven testing
  - LLM testing and interactive API control during this phase were performed with **Codex GPT-5.4**

👉 Full changelog is available at:  
➡️ [docs/changelog.md](docs/changelog.md)

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
'bc1qr49kr0cn92wmtne4tasdqe9qzfhj0jqvpxjhha'

> *"If you’d like to say thanks: Even a few sats are appreciated!"*

🙏 Thank you!

---

📬 **Feedback welcome**  
If you're experimenting with CellBots or building something on top of it, I'd love to hear from you.  
Even a short message helps with motivation and future planning.

Feel free to drop a quick note to:  
'sven.pohl@zen-systems.de'
