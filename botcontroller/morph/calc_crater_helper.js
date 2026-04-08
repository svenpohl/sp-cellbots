"use strict";

/**
 * calc_crater_helper.js
 * Lightweight helper scaffold for future crater planning logic.
 */
class CalcCraterHelper {

  static normalizeRequest(raw = {}) {
    return {
      tx: Number(raw?.tx ?? 0),
      ty: Number(raw?.ty ?? 0),
      tz: Number(raw?.tz ?? 0),
      vx: Number(raw?.vx ?? 0),
      vy: Number(raw?.vy ?? 0),
      vz: Number(raw?.vz ?? 0),
      sx: Number(raw?.sx ?? 0),
      sy: Number(raw?.sy ?? 0),
      sz: Number(raw?.sz ?? 0),
      mode: String(raw?.mode ?? "plan"),
      max_depth: (raw?.max_depth ?? null)
    };
  } // normalizeRequest()

  static validateRequest(req = {}) {
    const errors = [];

    const vectorLength = Math.abs(req.vx) + Math.abs(req.vy) + Math.abs(req.vz);
    if (vectorLength !== 1) {
      errors.push("DIG_VECTOR_MUST_BE_UNIT_AXIS");
    } // if

    const stampLength = Math.abs(req.sx) + Math.abs(req.sy) + Math.abs(req.sz);
    if (stampLength < 1) {
      errors.push("STAMP_SHAPE_MUST_HAVE_POSITIVE_SPAN");
    } // if

    if (req.vx !== 0 && req.sx !== 0) {
      errors.push("STAMP_MUST_BE_ZERO_ON_DEPTH_AXIS_X");
    } // if

    if (req.vy !== 0 && req.sy !== 0) {
      errors.push("STAMP_MUST_BE_ZERO_ON_DEPTH_AXIS_Y");
    } // if

    if (req.vz !== 0 && req.sz !== 0) {
      errors.push("STAMP_MUST_BE_ZERO_ON_DEPTH_AXIS_Z");
    } // if

    if (req.mode !== "plan" && req.mode !== "execute") {
      errors.push("MODE_MUST_BE_PLAN_OR_EXECUTE");
    } // if

    if (req.max_depth !== null) {
      const normalizedDepth = Number(req.max_depth);
      if (!Number.isFinite(normalizedDepth) || normalizedDepth <= 0) {
        errors.push("MAX_DEPTH_MUST_BE_POSITIVE_NUMBER");
      } // if
    } // if

    return {
      ok: (errors.length === 0),
      errors: errors
    };
  } // validateRequest()

  static getAxisConfig(req = {}) {
    if (req.vx !== 0) {
      return {
        depthAxis: "x",
        crossAxisA: "y",
        crossAxisB: "z",
        shaftA: Math.abs(req.sy),
        shaftB: Math.abs(req.sz),
        depthSign: Math.sign(req.vx)
      };
    } // if

    if (req.vy !== 0) {
      return {
        depthAxis: "y",
        crossAxisA: "x",
        crossAxisB: "z",
        shaftA: Math.abs(req.sx),
        shaftB: Math.abs(req.sz),
        depthSign: Math.sign(req.vy)
      };
    } // if

    return {
      depthAxis: "z",
      crossAxisA: "x",
      crossAxisB: "y",
      shaftA: Math.abs(req.sx),
      shaftB: Math.abs(req.sy),
      depthSign: Math.sign(req.vz)
    };
  } // getAxisConfig()

  static extractWorld(context = {}) {
    const worldBots = Array.isArray(context?.world?.bots) ? context.world.bots : [];
    const roles = context?.botcontroller?.structure_roles ?? {};
    const inactiveList = Array.isArray(roles.inactive) ? roles.inactive : [];
    const forbiddenList = Array.isArray(roles.forbidden) ? roles.forbidden : [];
    const bots = [];

    for (let i = 0; i < worldBots.length; i++) {
      const b = worldBots[i];
      if (!b || !b.id || b.id === "masterbot") {
        continue;
      } // if

      bots.push({
        id: String(b.id),
        x: Number(b.x ?? 0),
        y: Number(b.y ?? 0),
        z: Number(b.z ?? 0)
      });
    } // for worldBots

    const inactiveSet = new Set();
    for (let i = 0; i < inactiveList.length; i++) {
      const c = inactiveList[i];
      if (!c) {
        continue;
      } // if

      inactiveSet.add(`${Number(c.x ?? 0)},${Number(c.y ?? 0)},${Number(c.z ?? 0)}`);
    } // for inactiveList

    const forbiddenSet = new Set();
    for (let i = 0; i < forbiddenList.length; i++) {
      const c = forbiddenList[i];
      if (!c) {
        continue;
      } // if

      forbiddenSet.add(`${Number(c.x ?? 0)},${Number(c.y ?? 0)},${Number(c.z ?? 0)}`);
    } // for forbiddenList

    return {
      bots: bots,
      inactiveSet: inactiveSet,
      forbiddenSet: forbiddenSet
    };
  } // extractWorld()

  static isInDigDirection(bot = {}, target = {}, depthAxis = "y", depthSign = -1, maxDepth = null) {
    const delta = Number(bot[depthAxis] ?? 0) - Number(target[depthAxis] ?? 0);

    if (depthSign > 0 && delta > 0) {
      return false;
    } // if

    if (depthSign < 0 && delta < 0) {
      return false;
    } // if

    if (maxDepth !== null) {
      const distance = Math.abs(delta);
      if (distance > Number(maxDepth)) {
        return false;
      } // if
    } // if

    return true;
  } // isInDigDirection()

  static makeShaftPredicate(target = {}, axis = {}, shaftStartA = 0, shaftStartB = 0) {
    return function inShaft(x, y, z) {
      const p = { x: Number(x), y: Number(y), z: Number(z) };
      const inCrossA = p[axis.crossAxisA] >= shaftStartA && p[axis.crossAxisA] < (shaftStartA + axis.shaftA);
      const inCrossB = p[axis.crossAxisB] >= shaftStartB && p[axis.crossAxisB] < (shaftStartB + axis.shaftB);
      if (!(inCrossA && inCrossB)) {
        return false;
      } // if

      if (axis.depthSign > 0) {
        return p[axis.depthAxis] <= target[axis.depthAxis];
      } // if

      return p[axis.depthAxis] >= target[axis.depthAxis];
    }; // inShaft()
  } // makeShaftPredicate()

  static collectExcavationBots(world = {}, target = {}, axis = {}, shaftStartA = 0, shaftStartB = 0, maxDepth = null) {
    const inShaft = CalcCraterHelper.makeShaftPredicate(target, axis, shaftStartA, shaftStartB);
    const sRemove = [];

    for (let i = 0; i < world.bots.length; i++) {
      const bot = world.bots[i];
      const inCrossA = bot[axis.crossAxisA] >= shaftStartA && bot[axis.crossAxisA] < (shaftStartA + axis.shaftA);
      const inCrossB = bot[axis.crossAxisB] >= shaftStartB && bot[axis.crossAxisB] < (shaftStartB + axis.shaftB);
      if (!(inCrossA && inCrossB)) {
        continue;
      } // if

      if (!CalcCraterHelper.isInDigDirection(bot, target, axis.depthAxis, axis.depthSign, maxDepth)) {
        continue;
      } // if

      const key = `${bot.x},${bot.y},${bot.z}`;
      if (world.inactiveSet.has(key)) {
        continue;
      } // if

      if (world.forbiddenSet.has(key)) {
        continue;
      } // if

      if (!inShaft(bot.x, bot.y, bot.z)) {
        continue;
      } // if

      sRemove.push({ id: bot.id, x: bot.x, y: bot.y, z: bot.z });
    } // for bots

    return sRemove;
  } // collectExcavationBots()

  static buildCraterPositions(sRemove = [], world = {}, target = {}, axis = {}, shaftStartA = 0, shaftStartB = 0) {
    if (sRemove.length === 0) {
      return { crater_positions: [], base_mode: "empty" };
    } // if

    const depositDir = { x: 0, y: 0, z: 0 };
    depositDir[axis.depthAxis] = -axis.depthSign;
    const removedSet = new Set(sRemove.map((b) => `${b.x},${b.y},${b.z}`));
    const cubeEdge = Math.ceil(Math.cbrt(sRemove.length));
    const half = Math.floor(cubeEdge / 2);    
    const level0 = [];    

    const base = { x: target.x, y: target.y, z: target.z };
    base[axis.crossAxisA] -= half;
    base[axis.crossAxisB] -= half;

    const inShaft = CalcCraterHelper.makeShaftPredicate(target, axis, shaftStartA, shaftStartB);
    for (let ia = 0; ia < cubeEdge; ia++) {
      for (let ib = 0; ib < cubeEdge; ib++) {
        const p = { x: base.x, y: base.y, z: base.z };
        p[axis.crossAxisA] += ia;
        p[axis.crossAxisB] += ib;
        if (inShaft(p.x, p.y, p.z)) {
          continue;
        } // if

        level0.push(p);
      } // for ib
    } // for ia

    if (level0.length === 0) {
      return { crater_positions: [], base_mode: "empty" };
    } // if

    const level0Clean = level0.filter((p) => {
      const key = `${p.x},${p.y},${p.z}`;
      return !removedSet.has(key);
    });

    const hasSupportBehind = (bot = null) => {
      if (!bot) {
        return false;
      } // if

      const bx = Number(bot.x) - depositDir.x;
      const by = Number(bot.y) - depositDir.y;
      const bz = Number(bot.z) - depositDir.z;
      const supportKey = `${bx},${by},${bz}`;
      if (!world.botMap.has(supportKey)) {
        return false;
      } // if

      if (world.inactiveSet.has(supportKey)) {
        return false;
      } // if

      return true;
    }; // hasSupportBehind()

    const buildLevel1FromBaseCandidates = (baseCandidates = [], requireSupportBehind = true) => {
      const level1Tmp = [];
      let baseModeTmp = "full";

      for (let i = 0; i < baseCandidates.length; i++) {
        const p = baseCandidates[i];
        let extreme = null;
        let extremeBot = null;

        for (let b = 0; b < world.bots.length; b++) {
          const bot = world.bots[b];
          if (bot[axis.crossAxisA] !== p[axis.crossAxisA] || bot[axis.crossAxisB] !== p[axis.crossAxisB]) {
            continue;
          } // if

          const d = bot[axis.depthAxis];
          if (extreme === null) {
            extreme = d;
            extremeBot = bot;
            continue;
          } // if

          if (depositDir[axis.depthAxis] > 0 && d > extreme) {
            extreme = d;
            extremeBot = bot;
            continue;
          } // if

          if (depositDir[axis.depthAxis] < 0 && d < extreme) {
            extreme = d;
            extremeBot = bot;
            continue;
          } // if
        } // for world.bots

        if (!extremeBot) {
          baseModeTmp = "reduced";
          continue;
        } // if

        if (requireSupportBehind && !hasSupportBehind(extremeBot)) {
          baseModeTmp = "reduced";
          continue;
        } // if

        if (extreme === null) {
          extreme = p[axis.depthAxis];
        } // if

        const p1 = { x: p.x, y: p.y, z: p.z };
        p1[axis.depthAxis] = Number(extreme) + depositDir[axis.depthAxis];

        const p1Key = `${p1.x},${p1.y},${p1.z}`;
        if (world.forbiddenSet.has(p1Key) || world.inactiveSet.has(p1Key)) {
          continue;
        } // if

        level1Tmp.push(p1);
      } // for baseCandidates

      return {
        level1: level1Tmp,
        base_mode: baseModeTmp
      };
    }; // buildLevel1FromBaseCandidates()

    const collectAlternativeBaseCandidatesAroundShaft = () => {
      const candidates = [];
      const seen = new Set();

      for (let ia = -1; ia <= axis.shaftA; ia++) {
        for (let ib = -1; ib <= axis.shaftB; ib++) {
          const inOriginalRect = ia >= 0 && ia < axis.shaftA && ib >= 0 && ib < axis.shaftB;
          if (inOriginalRect) {
            continue;
          } // if

          const p = { x: target.x, y: target.y, z: target.z };
          p[axis.crossAxisA] = shaftStartA + ia;
          p[axis.crossAxisB] = shaftStartB + ib;
          p[axis.depthAxis] = target[axis.depthAxis];

          if (inShaft(p.x, p.y, p.z)) {
            continue;
          } // if

          const key = `${p.x},${p.y},${p.z}`;
          if (seen.has(key) || removedSet.has(key) || world.inactiveSet.has(key) || world.forbiddenSet.has(key)) {
            continue;
          } // if

          seen.add(key);
          candidates.push(p);
        } // for ib
      } // for ia

      return candidates;
    }; // collectAlternativeBaseCandidatesAroundShaft()

    const level1 = [];
    let baseMode = "full";
    const level1PrimaryResult = buildLevel1FromBaseCandidates(level0Clean);
    level1.push(...level1PrimaryResult.level1);
    baseMode = level1PrimaryResult.base_mode;

    if (level1.length === 0 && sRemove.length > 0) {
      const alternativeCandidates = collectAlternativeBaseCandidatesAroundShaft();
      const level1FallbackResult = buildLevel1FromBaseCandidates(alternativeCandidates, true);
      if (level1FallbackResult.level1.length > 0) {
        level1.push(...level1FallbackResult.level1);
        baseMode = "fallback_ring";
      } else if (baseMode === "full") {
        baseMode = level1FallbackResult.base_mode;
      } // if
    } // if

    if (level1.length === 0 && sRemove.length > 0) {
      const level1LooseResult = buildLevel1FromBaseCandidates(level0Clean, false);
      if (level1LooseResult.level1.length > 0) {
        level1.push(...level1LooseResult.level1);
        baseMode = "fallback_loose_projection";
      } // if
    } // if

    if (level1.length === 0) {
      return { crater_positions: [], base_mode: baseMode };
    } // if

    const craterPositions = [];
    const baseCount = level1.length;
    for (let i = 0; i < sRemove.length; i++) {
      const basePos = level1[i % baseCount];
      const layer = Math.floor(i / baseCount);
      const p = { x: basePos.x, y: basePos.y, z: basePos.z };
      p[axis.depthAxis] += layer * depositDir[axis.depthAxis];
      craterPositions.push(p);
    } // for sRemove

    return { crater_positions: craterPositions, base_mode: baseMode };
  } // buildCraterPositions()

  static buildRemoveOrder(sRemove = [], target = {}, axis = {}) {
    const ordered = sRemove.slice();
    const sign = axis.depthSign;
    const depthAxis = axis.depthAxis;
    const crossA = axis.crossAxisA;
    const crossB = axis.crossAxisB;

    // Farthest-first in dig direction, then deterministic cross-axis order.
    ordered.sort((a, b) => {
      const da = Number(a[depthAxis] ?? 0) - Number(target[depthAxis] ?? 0);
      const db = Number(b[depthAxis] ?? 0) - Number(target[depthAxis] ?? 0);

      const distA = Math.abs(da);
      const distB = Math.abs(db);
      if (distA !== distB) {
        return distB - distA;
      } // if

      // Same depth distance: prefer stricter in-front points first.
      const frontA = sign > 0 ? -da : da;
      const frontB = sign > 0 ? -db : db;
      if (frontA !== frontB) {
        return frontB - frontA;
      } // if

      const ca = Number(a[crossA] ?? 0);
      const cb = Number(b[crossA] ?? 0);
      if (ca !== cb) {
        return ca - cb;
      } // if

      const za = Number(a[crossB] ?? 0);
      const zb = Number(b[crossB] ?? 0);
      if (za !== zb) {
        return za - zb;
      } // if

      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });

    return ordered.map((bot, index) => {
      return {
        step: index + 1,
        id: bot.id,
        x: bot.x,
        y: bot.y,
        z: bot.z
      };
    });
  } // buildRemoveOrder()

  /**
   * Build an explicit pair order between excavation bots and crater targets.
   * The ordering is level-based along the deposit direction:
   * 1) fill first reachable crater level,
   * 2) continue with higher stack levels,
   * 3) keep deterministic tie-breakers inside each level.
   */
  static buildPairOrder(removeOrder = [], craterPositions = [], target = {}, axis = {}) {
    const depthAxis = axis.depthAxis;
    const depositSign = -axis.depthSign;
    const targets = craterPositions.slice();

    // Order crater targets by level in deposit direction, then by cross axes.
    targets.sort((a, b) => {
      const pa = (Number(a[depthAxis] ?? 0) - Number(target[depthAxis] ?? 0)) * depositSign;
      const pb = (Number(b[depthAxis] ?? 0) - Number(target[depthAxis] ?? 0)) * depositSign;
      if (pa !== pb) {
        return pa - pb;
      } // if

      const ca = Number(a[axis.crossAxisA] ?? 0);
      const cb = Number(b[axis.crossAxisA] ?? 0);
      if (ca !== cb) {
        return ca - cb;
      } // if

      const za = Number(a[axis.crossAxisB] ?? 0);
      const zb = Number(b[axis.crossAxisB] ?? 0);
      if (za !== zb) {
        return za - zb;
      } // if

      return 0;
    });

    const pairOrder = [];
    const craterFillLevels = [];
    const levelMap = new Map();

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const levelProjection = (Number(t[depthAxis] ?? 0) - Number(target[depthAxis] ?? 0)) * depositSign;
      const levelKey = String(levelProjection);
      if (!levelMap.has(levelKey)) {
        levelMap.set(levelKey, {
          level_projection: levelProjection,
          level_axis_value: Number(t[depthAxis] ?? 0),
          targets: []
        });
      } // if

      levelMap.get(levelKey).targets.push({ x: t.x, y: t.y, z: t.z });
    } // for targets

    const levelKeys = Array.from(levelMap.keys()).sort((a, b) => Number(a) - Number(b));
    for (let i = 0; i < levelKeys.length; i++) {
      craterFillLevels.push(levelMap.get(levelKeys[i]));
    } // for levelKeys

    const pairCount = Math.min(removeOrder.length, targets.length);
    for (let i = 0; i < pairCount; i++) {
      const removeBot = removeOrder[i];
      const craterTarget = targets[i];
      const targetLevelProjection = (Number(craterTarget[depthAxis] ?? 0) - Number(target[depthAxis] ?? 0)) * depositSign;

      pairOrder.push({
        step: i + 1,
        remove_bot: {
          id: removeBot.id,
          x: removeBot.x,
          y: removeBot.y,
          z: removeBot.z
        },
        crater_target: {
          x: craterTarget.x,
          y: craterTarget.y,
          z: craterTarget.z
        },
        target_level_projection: targetLevelProjection,
        reason: "level_first_pairing"
      });
    } // for pairCount

    return {
      pair_order: pairOrder,
      crater_fill_levels: craterFillLevels
    };
  } // buildPairOrder()

  static buildPlan(req = {}, world = {}) {
    const target = { x: req.tx, y: req.ty, z: req.tz };
    const axis = CalcCraterHelper.getAxisConfig(req);
    const shaftStartA = target[axis.crossAxisA];
    const shaftStartB = target[axis.crossAxisB];
    world.botMap = new Map();
    for (let i = 0; i < world.bots.length; i++) {
      const b = world.bots[i];
      world.botMap.set(`${b.x},${b.y},${b.z}`, b);
    } // for world.bots

    const sRemove = CalcCraterHelper.collectExcavationBots(
      world,
      target,
      axis,
      shaftStartA,
      shaftStartB,
      req.max_depth
    );

    const craterPlan = CalcCraterHelper.buildCraterPositions(
      sRemove,
      world,
      target,
      axis,
      shaftStartA,
      shaftStartB
    );
    const removeOrder = CalcCraterHelper.buildRemoveOrder(sRemove, target, axis);
    const pairPlan = CalcCraterHelper.buildPairOrder(
      removeOrder,
      craterPlan.crater_positions,
      target,
      axis
    );

    return {
      target: target,
      dig_vector: { x: req.vx, y: req.vy, z: req.vz },
      stamp_shape: { x: req.sx, y: req.sy, z: req.sz },
      mode: req.mode,
      max_depth: req.max_depth,
      axis_map: {
        depth_axis: axis.depthAxis,
        cross_axis_a: axis.crossAxisA,
        cross_axis_b: axis.crossAxisB,
        shaft_start_a: shaftStartA,
        shaft_start_b: shaftStartB,
        shaft_size_a: axis.shaftA,
        shaft_size_b: axis.shaftB
      },
      s_remove: sRemove,
      remove_order: removeOrder,
      crater_positions: craterPlan.crater_positions,
      pair_order: pairPlan.pair_order,
      crater_fill_levels: pairPlan.crater_fill_levels,
      stats: {
        excavation_count: sRemove.length,
        crater_count: craterPlan.crater_positions.length,
        pair_count: pairPlan.pair_order.length,
        balanced: (sRemove.length === craterPlan.crater_positions.length),
        base_mode: craterPlan.base_mode
      },
      bot_paths: [],
      opcodes: [],
      warnings: [
        "PLANNING_ONLY",
        "geometric_stub_without_transport_paths"
      ]
    };
  } // buildPlan()

  static calcCrater(rawRequest = {}, context = {}) {
    const request = CalcCraterHelper.normalizeRequest(rawRequest);
    const validation = CalcCraterHelper.validateRequest(request);
    const world = CalcCraterHelper.extractWorld(context);

    if (!validation.ok) {
      return {
        ok: false,
        answer: "api_calc_crater",
        implemented: false,
        error: "INVALID_PARAMETERS",
        errors: validation.errors,
        request: request,
        context_hint: {
          has_world: Boolean(context?.world),
          has_botcontroller: Boolean(context?.botcontroller)
        },
        plan: CalcCraterHelper.buildPlan(request, world)
      };
    } // if

    return {
      ok: true,
      answer: "api_calc_crater",
      implemented: false,
      error: "NOT_IMPLEMENTED_YET",
      request: request,
      context_hint: {
        has_world: Boolean(context?.world),
        has_botcontroller: Boolean(context?.botcontroller),
        bot_count: world.bots.length
      },
      plan: CalcCraterHelper.buildPlan(request, world)
    };
  } // calcCrater()

} // class CalcCraterHelper

module.exports = CalcCraterHelper;
