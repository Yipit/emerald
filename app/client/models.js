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
        schema: {
            name:        { validators: ['required'] },
            description: { type: 'Text'},
            repository_address: { type: 'Text', validators: ['required', validateRepositoryAddress]},
            branch: { type: 'Text'},
            build_script: { type: 'Text'}
        },
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
            window.socket.on('Build started',                bypass_signal("Build started",                "build_started"));
            window.socket.on('Build running',                bypass_signal("Build running",                "build_running"));
            window.socket.on('Build finished',               bypass_signal("Build finished",               "build_finished"));
            window.socket.on('Build aborted',                bypass_signal("Build aborted",                "build_aborted"));
            window.socket.on('Build output',                 bypass_signal("Build output",                 "build_output"));

            window.socket.on('Repository started fetching', bypass_signal("Repository started fetching", "repository_fetched"));
            window.socket.on('Repository being fetched',     bypass_signal("Repository being fetched",     "fetching_repository"));
            window.socket.on('Repository finished fetching', bypass_signal("Repository finished fetching", "repository_fetched"));
        }
    });

    window.BuildInstructions = Backbone.Collection.extend({
        model: BuildInstruction,
        url: '/api/instructions.json'
    });
})(jQuery);
