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
                console.log("got a build:", data.build);
                _.each(data.build, function(key, value){
                    self.set({key: value});
                });
            }
        }
    });
    window.Builds = Backbone.Collection.extend({
        model: Build
    });

    window.BuildInstruction = EmeraldModel.extend({
        __name__: 'instruction',
        initialize: function(){
            this.__init__();
            _.bindAll(this, 'build_started', 'build_finished');

            window.socket.on('Build started', this.build_started);
            window.socket.on('Build finished', this.build_finished);

            var self = this;
            this.bind("change", function() {
                [
                    'all_builds',
                    'failed_builds',
                    'succeeded_builds'
                ].forEach(function(attr){
                    if (self.hasChanged(attr)) {
                        self.set({attr: new Builds(self.get(attr))});
                    }
                });
            });
        },
        build_started: function(data){
            var self = this;
            if (parseInt(data.instruction.__id__) == (this.get('__id__'))) {
                console.log("started running instruction:", data.instruction);
                _.each(data.instruction, function(key, value){
                    self.set({key: value});
                });
            }
        },
        build_finished: function(data){
            var self = this;
            if (parseInt(data.instruction.__id__) == (this.get('__id__'))) {
                console.log("finished running instruction:", data.instruction);
                _.each(data.instruction, function(key, value){
                    self.set({key: value});
                });
            }
        }

    });

    window.BuildInstructions = Backbone.Collection.extend({
        model: BuildInstruction,
        url: '/api/instructions.json'
    });
})})(jQuery);