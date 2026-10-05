#!/usr/bin/env python3
"""Minimal stateful TransformerMorph planner for tm_v001.

The adapter intentionally knows neither WebSocket nor the SP-CellBots
controller. It reads a Morph Plugin input, runs the frozen Morph-S2 checkpoint
greedily, and prints ONLY a JSON-compatible plan to stdout. runner.js remains
the sole owner of atomic publication.
"""

from __future__ import annotations

import argparse
import copy
import json
import math
import random
import sys
from pathlib import Path
from typing import Any

import torch
from torch import nn


ACTIONS = ("F", "B", "T", "D", "TF", "BD", "SR", "SL", "WAIT")
RADIUS = 2
HISTORY_LENGTH = 8
MAX_STEPS_PER_DONOR = 200


class MorphS2(nn.Module):
    """Local inference-only copy of the unchanged Morph-S2 architecture."""

    def __init__(self) -> None:
        super().__init__()
        self.control_adapter = nn.Linear(5, 128)
        self.ego_adapter = nn.Linear(9, 128)
        self.history_adapter = nn.Linear(17, 128)
        layer = nn.TransformerEncoderLayer(d_model=128, nhead=8,
                                           dim_feedforward=512, dropout=0.0,
                                           batch_first=True, norm_first=True)
        self.transformer = nn.TransformerEncoder(layer, num_layers=5,
                                                  enable_nested_tensor=False)
        self.final_norm = nn.LayerNorm(128)
        self.action_head = nn.Linear(128, len(ACTIONS))

    def forward(self, control, ego, history):
        sequence = torch.cat((self.control_adapter(control), self.ego_adapter(ego),
                              self.history_adapter(history)), dim=1)
        hidden = self.transformer(sequence)
        return self.action_head(self.final_norm(hidden[:, 0, :]))
    # forward()
# MorphS2


def vector(bot: dict[str, Any]) -> tuple[int, int, int]:
    return (int(bot.get("vx", 0)), int(bot.get("vy", 0)), int(bot.get("vz", 1)))
# vector()


def position(bot: dict[str, Any]) -> tuple[int, int, int]:
    return (int(bot["x"]), int(bot["y"]), int(bot["z"]))
# position()


def add(origin: tuple[int, int, int], delta: tuple[int, int, int]) -> tuple[int, int, int]:
    return tuple(origin[index] + delta[index] for index in range(3))
# add()


def right_of(direction: tuple[int, int, int]) -> tuple[int, int, int]:
    return (direction[2], 0, -direction[0])
# right_of()


def dot(first: tuple[int, int, int], second: tuple[int, int, int]) -> int:
    return sum(first[index] * second[index] for index in range(3))
# dot()


def is_free(cell: tuple[int, int, int], occupied: set[tuple[int, int, int]]) -> bool:
    return cell not in occupied
# is_free()


def candidate(bot: dict[str, Any], action: str,
              occupied: set[tuple[int, int, int]]) -> tuple[bool, tuple[int, int, int], tuple[int, int, int], int]:
    """The eight vehicle-kinematics action families, locally without environment dependencies."""
    pos = position(bot)
    direction = vector(bot)
    forward = direction
    backward = (-forward[0], 0, -forward[2])
    up = (0, 1, 0)
    down = (0, -1, 0)
    if action == "WAIT":
        return True, pos, direction, 0
    if action in ("SR", "SL"):
        all_clear = all(is_free(add(pos, delta), occupied)
                        for delta in ((1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1)))
        right = right_of(direction)
        new_direction = right if action == "SR" else (-right[0], 0, -right[2])
        return all_clear, pos, new_direction if all_clear else direction, 2
    if action in ("F", "B"):
        step = forward if action == "F" else backward
        valid = is_free(add(pos, step), occupied) and not is_free(add(pos, down), occupied) and not is_free(add(add(pos, step), down), occupied)
        return valid, add(pos, step) if valid else pos, direction, 1
    if action == "T":
        valid = is_free(add(pos, up), occupied) and not is_free(add(pos, forward), occupied) and not is_free(add(add(pos, forward), up), occupied)
        return valid, add(pos, up) if valid else pos, direction, 2
    if action == "D":
        valid = is_free(add(pos, down), occupied) and not is_free(add(pos, forward), occupied) and not is_free(add(add(pos, forward), down), occupied)
        return valid, add(pos, down) if valid else pos, direction, 2
    if action == "TF":
        valid = not is_free(add(pos, forward), occupied) and is_free(add(pos, up), occupied) and is_free(add(add(pos, forward), up), occupied)
        return valid, add(add(pos, forward), up) if valid else pos, direction, 2
    if action == "BD":
        valid = not is_free(add(pos, down), occupied) and is_free(add(pos, backward), occupied) and is_free(add(add(pos, backward), down), occupied)
        return valid, add(add(pos, backward), down) if valid else pos, direction, 2
    raise ValueError("unbekannte Aktion: %s" % action)
# candidate()


def history_tokens(records: list[dict[str, Any]]) -> list[list[float]]:
    tokens = []
    relevant = records[-HISTORY_LENGTH:]
    for _ in range(HISTORY_LENGTH - len(relevant)):
        tokens.append([0.0] * 17)
    for index, record in enumerate(relevant):
        one_hot = [1.0 if record["action"] == item else 0.0 for item in ACTIONS]
        tokens.append([1.0, float(len(relevant) - index - 1), *one_hot,
                       1.0 if record["valid"] else 0.0, float(record["reward"]),
                       *[float(item) for item in record["delta"]],
                       1.0 if record["target_reached"] else 0.0])
    return tokens
# history_tokens()


def observation_tensors(bots: list[dict[str, Any]], active_id: str,
                        target: tuple[int, int, int], records: list[dict[str, Any]]) -> dict[str, torch.Tensor]:
    """Build the exact 5x5x5 / CONTROL / HISTORY model input without debug or world-state leaks."""
    bot = next(item for item in bots if str(item["id"]) == active_id)
    origin = position(bot)
    forward = vector(bot)
    right = right_of(forward)
    delta = tuple(target[index] - origin[index] for index in range(3))
    distance = math.sqrt(sum(value * value for value in delta))
    occupied = {position(item) for item in bots}
    donors = {position(item) for item in bots if item.get("donor")}
    control = [[1.0,
                0.0 if not distance else dot(delta, forward) / distance,
                0.0 if not distance else dot(delta, right) / distance,
                0.0 if not distance else delta[1] / distance,
                distance / (distance + 1.0)]]
    ego = []
    for dy in range(-RADIUS, RADIUS + 1):
        for dz in range(-RADIUS, RADIUS + 1):
            for dx in range(-RADIUS, RADIUS + 1):
                cell = add(add(add(origin, tuple(value * dx for value in right)), (0, dy, 0)), tuple(value * dz for value in forward))
                ego.append([float(dx), float(dy), float(dz),
                            1.0 if cell in occupied else 0.0,
                            1.0 if cell in donors else 0.0,
                            1.0 if cell == target else 0.0,
                            1.0 if cell == target else 0.0,
                            1.0 if (dx, dy, dz) == (0, 0, 0) else 0.0,
                            0.0])
            # for dx
        # for dz
    # for dy
    return {"control": torch.tensor([control], dtype=torch.float32),
            "ego": torch.tensor([ego], dtype=torch.float32),
            "history": torch.tensor([history_tokens(records)], dtype=torch.float32)}
# observation_tensors()


def step_reward(valid: bool, action: str, cost: int,
                before: tuple[int, int, int], after: tuple[int, int, int],
                target: tuple[int, int, int], target_reached: bool) -> float:
    if not valid:
        return -0.20
    if action == "WAIT":
        return -0.002
    distance_before = math.dist(before, target)
    distance_after = math.dist(after, target)
    return -0.005 * cost + 0.05 * (distance_before - distance_after) + (6.0 if target_reached else 0.0)
# step_reward()


def edge_donors(bots: list[dict[str, Any]]) -> list[dict[str, Any]]:
    mobile = [bot for bot in bots if bot.get("mobility")]
    if not mobile:
        return []
    xs = [position(bot)[0] for bot in mobile]
    zs = [position(bot)[2] for bot in mobile]
    return [bot for bot in mobile if position(bot)[0] in (min(xs), max(xs)) or position(bot)[2] in (min(zs), max(zs))]
# edge_donors()


def schedule_donors(bots: list[dict[str, Any]], count: int,
                    chooser: random.Random) -> list[dict[str, Any]]:
    """Draw one random edge-donor roster without replacement."""
    candidates = edge_donors(bots)
    if len(candidates) < count:
        return []
    selected = chooser.sample(candidates, count)
    selected_ids = {str(bot["id"]) for bot in selected}
    for bot in bots:
        bot["donor"] = str(bot["id"]) in selected_ids
    return selected
# schedule_donors()


def state(bot: dict[str, Any]) -> dict[str, int]:
    return {key: int(bot.get(key, 0)) for key in ("x", "y", "z", "vx", "vy", "vz")}
# state()


def load_model(checkpoint: Path) -> MorphS2:
    if not checkpoint.is_file():
        raise FileNotFoundError("Checkpoint fehlt: %s" % checkpoint)
    payload = torch.load(checkpoint, map_location="cpu", weights_only=False)
    if not isinstance(payload, dict) or "online_model" not in payload:
        raise ValueError("Unsupported inference checkpoint: online_model is missing")
    model = MorphS2()
    model.load_state_dict(payload["online_model"])
    model.eval()
    return model
# load_model()


def run_donor_attempt(model: MorphS2, bots: list[dict[str, Any]], donor: dict[str, Any],
                      target: tuple[int, int, int], epsilon: float,
                      rng: random.Random, step_limit: int = MAX_STEPS_PER_DONOR) -> tuple[bool, list[dict[str, int]], int, int]:
    """Run one local donor attempt; epsilon uses the trainer's unmasked action selection."""
    history: list[dict[str, Any]] = []
    path = [state(donor)]
    random_actions = 0
    for step in range(1, step_limit + 1):
        tensors = observation_tensors(bots, str(donor["id"]), target, history)
        with torch.no_grad():
            values = model(**tensors)[0]
        if epsilon and rng.random() < epsilon:
            action = ACTIONS[rng.randrange(len(ACTIONS))]
            random_actions += 1
        else:
            action = ACTIONS[int(values.argmax().item())]
        before = position(donor)
        direction_before = vector(donor)
        valid, after, direction, cost = candidate(donor, action, {position(item) for item in bots})
        if valid:
            donor["x"], donor["y"], donor["z"] = after
            donor["vx"], donor["vy"], donor["vz"] = direction
            if after != before or direction != direction_before:
                path.append(state(donor))
        reached = valid and after == target
        reward = step_reward(valid, action, cost, before, after, target, reached)
        basis_right = right_of(direction_before)
        move_delta = tuple(after[index] - before[index] for index in range(3))
        history.append({"action": action, "valid": valid, "reward": reward,
                        "delta": (dot(move_delta, direction_before), dot(move_delta, basis_right), move_delta[1]),
                        "target_reached": reached})
        if reached:
            return True, path, step, random_actions
    # for step
    return False, path, step_limit, random_actions
# run_donor_attempt()


def select_movable_donor(model: MorphS2, bots: list[dict[str, Any]],
                          candidates: list[dict[str, Any]], target: tuple[int, int, int],
                          chooser: random.Random, retry_rng: random.Random,
                          screening: dict[str, list[str]]) -> dict[str, Any] | None:
    """Choose an edge donor and reject candidates with no position progress after five steps."""
    remaining = list(candidates)
    while remaining:
        donor = chooser.choice(remaining)
        remaining.remove(donor)
        before = copy.deepcopy(donor)
        reached, _, _, _ = run_donor_attempt(model, bots, donor, target, 0.0, retry_rng, 5)
        moved = position(donor) != position(before)
        donor.update(before)
        if moved or reached:
            screening["accepted"].append(str(donor["id"]))
            return donor
        screening["stuck_after_5_steps"].append(str(donor["id"]))
    # while
    return None
# select_movable_donor()


def plan(input_data: dict[str, Any], checkpoint: Path, seed: int) -> dict[str, Any]:
    bots = copy.deepcopy(input_data.get("startBots") or [])
    initial_bots = copy.deepcopy(bots)
    targets = sorted([tuple(int(target[key]) for key in ("x", "y", "z"))
                      for target in (input_data.get("targetBots") or [])], key=lambda cell: (cell[1], cell[0], cell[2]))
    if not bots or not targets:
        raise ValueError("morph_input requires startBots and at least one targetBots entry")
    model = load_model(checkpoint)
    chooser = random.Random(seed)
    retry_rng = random.Random(seed + 1)
    scheduled_donors = schedule_donors(bots, len(targets), chooser)
    screening = {"accepted": [], "stuck_after_5_steps": []}
    if not scheduled_donors:
        return result(initial_bots, targets, [], 0, False, "NO_EDGE_DONOR",
                      "not enough mobile edge donors for %d targets" % len(targets), seed,
                      {"attempts": 0, "successes": 0, "random_actions": 0}, [], screening)
    waves: list[dict[str, Any]] = []
    completed = 0
    retry_stats = {"attempts": 0, "successes": 0, "random_actions": 0}
    for target_number, target in enumerate(targets, start=1):
        donor = scheduled_donors[target_number - 1]
        before_donor = copy.deepcopy(donor)
        reached, _, _, _ = run_donor_attempt(model, bots, donor, target, 0.0, retry_rng, 5)
        moved = position(donor) != position(before_donor)
        donor.update(before_donor)
        if not (moved or reached):
            screening["stuck_after_5_steps"].append(str(donor["id"]))
            donor["donor"] = False
            used_ids = {str(item["id"]) for item in scheduled_donors}
            replacements = [item for item in edge_donors(bots) if str(item["id"]) not in used_ids]
            donor = select_movable_donor(model, bots, replacements, target, chooser, retry_rng, screening)
            if donor is None:
                return result(initial_bots, targets, waves, completed, False, "NO_MOVABLE_DONOR",
                              "no edge donor changed position within five greedy screening steps", seed,
                              retry_stats, [str(item["id"]) for item in scheduled_donors], screening)
            donor["donor"] = True
            scheduled_donors[target_number - 1] = donor
        before_donor = copy.deepcopy(donor)
        reached, path, step, random_actions = run_donor_attempt(model, bots, donor, target, 0.0, retry_rng)
        attempt_meta = [{"epsilon": 0.0, "steps": step, "success": reached, "random_actions": random_actions}]
        if not reached:
            donor.update(before_donor)
            retry_stats["attempts"] += 1
            reached, path, step, random_actions = run_donor_attempt(model, bots, donor, target, 0.1, retry_rng)
            retry_stats["random_actions"] += random_actions
            attempt_meta.append({"epsilon": 0.1, "steps": step, "success": reached, "random_actions": random_actions})
            if reached:
                retry_stats["successes"] += 1
            else:
                donor.update(before_donor)
                return result(initial_bots, targets, waves, completed, False, "DONOR_TIMEOUT",
                              "Donor %s did not reach target %d within %d greedy steps or %d epsilon=0.1 retry steps" % (donor["id"], target_number, MAX_STEPS_PER_DONOR, MAX_STEPS_PER_DONOR), seed, retry_stats,
                              [str(item["id"]) for item in scheduled_donors], screening)
        donor["donor"] = False
        waves.append({"step": len(waves) + 1, "moves": [{"id": str(donor["id"]), "from": state(before_donor), "to": state(donor), "fullPath": path}],
                      "meta": {"target_number": target_number, "target": {"x": target[0], "y": target[1], "z": target[2]}, "steps": step, "attempts": attempt_meta}})
        completed += 1
    # for target_number
    return result(initial_bots, targets, waves, completed, True, None, None, seed, retry_stats,
                  [str(item["id"]) for item in scheduled_donors], screening)
# plan()


def result(bots: list[dict[str, Any]], targets: list[tuple[int, int, int]], waves: list[dict[str, Any]],
           completed: int, success: bool, code: str | None, message: str | None, seed: int,
           retry_statistics: dict[str, int], scheduled_donors: list[str],
           screening: dict[str, list[str]]) -> dict[str, Any]:
    payload: dict[str, Any] = {"bots": [{"id": str(bot["id"]), **state(bot)} for bot in bots],
                               "targets": [{"x": cell[0], "y": cell[1], "z": cell[2]} for cell in targets],
                               "waves": waves,
                               "morph": "success" if success else "failed",
                               "statistics": {"targets_total": len(targets), "targets_completed": completed,
                                              "seed": seed, "epsilon": 0.0,
                                              "max_steps_per_donor": MAX_STEPS_PER_DONOR,
                                              "epsilon_retry": 0.1,
                                              "retry": retry_statistics,
                                              "scheduled_donors": scheduled_donors,
                                              "screening": screening}}
    if not success:
        payload["error"] = {"code": code, "message": message}
    return payload
# result()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--checkpoint", required=True, type=Path)
    parser.add_argument("--seed", type=int, default=45)
    args = parser.parse_args()
    try:
        payload = plan(json.loads(args.input.read_text(encoding="utf-8")), args.checkpoint, args.seed)
    except Exception as error:
        print(json.dumps({"morph": "failed", "error": {"code": "TM_INFERENCE_FAILED", "message": str(error)}, "bots": [], "targets": [], "waves": []}))
        return 2
    print(json.dumps(payload))
    return 0 if payload["morph"] == "success" else 2
# main()


if __name__ == "__main__":
    raise SystemExit(main())
