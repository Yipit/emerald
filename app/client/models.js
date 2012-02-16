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

    function validateRepositoryAddress(str) {
        var regex = new RegExp('^((file|git|ssh|https?|ftps?|rsync)[:][/]{2})?([\\w_-.]+[@])?[/:].*');
        return regex.test(str) ? null : 'Invalid repository address';
    }
    window.BuildInstruction = EmeraldModel.extend({
        __name__: 'instruction',
        initialize: function(){
            var self = this;

            function bypass_signal (server_name, client_name) {
                var myid = self.get('id');
                return function (data) {
                    if (data.instruction.id == myid) {
                        self.set(data.instruction);
                        data.event_name = server_name;
                        self.trigger(client_name, data);
                    }
                };
            }

            var mappings = {
                "BuildInstruction deleted": "instruction_deleted",
                "Build started": "build_started",
                "Build running": "build_running",
                "Build finished": "build_finished",
                "Build aborted": "build_aborted",
                "Build output": "build_output",
                "Repository started fetching": "repository_fetched",
                "Repository being fetched": "fetching_repository",
                "Repository finished fetching": "repository_fetched"
            };
            _.each(mappings, function(method_name, signal_name){
                window.socket.on(signal_name, bypass_signal(signal_name, method_name));
            });
        }
    });

    window.BuildInstructions = Backbone.Collection.extend({
        model: BuildInstruction,
        url: '/api/instructions.json'
    });
})(jQuery);
