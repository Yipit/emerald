(function($){$(function(){
    window.EmeraldRouter = Backbone.Router.extend({
        routes: {
            '': 'dashboard',
            'dashboard': 'dashboard',
            'build/:id': 'build',
            'instructions': 'manage_instructions'
        },
        initialize: function(){
            this.$app = $("#app");
            this.dashboardView = new BuildListView({collection: instructions});
        },
        dashboard: function(){
            var element = this.dashboardView.render().el;
            this.$app.empty().append(element);
            instructions.fetch();
        },
        build: function(id) {
            var $app = this.$app.empty();
            var build = new Build({__id__: id});
            build.fetch({success: function(){
                var view = new DetailedBuildView({model: build});
                $app.append(view.render().el);
            }});

        },
        manage_instructions: function() {
            var view = new InstructionManagementView();
            this.$app.empty().append(view.render().el);
        }
    });
})})(jQuery);