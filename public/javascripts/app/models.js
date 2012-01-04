(function($){$(function(){
    window.EmeraldModel = Backbone.Model.extend({
        initialize: function(){
            this.__init__();
        },
        __init__: function(){
            var self = this;
            self.bind("change", function() {
              if (self.hasChanged("__id__")) {
                  self.set('id', self.get('__id__'));
              }
            });
        },
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

            this.__init__();

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
    window.Builds = Backbone.Collection.extend({
        model: Build,
        comparator: function(){
            return (new Date(this.get('finished_at'))).getTime();
        }
    });

    window.BuildInstruction = EmeraldModel.extend({
        __name__: 'instruction',
        initialize: function(){
            this.__init__();
            _.bindAll(this, 'build_started', 'build_finished');
            window.socket.on('Build started', this.build_started);
            window.socket.on('Build finished', this.build_finished);
        },
        build_started: function(data){
            this.change();
        },
        build_finished: function(data){
            this.change();
        }

    });

    window.BuildInstructions = Backbone.Collection.extend({
        model: BuildInstruction,
        url: '/api/instructions.json'
    });
})})(jQuery);