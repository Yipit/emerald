(function($){$(function(){
    window.socket = io.connect();
    window.instructions = new window.BuildInstructions();

    window.App = new window.EmeraldRouter();
    Backbone.history.start();
})})(jQuery);