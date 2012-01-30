(function($){
    window.UIError = Backbone.Model.extend({});

    window.ConsoleSource = Backbone.Model.extend({
        initialize: function(){
            var self = this;
            window.socket.on('Build stdout', function(data){
                self.set(data);
            });
        }
    });

    window.EmeraldModel = Backbone.Model.extend({
        url: function(){
            return [
                '/api',
                this.__name__,
                this.get('__id__')
            ].join('/') + '.json';
        }
    });

    window.Build = EmeraldModel.extend({
        __name__: "build"
    });

    window.BuildInstruction = EmeraldModel.extend({
        __name__: 'instruction',
        initialize: function(){
            var self = this;

            function bypass_signal (server_name, client_name) {
                /* takes a signal broadcasted by redis, match the
                 * instruction id and cascade the signal town into
                 * backbone signals */
                var myid = self.get('id');
                return function (data) {
                    if (data.instruction.id == myid) {
                        self.set(data.instruction);
                        data.event_name = server_name;
                        self.trigger(client_name, data);
                    }
                }
            }
            window.socket.on('Build started',                bypass_signal("Build started",                "build_started"));
            window.socket.on('Build finished',               bypass_signal("Build finished",               "build_finished"));
            window.socket.on('Build aborted',                bypass_signal("Build aborted",                "build_aborted"));
            window.socket.on('Build output',                 bypass_signal("Build output",                 "build_output"));

            window.socket.on('Repository being fetched',     bypass_signal("Repository being fetched",     "fetching_repository"));
            window.socket.on('Repository finished fetching', bypass_signal("Repository finished fetching", "fetching_repository"));
        }
    });

    window.BuildInstructions = Backbone.Collection.extend({
        model: BuildInstruction,
        url: '/api/instructions.json'
    });
})(jQuery);
