[⬅️ Back to Overview](../README.md)

# 🤖 Morphing – Programmable Shape Transformation

The central idea of *Cellbots* is the transformation of a start cluster into a desired target structure.  
We refer to this transformation as **Morphing** – the programming of **programmable matter**.

---

## 🔄 Morphing Process

Currently, the **BotController** includes an intentionally "naive" reference algorithm:
**`Morph_BFS_Wavefront`**

### 🔹 Approach:
- The **farthest bot** is selected first.
- A **shortest path** is calculated using **Breadth-First Search (BFS)**.
- **Non-colliding paths** are grouped into a "wave" and executed simultaneously.

An alternative is **`BFS_Simple`**:  
Here, **only one bot moves at a time**, sequentially.

Both algorithms can be selected directly in the **BotController GUI**.

---

## 📁 Implementation

The corresponding classes are located in:

```
morph/
├── morph_base.js
└── morph_bfs_wavefront.js
```

Further – more efficient or specialized – morphing algorithms can be added here in the future.

---

## 🧩 Step 1: Calculate Morph Paths

The algorithm receives a JSON object with the start configuration.  
Upon successful computation:

- **Start and target paths** are determined for each bot
- Movements are saved to `/logs/morphresult.json`
- "Wave" blocks (simultaneously moving bots) are marked

The **BotController console** shows the **percentage progress** of the calculation.

> ⚠️ **Note:** Calculation time increases **quadratically** with the number of bots.  
> The project goal is to develop **scalable algorithms**  
> that can efficiently handle **thousands of CellBots**.

---

## 🔁 Step 2: Generate OP-Code Sequence

The file `morphresult.json` contains only **raw movement path data** (coordinate transformations).  
In a second step, an OP-Code sequence is generated:

📄 **Target file:**  
`/sequences/morph.sequence`

This file contains movement commands in **blocks**,  
which wait for an ALIFE signal from the involved bots before continuing.

---

## ✏️ Example: Morph Sequence with OP-Codes

```plaintext
block
{
FLLD#MOVE#F_BT_F;F_R_F;F_TF_D;D_F_D;D_F_D;D_F_D;D_R_D;ALIFE;sig1#DLBLB
}

block sig1
{
FLLFRFDR#MOVE#B_FT_B;B_R_B;B_R_B;B_TB_B;B_TB_D;D_BD_F;F_B_D;ALIFE;FIN#DLB
}
```

Each `block` contains:
- The bot's address
- A `MOVE` sequence with atomic or grouped steps
- An `ALIFE` command for synchronization
- A target label (`sig1`, `FIN`, ...) for the next block

---

## 🧠 Execution

The morph sequence is executed in:

**`self_assembly.js`**

This script controls the flow of each block – including wait logic and synchronization.

---

📌 **Conclusion:**  
Although the current algorithm is not yet optimized, it provides a **transparent, robust foundation**.  
The clear separation between path calculation and OP-Code generation allows for maximum flexibility for future extensions, such as:

- Optimized parallelization
- Energy-efficient movements
- Error handling and recovery from blockages

---

## 🔍 Objective

- Each unit (Cellbot) should reach a new position through local movement (atomic steps, possibly climbing actions).
- The morph process occurs **step-by-step**, visibly and traceably.
- All movements currently follow a **simple but robust algorithm** (Breadth-First Search / naive assignment).

---

## ⚙️ The First Morph Algorithm (Naive, BFS-Based)

### Principle:
1. For each target position, a "happy" bot is found that can reach it best.
2. The best path is found using a simple **wavefront search**.
3. Movement sequences are stored as atomic moves (`TFFRTT`).
4. After each step, **positions and addresses are updated**.
5. Fulfilled target positions are locked.

### Characteristics:
- Collisions are avoided because bots **morph sequentially**.
- The algorithm is **deterministic and transparent**.
- Visualization via `cluster_sim`, export via `logger_blender.js`.

---

## 🧱 Movement Representation

- Moves as strings (`rawMoves`)
- Paths as arrays with intermediate coordinates (`fullPath`)
- Optional: grouping into climbing actions (e.g., `K_TF`, `K_DB`, ...)

---

## 📦 Example Workflow

1. Load start and target clusters (`cluster_start.js`, `cluster_target.js`)
2. Run `choose_pair()` → generates morph assignments
3. Calculate paths using `morph_bfs_wavefront.js`
4. Log movements with `logger.js` or `logger_blender.js`
5. Replay movement in the simulator or export for Blender

---

## 🧭 Future: Many Algorithms – One Goal

In the long term, various morph strategies will exist:
- Time-optimized morphs (parallel instead of sequential)
- Energy-efficient movements
- Ant or swarm behavior (decentralized)
- AI-based decision algorithms

---

[⬅️ Back to Overview](../README.md)  
**Previous chapter:** [API](api.md) | **Next chapter:** [Blender](blender.md)
