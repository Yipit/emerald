(function($){$(function(){
    window.instructions = new window.BuildInstructions();
    window.main_console = new window.ConsoleSource();

    window.App = new window.EmeraldRouter();
    Backbone.history.start();
});})(jQuery);
