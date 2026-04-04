[⬅️ Back to Overview](../README.md)

# API

The **BotController API** provides a programmatic interface for querying structure state, planning movements, executing transport operations, and starting morph runs.

It is designed as a pragmatic control layer for:

- human operators
- scripts
- future LLM-based tooling

The transport is currently:

- **JSON over TCP**
- one request per connection
- one structured response per request

---

## 🎯 Start Here

The most important entry point is the built-in self-description:

```bash
node api.js describe
```

This command prints the currently available API commands together with:

- short descriptions
- expected parameters
- typical return fields

So the API is not only callable, but also largely **self-describing**.

For quick inspection and experimentation, `describe` should usually be the first step.

---

## 🎯 Purpose

The API is intended to make the current simulator stack usable without clicking through the WebGUI.

Typical use cases:

- inspect the current cluster world model
- look up individual bots and neighbors
- calculate paths before execution
- move, rotate, grab, and release bots
- transport a payload with a carrier
- start and monitor morph runs

---

## 🧩 Current Scope

The current API already includes useful building blocks such as:

- world and scan status queries
- marker and GUI refresh commands
- bot lookup and neighborhood inspection
- pathfinding and MOVE diagnostics
- carrier and payload transport commands
- morph structure and algorithm discovery
- morph start and morph progress checks

---

## 🧪 Small Example

One simple example is:

```bash
node api.js get_bot_by_id B28
```

Typical response:

```json
{
  "ok": true,
  "answer": "api_get_bot_by_id",
  "bot_id": "B28",
  "position": { "x": 3, "y": 1, "z": 2 },
  "orientation": { "x": 1, "y": 0, "z": 0 },
  "adress": "FLLFRT"
}
```

This already shows the basic shape of the interface:

- requests are simple command calls via `api.js`
- responses come back as JSON
- coordinates are returned explicitly as `x`, `y`, `z`
- orientation is also encoded as a vector

---

## 📦 Command Families

### World and Scan

- `get_status`
- `get_status_extended`
- `get_masterbot`
- `get_scan_state`
- `structurescan`
- `structurescan_lvl2`

### GUI and Diagnostics

- `gui_set_marker`
- `gui_clear_markers`
- `gui_refresh`
- `debug_move`
- `get_last_moves`
- `get_bot_history`
- `get_last_raw_cmds`
- `get_api_messages`

### Bot Queries and Path Planning

- `get_bot_by_id`
- `get_bots`
- `get_neighbors`
- `is_occupied`
- `get_slot_status`
- `find_path_for_bot`
- `find_path_for_bot_payload`
- `suggest_simple_move`
- `diagnose_move_bot_to`
- `diagnose_move_carrier_to`

### Motion and Transport

- `move_bot_to`
- `rotate_bot`
- `rotate_bot_to`
- `grab_bot`
- `release_bot`
- `move_payload_to`
- `move_carrier_to`

### Morphing

- `morph_get_structures`
- `morph_get_algos`
- `morph_start`
- `morph_check_progress`

---

## ⚠️ V1 Notes

The API is already practically useful, but still evolving.

Important characteristics of the current V1-style interface:

- recovery and acknowledgement handling are already integrated for many commands
- `move_carrier_to` is the clearer transport primitive for current payload workflows
- `move_payload_to` currently still targets the **carrier position**, not a payload target pose
- `morph_check_progress` distinguishes between:
  - calculation success
  - final sequence completion

Some semantics are intentionally conservative and may still be refined in future versions.
For command details, the built-in `describe` output should be treated as the primary live reference.

---

## 📚 Next Steps

This page is intentionally lightweight and serves as the API entry point.

The next iteration should grow into a fuller V1 reference with:

- a few selected command examples
- guarantees and caveats
- recovery semantics
- transport workflow examples
- morph workflow examples

---

[⬅️ Back to Overview](../README.md)  
**Previous chapter:** [Usage & examples](usage.md) | **Next chapter:** [Morphing](morphing.md)
