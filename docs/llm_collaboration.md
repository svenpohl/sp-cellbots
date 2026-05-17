[⬅️ Back to Overview](../README.md)

---

# LLM-Assisted Collaboration with SP-CellBots

> A documented example — Live test from May 17, 2026  
> *Scenario: A developer works with an AI assistant (LLM) to control and test the SP-CellBots system.*

---

## 🧠 Introduction

This document illustrates a **typical workflow** between a human and an LLM when working with SP-CellBots.  
All API commands are executed via `node api.js` — the same interface as the command line.

### Principles of Collaboration

- **The human decides, the LLM executes** — no unsolicited actions
- **Every command is visible** — the LLM shows what it's doing
- **Questions welcome** — when uncertain, the LLM asks the human
- **Results are verified** — status checks follow every action

---

## 💬 Example Dialogue (Live from May 17, 2026)

### 1. System Start and Scan

**👤 Human:**  
> Hello, I've started ClusterSim and the BotController. I see the BotController frontend in my browser at http://localhost:3010 and the ClusterSim live view in a separate window at http://localhost:3020. Please run a scan.

**🤖 LLM:**

```bash
node api.js structurescan
```

```json
{"ok":true,"result":"api_structurescan_started"}
```

```bash
node api.js get_status
```

```json
{
  "ok": true,
  "result": "api_status",
  "loaded_bots": 58,
  "mobility_mode": "vehicle_kinematics",
  "communication_mode": "mesh_opcode"
}
```

> ✅ System ready: **58 bots** loaded, mode `vehicle_kinematics`.

---

### 2. Query Bot Position

**👤 Human:**  
> Where is B26?

**🤖 LLM:**

```bash
node api.js get_bot_position B26
```

```json
{
  "ok": true,
  "bot_id": "B26",
  "position": {"x":5, "y":1, "z":2},
  "orientation": {"x":1, "y":0, "z":0}
}
```

> B26 is at **(5, 1, 2)** facing **(1, 0, 0)**.

---

### 3. Move a Bot

**👤 Human:**  
> Please move B26 to (2, 1, 0), heading (1, 0, 0).

**🤖 LLM:**

```bash
node api.js move_bot_to B26 2 1 0 1 0 0
```

```json
{"ok":true,"result":"succeeded","position":{"x":2,"y":1,"z":0}}
```

> ✅ B26 arrived at **(2, 1, 0)**.

---

### 4. Targeted Environment Query

**👤 Human:**  
> Which bot is highest at x=8?

**🤖 LLM:** *(checks multiple heights)*

```bash
node api.js is_occupied 8 1 2
node api.js is_occupied 8 2 2
node api.js is_occupied 8 3 2
```

```
(8,1,2) → B57 ✅
(8,2,2) → B58 ✅
(8,3,2) → empty
```

> **B58** at y=2 is the highest bot at x=8.

---

### 5. Stack a Bot

**👤 Human:**  
> Please put that one on top of B26.

**🤖 LLM:**

```bash
node api.js move_bot_to B58 2 2 0
```

```json
{"ok":true,"result":"succeeded","position":{"x":2,"y":2,"z":0}}
```

> ✅ B58 is now above B26 — a **2-bot tower** at (2, y, 0).

---

### 6. Relocate and Release

**👤 Human:**  
> Move B58 back down, 2 or 3 fields away from B26.

**🤖 LLM:**

```bash
node api.js move_bot_to B58 4 1 0
```

```json
{"ok":true,"result":"succeeded","position":{"x":4,"y":1,"z":0}}
```

> B58 is now at **(4, 1, 0)** — 2 fields away from B26.

---

### 7. B-Slot Grab (Payload)

**👤 Human:**  
> How would you grab B58 with B26?

**🤖 LLM:**  
> Analysis: B26 at (2,1,0) heading (1,0,0) → B-Slot at (1,1,0). B58 is at (4,1,0).  
> B26 needs to move next to B58 first:

```bash
node api.js move_bot_to B26 5 1 0
node api.js grab_bot B26 B
```

```json
{"ok":true,"result":"succeeded","position":{"x":5,"y":1,"z":0}}
{"ok":true,"result":"succeeded","payload_bot_id":"B58"}
```

```bash
node api.js get_bot_position B58
```

```json
{"position":{"x":4,"y":1,"z":0},"orientation":{"x":1,"y":0,"z":0}}
```

> ✅ **B58 is riding in B26's B-Slot** — B26 is carrying B58 on its back.

---

### 8. Transport Payload and Drop Off

**👤 Human:**  
> Take it, bring the payload bot to (1,1,0), drop it there, then return B26 to (5,1,0) and rotate B26 to heading (-1,0,0).

**🤖 LLM:**

```bash
node api.js move_bot_to B26 1 1 0
node api.js release_bot B26
```

```json
{"ok":true,"result":"succeeded","position":{"x":1,"y":1,"z":0}}
{"ok":true,"result":"succeeded","payload_bot_id":"B58"}
```

```bash
node api.js get_bot_position B58
```

```json
{"position":{"x":0,"y":1,"z":0},"orientation":{"x":1,"y":0,"z":0}}
```

> B58 was dropped at **(0, 1, 0)** — the B-Slot position at release time.

```bash
node api.js move_bot_to B26 5 1 0 -1 0 0
```

```json
{"ok":true,"result":"succeeded","position":{"x":5,"y":1,"z":0}}
```

```bash
node api.js get_bot_position B26
```

```json
{"position":{"x":5,"y":1,"z":0},"orientation":{"x":-1,"y":0,"z":0}}
```

> ✅ **Mission complete:** B58 transported, dropped off, B26 returned and reoriented.

---

### 9. Place a Marker and Move

**👤 Human:**  
> Place a marker at (3,4,3) first so I can see if it's the right position.

**🤖 LLM:**

```bash
node api.js gui_set_marker 3 4 3 0.5 green
```

```json
{"ok":true,"result":"api_gui_set_marker"}
```

> ✅ Green marker placed at **(3, 4, 3)**.

**👤 Human:**  
> Yes, please go ahead.

```bash
node api.js move_bot_to B26 3 4 3
```

```json
{"ok":true,"result":"succeeded","position":{"x":3,"y":4,"z":3}}
```

> ✅ B26 is now at the marker — **y=4 reached**.

---

## 📋 API Command Reference

| Command | Description |
|---------|-------------|
| `structurescan` | Read bot structure from ClusterSim |
| `get_status` | Query system status |
| `get_bot_position <id>` | Position + orientation of a bot |
| `move_bot_to <id> x y z [vx vy vz]` | Move a bot (optional orientation) |
| `is_occupied x y z` | Check if a cell is occupied |
| `grab_bot <carrier> <slot>` | Grab a payload (B for VK mode) |
| `release_bot <carrier>` | Release the payload |
| `gui_set_marker x y z size color` | Place a marker in the 3D view |

---

## 🎯 Lessons Learned

1. **Think first, then act** — Briefly check each command before executing
2. **Verify intermediate results** — Check status after every action
3. **No unsolicited batch commands** — Always proceed step by step with confirmation
4. **Use a memory file** — An external memory (`deepseek.md`) helps the LLM retain context across sessions
5. **API CLI is the interface** — `node api.js` is the direct line to the system

---

[⬅️ Back to Overview](../README.md)  
**Previous chapter:** [API](api.md) | **Next chapter:** [Morphing](morphing.md)
