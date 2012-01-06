(function($){$(function(){
    window.instructions = new window.BuildInstructions();

    window.App = new window.EmeraldRouter();
    Backbone.history.start();
});})(jQuery);