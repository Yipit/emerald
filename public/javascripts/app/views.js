(function($){
    var STAGE_TO_UI = {
        0: 'ui-state-default',
        1: 'ui-state-default',
        2: 'ui-state-highlight',
        3: 'ui-state-highlight',
        4: 'ui-state-error',
        5: 'ui-state-error',
        6: 'ui-state-success'
    };

    function get_template(name){
        var selector = "script#template-" + name;
        var raw = $.trim($(selector).html());
        if (raw.length === 0){
            throw new Error('The template "'+name+'" could not be found.');
        }
        return _.template(raw);
    }
    window.EmeraldView = Backbone.View.extend({
        initialize: function(){
            _.bindAll(this, 'render');
            if (this.model) {
                this.model.bind('change', this.render);
            }
            if (this.collection) {
                this.collection.bind('reset', this.render);
            }
            if (this.template_name) {
                this.template = get_template(this.template_name);
            }

        },
        render: function(){
            var data = {};
            if (this.model) {
                data = this.model.toJSON();
            }
            this.trigger('pre-render', {redefine:data});
            var rendered = this.template(_.extend(data, {
                STAGE_TO_UI: STAGE_TO_UI
            }));
            $(this.el).html(rendered);
            this.trigger('post-render', this);
            return this;
        },
        className: 'row'
    });

    window.ErrorView = Backbone.View.extend({
        template_name: 'error'
    });

    window.BuildListView = EmeraldView.extend({
        template_name: 'instruction-list',
        render: function(){
            var $instructions,
              collection = this.collection;

            $(this.el).html(this.template({}));
            $instructions = this.$("#builds");
            collection.each(function(instruction) {
                var view = new InstructionView({
                    model: instruction,
                    collection: collection
                });
                $instructions.append(view.render().el);
            });
            return this;
        }
    });

    window.InstructionView = EmeraldView.extend({
        tagName: 'li',
        className: 'instruction',
        events: {
            'click .do-schedule': 'run',
            'click .do-abort': 'abort',
            'click .show-output': 'show_output',
            'click .show-error': 'show_error'
        },
        initialize: function(){
            _.bindAll(
                this,
                'render',
                'add_build',
                'update_latest_build',
                'show_progress',
                'prepare_progress'
            );
            this.model.bind('change', this.render);
            this.model.bind('build_started', this.add_build);
            this.model.bind('build_finished', this.update_latest_build);
            this.model.bind('fetching_repository', this.show_progress);

            this.template = get_template('instruction');
            this.bind('post-render', this.prepare_progress);

            this.refresh_widgets();
        },
        /* utility functions */
        refresh_widgets: function(){
            this.$widget = this.$("article.instruction > div");

            this.$header = this.$widget.find(".instruction-header");
            this.$body =   this.$widget.find(".instruction-body");
            this.$footer = this.$widget.find(".instruction-footer");

            this.$last_build = this.$header.find(".last-build");
            this.$avatar = this.$header.find(".avatar");
            this.$toolbar = this.$footer.find(".toolbar");
        },
        make_abort_button: function(build){
            return ['<a class="btn small large error do-abort" rel=', build.__id__,' href="#">Abort</a>'].join('"');
        },
        make_build_li: function(build){
            return [
                '<li class="' + build.style_name + '" id="clay:Build:id:'+build.__id__+'">',
                '  <a href="'+build.permalink+'">' + build.message + '</a>',
                '</li>'
            ].join('\n');
        },
        make_last_build: function(build){
            return [
                '<li class="last-build">',
                '  last build:',
                ('  <strong class="status-color ' + build.style_name + '">'),
                ('  <a href="'+build.permalink+'">' + build.message + '</a>'),
                '  </strong>',
                '</li>'
            ].join('\n');
        },
        /* event reactions */
        prepare_progress: function(data){
            this.$(".ui-progress-bar").progressbar({value: 0});
        },
        show_progress: function(data){
            var value = (parseInt(/\d+/.exec(data.percentage)))[0];
            this.$(".ui-progress-bar").progressbar({
		value: value
            });
        },
        add_build: function(build, instruction){
            this.refresh_widgets();
            var total_builds = this.$('.buildlog li').length;
            /* make the widget look busy */
            this.$widget.addClass('ui-state-default');

            /* expand the body */
            this.$body.removeClass('hidden');

            /* add an abort button */
            this.$toolbar.empty().append(this.make_abort_button(build));

            /* although the build object still incomplete, let's add
             * the current build to the log */
            this.$('.buildlog').append(this.make_build_li(build));
        },
        update_latest_build: function(build, instruction){
            this.refresh_widgets();
            /* make the widget look like is done */
            this.$widget
                .attr('class', 'ui-widget ui-corner-all')
                .addClass(STAGE_TO_UI[build.stage]);

            /* expand the body the body title */
            this.$body.removeClass('hidden')

            /* set the body title */
                this.$body.find(".title")
                .text('latest builds');

            this.$avatar.addClass('picture').find("img").attr('src', build.gravatars['75']);


            var $li = this.$body.find("li[id='clay:Build:id:" + build.__id__ + "']");
            this.$last_build.html(this.make_build_li(build));
            $li.attr('class', build.style_name);
            $li.find('a').text(build.message);
        },
        /* user actions */
        show_output: function(e){
            return e.preventDefault();
        },
        show_error: function(e){
            return e.preventDefault();
        },
        run: function(e){
            window.socket.emit('run BuildInstruction', {id: this.model.get('__id__')});
            return e.preventDefault();
        },
        abort: function(e){
            var id = this.$(".do-abort").attr('rel');
            window.socket.emit('abort Build', {id: id});
            return e.preventDefault();
        }
    });

    window.DetailedBuildView = EmeraldView.extend({
        template_name: 'build',
        className: 'build'
    });

    window.InstructionManagementView = EmeraldView.extend({
        template_name: 'instruction-management'
    });
})(jQuery);