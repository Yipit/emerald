(function($){$(function(){
    window.instructions = new BuildInstructions();
    window.dashboard = new BuildListView({collection: instructions});
    $("body").append(dashboard.render().el);
    instructions.fetch()

})})(jQuery);