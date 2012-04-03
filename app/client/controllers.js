(function($){$(function(){
    window.EmeraldRouter = Backbone.Router.extend({
        routes: {
            '': 'dashboard',
            'dashboard': 'dashboard',
            'build/:id': 'build',
            'instructions': 'manage_instructions',
            'instruction/new': 'new_instruction',
            'instruction/:id/edit': 'edit_instruction',
            'instruction/:id/duplicate': 'duplicate_instruction',
            'instruction/:id': 'list_builds',
            'pipelines': 'pipelines_list',
            'pipelines/new': 'pipelines_new'
        },
        initialize: function(){
            this.$body = $("body");
            this.$app = $("#app");
            _.bindAll(this,
                      'render',
                      'dashboard',
                      'build',
                      'manage_instructions',
                      'new_instruction',
                      'edit_instruction',
                      'list_builds',
                      'connection_lost',
                      'pipelines_list',
                      'pipelines_new');

            this.consoleView = new ConsoleView({model: main_console});
            var consoleElement = this.consoleView.render().el;
            this.$body.prepend(consoleElement);

            $("#show-main-console").click(function(e){
                $("#terminal").slideDown('fast');
                return e.preventDefault();
            });

            window.socket.on('disconnect', this.connection_lost);
        },
        render: function(view_instance){
            /* just a DRY helper for rendering backbone views in the
             * main app */
            return this.$app.empty().append(view_instance.render().el);
        },
        dashboard: function(){
            dashboardView = new BuildListView({collection: instructions});
            instructions.fetch();
            this.render(dashboardView);
        },
        build: function(id) {
            var self = this;
            var build = new Build({__id__: id});
            build.fetch({
                success: function(){
                    var view = new DetailedBuildView({model: build});
                    self.render(view);
                },
                error: function(build, response){
                    var error = new UIError(JSON.parse(response.responseText));
                    var view = new ErrorView({model: error});
                    self.render(view);
                }
            });
        },
        manage_instructions: function() {
            var view = new InstructionManagementView({collection: instructions});
            instructions.fetch();
            return this.render(view);
        },
        new_instruction: function() {
            var view = new InstructionCRUDView({model: new BuildInstruction()});
            return this.render(view);
        },
        edit_instruction: function(id) {
            var self = this;
            var instruction = new BuildInstruction({__id__: id});
            instruction.fetch({
                success: function(){
                    var view = new InstructionCRUDView({model: instruction});
                    self.render(view);
                },
                error: function(build, response){
                    var error = new UIError(JSON.parse(response.responseText));
                    var view = new ErrorView({model: error});
                    self.render(view);
                }
            });
        },
        duplicate_instruction: function(id) {
            var self = this;
            var instruction = new BuildInstruction({__id__: id});
            instruction.fetch({
                success: function(){
                    instruction.set('__id__', null);
                    var name = instruction.get('name');
                    instruction.set('name', 'copy of ' + name);
                    var view = new InstructionCRUDView({
                        model: instruction,
                        duplicate_mode: true
                    });
                    self.render(view);
                },
                error: function(build, response){
                    var error = new UIError(JSON.parse(response.responseText));
                    var view = new ErrorView({model: error});
                    self.render(view);
                }
            });
        },
        list_builds: function (id) {
            var self = this;
            var instruction = new BuildInstruction({__id__: id});
            instruction.fetch({
                success: function(){
                    var view = new window.CompleteBuildListView({model: instruction});
                    self.render(view);
                },
                error: function(build, response){
                    var error = new UIError(JSON.parse(response.responseText));
                    var view = new ErrorView({model: error});
                    self.render(view);
                }
            });
        },
        connection_lost: function() {
            var view = new ConnectionLostView();
            this.render(view);

            setTimeout(function() {
                if (!window.socket.socket.connected) {
                    $('#connection-lost-dialog').dialog({
                        resizable: false,
                        modal: true,
                        width: 500
                    });
                }
            }, 1000);
        },

        /* -- pipeline routes -- */

        pipelines_list: function() {
            var self = this;
            window.pipelines.fetch({
                success: function() {
                    var view = new window.Views.Pipelines.List({ collection: pipelines });
                    self.render(view);
                },
                error: function () {
                    console.debug('not good');
                }
            });
        },

        pipelines_new: function() {
            var model = new window.Pipeline();
            var view  = new window.Views.Pipelines.New({ model: model });
            this.render(view);
        }

    });
});})(jQuery);
