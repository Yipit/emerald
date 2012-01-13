(function($){
    window.UIError = Backbone.Model.extend({});

    window.ConsoleSource = Backbone.Model.extend({
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
            window.socket.on('Build started', function(data){
                if (data.instruction.id == self.get('id')) {
                    self.trigger('build_started', data);
                }
            });
            window.socket.on('Build finished', function(data){
                if (data.instruction.id == self.get('id')) {
                    self.trigger('build_finished', data);
                }
            });
            window.socket.on('Build aborted', function(data){
                if (data.instruction.id == self.get('id')) {
                    self.trigger('build_aborted', data);
                }
            });

            window.socket.on('Build stdout', function(data){
                if (data.instruction.id == self.get('id')) {
                    self.trigger('build_stdout', data);
                }
            });
            window.socket.on('Build stderr', function(data){
                if (data.instruction.id == self.get('id')) {
                    self.trigger('build_stderr', data);
                }
            });

            window.socket.on('Repository being fetched', function(data){
                if (data.instruction.id == self.get('id')) {
                    self.trigger('fetching_repository', data);
                }
            });

        }
    });

    window.BuildInstructions = Backbone.Collection.extend({
        model: BuildInstruction,
        url: '/api/instructions.json'
    });
})(jQuery);
