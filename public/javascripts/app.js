(function($){$(function(){
    window.instructions = new window.BuildInstructions();
    window.builds = new window.Builds();

    window.App = new window.EmeraldRouter();
    Backbone.history.start();
})})(jQuery);