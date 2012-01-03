(function($){$(function(){
    window.BuildInstruction = Backbone.Model.extend({});
    window.Build = Backbone.Model.extend({});

    window.BuildInstructions = Backbone.Collection.extend({
        model: BuildInstruction,
        url: '/instructions.json'
    });
    window.Builds = Backbone.Collection.extend({
        model: Build
    });
})})(jQuery);