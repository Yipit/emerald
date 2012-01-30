(function($){$(function(){
    window.EmeraldRouter = Backbone.Router.extend({
        routes: {
            '': 'dashboard',
            'dashboard': 'dashboard',
            'build/:id': 'build',
            'instructions': 'manage_instructions'
        },
        initialize: function(){
            this.$body = $("body");
            this.$app = $("#app");
            _.bindAll(this,
                      'dashboard',
                      'build',
                      'manage_instructions',
                      'connection_lost');

            this.dashboardView = new BuildListView({collection: instructions});

            this.consoleView = new ConsoleView({model: main_console});
            var console = this.consoleView.render().el;
            this.$body.prepend(console);

            $("#show-main-console").click(function(e){
                $("#terminal").show();
                return e.preventDefault();
            });

            window.socket.on('disconnect', this.connection_lost);
        },
        dashboard: function(){
            var dashboard = this.dashboardView.render().el;
            this.$app.empty().append(dashboard);
            instructions.fetch();
        },
        build: function(id) {
            var $app = this.$app.empty();
            var build = new Build({__id__: id});
            build.fetch({
                success: function(){
                    var view = new DetailedBuildView({model: build});
                    $app.append(view.render().el);
                },
                error: function(build, response){
                    var error = new UIError(JSON.parse(response.responseText));
                    var view = new ErrorView({model: error});
                    $app.append(view.render().el);
                }
            });
        },
        manage_instructions: function() {
            var view = new InstructionManagementView({collection: instructions});
            instructions.fetch();
            this.$app.empty().append(view.render().el);
        },
        connection_lost: function() {
            var view = new ConnectionLostView();
            this.$app.empty().append(view.render().el);
            setTimeout(function(){
                if (!window.socket.socket.connected) {
                    $('#connection-lost-dialog').dialog({
                        resizable: false,
                        modal: true,
                        width: 500
                    });
                }
            }, 1000);
        }
    });
});})(jQuery);
