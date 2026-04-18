function build_api_describe_head(controller)
{
return(
       {
       ok: true,
       answer: "api_description",
       api_name: "SP-CellBots BotController API",
       version: controller.version,
       transport: "json-over-tcp",
       mode: "atomic-request",
       general: [
                 "This API controls the BotController for real or simulated SP-CellBot clusters via a Masterbot connection.",
                 "All coordinates are Masterbot-relative (x, y, z), and commands operate on local slot semantics (F, R, B, L, T, D).",
                 "Movement is step-based and only valid when anchor/contact constraints are satisfied; invalid paths are rejected.",
                 "Rotation is executed in 90° left/right steps and can be blocked by local occupancy even if translation to the same cell is possible.",
                 "Grabbing is front-slot based (F) and transport behavior depends on current carrier/payload state and local free space.",
                 "ACK timeout, blocked rotation, or topology changes can cause partial execution; always verify post-state before continuing.",
                 "On failure, proactively switch to the available diagnostic commands, derive an alternative execution plan, and continue with the revised plan."
                ]
       }
      );
} // build_api_describe_head()

module.exports = { build_api_describe_head };
