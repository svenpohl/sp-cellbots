const net = require('net');

class BotControllerApiService
{

constructor(controller)
{
this.controller = controller;
} // constructor()


append_api_message_log(raw_message, parsed_message)
{
return(this.controller.append_api_message_log_internal(raw_message, parsed_message));
} // append_api_message_log()


async handleAPIMessage(message, socket)
{
return(await this.controller.handleAPIMessage_internal(message, socket));
} // handleAPIMessage()


start_api_service()
{
const controller = this.controller;

if (controller.ENABLE_API != "true")
   {
   console.log("[BotController API] API disabled by config.");
   return;
   } // if

if (!controller.API_PORT || Number.isNaN(controller.API_PORT))
   {
   console.log("[BotController API] No valid api_port configured.");
   return;
   } // if

controller.api_server = net.createServer((socket) =>
                                        {
                                        let buffer = "";

                                        socket.on('data', async (data) =>
                                                           {
                                                           buffer += data.toString();
                                                           const messages = buffer.split("\n");
                                                           buffer = messages.pop();

                                                           for (let i = 0; i < messages.length; i++)
                                                               {
                                                               const message = messages[i].trim();
                                                               if (!message)
                                                                  {
                                                                  continue;
                                                                  } // if

                                                               await this.handleAPIMessage(message, socket);
                                                               } // for
                                                           });

                                        socket.on('error', (err) =>
                                                          {
                                                          console.error("[BotController API] Socket error:", err.message);
                                                          });
                                        });

controller.api_server.listen(controller.API_PORT, () =>
                                                  {
                                                  console.log(`[BotController API] listening on port ${controller.API_PORT}`);
                                                  });

controller.api_server.on('error', (err) =>
                                  {
                                  console.error("[BotController API] Server error:", err.message);
                                  });
} // start_api_service()


} // class BotControllerApiService

module.exports = BotControllerApiService;
