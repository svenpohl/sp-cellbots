
//
//
//
// start  : Vehicle start state as object { x, y, z, vx, vy, vz }
// goal   : Vehicle goal state as object { x, y, z, vx, vy, vz }
// world  : Complete world with terrain/S-Bots and world.forbidden
// options: Additional options such as max_search_steps, max_debug_rejections, Debug flags
function calc_vehicle_kinematics_payload_path(start, goal, world, options = {})
{
if (typeof Logger !== "undefined") Logger.log("[DEBUG VK-Payload] calc_vehicle_kinematics_payload_path AUFGERUFEN");
// if (!(typeof globalThis !== "undefined" && globalThis.randomScenarioBatchQuiet)) {
   console.log("Start VK-Payload-pathplaner");
// } // START log guard
  const DIR_XP = Object.freeze({ x: 1, y: 0, z: 0 });
  const DIR_XN = Object.freeze({ x: -1, y: 0, z: 0 });
  const DIR_ZP = Object.freeze({ x: 0, y: 0, z: 1 });
  const DIR_ZN = Object.freeze({ x: 0, y: 0, z: -1 });

  const primitives = Object.freeze({
    meta: Object.freeze({
      cell_states: ["free", "occupied"],
    }),
    primitives: [
    
     { 
                    name: "MOVE_XP_FWD",
                    match: { dir: [1, 0, 0] },
                    pre: [{ cell: [1, 0, 0], is: "free" } ,{ cell: [0, -1, 0], is: "occupied" }, { cell: [1, -1, 0], is: "occupied" } ],
                    effect: { pos_delta: [1, 0, 0], dir: [1, 0, 0] },
                    cost: 1,
                },  
                { 
                    name: "MOVE_XP_BWD",
                    match: { dir: [1, 0, 0] },
                    pre: [{ cell: [-1, 0, 0], is: "free" } ,{ cell: [0, -1, 0], is: "occupied" }, { cell: [-1, -1, 0], is: "occupied" },    { cell: [-2, 0, 0], is: "free" }  ],
                    effect: { pos_delta: [-1, 0, 0], dir: [1, 0, 0] },
                    cost: 1,
                },
                
               
                
                {
                    name: "MOVE_XN_FWD",
                    match: { dir: [-1, 0, 0] },
                    pre: [{ cell: [-1, 0, 0], is: "free" } ,{ cell: [0, -1, 0], is: "occupied" }, { cell: [-1, -1, 0], is: "occupied" }],
                    effect: { pos_delta: [-1, 0, 0], dir: [-1, 0, 0] },
                    cost: 1,
                },
                {
                    name: "MOVE_XN_BWD",
                    match: { dir: [-1, 0, 0] },
                    pre: [{ cell: [1, 0, 0], is: "free" } ,{ cell: [0, -1, 0], is: "occupied" }, { cell: [1, -1, 0], is: "occupied" },   { cell: [2, 0, 0], is: "free" } ],
                    effect: { pos_delta: [1, 0, 0], dir: [-1, 0, 0] },
                    cost: 1,
                },
            
                {
                    name: "MOVE_ZP_FWD",
                    match: { dir: [0, 0, 1] },
                    pre: [{ cell: [0, 0, 1], is: "free" } ,{ cell: [0, -1, 0], is: "occupied" }, { cell: [0, -1, 1], is: "occupied" }],
                    effect: { pos_delta: [0, 0, 1], dir: [0, 0, 1] },
                    cost: 1,
                },
                {
                    name: "MOVE_ZP_BWD",
                    match: { dir: [0, 0, 1] },
                    pre: [{ cell: [0, 0, -1], is: "free" } ,{ cell: [0, -1, 0], is: "occupied" }, { cell: [0, -1, -1], is: "occupied" } ,   { cell: [0, 0, -2], is: "free" } ],
                    effect: { pos_delta: [0, 0, -1], dir: [0, 0, 1] },
                    cost: 1,
                },
                    
                {
                    name: "MOVE_ZN_FWD",
                    match: { dir: [0, 0, -1] },
                    pre: [{ cell: [0, 0, -1], is: "free" } ,{ cell: [0, -1, 0], is: "occupied" }, { cell: [0, -1, -1], is: "occupied" }],
                    effect: { pos_delta: [0, 0, -1], dir: [0, 0, -1] },
                    cost: 1,
                },
                {
                    name: "MOVE_ZN_BWD",
                    match: { dir: [0, 0, -1] },
                    pre: [{ cell: [0, 0, 1], is: "free" } ,{ cell: [0, -1, 0], is: "occupied" }, { cell: [0, -1, 1], is: "occupied" } ,   { cell: [0, 0, 2], is: "free" } ],
                    effect: { pos_delta: [0, 0, 1], dir: [0, 0, -1] },
                    cost: 1,
                },
                 
      
      
      {
        name: "STEP_DOWN_XP",
        match: { dir: [-1, 0, 0] },
        pre: [ { cell: [0, -1, 0], is: "occupied" }, { cell: [1, 0, 0], is: "free" },{ cell: [1, -1, 0], is: "free" },    { cell: [2, 0, 0], is: "free" },{ cell: [2, -1, 0], is: "free" } ],
        effect: { pos_delta_inter: [1, 0, 0], dir_inter: [-1, 0, 0], pos_delta: [1, -1, 0], dir: [-1, 0, 0] },
        cost: 2,
      },
       
      {
        name: "STEP_DOWN_XN",
        match: { dir: [1, 0, 0] },
        pre: [ { cell: [0, -1, 0], is: "occupied" }, { cell: [-1, 0, 0], is: "free" }, { cell: [-1, -1, 0], is: "free" } ,    { cell: [-2, 0, 0], is: "free" },{ cell: [-2, -1, 0], is: "free" }  ],
        effect: { pos_delta_inter: [-1, 0, 0], dir_inter: [1, 0, 0], pos_delta: [-1, -1, 0], dir: [1, 0, 0] },
        cost: 2,
      },
      
     
      {
        name: "STEP_DOWN_ZP",
        match: { dir: [0, 0, -1] },
        pre: [ { cell: [0, -1, 0], is: "occupied" }, { cell: [0, 0, 1], is: "free" },{ cell: [0, -1, 1], is: "free" } ,  { cell: [0, 0, 2], is: "free" },{ cell: [0, -1, 2], is: "free" } ],
        effect: { pos_delta_inter: [0, 0, 1], dir_inter: [0, 0, -1], pos_delta: [0, -1, 1], dir: [0, 0, -1] },
        cost: 2,
      },
      {
        name: "STEP_DOWN_ZN",
        match: { dir: [0, 0, 1] },
        pre: [{ cell: [0, -1, 0], is: "occupied" }, { cell: [0, 0, -1], is: "free" },{ cell: [0, -1, -1], is: "free" },   { cell: [0, 0, -2], is: "free" },{ cell: [0, -1, -2], is: "free" } ],
        effect: { pos_delta_inter: [0, 0, -1], dir_inter: [0, 0, 1], pos_delta: [0, -1, -1], dir: [0, 0, 1] },
        cost: 2,
      },
      
    
      
        {
        name: "STEP_UP_XN",
        match: { dir: [-1, 0, 0] },
        pre: [ { cell: [-1, 0, 0], is: "occupied" }, { cell: [0, 1, 0], is: "free" },{ cell: [-1, 1, 0], is: "free" },  { cell: [1, 1, 0], is: "free" } ],
        effect: { pos_delta_inter: [0, 1, 0], dir_inter: [-1, 0, 0], pos_delta: [-1, 1, 0], dir: [-1, 0, 0] },
        cost: 2,
      },
      
      {
        name: "STEP_UP_XP",
        match: { dir: [1, 0, 0] },
        pre: [ { cell: [1, 0, 0], is: "occupied" }, { cell: [0, 1, 0], is: "free" },{ cell: [1, 1, 0], is: "free" }, { cell: [-1, 1, 0], is: "free" }],
        effect: { pos_delta_inter: [0, 1, 0], dir_inter: [1, 0, 0], pos_delta: [1, 1, 0], dir: [1, 0, 0] },
        cost: 2,
      },
       
      {
        name: "STEP_UP_ZN",
        match: { dir: [0, 0, -1] },
        pre: [{ cell: [0, 0, -1], is: "occupied" }, { cell: [0, 1, 0], is: "free" },{ cell: [0, 1, -1], is: "free" },  { cell: [0, 1, 1], is: "free" } ],
        effect: { pos_delta_inter: [0, 1, 0], dir_inter: [0, 0, -1], pos_delta: [0, 1, -1], dir: [0, 0, -1] },
        cost: 2,
      },
      
      {
        name: "STEP_UP_ZP",
        match: { dir: [0, 0, 1] },
        pre: [ { cell: [0, 0, 1], is: "occupied" }, { cell: [0, 1, 0], is: "free" },{ cell: [0, 1, 1], is: "free" },  { cell: [0, 1, -1], is: "free" } ],
        effect: { pos_delta_inter: [0, 1, 0], dir_inter: [0, 0, 1], pos_delta: [0, 1, 1], dir: [0, 0, 1] },
        cost: 2,
      },
      
    
       
      
      {
        name: "WALL_DOWN_XP",
        match: { dir: [1, 0, 0] },
        pre: [
          { cell: [0, -1, 0], is: "free" },
          { cell: [1, 0, 0], is: "occupied" },
          { cell: [1, -1, 0], is: "occupied" },    { cell: [-1, -1, 0], is: "free" }
        ],
        effect: { pos_delta: [0, -1, 0], dir: [1, 0, 0] },
        cost: 2,
      },
      
 {
        name: "WALL_DOWN_XN",
        match: { dir: [-1, 0, 0] },
        pre: [
          { cell: [0, -1, 0], is: "free" },
          { cell: [-1, 0, 0], is: "occupied" },
          { cell: [-1, -1, 0], is: "occupied" },   { cell: [1, -1, 0], is: "free" }
        ],
        effect: { pos_delta: [0, -1, 0], dir: [-1, 0, 0] },
        cost: 2,
      },      
      
        {
        name: "WALL_DOWN_ZP",
        match: { dir: [0, 0, 1] },
        pre: [
          { cell: [0, -1, 0], is: "free" },
          { cell: [0, 0, 1], is: "occupied" },
          { cell: [0, -1, 1], is: "occupied" },   { cell: [0, -1, -1], is: "free" }
        ],
        effect: { pos_delta: [0, -1, 0], dir: [0, 0, 1] },
        cost: 2,
      },

 {
        name: "WALL_DOWN_ZN",
        match: { dir: [0, 0, -1] },
        pre: [
          { cell: [0, -1, 0], is: "free" },
          { cell: [0, 0, -1], is: "occupied" },
          { cell: [0, -1, -1], is: "occupied" }, { cell: [0, -1, 1], is: "free" }
        ],
        effect: { pos_delta: [0, -1, 0], dir: [0, 0, -1] },
        cost: 2,
      },      
      
    
      
      
      {
        name: "WALL_UP_XP",
        match: { dir: [1, 0, 0] },
        pre: [
          { cell: [0, 1, 0], is: "free" },
          { cell: [1, 0, 0], is: "occupied" },
          { cell: [1, 1, 0], is: "occupied" },    { cell: [-1, 1, 0], is: "free" }
        ],
        effect: { pos_delta: [0, 1, 0], dir: [1, 0, 0] },
        cost: 2,
      },
       
 {
        name: "WALL_UP_XN",
        match: { dir: [-1, 0, 0] },
        pre: [
          { cell: [0, 1, 0], is: "free" },
          { cell: [-1, 0, 0], is: "occupied" },
          { cell: [-1, 1, 0], is: "occupied" },      { cell: [1, 1, 0], is: "free" }
        ],
        effect: { pos_delta: [0, 1, 0], dir: [-1, 0, 0] },
        cost: 2,
      },      
     
        {
        name: "WALL_UP_ZP",
        match: { dir: [0, 0, 1] },
        pre: [
          { cell: [0, 1, 0], is: "free" },
          { cell: [0, 0, 1], is: "occupied" },
          { cell: [0, 1, 1], is: "occupied" },      { cell: [0, 1, -1], is: "free" }
        ],
        effect: { pos_delta: [0, 1, 0], dir: [0, 0, 1] },
        cost: 2,
      },
      
 {
        name: "WALL_UP_ZN",
        match: { dir: [0, 0, -1] },
        pre: [
          { cell: [0, 1, 0], is: "free" },
          { cell: [0, 0, -1], is: "occupied" },
          { cell: [0, 1, -1], is: "occupied" },    { cell: [0, 1, 1], is: "free" }
        ],
        effect: { pos_delta: [0, 1, 0], dir: [0, 0, -1] },
        cost: 2,
      },      
      
      
       
      
      {
        name: "ROT_RIGHT_XP_TO_ZN",
        match: { dir: [1, 0, 0] },
        pre: [ 
             { cell: [1, 0, 0], is: "free" },{ cell: [0, 0, 1], is: "free" },{ cell: [-1, 0, 0], is: "free" }, { cell: [0, 0, -1], is: "free" } ,

             { cell: [-2, 0, 0], is: "free" }, { cell: [-2, 0, 1], is: "free" },{ cell: [-1, 0, 1], is: "free" },{ cell: [-1, 0, 2], is: "free" }, { cell: [0, 0, 2], is: "free" } 
             
             ],
        effect: { pos_delta: [0, 0, 0], dir: [0, 0, -1] },
        cost: 2,
      },
     
      {
        name: "ROT_LEFT_XP_TO_ZP",
        match: { dir: [1, 0, 0] },
        pre: [
             { cell: [1, 0, 0], is: "free" },{ cell: [0, 0, 1], is: "free" },{ cell: [-1, 0, 0], is: "free" }, { cell: [0, 0, -1], is: "free" } ,
             
             { cell: [-2, 0, 0], is: "free" }, { cell: [-2, 0, -1], is: "free" },{ cell: [-1, 0, -1], is: "free" },{ cell: [-1, 0, -2], is: "free" }, { cell: [0, 0, -2], is: "free" } 
             
             ],
        effect: { pos_delta: [0, 0, 0], dir: [0, 0, 1] },
        cost: 2,
      },
      
      
       
      {
        name: "ROT_RIGHT_XN_TO_ZP",
        match: { dir: [-1, 0, 0] },
        pre: [
            { cell: [1, 0, 0], is: "free" },{ cell: [0, 0, 1], is: "free" },{ cell: [-1, 0, 0], is: "free" }, { cell: [0, 0, -1], is: "free" } ,
            
             { cell: [2, 0, 0], is: "free" }, { cell: [1, 0, -1], is: "free" },{ cell: [2, 0, -1], is: "free" },{ cell: [0, 0, -2], is: "free" }, { cell: [1, 0, -2], is: "free" } 
            
            ],
        effect: { pos_delta: [0, 0, 0], dir: [0, 0, 1] },
        cost: 2,
      },
      
       // ... alfalf
      {
        name: "ROT_LEFT_XN_TO_ZN",
        match: { dir: [-1, 0, 0] },
        pre: [
             { cell: [1, 0, 0], is: "free" },{ cell: [0, 0, 1], is: "free" },{ cell: [-1, 0, 0], is: "free" }, { cell: [0, 0, -1], is: "free" } ,
             
         { cell: [0, 0, 2], is: "free" }, { cell: [1, 0, 2], is: "free" },{ cell: [1, 0, 1], is: "free" },{ cell: [2, 0, 1], is: "free" }, { cell: [2, 0, 0], is: "free" } 
 
             
             ],
        effect: { pos_delta: [0, 0, 0], dir: [0, 0, -1] },
        cost: 2,
      },
      
      
      {
        name: "ROT_RIGHT_ZP_TO_XP",
        match: { dir: [0, 0, 1] },
        pre: [
             { cell: [1, 0, 0], is: "free" },{ cell: [0, 0, 1], is: "free" },{ cell: [-1, 0, 0], is: "free" }, { cell: [0, 0, -1], is: "free" }, 
             
      { cell: [-2, 0, 0], is: "free" }, { cell: [-2, 0, -1], is: "free" },{ cell: [-1, 0, -1], is: "free" },{ cell: [-1, 0, -2], is: "free" }, { cell: [0, 0, -2], is: "free" } 

             ],
        effect: { pos_delta: [0, 0, 0], dir: [1, 0, 0] },
        cost: 2,
      },
      {
        name: "ROT_LEFT_ZP_TO_XN",
        match: { dir: [0, 0, 1] },
        pre: [ 
             { cell: [1, 0, 0], is: "free" },{ cell: [0, 0, 1], is: "free" },{ cell: [-1, 0, 0], is: "free" }, { cell: [0, 0, -1], is: "free" }, 
             
            { cell: [2, 0, 0], is: "free" }, { cell: [1, 0, -1], is: "free" },{ cell: [2, 0, -1], is: "free" },{ cell: [0, 0, -2], is: "free" }, { cell: [1, 0, -2], is: "free" } 

             ],
        effect: { pos_delta: [0, 0, 0], dir: [-1, 0, 0] },
        cost: 2,
      },
      {
        name: "ROT_RIGHT_ZN_TO_XN",
        match: { dir: [0, 0, -1] },
        pre: [ 
             { cell: [1, 0, 0], is: "free" },{ cell: [0, 0, 1], is: "free" },{ cell: [-1, 0, 0], is: "free" }, { cell: [0, 0, -1], is: "free" } ,

         { cell: [0, 0, 2], is: "free" }, { cell: [1, 0, 2], is: "free" },{ cell: [1, 0, 1], is: "free" },{ cell: [2, 0, 1], is: "free" }, { cell: [2, 0, 0], is: "free" } 

             ],
        effect: { pos_delta: [0, 0, 0], dir: [-1, 0, 0] },
        cost: 2,
      },
      {
        name: "ROT_LEFT_ZN_TO_XP",
        match: { dir: [0, 0, -1] },
        pre: [ 
        { cell: [1, 0, 0], is: "free" },{ cell: [0, 0, 1], is: "free" },{ cell: [-1, 0, 0], is: "free" }, { cell: [0, 0, -1], is: "free" } ,
        
      { cell: [-2, 0, 0], is: "free" }, { cell: [-2, 0, 1], is: "free" },{ cell: [-1, 0, 1], is: "free" },{ cell: [-1, 0, 2], is: "free" }, { cell: [0, 0, 2], is: "free" } 
      
      ],

        effect: { pos_delta: [0, 0, 0], dir: [1, 0, 0] },
        cost: 2,
      },
    ],
  });

  const primitiveList = primitives.primitives.slice();
  const primitiveByName = new Map(primitiveList.map((primitive) => [primitive.name, primitive]));
  const primitiveOrder = primitiveList.map((primitive) => primitive.name);
  const primitiveCosts = Object.fromEntries(primitiveList.map((primitive) => [primitive.name, Number(primitive.cost ?? 1)]));

  const forbiddenSource = (world && world.forbidden) ?? options.forbidden ?? options.forbidden_world ?? null;
  const isForbidden = (x, y, z) => {
    if (!forbiddenSource) return false;

    if (typeof forbiddenSource.isOccupied === "function") {
      return forbiddenSource.isOccupied(x, y, z);
    }

    if (typeof forbiddenSource.get === "function") {
      return forbiddenSource.get(x, y, z) !== null;
    }

    if (Array.isArray(forbiddenSource)) {
      for (let i = 0; i < forbiddenSource.length; i++) {
        const cell = forbiddenSource[i];
        if (
          Number(cell?.x) === Number(x) &&
          Number(cell?.y) === Number(y) &&
          Number(cell?.z) === Number(z)
        ) {
          return true;
        }
      } // for
    }

    return false;
  }; // isForbidden()

  const canCheckTerrain = Boolean(world && typeof world.isFree === "function");
  const isFree = canCheckTerrain
    ? (x, y, z) => world.isFree(x, y, z) && !isForbidden(x, y, z)
    : (x, y, z) => !isForbidden(x, y, z);

  function normalizeVehicleHeading(input) {
    const x = Number(input?.vx ?? input?.x ?? input?.dir?.x ?? 0);
    const y = Number(input?.vy ?? input?.y ?? input?.dir?.y ?? 0);
    const z = Number(input?.vz ?? input?.z ?? input?.dir?.z ?? 0);

    const sx = Math.sign(x);
    const sy = Math.sign(y);
    const sz = Math.sign(z);

    if (sx === 1) return DIR_XP;
    if (sx === -1) return DIR_XN;
    if (sz === 1) return DIR_ZP;
    if (sz === -1) return DIR_ZN;
    if (sy === 1) return { x: 0, y: 1, z: 0 };
    if (sy === -1) return { x: 0, y: -1, z: 0 };
    return DIR_ZP;
  } // normalizeVehicleHeading()

  function makeVehicleState(input = {}) {
    const heading = normalizeVehicleHeading(input.dir ?? input);
    return {
      x: Number(input.x ?? 0),
      y: Number(input.y ?? 0),
      z: Number(input.z ?? 0),
      vx: heading.x,
      vy: heading.y,
      vz: heading.z,
      support: input.support ?? null,
      edge: input.edge ?? null,
    };
  } // makeVehicleState()

  function cloneVehicleState(state, patch = {}) {
    return makeVehicleState({
      x: patch.x ?? state.x,
      y: patch.y ?? state.y,
      z: patch.z ?? state.z,
      dir: patch.dir ?? { x: patch.vx ?? state.vx, y: patch.vy ?? state.vy, z: patch.vz ?? state.vz },
      support: patch.support ?? state.support ?? null,
      edge: patch.edge ?? state.edge ?? null,
    });
  } // cloneVehicleState()

  function buildStateKey(state) {
    return [
      Number(state.x ?? 0),
      Number(state.y ?? 0),
      Number(state.z ?? 0),
      Number(state.vx ?? 0),
      Number(state.vy ?? 0),
      Number(state.vz ?? 0),
    ].join("|");
  } // buildStateKey()

  function sameHeading(a, b) {
    return Number(a?.x ?? 0) === Number(b?.x ?? 0) &&
      Number(a?.y ?? 0) === Number(b?.y ?? 0) &&
      Number(a?.z ?? 0) === Number(b?.z ?? 0);
  } // sameHeading()

  function headingKey(heading) {
    const dir = normalizeVehicleHeading(heading);
    if (dir.x === 1) return "XP";
    if (dir.x === -1) return "XN";
    if (dir.z === 1) return "ZP";
    if (dir.z === -1) return "ZN";
    return "ZP";
  } // headingKey()

  function rotationLowerBound(currentHeading, goalHeading) {
    const current = headingKey(currentHeading);
    const goalDir = headingKey(goalHeading);
    if (current === goalDir) return 0;
    const table = {
      XP: { XP: 0, ZP: 1, XN: 2, ZN: 1 },
      XN: { XN: 0, ZP: 1, XP: 2, ZN: 1 },
      ZP: { ZP: 0, XP: 1, ZN: 2, XN: 1 },
      ZN: { ZN: 0, XP: 1, ZP: 2, XN: 1 },
    };
    return table[current]?.[goalDir] ?? 0;
  } // rotationLowerBound()

  function manhattan3d(a, b) {
    return Math.abs(Number(a.x ?? 0) - Number(b.x ?? 0)) +
      Math.abs(Number(a.y ?? 0) - Number(b.y ?? 0)) +
      Math.abs(Number(a.z ?? 0) - Number(b.z ?? 0));
  } // manhattan3d()

  const startState = makeVehicleState(start);
  const goalState = makeVehicleState(goal);
  const includeStart = options.include_start !== false;
  const maxDebugRejections = Math.max(0, Number(options.max_debug_rejections ?? 120));
  const maxSearchSteps = Math.max(1, Number(options.max_search_steps ?? 100000));
  const openKeys = [];
  const openSet = new Set();
  const closedSet = new Set();
  const cameFrom = new Map();
  const actionFrom = new Map();
  const stateByKey = new Map();
  const gScore = new Map();
  const hScore = new Map();
  const fScore = new Map();
  const rejectionCounts = new Map();
  const debugRejections = [];
  let expandedNodes = 0;
  let generatedNodes = 0;
  let bestPartialKey = null;

  const recordRejection = (currentState, primitiveName, transition) => {
    const error = transition?.error ?? "ERR_PRIMITIVE_BLOCKED";
    rejectionCounts.set(error, (rejectionCounts.get(error) ?? 0) + 1);

    if (debugRejections.length >= maxDebugRejections) {
      return;
    }

    debugRejections.push({
      from: cloneVehicleState(currentState),
      primitive: primitiveName,
      error,
      target: transition?.target ?? null,
      contact: transition?.contact ?? null,
      expected_support: transition?.expected_support ?? null,
      actual_support: transition?.actual_support ?? null,
      composite: null,
      failed_step_index: null,
      failed_primitive: null,
      step_error: null,
      macro_trace: null,
      gate_debug: transition?.gate_debug ?? null,
    });
  }; // recordRejection()

  const considerBestPartial = (key) => {
    if (!key) return;
    const candidateState = stateByKey.get(key);
    if (!candidateState) return;

    const candidateH = hScore.get(key) ?? Infinity;
    const candidateG = gScore.get(key) ?? Infinity;

    if (!bestPartialKey) {
      bestPartialKey = key;
      return;
    }

    const currentBestH = hScore.get(bestPartialKey) ?? Infinity;
    const currentBestG = gScore.get(bestPartialKey) ?? Infinity;
    if (
      candidateH < currentBestH ||
      (candidateH === currentBestH && candidateG < currentBestG)
    ) {
      bestPartialKey = key;
    }
  }; // considerBestPartial()

  const heuristic = (state) => {
    return manhattan3d(state, goalState) + rotationLowerBound(state, goalState) * 2;
  }; // heuristic()

  const goalMatches = (state) => {
    const normalized = makeVehicleState(state);
    return (
      Number(normalized.x) === Number(goalState.x) &&
      Number(normalized.y) === Number(goalState.y) &&
      Number(normalized.z) === Number(goalState.z) &&
      Number(normalized.vx) === Number(goalState.vx) &&
      Number(normalized.vy) === Number(goalState.vy) &&
      Number(normalized.vz) === Number(goalState.vz)
    );
  }; // goalMatches()

  const isTerrainOccupied = (x, y, z) => {
    if (!canCheckTerrain) return false;
    if (isForbidden(x, y, z)) return false;
    return world.isOccupied(x, y, z);
  }; // isTerrainOccupied()

  const applyPrimitive = (currentState, primitiveName) => {
    const primitive = primitiveByName.get(primitiveName);
    if (!primitive) {
      return {
        ok: false,
        error: "ERR_UNKNOWN_PRIMITIVE",
        gate_debug: { reason_code: "unknown_primitive" },
      };
    }

    const currentHeading = normalizeVehicleHeading(currentState);
    const requiredHeading = primitive.match?.dir
      ? normalizeVehicleHeading({ vx: primitive.match.dir[0], vy: primitive.match.dir[1], vz: primitive.match.dir[2] })
      : null;

    if (requiredHeading && !sameHeading(currentHeading, requiredHeading)) {
      return {
        ok: false,
        error: "ERR_PRIMITIVE_DIR_MISMATCH",
        gate_debug: {
          kind: primitive.kind ?? "primitive",
          reason_code: "wrong_heading",
          current_heading: currentHeading,
          required_heading: requiredHeading,
        },
      };
    }

    const deltas = Array.isArray(primitive.effect?.pos_delta) ? primitive.effect.pos_delta : [0, 0, 0];
    const targetX = Number(currentState.x) + Number(deltas[0] ?? 0);
    const targetY = Number(currentState.y) + Number(deltas[1] ?? 0);
    const targetZ = Number(currentState.z) + Number(deltas[2] ?? 0);
    const targetFree = isFree(targetX, targetY, targetZ);
    const orthogonalOffsets = [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 },
    ];
    const targetOrthogonalContacts = (() => {
      if (!canCheckTerrain) return [];
      const contacts = [];
      for (let i = 0; i < orthogonalOffsets.length; i++) {
        const offset = orthogonalOffsets[i];
        const cx = targetX + offset.x;
        const cy = targetY + offset.y;
        const cz = targetZ + offset.z;
        if (isTerrainOccupied(cx, cy, cz)) {
          contacts.push({ x: cx, y: cy, z: cz });
        }
      } // for
      return contacts;
    })();
    const hasTargetContact = !canCheckTerrain || targetOrthogonalContacts.length > 0;

    for (let i = 0; i < (primitive.pre ?? []).length; i++) {
      const pre = primitive.pre[i];
      const rel = Array.isArray(pre?.cell) ? pre.cell : [0, 0, 0];
      const checkX = Number(currentState.x) + Number(rel[0] ?? 0);
      const checkY = Number(currentState.y) + Number(rel[1] ?? 0);
      const checkZ = Number(currentState.z) + Number(rel[2] ?? 0);
      const shouldBeFree = String(pre?.is ?? "free") === "free";
      const free = isFree(checkX, checkY, checkZ);
      const occupied = isTerrainOccupied(checkX, checkY, checkZ);
      if (shouldBeFree && !free) {
        return {
          ok: false,
          error: "ERR_PRECONDITION_BLOCKED",
          target: { x: targetX, y: targetY, z: targetZ },
          contact: { x: checkX, y: checkY, z: checkZ },
          gate_debug: {
            kind: primitive.kind ?? "primitive",
            reason_code: "precondition_blocked",
            pre_index: i,
            pre_cell: { x: checkX, y: checkY, z: checkZ, free: false },
          },
        };
      }
      if (!shouldBeFree && !occupied) {
        return {
          ok: false,
          error: "ERR_PRECONDITION_BLOCKED",
          target: { x: targetX, y: targetY, z: targetZ },
          contact: { x: checkX, y: checkY, z: checkZ },
          gate_debug: {
            kind: primitive.kind ?? "primitive",
            reason_code: "precondition_blocked",
            pre_index: i,
            pre_cell: { x: checkX, y: checkY, z: checkZ, free: true, occupied: false },
          },
        };
      }
    } // for

    if (primitive.kind === "move" && !targetFree) {
      return {
        ok: false,
        error: "ERR_TARGET_BLOCKED",
        target: { x: targetX, y: targetY, z: targetZ },
        contact: { x: targetX, y: targetY, z: targetZ },
        gate_debug: {
          kind: primitive.kind ?? "primitive",
          reason_code: "target_blocked",
          target: { x: targetX, y: targetY, z: targetZ, free: false },
        },
      };
    }



     if (!hasTargetContact) {
       return {
         ok: false,
         error: "ERR_NO_CONTACT",
         target: { x: targetX, y: targetY, z: targetZ },
         contact: null,
         gate_debug: {
           kind: primitive.kind ?? "primitive",
           reason_code: "no_orthogonal_contact",
           target: {
             x: targetX,
             y: targetY,
             z: targetZ,
             free: targetFree,
           },
           orthogonal_contacts: targetOrthogonalContacts,
           can_use: false,
         },
       };
     } // hasTargetContact guard



    const nextHeading = primitive.effect?.dir
      ? normalizeVehicleHeading({ vx: primitive.effect.dir[0], vy: primitive.effect.dir[1], vz: primitive.effect.dir[2] })
      : currentHeading;

    return {
      ok: true,
      state: makeVehicleState({
        x: targetX,
        y: targetY,
        z: targetZ,
        dir: nextHeading,
        support: null,
        edge: null,
      }),
      cost: Number(primitive.cost ?? 1),
      gate_debug: {
        kind: primitive.kind ?? "primitive",
        reason_code: "ok",
      },
    };
  }; // applyPrimitive()

  const expandState = (currentState, currentKey, currentG) => {
    const neighbors = [];
    for (let i = 0; i < primitiveOrder.length; i++) {
      const primitiveName = primitiveOrder[i];
      generatedNodes++;

      const transition = applyPrimitive(currentState, primitiveName);
      if (!transition.ok) {
        recordRejection(currentState, primitiveName, transition);
        continue;
      }

      const nextState = makeVehicleState(transition.state);
      const nextKey = buildStateKey(nextState);
      const stepCost = Number(transition.cost ?? primitiveCosts[primitiveName] ?? 1);
      const tentativeG = currentG + stepCost;
      const knownG = gScore.get(nextKey);

      if (knownG !== undefined && tentativeG >= knownG) {
        continue;
      }

      neighbors.push({
        primitive: primitiveName,
        state: nextState,
        key: nextKey,
        g: tentativeG,
        h: heuristic(nextState),
        fromKey: currentKey,
        trace: [cloneVehicleState(currentState), nextState],
        actions: [primitiveName],
      });
    } // for
    return neighbors;
  }; // expandState()

  const reconstructPath = (terminalKey) => {
    const statesRev = [];
    const actionsRev = [];
    let cursor = terminalKey;

    while (cursor !== null && cursor !== undefined) {
      const state = stateByKey.get(cursor);
      if (state) {
        statesRev.push(cloneVehicleState(state));
      }

      const parent = cameFrom.get(cursor);
      const action = actionFrom.get(cursor);
      if (parent !== undefined && parent !== null && action) {
        actionsRev.push(action);
      }

      cursor = parent ?? null;
    } // while

    statesRev.reverse();
    actionsRev.reverse();

    return {
      states: includeStart ? statesRev : statesRev.slice(1),
      states_full: statesRev,
      actions: actionsRev,
      total_cost: gScore.get(terminalKey) ?? actionsRev.length,
      terminal_key: terminalKey,
      terminal_state: stateByKey.get(terminalKey) ?? null,
      heuristic: hScore.get(terminalKey) ?? null,
      f_score: fScore.get(terminalKey) ?? null,
    };
  }; // reconstructPath()

  const headingLabelFromVector = (state) => {
    const vx = Number(state?.vx ?? 0);
    const vy = Number(state?.vy ?? 0);
    const vz = Number(state?.vz ?? 0);
    if (vx === 1 && vy === 0 && vz === 0) return "PX";
    if (vx === -1 && vy === 0 && vz === 0) return "XN";
    if (vx === 0 && vy === 0 && vz === 1) return "ZP";
    if (vx === 0 && vy === 0 && vz === -1) return "ZN";
    if (vx === 0 && vy === 0 && vz === 0) return "—";
    return `[${vx},${vy},${vz}]`;
  }; // headingLabelFromVector()

  const supportModeFromPrimitiveName = (primitiveName) => {
    const name = String(primitiveName ?? "");
    return name.startsWith("WALL_") ? "wall" : "floor";
  }; // supportModeFromPrimitiveName()

  const serializeVehicleState = (state, supportMode = null) => {
    if (!state) return null;
    const vx = Number(state.vx ?? 0);
    const vy = Number(state.vy ?? 0);
    const vz = Number(state.vz ?? 0);
    return {
      x: Number(state.x ?? 0),
      y: Number(state.y ?? 0),
      z: Number(state.z ?? 0),
      vx,
      vy,
      vz,
      dir: headingLabelFromVector({ vx, vy, vz }),
      support_mode: String(supportMode ?? state.support ?? "floor"),
    };
  }; // serializeVehicleState()

  const interpolateStateBetweenPrimitiveSteps = (beforeState, primitiveName) => {
    const primitive = primitiveByName.get(String(primitiveName ?? ""));
    const deltaInter = primitive?.effect?.pos_delta_inter;
    const dirInter = primitive?.effect?.dir_inter;
    if (!Array.isArray(deltaInter) || deltaInter.length < 3) return [];

    const midState = cloneVehicleState(beforeState, {
      x: Number(beforeState?.x ?? 0) + Number(deltaInter[0] ?? 0),
      y: Number(beforeState?.y ?? 0) + Number(deltaInter[1] ?? 0),
      z: Number(beforeState?.z ?? 0) + Number(deltaInter[2] ?? 0),
      dir: Array.isArray(dirInter) && dirInter.length >= 3
        ? { x: Number(dirInter[0] ?? 0), y: Number(dirInter[1] ?? 0), z: Number(dirInter[2] ?? 0) }
        : undefined,
      support: "floor",
    });
    return midState ? [midState] : [];
  }; // interpolateStateBetweenPrimitiveSteps()

  const decoratePathDataForOutput = (pathData) => {
    if (!pathData) return null;
    const rawStates = Array.isArray(pathData.states_full)
      ? pathData.states_full
      : Array.isArray(pathData.states)
        ? pathData.states
        : [];
    const rawActions = Array.isArray(pathData.actions) ? pathData.actions : [];
    const publicStates = [];

    if (rawStates.length > 0) {
      publicStates.push(serializeVehicleState(rawStates[0], rawStates[0]?.support ?? "floor"));
    }

    for (let i = 0; i < rawActions.length; i++) {
      const beforeState = rawStates[i] ?? null;
      const afterState = rawStates[i + 1] ?? null;
      const primitiveName = String(rawActions[i] ?? "");
      const supportMode = supportModeFromPrimitiveName(primitiveName);
      const midStates = beforeState
        ? interpolateStateBetweenPrimitiveSteps(beforeState, primitiveName)
        : [];

      for (let j = 0; j < midStates.length; j++) {
        publicStates.push(serializeVehicleState(midStates[j], "floor"));
      } // for

      if (afterState) {
        publicStates.push(serializeVehicleState(afterState, supportMode));
      }
    } // for

    const publicStatesOut = includeStart ? publicStates : publicStates.slice(1);
    const publicStatesFull = publicStates.slice();
    const lastPublicState = publicStatesOut.length > 0 ? publicStatesOut[publicStatesOut.length - 1] : null;
    const firstPublicState = publicStatesOut.length > 0 ? publicStatesOut[0] : null;

    return {
      ...pathData,
      states: publicStatesOut,
      states_full: publicStatesFull,
      terminal_state: lastPublicState ?? serializeVehicleState(pathData.terminal_state ?? null, null),
      start_state: firstPublicState ?? serializeVehicleState(pathData.states_full?.[0] ?? pathData.states?.[0] ?? null, null),
    };
  }; // decoratePathDataForOutput()

  const buildFinalResult = (pathData, extra = {}) => {
    const publicPathData = decoratePathDataForOutput(pathData);
    const dominantBlockReason = (() => {
      let bestReason = null;
      let bestCount = -1;
      for (const [reason, count] of rejectionCounts.entries()) {
        if (count > bestCount) {
          bestReason = reason;
          bestCount = count;
        }
      } // for
      return bestReason;
    })();

    const goalReachedExplicit = Boolean(
      goalState &&
      publicPathData &&
      publicPathData.terminal_state &&
      goalMatches(pathData.terminal_state ?? publicPathData.terminal_state)
    );

    const lastReachableState = publicPathData?.terminal_state ?? null;
    const lastReachableActions = publicPathData?.actions ?? [];
    const publicStartState = serializeVehicleState(startState, startState?.support ?? null);
    const publicGoalState = serializeVehicleState(goalState, goalState?.support ?? null);
    const errorStats = Object.fromEntries(rejectionCounts.entries());

    const result = {
      ok: Boolean(extra.ok),
      answer: "calc_vehicle_kinematics_path",
      error: extra.error ?? null,
      error_code: extra.ok ? null : (extra.error ?? "PATH_NOT_FOUND"),
      path_found: Boolean(extra.ok),
      dominant_block_reason: dominantBlockReason,
      start_state: publicStartState,
      goal_state: publicGoalState,
      states: publicPathData?.states ?? [],
      states_full: publicPathData?.states_full ?? [],
      actions: publicPathData?.actions ?? [],
      total_cost: publicPathData?.total_cost ?? 0,
      expanded_nodes: expandedNodes,
      generated_nodes: generatedNodes,
      debug_rejections: debugRejections,
      special_gate_trace: [],
      best_partial: decoratePathDataForOutput(extra.best_partial ?? null),
      error_stats: errorStats,
      hint: null,
    };

    Object.defineProperties(result, {
      states_full: {
        value: publicPathData?.states_full ?? [],
        enumerable: false,
        writable: false,
      },
      generated_nodes: {
        value: generatedNodes,
        enumerable: false,
        writable: false,
      },
      debug_rejections: {
        value: debugRejections,
        enumerable: false,
        writable: false,
      },
      special_gate_trace: {
        value: [],
        enumerable: false,
        writable: false,
      },
      debug: {
        value: {
        mode: "a_star_primitives",
        canReadTerrain: Boolean(canCheckTerrain),
        canReadForbidden: Boolean(forbiddenSource),
        start: publicStartState,
        goal: publicGoalState,
        forbidden: forbiddenSource ?? null,
        primitives: primitiveList.map((primitive) => ({
          name: primitive.name,
          kind: primitive.kind,
          description: primitive.description,
        })),
        primitive_order: primitiveOrder,
        primitive_costs: primitiveCosts,
        expanded_nodes: expandedNodes,
        generated_nodes: generatedNodes,
        dominant_block_reason: dominantBlockReason,
        goal_reached: goalReachedExplicit,
        last_reachable_state: lastReachableState,
        last_reachable_actions: lastReachableActions,
        special_gate_trace: [],
      },
        enumerable: false,
        writable: false,
      },
      _world_access: {
        value: {
        canReadTerrain: Boolean(canCheckTerrain),
        canReadForbidden: Boolean(forbiddenSource),
        isOccupied: (x, y, z) => isTerrainOccupied(x, y, z),
        isFree,
        isForbidden,
        validateTransition: applyPrimitive,
        primitives: primitiveList.map((primitive) => ({
          name: primitive.name,
          kind: primitive.kind,
          description: primitive.description,
        })),
        applyPrimitive,
      },
        enumerable: false,
        writable: false,
      },
    });

    return result;
  }; // buildFinalResult()

  if (!goalState) {
    return buildFinalResult(null, {
      ok: false,
      error: "ERR_GOAL_MISSING",
      best_partial: null,
    });
  }

  if (canCheckTerrain && !isFree(startState.x, startState.y, startState.z)) {
    return buildFinalResult(null, {
      ok: false,
      error: "ERR_START_BLOCKED",
      best_partial: null,
    });
  }

  if (canCheckTerrain && !isFree(goalState.x, goalState.y, goalState.z)) {
    return buildFinalResult(null, {
      ok: false,
      error: "ERR_GOAL_BLOCKED",
      best_partial: null,
    });
  }

  const startKey = buildStateKey(startState);
  stateByKey.set(startKey, startState);
  gScore.set(startKey, 0);
  hScore.set(startKey, heuristic(startState));
  fScore.set(startKey, heuristic(startState));
  openKeys.push(startKey);
  openSet.add(startKey);
  considerBestPartial(startKey);

  while (openKeys.length > 0) {
    if (expandedNodes >= maxSearchSteps) {
      const partialKey = bestPartialKey ?? startKey;
      const partialPath = reconstructPath(partialKey);
      return buildFinalResult(partialPath, {
        ok: false,
        error: "ERR_SEARCH_LIMIT_REACHED",
        best_partial: partialPath,
      });
    }

    let bestIndex = 0;
    let bestKey = openKeys[0];
    let bestF = fScore.get(bestKey) ?? Infinity;
    let bestH = hScore.get(bestKey) ?? Infinity;
    let bestG = gScore.get(bestKey) ?? Infinity;

    for (let i = 1; i < openKeys.length; i++) {
      const candidateKey = openKeys[i];
      const candidateF = fScore.get(candidateKey) ?? Infinity;
      const candidateH = hScore.get(candidateKey) ?? Infinity;
      const candidateG = gScore.get(candidateKey) ?? Infinity;

      if (
        candidateF < bestF ||
        (candidateF === bestF && candidateH < bestH) ||
        (candidateF === bestF && candidateH === bestH && candidateG < bestG)
      ) {
        bestIndex = i;
        bestKey = candidateKey;
        bestF = candidateF;
        bestH = candidateH;
        bestG = candidateG;
      }
    } // for

    openKeys.splice(bestIndex, 1);
    openSet.delete(bestKey);

    if (closedSet.has(bestKey)) {
      continue;
    }

    const currentState = stateByKey.get(bestKey);
    if (!currentState) {
      continue;
    }

    closedSet.add(bestKey);
    expandedNodes++;

    if (goalMatches(currentState)) {
      const successPath = reconstructPath(bestKey);
      return buildFinalResult(successPath, {
        ok: true,
        error: null,
        best_partial: null,
      });
    }

    const currentG = gScore.get(bestKey) ?? Infinity;
    const nextStates = expandState(currentState, bestKey, currentG);

    for (let i = 0; i < nextStates.length; i++) {
      const next = nextStates[i];
      cameFrom.set(next.key, next.fromKey);
      actionFrom.set(next.key, next.actions?.[0] ?? next.primitive);
      stateByKey.set(next.key, next.state);
      gScore.set(next.key, next.g);
      hScore.set(next.key, next.h);
      fScore.set(next.key, next.g + next.h);

      if (closedSet.has(next.key)) {
        closedSet.delete(next.key);
      }

      if (!openSet.has(next.key)) {
        openSet.add(next.key);
        openKeys.push(next.key);
      }

      considerBestPartial(next.key);
    } // for nextStates
  } // while

  const partialKey = bestPartialKey ?? startKey;
  const partialPath = reconstructPath(partialKey);
  return buildFinalResult(null, {
    ok: false,
    error: "PATH_NOT_FOUND",
    best_partial: partialPath,
  });
} // calc_vehicle_kinematics_payload_path()


module.exports = {
                 calc_vehicle_kinematics_payload_path
                 };

  
