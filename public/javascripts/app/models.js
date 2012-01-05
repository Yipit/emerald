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
            if (parseInt(data.build.__id__) == (this.get('__id__'))) {
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
            window.socket.on('Build started' , function(data){
                if (data.instruction.id == self.get('id')) {
                    self.trigger('build_started', data.build, data.instruction);
                }
            });
            window.socket.on('Build finished' , function(data){
                if (data.instruction.id == self.get('id')) {
                    self.trigger('build_finished', data.build, data.instruction);
                }
            });
            window.socket.on('Build output' , function(data){
                if (data.instruction.id == self.get('id')) {
                    self.trigger('build_output', data);
                }
            });
            window.socket.on('Repository being fetched' , function(data){
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