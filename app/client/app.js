(function($){
    $(function(){
        window.instructions = new window.BuildInstructions();
        window.main_console = new window.ConsoleSource();

        window.App = new window.EmeraldRouter();
        Backbone.history.bind('route', function(router, controller_name){
            var selector = 'a[rel~="' + controller_name + '"]';
            var $item = $(selector).closest('li.navigation-item');
            $item.siblings().removeClass("active");
            $item.addClass("active");
        });
        Backbone.history.start();
    });
})(jQuery);
