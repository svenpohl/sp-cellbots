[⬅️ Back to Overview](../README.md)

# Direct Radio Mode (`communication_mode = direct_radio`)

Starting with **v1.6**, SP-CellBots supports two communication modes:

- `mesh_opcode` (default)
- `direct_radio` (optional)

Configuration is done independently in both systems:

- `cluster_sim/config.cfg`
- `botcontroller/config.cfg`

```ini
communication_mode = mesh_opcode # [mesh_opcode | direct_radio]
```

Switching both to `direct_radio` enables direct bot addressing via radio IDs.

---

## Why Direct Radio Exists

The default protocol path in SP-CellBots is still **mesh-based opcode routing**, because that model is expected to be essential for future miniaturized hardware.

`direct_radio` is an additional, practical transition mode for larger or early-stage hardware prototypes:

- simpler first hardware implementation
- direct MasterBot ↔ CellBot command delivery
- easier debugging in early physical testbeds
- reduced dependence on fragile mesh path continuity

Typical radio candidates for this transition layer include:

- Wi-Fi
- BLE (Bluetooth Low Energy)
- Sub-GHz RF modules (e.g. 433/868/915 MHz families)

---

## RID Requirement in XML

In direct-radio mode, every bot needs both:

- `<id>` (logical cluster identity, API-facing)
- `<rid>` (radio identity used for direct addressing)

This applies to:

1. **ClusterSim construct XML** (e.g. `cluster_sim/constructs/base_25_radio.xml`)
2. **BotController static radio map XML** (e.g. `botcontroller/static_bot_info/base_25_radio.xml`)

Minimal pattern:

```xml
<masterbot>
  <id>MASTERBOT</id>
  <rid>00:00:00:00:00:00</rid>
  ...
</masterbot>

<cell>
  <id>B26</id>
  <rid>00:00:00:00:00:26</rid>
  ...
</cell>
```

The bot is still selected by `id` in API calls.  
Internally, the controller resolves the matching `rid` for direct-radio transmission.

---

## Protocol Behavior in Direct Radio

Core OP-code structure, signing, and encryption behavior remain largely unchanged.

The important change is addressing:

- commands are sent directly to the target bot RID
- replies are sent directly to the configured MasterBot RID
- no mesh forwarding path is required for command transport itself

For structure discovery, bots still need local neighbor knowledge.  
SP-CellBots introduces this through neighborhood query opcodes (`NBH` / `RNBH`) and models local neighbor readout as a contact-side interface (conceptually comparable to side-ID signaling such as barcode/QR-like side identity or Manchester-style local side encoding).

---

## Relation to Mesh Mode

`mesh_opcode` remains the **default and reference mode** because:

- it reflects the long-term architecture for dense and miniaturized swarms
- it keeps routing-centric robustness in focus
- core swarm logic was originally built on mesh behavior

`direct_radio` is not a replacement, but a strategic extension to bring SP-CellBots closer to practical first hardware deployments.

---

## API State in v1.6

The API layer has been migrated and tested as far as possible for `direct_radio`, including:

- movement and rotation flows
- scan and scan-level-2 flows
- crater planning/execution/fill workflows
- targeted bot relocalization (`search_bot`)

This allows LLMs and external applications to control SP-CellBots without maintaining mesh route addresses themselves.

**Current limitation at this stage:**  
The general morphing pipeline is not yet migrated to direct-radio execution and remains planned as a future extension.

---

## Operational Note

Even in direct-radio mode, real systems can drift (timing, stale state, partial updates).  
SP-CellBots therefore keeps recovery-oriented operation patterns:

- targeted relocalization (`search_bot`)
- radio/full scans as fallback
- ACK-oriented movement confirmation

This fallback philosophy is a core part of making future physical deployments robust.

[⬅️ Back to Overview](../README.md)  
**Previous chapter:** [CellBot Hardware Blueprint (Virtual)](hardware_blueprint.md) | **Next chapter:** [Vehicle Kinematics](vehicle_kinematics.md)
