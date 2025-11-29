[⬅️ Back to Overview](../README.md)

<table>
  <tr>
    <td align="center">
      <img src="img/cellbot_concept.png" width="180"/><br>
      <sub>
        CellBot concept design<br>
        <sup><i>Blender rendering</i></sup>
      </sub>
    </td>
    <td align="center">
      <img src="img/sketch1.png" width="180"/><br>
      <sub>
        Basic degrees of freedom
      </sub>
    </td>
    <td align="center">
      <img src="img/cellbot_cross.png" width="180"/><br>
      <sub>
        CellBot micro-structure<br>
        <sub>(Cross / Rendering)</sub>
      </sub>
    </td>
  </tr>
</table>

---

# Description

---

### Basic Movement Types

- **Move:** Forward, backward, and sideways motion  
- **Spin:** 90° rotation  
- **Climb:** Movement over or along other CellBots

---

> **Core Assumptions:**
>
> - A CellBot has **no wireless communication**, **cannot jump**, and possesses **no global knowledge**.
> - Messages are passed **exclusively via relay** from a "MasterBot" (or multiple MasterBots) from CellBot to CellBot.
> - The CellBot’s **address** (routing path) is derived from its **relative position within the cluster** (multiple routes possible).
> - It is possible that some CellBots are **non-functional**, do **not respond**, or **ignore MasterBot commands**.
> - Inactive CellBots can be **removed and replaced** via **grabbing and transport** actions.

---

**Purpose of the Software:**  
The software is designed to *simulate, control, and test* various CellBot behaviors, including:

- Signal transmission between CellBots  
- Scanning and reconstructing the current cluster structure  
- Automatic calculation of morph paths  
- Transport and replacement of inactive units  
- Prototyping future algorithms, protocols, and system behaviors

---

### Software Components

| Component        | Description |
|------------------|-------------|
| **ClusterSim**   | Simulator for virtual CellBot hardware<br>Frontend: '../webgui/index.html'<br>– Simulates CellBot behavior in a 3D environment<br>– Handles signal routing and visualizes positions in a web frontend<br>– Optional logging for Blender animation<br>– Communication only via a "MasterBot Interface" at coordinate '[0,0,0]' |
| **BotController** | Control system for scanning real or simulated CellBot clusters<br>Frontend: '/webguisim/index.html'<br>– WebSocket connection to ClusterSim **or** real CellBot hardware<br>– Scans current structure and manages world state, position, orientation, and status of each CellBot<br>– Includes a robust morphing algorithm (e.g. 'morph_bfs_wavefront') |

---

[⬅️ Back to Overview](../README.md)  
**Next chapter:** [Installation & Quickstart](install.md)
