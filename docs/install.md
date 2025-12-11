[⬅️ Back to Overview](../README.md)

# CellBots – Installation

Current version: **1.4**  
Developed and tested on **Node.js v23.11.0**.  
Due to rapid ecosystem changes, newer or older versions may cause incompatibilities.

---

This repository contains both main components:  
- **botcontroller** (Backend)  
- **clustersim** (Simulation/Frontend)


Please run 'npm install' root folder:

```sh

npm install


```


To start the system, launch both components in their own terminal windows  

```sh
cd botcontroller
node botcontroller
```

```sh
cd cluster_sim
node cluster_sim
```

or 

```sh
cd cluster_sim
node cluster_sim --quiet
```


Both Web GUIs are optional but offer a convenient interface for exploring and controlling prepared experiments.

---

# Overview: CellBots WebGUI & ClusterSim

<table>
  <tr>
    <td align="center">
      <img src="img/screen_clustersim.png" width="280"/><br>
      <sub>
        % node cluster_sim<br>
      </sub>
    </td>
    <td align="center">
      <img src="img/screen_webguiclustersim.png" width="280"/><br>
      <sub>
        /cluster_sim/webguisim/index.html<br>
        <sub>WebGUI Cluster Simulator</sub> 
      </sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="img/screen_botcontroller.png" width="280"/><br>
      <sub>
        % node botcontroller<br>
      </sub>
    </td>
    <td align="center">
      <img src="img/screen_webguicontroller.png" width="280"/><br>
      <sub>
        /botcontroller/webguicontroller/index.html<br>
        <sub>WebGUI BotController</sub>
      </sub>
    </td>
  </tr>
</table>

---

## Quick Start: Morphing with CellBots – Visualize Your Own Structures

Once all four components are running and open, you’re ready to start.  
**Morph sequences like Arch, Tower, Ring or Stick-Figure can be simulated immediately in 3D.**

In the BotController WebGUI, click **Start Scan** to scan the current structure of the CellBot cluster via ClusterSim.  
The 3D view will then mirror the same structure. Now, you can morph into a target structure like **25_arch**.

By default, 'ClusterSim' starts with **25 CellBots and one MasterBot** arranged in a flat base layout (see 'config.txt').  
You can instantly morph into any structure starting with '25_' (e.g., '25_ring', '25_tower', etc.).  
**More complex forms** can be loaded by switching the 'config.txt' to use 'base_72.xml'.  
Note: The more complex the target structure, the longer the BFS wavefront morphing algorithm will take.

**Important:**  
Before morphing into a new target structure, always first morph back into the correct base structure (e.g., 'base_25').  
The current algorithm does not yet remove surplus CellBots.

---

## Designing Your Own Structures

- **Add your own target structures** in simple JSON format:  
  Place them here:
  ```
  botcontroller/structures/[structure].json
  ```
  Example format:
  ```json
  [
    { "x": 2, "y": 1, "z": 1 },
    { "x": 4, "y": 1, "z": 1 },
    ...
  ]
  ```

- **Tip:**  
  Use the Blender export script:
  ```
  /tools/blender_python_targetdesign.py
  ```
  This generates '.json' files directly from Blender.  
  It’s best to enable snap mode so that cubes align perfectly to the 3D grid.

Now you can let your creativity run wild: design any **voxel-based structure**, experiment with shapes and morph sequences!  
⚠️ Each new structure must share at least one coordinate with the base structure, otherwise the algorithm cannot find a valid starting point.

---

**Try it now – and build your own morphing worlds in minutes!**

---

|                       | **ClusterSim WebGUI**                | **BotController WebGUI**           |
|-----------------------|--------------------------------------|------------------------------------|
| **Shell**             | '% node cluster_sim'                 | '% node botcontroller'             |
| **Frontend/WebGUI**   | '/cluster_sim/webguisim/index.html'  | '/botcontroller/webguicontroller/index.html' |
| **Description**       | WebGUI Cluster Simulator             | WebGUI BotController               |

---

## Components & Ports

The current CellBots architecture has two main components,  
each with its own WebGUI and dedicated network ports (hardcoded for now):

| **Component**          | **Frontend/WebGUI**                                 | **Port** | **Description**                                   |
|------------------------|-----------------------------------------------------|----------|----------------------------------------------------|
| ClusterSim Simulator   | '/cluster_sim/webguisim/index.html'                 | **3020** | WebSocket port for ClusterSim frontend             |
| ClusterSim Server      |                                                     | **3001** | Connection from BotController to ClusterSim server |
| BotController Frontend | '/botcontroller/webguicontroller/index.html'        | **3010** | WebSocket port for BotController frontend          |

---

## Start & Usage

### **ClusterSim**

- **Start:**  
  ```sh
  % node cluster_sim
  ```
- **WebGUI:**  
  Access via:  
  ```
  http://localhost:3020
  ```
- **Configuration:**  
  Defined via 'config.txt'
- **Control:**  
  All interactions handled through the WebGUI and server communication.

---

### **BotController**

- **Start:**  
  ```sh
  % node botcontroller
  ```
- **WebGUI:**  
  Access via:  
  ```
  http://localhost:3010
  ```
- **Configuration:**  
  Fast variable setup via 'config.txt'
- **Shell Console:**  
  Supports custom commands:
  - 'quit' gracefully shuts down both components
  - Custom commands like 'push' and test routines
- **WebGUI:**  
  Includes its own "Quit" button

---

## Notes on Operation

- **Communication:**
  - Port **3001**: Connection from BotController → ClusterSim
  - Port **3010**: Websocket for BotController GUI
  - Port **3020**: Websocket for ClusterSim GUI
- **Quit:**  
  Both frontends include a convenient "Quit" button.
- **Flexibility:**  
  You can tweak any config setting via 'config.txt' in each component.

---

**Note:**  
All ports and paths are currently hardcoded in the source and can be adjusted centrally if needed.  
The BotController shell interface allows for flexible test commands, while the WebGUIs provide a user-friendly control surface.

---

# Configuration

```ini
# -------- config.txt for ClusterSim --------

version = 1.0
port    = 3001
name    = Default Swarm

blenderlogging = true

# Possible base cluster layouts:
# construct = cells.xml
construct = base_25.xml
# construct = base_x.xml
# construct = base_72.xml

stepdelay = 20
physical_bot_move_delay = 300

# -------- config.txt for BotController --------

version           = 1.0
connect_masterbot = 1
masterbot_host    = localhost
masterbot_port    = 3001

# MasterBot initialization:

mb_x = 0
mb_y = 0
mb_z = 0
mb_vx = 1
mb_vy = 0
mb_vz = 0
mb_connection = f
```

---

[⬅️ Back to Overview](../README.md)  
**Previous chapter:** [Description](description.md) | 
**Next chapter:** [CellBot Protocol](protocol.md)
