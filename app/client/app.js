(function($){$(function(){
    window.instructions = new window.BuildInstructions();
    window.main_console = new window.ConsoleSource();

    window.socket.on('Build stdout', function(data){
        window.main_console.set(data);
    });

    window.App = new window.EmeraldRouter();
    Backbone.history.start();
});})(jQuery);
