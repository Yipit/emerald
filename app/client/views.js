(function($){
    var STAGES_BY_INDEX = {
        0: 'BEGINNING',
        1: 'FETCHING',
        2: 'PREPARING_ENVIRONMENT',
        3: 'RUNNING',
        4: 'ABORTED',
        5: 'FAILED',
        6: 'SUCCEEDED'
    };

    var STAGE_TO_UI = {
        0: 'ui-state-default',
        1: 'ui-state-default',
        2: 'ui-state-highlight',
        3: 'ui-state-highlight',
        4: 'ui-state-error',
        5: 'ui-state-error',
        6: 'ui-state-success'
    };

    function truncate(string, amount){
        amount = amount || 45;
        if (string.length > amount) {
            return string.substr(0, amount) + ' ...';
        } else {
            return string;
        }
    }
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
                STAGE_TO_UI: STAGE_TO_UI,
                truncate: truncate
            }));
            $(this.el).html(rendered);
            this.trigger('post-render', this);
            return this;
        },
        className: 'row'
    });

    window.ErrorView = EmeraldView.extend({
        template_name: 'error'
    });

    window.ConnectionLostView = EmeraldView.extend({
        template_name: 'connection-lost'
    });

    window.BuildListView = EmeraldView.extend({
        template_name: 'list-instructions',
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
            this.avatar_loading_gif = '/images/loading-avatar.gif';

            _.bindAll(
                this,
                'render',
                'expand_box',
                'update_latest_build',
                'update_toolbar',
                'show_progress',
                'prepare_progress'
            );
            this.model.bind('change', this.render);
            this.model.bind('build_stdout', this.expand_box);
            this.model.bind('build_stderr', this.expand_box);
            this.model.bind('build_running', this.expand_box);

            this.model.bind('build_started', this.expand_box);
            this.model.bind('build_finished', this.update_latest_build);
            this.model.bind('build_aborted', this.update_latest_build);

            this.model.bind('build_started', this.update_toolbar);
            this.model.bind('build_finished', this.update_toolbar);
            this.model.bind('build_aborted', this.update_toolbar);

            this.model.bind('fetching_repository', this.show_progress);

            this.template = get_template('instruction');
            this.bind('post-render', this.prepare_progress);

            this.refresh_widgets();
        },
        /* utility functions */
        make_toolbar_button: function(title, classes, extra){
            extra = extra || '';
            return ['<a class="btn small ' + classes + '" ' + extra + ' href="#">' + title + '</a>'].join('"');
        },
        update_toolbar: function(build, instruction){
            var self = this;
            this.refresh_widgets();
            var buttons = [
                this.make_toolbar_button('Add to the queue', 'do-schedule'),
                this.make_toolbar_button('STDOUT', 'info show-output'),
                this.make_toolbar_button('STDERR', 'error show-error')
            ];
            switch (STAGES_BY_INDEX[build.stage]) {
            case 'BEGINNING':
            case 'FETCHING':
            case 'PREPARING_ENVIRONMENT':
            case 'RUNNING':
                buttons = [this.make_abort_button(build)];
                break;
            case 'ABORTED':
            case 'FAILED':
            case 'SUCCEEDED':
                buttons = [
                    this.make_toolbar_button('Run again', 'info do-schedule'),
                    this.make_toolbar_button('STDOUT', 'success show-output'),
                    this.make_toolbar_button('STDERR', 'error show-error')
                ];
            }

            this.$toolbar.fadeIn(function(){
                self.$toolbar.html(buttons.join('\n'));
            });
        },
        refresh_widgets: function(){
            this.$widget = this.$("article.instruction > div");

            this.$header = this.$widget.find(".instruction-header");
            this.$body =   this.$widget.find(".instruction-body");
            this.$footer = this.$widget.find(".instruction-footer");

            this.$last_build = this.$header.find(".last-build");
            this.$avatar = this.$header.find(".avatar");
            this.$img = this.$avatar.find('img');
            this.$toolbar = this.$footer.find(".toolbar");
        },
        make_abort_button: function(build){
            return this.make_toolbar_button('Abort', 'error do-abort', 'rel="' + build.__id__ + '"');
        },
        make_build_li: function(build){
            return [
                '<li class="' + build.style_name + '" id="clay:Build:id:'+build.__id__+'">',
                '  <a href="'+build.permalink+'">',
                '    <strong class="id">#' + build.__id__ + '</strong>',
                '    <span class="message">' + truncate(build.message) + '</span>',
                '  </a>',
                '</li>'
            ].join('\n');
        },
        make_last_build: function(build){
            return [
                '<span>last build:</span>',
                ('<strong class="status-color ' + build.style_name + '">'),
                ('<a href="'+build.permalink+'">' + truncate(build.message) + '</a>'),
                '</strong>'
            ].join('\n');
        },
        /* event reactions */
        prepare_progress: function(data){
            this.$(".ui-progress-bar").progressbar({value: 0});
        },
        show_progress: function(data){
            var value = (parseInt(/\d+/.exec(data.percentage), 10))[0];
            this.$(".ui-progress-bar").progressbar({
		value: value
            });
        },
        expand_box: function(build, instruction){
            var self = this;
            self.refresh_widgets();
            var total_builds = self.$('.buildlog li').length;
            /* make the widget look busy */
            self.$widget.addClass('ui-state-default');

            /* add a loading as placeholder for gravatar */
            this.$avatar.addClass('picture');
            if (this.$img.attr("src") !== this.avatar_loading_gif) {
                this.$img.attr('src', this.avatar_loading_gif);
            }

            /* expand the body */
            self.$body.animate({
                'padding-top': '10px',
                'padding-bottom': '10px',
                'padding-left': '30px',
                'padding-right': '30px',
                'margin-left': '-10px',
                'margin-right': '-10px'
            }, function(){
                self.$body.removeClass('hidden');

                /* add an abort button */
                self.$toolbar.empty().append(self.make_abort_button(build));

                /* although the build object still incomplete, let's add
                 * the current build to the log */
                self.$('.buildlog').append(self.make_build_li(build));
            });
        },
        update_latest_build: function(build, instruction){
            this.refresh_widgets();
            /* make the widget look like is done */
            this.$widget
                .attr('class', 'ui-widget ui-corner-all')
                .addClass(STAGE_TO_UI[build.stage]);

            /* expand the body the body title */
            this.$body.removeClass('hidden');

            this.$avatar.addClass('picture').find("img").attr('src', build.gravatars['100']);

            var $li = this.$body.find("li[id='clay:Build:id:" + build.__id__ + "']");
            this.$last_build.html(this.make_last_build(build));
            $li.attr('class', build.style_name);
            $li.find('a').text(truncate(build.message));
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
            this.refresh_widgets();
            var id = this.$(".do-abort").attr('rel');
            window.socket.emit('abort Build', {id: id});
            this.$toolbar.fadeOut();
            return e.preventDefault();
        }
    });

    window.DetailedBuildView = EmeraldView.extend({
        template_name: 'build',
        className: 'build'
    });

    window.InstructionManagementView = EmeraldView.extend({
        template_name: 'manage-instructions'
    });
})(jQuery);