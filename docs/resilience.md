[⬅️ Prev: LLM Collaboration](llm_collaboration.md)  —  [Back to Overview](../README.md)  —  [Next: Morphing ➡️](morphing.md)

# 🛡️ Resilience – Fault Tolerance in the Cluster

The SP-CellBots system provides a **Resilience Infrastructure** for detecting and
handling faults in the cluster. 18 plausible fault types have been identified,
made injectable, and diagnosed using BotController-native tools.

The focus is on:
- **World model stabilisation** in the BotController (consistency of position, address, orientation)
- **Common communication issues** (delayed, corrupted, or duplicate messages)
- **Unexpected obstacles** and path blockages
- **Inconsistent bot response behaviour** (fake IDs, sporadic failures)

Some mechanical fault types (e.g. faulty interlocking) have been deferred for now –
the primary emphasis is on world model stability and communication resilience.

General fault handling is configured via the **Resilience Controller** using
`resilience.cfg`. Detected faults are logged by the BotController in
`logs/resilience.log`.

---

## 📋 Fault Type Overview

| # | Fault Type | Injection (ClusterSim) | Diagnosis (BotController) | Solution |
|---|------------|------------------------|---------------------------|----------|
| 01 | **Bot offline** | `disable_bot <id>` | `diagnose_bot_address` → OFFL | `set_active false` + recalibrate |
| 02 | **Stop during move** | `set_move_interruption <id> true half_way` | `trace_move_path` → found_at | Fix position, retry move |
| 03 | **Bot displace** | `teleport_bot_to <id> <x> <y> <z>` | `verify_bot_position` → bot_found | `verify_bot_position` updates position |
| 04 | **Rotate wrong** | `teleport_bot_to <id> <x> <y> <z> <vx> <vy> <vz>` | `verify_bot_position` → orientation | `verify_bot_position` corrects orientation |
| 05 | **Bot swap** | `teleport_bot_to` for both bots | ClusterSim API → positions swapped | `verify_bot_position` for both |
| 06 | **Bot remove** | Bot deleted / never created | **`structurescan`** (most thorough) | Ghost bot removed |
| 07 | **Place obstacle** | `set_obstacle true <x> <y> <z>` | `trace_move_path` → bot stuck | `forbidden_add` + re-plan |
| 08 | **Disable forwarding** | `config_disable_forwarding <id> true` | Ping succeeds, bots behind don't | `set_active false` + recalibrate |
| 09 | **Delay messages** | `config_msg_delay <id> <ms>` | RTT in `ping_status` highly elevated | Ping individual bots → `set_active` relay |
| 10 | **Overflow queue** | `config_max_msgqueue <id> <size>` | Ping salvo: 60%+ lost, RTT 5000ms+ | Bypass via `set_active` |
| 11/12 | **Disable/Sporadic slot** | `config_slot <id> "F:0"` (0=never, 0.5=50%) | Ping fails, bot count drops | `set_active` or structurescan |
| 13 | **Corrupt messages** | `config_corrupt_msg <id> <prob> <pat> <repl>` | Cross-test: CHECK works, INFO doesn't | Retry, bypass, enable signing |
| 14 | **Duplicate messages** | `config_duplicate_msg <id> <factor>` | `resilience_status.duplicate_msg_count` | `set_active` + recalibrate |
| 15 | **Fake neighbor ID** | `config_fakeid <id> "<fake>:<prob>"` | `ping_status` shows wrong ID | `set_active` + recalibrate |
| 16 | **Disable MasterBot** | `disable_bot <neighbour_of_hMB>` | Auto-check every 20s → hMB offline | **auto-repair**: bots reassigned |
| 17 | **Add unknown bot** | `add_bot_to <id> <x> <y> <z>` | `ping_position` finds unknown bot | `integrate_bot` (ADC + address) |
| 18 | **Duplicate ID** | config XML with duplicate ID | `resilience_status.duplicate_ids_detected` | **Warning** (manual intervention) |

---

## 🛠️ Diagnosis Tools (BotController)

| Command | Function |
|---------|----------|
| `diagnose_bot_address <id>` | Walks address path hop by hop, shows OFFL bots |
| `trace_move_path <id> <x> <y> <z>` | Finds lost bot along movement path |
| `verify_bot_position <id> <x> <y> <z>` | Checks coordinate, updates position+orientation |
| `ping_position <x> <y> <z>` | Sends INFO to coordinate, expects RINFO back |
| `ping_status <tmpid>` | Shows result of last ping_position |
| `integrate_bot <id>` | Full integration (ADC + address + colour) |
| `set_active <id> <true/false>` | Activate/deactivate + recalibrate |
| `structurescan` | Scans entire cluster – most thorough method |
| `check_mbs` | Checks all MBs/hMBs for reachability |
| `get_resilience_status` | Shows global resilience status |
| `register_duplicate_ids` | Checks for duplicate bot IDs |

---

## 🔧 Resilience Controller (resilience.cfg)

```ini
mb_auto_check = true                  # Auto-check every 20s
register_duplicate_msg = true          # Duplicate detection
register_unexpected_ids = true         # Fake-ID detection
register_duplicate_ids = true          # Duplicate-ID warning
```

### Automatic hMB Monitoring
- Every 20s the controller pings bots on each hMB
- If no response → hMB marked as inactive
- Bots are reassigned to remaining hMBs
- When the hMB returns → automatically re-integrated

---

## 🔄 Standard Workflow: Detect & Recover

```bash
# 1. Structurescan (most thorough detection)
node api.js structurescan

# 2. Check bot count and distribution
node api.js get_status
node api.js get_assigned_bots

# 3. Query resilience status
node api.js get_resilience_status

# 4. Detailed bot diagnosis
node api.js diagnose_bot_address <bot_id>
node api.js verify_bot_position <bot_id> <x> <y> <z>

# 5. Repair (if needed)
node api.js set_active <bot_id> false
node api.js recalibrate_bot_addresses

# 6. Re-integration (if bot discovered new)
node api.js ping_position <x> <y> <z>
node api.js integrate_bot <bot_id>
```

---

## 💡 Hardware Note

In the simulator, messages travel almost instantly. In real hardware
(radio, slow buses) messages pile up much faster, queue overflows
are more pronounced, and the effect of delays is stronger.

---

[⬅️ Back to Overview](../README.md)  
**Previous chapter:** [LLM Collaboration](llm_collaboration.md) | **Next chapter:** [Morphing](morphing.md)
