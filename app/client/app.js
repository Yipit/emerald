(function($){$(function(){
    swig.init({filters: {
        truncate: function(string, amount){
        amount = amount || 45;
        try {
            if (string.length > amount) {
                return string.substr(0, amount) + ' ...';
            } else {
                return string;
            }
        } catch (e) {
            return string;
        }
    }}});
    window.instructions = new window.BuildInstructions();
    window.main_console = new window.ConsoleSource();

    window.App = new window.EmeraldRouter();
    Backbone.history.start();
});})(jQuery);
