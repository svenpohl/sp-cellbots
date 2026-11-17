[⬅️ Back to Research-Notes Overview](../research.md)

## General CellBots Strategy 2026  
2026-11-17

This note describes the strategic direction of SP-CellBots in three focus areas: **security**, **vehicle kinematics (VK)** and **preparing the BotController for real hardware**. The order is not arbitrary — it follows the question of what actually stands in the way of a practical use of programmable matter: first, whether a system can be operated responsibly at all; second, which bot architecture is affordable in the real world; and finally, how the BotController deals with the shortcomings of real hardware.

---

### 1. Security and Cryptography

Security in SP-CellBots **is not reducible to cryptography**. Cryptographic mechanisms — for example nonce parameters in the MasterBot–CellBot communication to defend against replay attacks — are a necessary basis, but they do not answer the question of whether a built structure is safe in its specific context of use.

Morphing, control and reconfiguration must therefore **take the physical requirements of the real world into account**. Those requirements derive from the intended use, not from the protocol:

- A structure that people will later **walk on**, or a **shielding against hazardous materials**, places different demands on stability, fault tolerance and traceability than
- a **support structure for a roll-up banner** at a trade-fair stand, or a **temporary privacy screen** at a camping shower.

Security thereby becomes a **context-dependent property**: same hardware, same protocol, but different risk classes — and therefore different criteria for verification, release and abort.

On top of that comes the **almost unavoidable connection to LLM and agent systems** via the API or the **MCP (Model Context Protocol)**. It significantly widens the attack and error surface, because plans are no longer proposed only by a deterministic planner but by external agents — which makes clearly defined boundaries even more important: what an agent may propose, what the controller validates on its own, and what it rejects.

> **Without a clear security focus, even the best protocol for programmable matter / modular robots cannot be practically used or deployed.**

---

### 2. Vehicle Kinematics as the Focus

In the long term, **full-edge** SP-CellBots hold a high potential: truly **flowing structures**, possibly down to **micro- or nanoscale**. In the transition phase, however, hardware in the real world has to work with a bot architecture that keeps the **cost per SP-CellBot low** — and that is what a comparatively **simple vehicle-based architecture** delivers.

VK architectures are **simpler to build** and still allow the formation of numerous potential objects in everyday life, in manufacturing and in public spaces. The focus will therefore concentrate on **vehicle kinematics** in the future — **without reducing existing and future full-edge features in any way**. Full-edge remains available as a separate mobility mode and will continue to be developed where it plays out its specific advantage.

Development capacity will concentrate on VK in the near future — also in preparation for a **first hardware implementation**; VK is preset as the **default mode** in the coming versions.

---

### 3. Preparing for Hardware

This does **not** mean fusing a specific piece of hardware inseparably with the system — beyond the core protocol, SP-CellBots stays hardware-agnostic. The **BotController**, however, should take more strongly into account that hardware follows different conditions than a simulation:

- Hardware is **slower and more sluggish** than simulated bots (timing behaviour, inertia, mechanical limits).
- Hardware is **more error-prone** (connection drops, lost messages, mechanical disturbances).
- **Small disturbances in the sequence** require **deeper diagnostics**, because their cause cannot be read from the target plan.

This leads to a deliberate default: the BotController behaves in its **default mode — even in pure simulator operation — as if real hardware were in use: literal-minded, and potentially damaged by incorrect commands**. Among other things, this concerns conservative validation before sending, fail-fast instead of silent errors, meaningful error messages and diagnostic paths, and the expectation that confirmations (RALIFE) may sometimes fail to arrive.

The simulator should thereby not be "friendlier" than reality: behaviour that only works by accident in the simulator should become visible early instead of showing up as a new class of errors when switching to real bots.

 
