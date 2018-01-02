
namespace Ecka.Dillon.Plugin.Controllers {
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading.Tasks;
    using Leuwen.Common;
    using Leuwen.Common.Logging;
    using Leuwen.Dillon.Plugin;
    using Microsoft.AspNetCore.Mvc;

    [Route("dillon")]
    public class DillonController
        : Controller {

        public Guid RuleId { get; } = Guid.Parse("c78d75ff-cb84-4bba-9b26-8588ce898a99");

        public DillonController(ILog log, IEventQueue queue) {
            _log = log;
            _queue = queue;
        }

        [HttpGet]
        [Route("update")]
        public async Task<IActionResult> Update([FromQuery]List<Update> updates) {
            _log.Debug($"Update requested with {updates.Count()} updates.");

            foreach (var update in updates) {
                _log.Debug($"Update {update.Id}: Y={update.Y}, X={update.X}");

                //turn the update into an event (with correct ruleid) and push onto queue
                var @event = new Event {
                    Data = new Dictionary<string, object> {{"key", update.Id}}
                };
                @event.RuleIds.Add(RuleId);
                _queue.Enqueue(@event);
                //if (_config.Mappings.ContainsKey(update.Id))
                //{
                //    var mapping = _config.Mappings[update.Id];
                //    try
                //    {
                //        mapping.Execute(update);
                //    }
                //    catch (Exception e)
                //    {
                //        _log.Error($"An exception was thrown executing {mapping.GetType().FullName} with id {update.Id}. {e}");
                //        //swallow the exception because we don't want the server to crash just because a mapping failed.
                //    }
                //}
                //else
                //{
                //    _log.Warn($"No mapping found for id {update.Id}.");
                //}
            }
            return Ok(updates.Count);
        }

        private readonly ILog _log;
        private readonly IEventQueue _queue;
    }
}