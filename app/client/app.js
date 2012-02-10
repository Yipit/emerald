(function($){
    $(function(){
        window.instructions = new window.BuildInstructions();
        window.main_console = new window.ConsoleSource();

        window.App = new window.EmeraldRouter();
        Backbone.history.bind('route', function(router, controller_name){
            var selector = "#controller-" + controller_name;
            $(selector).siblings().removeClass("active");
            $(selector).addClass("active");
        });
        Backbone.history.start();
    });
})(jQuery);
