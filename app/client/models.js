(function($){
    window.UIError = Backbone.Model.extend({});

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
        __name__: 'build',
        initialize: function(){
            _.bindAll(this, 'update_from_socket');

            window.socket.on('Build started', this.update_from_socket);
            window.socket.on('Build finished', this.update_from_socket);
        },
        update_from_socket: function(data){
            var self = this;
            var data_id = parseInt(data.build.__id__, 10);
            var my_id = parseInt(this.get('__id__'), 10);
            if (data_id === my_id) {
                _.each(data.build, function(key, value){
                    self.set({key: value});
                });
            }
        }
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