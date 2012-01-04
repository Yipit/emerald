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
            ['Build finished', 'Build started'].forEach(function(event){
                window.socket.on(event, function(data){
                    console.log([event, data]);
                    _.each(data[self.__name__], function(key, value){
                        self.set({key: value});
                    });
                });
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
        __name__: 'build'
    });
    window.Builds = Backbone.Collection.extend({
        model: Build
    });

    window.BuildInstruction = EmeraldModel.extend({
        __name__: 'instruction',
        initialize: function(){
            var self = this;
            self.__init__();
            self.bind("change", function() {
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
        }
    });

    window.BuildInstructions = Backbone.Collection.extend({
        model: BuildInstruction,
        url: '/api/instructions.json'
    });
})})(jQuery);