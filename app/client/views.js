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
        try {
            if (string.length > amount) {
                return string.substr(0, amount) + ' ...';
            } else {
                return string;
            }
        } catch (e) {
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

    window.Views = {};


    window.ConsoleView = Backbone.View.extend({
        /*
          this is the fullscreen terminal that shows live output from
          the current running build
         */
        id: 'terminal',
        events: {
            'click #hide-main-terminal': 'hide_terminal'
        },
        template: [
            '<pre id="live-code" class="terminal"></pre>',
            '<button class="btn large small" id="hide-main-terminal" href="#">Hide terminal</button>'
        ].join('\n'),
        initialize: function() {
            _.bindAll(this, 'render', 'hide_terminal');
            this.model.bind('change', this.render);
        },
        hide_terminal: function(e){
            $("#terminal").slideUp('fast');
            return e.preventDefault();
        },
        render: function() {
            this.$el.html(this.template);
            return this;
        }
    });
    window.EmeraldView = Backbone.View.extend({
        /*
          base class for all the views, be careful with this thing
         */
        form_still_valid: true,
        fields: [],
        className: 'row',
        initialize: function(){
            _.bindAll(this, 'render', 'customize', 'get_field_value');
            if (this.model) {
                this.model.bind('change', this.render);
            }
            if (this.collection) {
                this.collection.bind('reset', this.render);
            }
            if (this.template_name) {
                this.template = get_template(this.template_name);
            }
            this.customize();
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
            this.$el.html(rendered);
            this.trigger('post-render', this);
            return this;
        },
        customize: function(){
            /* empty function to be overwritten by the child views in
             * order to take custom actions in the very beginning */
        },

        get_field_value: function(name, is_required){
            var $field = this.$el.find("#" + name);
            var $control_group = $field.closest(".control-group");
            var value = $field.val();
            var error_message = is_required;
            $field.tooltip({
                trigger: 'manual',
                placement: 'right',
                title: error_message
            });

            if (!is_required) {
                return value || "";
            } else {
                if (/^\s*$/.test(value)) {
                    if (this.form_still_valid) {
                        $control_group.addClass("error");
                        $field.tooltip('show');
                        setTimeout(function(){
                            $field.tooltip('hide');
                        }, 10000);
                    }
                    this.form_still_valid = false;
                    return null;
                } else {
                    $field.tooltip('hide');
                    $control_group.removeClass("error");
                    return value;
                }
            }
        }

    });

    window.ErrorView = EmeraldView.extend({
        /*
          whenever backbone goes to any URL of /api and gets a status
          code that is 4xx or 5xx, this ErrorView will be rendered
         */
        template_name: 'error',
        customize: function(){
            _.bindAll(this, 'prepare_connection_lost_dialog');
        },
        prepare_connection_lost_dialog: function() {
            setTimeout(function() {
                $("#connection-lost-dialog").dialog({
                    modal: true
                });
            }, 2000);
        }
    });

    window.ConnectionLostView = EmeraldView.extend({
        /*
          this view is primarily that "loading..." screen shown when
          the page is refreshed, but in case it takes more than 2
          minutes to load, it assumes the connection was lost and how
          a modal dialog
         */
        template_name: 'connection-lost'
    });

    window.BuildListView = EmeraldView.extend({
        /*
          this is actually the dashboard view, bad naming maybe?!
          Well anyways I don't wanna refactor that now, get over it :P
         */
        template_name: 'list-instructions',
        render: function(){
            var collection = this.collection;

            this.$el.html(this.template({}));
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

    window.CompleteBuildListView = EmeraldView.extend({
        /* This view lists all builds of an instruction */
        template_name: 'build-list',
        render: function () {
            var data = {
                model: this.model,
                all_builds: _.uniq(this.model.get('all_builds'))
            };

            this.$el.html(this.template(data));
            return this;
        }
    });

    window.InstructionView = EmeraldView.extend({
        /*
          each instruction rendered on the dashboard is an instance of
          this view
         */
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
                'customize',
                'vanish_and_remove',
                'expand_box',
                'avatar_loading',
                'update_latest_build',
                'update_toolbar',
                'show_progress',
                'hide_progress',
                'render_builds',
                'prepare_progress'
            );
            //this.model.bind('change', this.render);
            this.model.bind('instruction_deleted', this.vanish_and_remove);

            this.model.bind('build_output', this.expand_box);
            this.model.bind('build_running', this.expand_box);
            this.model.bind('build_started', this.expand_box);
            this.model.bind('build_started', this.avatar_loading);
            this.model.bind('build_finished', this.expand_box);
            this.model.bind('build_finished', this.render_builds);
            this.model.bind('fetching_repository', this.expand_box);

            this.model.bind('build_finished', this.update_latest_build);
            this.model.bind('build_aborted', this.update_latest_build);

            this.model.bind('build_started', this.update_toolbar);
            this.model.bind('build_finished', this.update_toolbar);
            this.model.bind('build_aborted', this.update_toolbar);

            this.model.bind('fetching_repository', this.show_progress);
            this.model.bind('repository_fetched', this.hide_progress);
            this.model.bind('build_finished', this.hide_progress);

            this.template = get_template('instruction');
            this.bind('post-render', this.prepare_progress);
            this.bind('post-render', this.render_builds);

            this.refresh_widgets();
        },
        render: function () {
            var data = {
                model: this.model.toJSON(),
                STAGE_TO_UI: STAGE_TO_UI,
                truncate: truncate,
                all_builds: _.uniq(this.model.get('all_builds'))
            };

            this.trigger('pre-render', {redefine:data});
            this.$el.html(this.template(data));
            this.trigger('post-render', this);
            return this;
        },

        /* utility functions */
        make_toolbar_button: function(title, classes, extra, icon){
            extra = extra || '';
            var ico = icon ? '<i class="'+icon+' icon-white"></i>' : '';
            return ['<a class="btn small ' + classes + '" ' + extra + ' href="#">' + ico + title + '</a>'].join('"');
        },
        update_toolbar: function(data){
            var self = this;

            var build = data.build;
            var instruction = data.instruction;

            this.refresh_widgets();
            var buttons = [
                this.make_toolbar_button('Add to the queue', 'btn-warning do-schedule', '', 'icon-share'),
                this.make_toolbar_button('STDOUT', 'btn-info show-output', '', 'icon-leaf'),
                this.make_toolbar_button('STDERR', 'btn-danger show-error', '', 'icon-fire')
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
                    this.make_toolbar_button('Run again', 'btn-info do-schedule', '', 'icon-retweet'),
                    this.make_toolbar_button('STDOUT', 'btn-success show-output', '', 'icon-leaf'),
                    this.make_toolbar_button('STDERR', 'btn-danger show-error', '', 'icon-fire')
                ];
            }

            this.$toolbar.fadeIn(function(){
                self.$toolbar.html(buttons.join('\n'));
            });
        },
        refresh_widgets: function(){
            this.$widget =     this.$("article.instruction > div");

            this.$header =     this.$widget.find(".instruction-header");
            this.$body =       this.$widget.find(".instruction-body");
            this.$footer =     this.$widget.find(".instruction-footer");

            this.$last_build = this.$header.find(".last-build");
            this.$avatar =     this.$header.find(".avatar");
            this.$img =        this.$avatar.find('img');
            this.$toolbar =    this.$footer.find(".toolbar");
            this.$buildlog =   this.$body.find(".buildlog");

        },
        render_builds: function(data) {
            var self = this;
            var max_builds = 2;

            self.refresh_widgets();

            var all_builds = _.uniq(this.model.get('all_builds'));

            if (data && data.build) {
                all_builds.unshift(data.build);
            }

            var show_build_history_link = all_builds.length > max_builds;

            /* Showing only the last `max_builds' builds, we'll show the
             * rest of them in the internal build page */
            all_builds = all_builds.slice(0, max_builds);

            self.$buildlog.empty();
            _.each(all_builds, function(raw_build_data) {
                var build = new Build(raw_build_data);
                var params = {
                    model: build
                };

                var subview = new InstructionBuildListItemView(params);
                var rendered = subview.render().$el;
                self.$buildlog.append(rendered);
            });

            /* This is not shown until the instruction is built more than
             * `max_builds' */
            if (show_build_history_link) {
                self.$body.find('.history')
                    .html($('<a>')
                          .attr({ href: this.model.get('permalink') })
                          .addClass('text')
                          .html('build history'));
            }
        },
        make_abort_button: function(build){
            return this.make_toolbar_button('Abort', 'btn-danger do-abort', 'rel="' + build.__id__ + '"', 'icon-off');
        },
        make_last_build: function(build){
            var html = [
                '<span>last build:</span>',
                ('<strong class="status-color ' + build.style_name + '">'),
                ('<a href="'+build.permalink+'">' + truncate(build.message) + '</a>'),
                '</strong>'
            ].join('\n');

            return html;
        },
        /* event reactions */
        prepare_progress: function(data){
            this.$(".progress").progressbar({value: 0}).hide();
        },
        show_progress: function(data){
            var $pbar = this.$(".progress");
            if (!data.phase && !data.percentage) {return;}
            var parsed_value = /\d+/.exec(data.percentage)[0];

            var value = parseInt(parsed_value, 10);
            var label = [data.phase, data.percentage].join(': ');

            $pbar
                .show()
                .find(".text").text(label);

            $pbar.progressbar("value", value);

        },
        hide_progress: function(data){
            this.$(".progress").hide();
        },
        avatar_loading: function (data) {
            /* add a loading as placeholder for gravatar */
            this.refresh_widgets();
            this.$avatar.addClass('picture');
            if (this.$img.attr("src") !== this.avatar_loading_gif) {
                this.$img.attr('src', this.avatar_loading_gif);
            }
        },
        expand_box: function(data){
            var self = this;

            var build = new Build(data.build);

            self.refresh_widgets();
            /* make the widget look busy */
            self.$widget.addClass('ui-state-default');

            /* only animate when the build stage is either BEGINNING or FETCHING */
            if (_.include([0, 1], build.stage)) {
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

                    /* refresh the toolbar */
                    self.update_toolbar(data);

                    self.render_builds(data);
                });
            }
        },
        update_latest_build: function(data){
            var self = this;

            var build = data.build;
            var instruction = data.instruction;

            this.refresh_widgets();
            /* make the widget look like is done */
            this.$widget
                .attr('class', 'ui-widget ui-corner-all')
                .addClass(STAGE_TO_UI[build.stage]);

            /* expand the body the body title */
            this.$body.removeClass('hidden');

            this.$avatar.addClass('picture').find("img").attr('src', build.gravatars['100']);

            var $li = this.$body.find("li[id='clay:Build:id:" + build.__id__ + "']");

            $li.attr('class', build.style_name);
            $li.find('a').text(truncate(build.message));

            /* updating the very last build (located on top)*/
            this.$last_build.html(this.make_last_build(build));

        },
        /* user actions */
        show_output: function(e){
            var url = this.model.attributes.last_build.route + ',stdout';
            App.navigate(url, { trigger: true });
            return e.preventDefault();
        },
        show_error: function(e){
            var url = this.model.attributes.last_build.route + ',stderr';
            App.navigate(url, { trigger: true });
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
        },
        vanish_and_remove: function(){
            var self = this;
            this.$el.fadeOut(function(){
                self.$el.remove();
            });
        }
    });

    window.InstructionBuildListItemView = EmeraldView.extend({
        /*
          subview for the small list of builds for each instruction
          rendered at #dashboard
         */
        template_name: 'subview-build-item-for-instruction',
        tagName: 'li',
        render: function(){
            var data = this.model.toJSON();

            var rendered = this.template(_.extend(data, {
                STAGE_TO_UI: STAGE_TO_UI,
                truncate: truncate
            }));

            this.$el.addClass('build-link');
            this.$el.addClass(this.model.get('style_name'));
            this.$el.html(rendered);

            return this;
        }
    });

    window.DetailedBuildView = EmeraldView.extend({
        /*
          the view rendered when a user goes to #build/:id
        */
        template_name: 'build',
        className: 'build',
        render: function () {
            var data = this.model.toJSON();

            // Just avoiding to type it twice :)
            var clean = function (x) {
                return ansiColors.ansi2html(x.replace('\n', '<br />'));
            };

            data.stdout = clean(data.stdout);
            data.stderr = clean(data.stderr);

            this.$el.html(this.template(data));
            return this;
        }
    });

    window.SingleManagedInstruction = EmeraldView.extend({
        /*
           each of the instructions rendered at #instructions is an instance of
           this view

           this is basically a subview of InstructionManagementView
        */
        events: {
            'click a.schedule-build': 'run',
            'click a.delete': 'erase'
        },
        template_name: 'single-managed-instruction',
        render: function(){
            this.$el.html(this.template({
                instruction: this.model.toJSON()
            }));

            this.delegateEvents();
            return this;
        },
        customize: function(){
            _.bindAll(this, 'run', 'erase', 'vanish_and_remove');
            this.model.bind('instruction_deleted', this.vanish_and_remove);
        },
        run: function(e){
            window.socket.emit('run BuildInstruction', {id: this.model.get('__id__')});
            return e.preventDefault();
        },
        erase: function(e) {
            if (confirm('Are you sure you want to delete "' + this.model.get('name') + '"')) {
                window.socket.emit('delete BuildInstruction', {id: this.model.get('__id__')});
            }
            return e.preventDefault();
        },
        vanish_and_remove: function(){
            var self = this;
            this.$el.fadeOut(function(){
                self.$el.remove();
            });
        }
    });

    window.InstructionManagementView = EmeraldView.extend({
        /* the view that is shown when a user goes to #instructions*/
        template_name: 'manage-instructions',
        render: function(){
            var model = this.model;
            var collection = this.collection;

            this.$el.html(this.template({}));

            var $list = this.$el.find("#instruction-list");

            collection.each(function(instruction){
                var subView = new SingleManagedInstruction({model: instruction});
                $list.append(subView.render().el);
            });

            return this;
        }
    });

    window.InstructionCRUDView = EmeraldView.extend({
        template_name: 'instruction-crud',
        events: {
            'click #save': 'create_or_edit',
            'click #cancel': 'cancel'
        },
        form_still_valid: true,
        fields: [
            {key: 'name', required: 'you need to provide a name so that emerald will use it to identify the different instructions'},
            {key: 'description', required: null},
            {key: 'repository_address', required: "c'mon if you don't provide the repository address, how's emerald supposed to check that out for you?"},
            {key: 'branch', required: "really? if please tell me which branch you wanna build, if you don't know what to do, just put \"master\""},
            {key: 'build_script', required: "alright you gotta be kidding, without a build script how is emerald supposed to actually \"build\" the thing?"},
            {key: 'poll_interval', required: null},
            {key: 'max_build_time', required: null}
        ],
        customize: function(){
            _.bindAll(this, 'create_or_edit');
        },
        render: function(){
            this.$el.html(this.template({
                instruction: this.model.toJSON(),
                options: this.options
            }));

            return this;
        },
        create_or_edit: function(){
            var self = this;
            var data = {};
            this.$el.find("#save").button('validating');
            _.each(this.fields, function(item){
                data[item.key] = self.get_field_value(item.key, item.required);
            });

            if (this.form_still_valid) {
                if (this.options.duplicate_mode) {
                    this.model.url = '/api/instructions.json';
                }
                this.$el.find("#save").button('saving');

                this.model.save(data, {
                    success: function(model, data){
                        self.$el.find("#save").button('reset');
                        App.navigate('/instructions', {trigger: true});
                    },
                    error: function(){
                        self.$el.find("#save").button('reset');
                    }
                });

            } else {
                self.$el.find("#save").button('retry');
                this.form_still_valid = true;
            }
        },
        cancel: function(e) {
            App.navigate('/instructions', { trigger: true });
            return e.preventDefault();
        }
    });

    /* -- Pipelines -- */

    window.Views.Pipelines = {};

    window.Views.Pipelines.New = EmeraldView.extend({
        template_name: 'pipelines-new',
        events: {
            'click #save': 'create',
            'click #cancel': 'cancel'
        },
        fields: [
            { key: 'name',
              required: 'you need to provide a name' },
            { key: 'description',
              required: 'This is why you came to do here, do not leave it blank!'}
        ],
        customize: function() {
            _.bindAll(this, 'create', 'cancel');
        },
        create: function(event) {
            var data = {};
            var self = this;

            this.fields.forEach(function(item) {
                data[item.key] = self.get_field_value(item.key, item.required);
            });

            if (this.form_still_valid) {
                this.model.save(data, {
                    success: function (model, data) {
                        App.navigate('/pipelines', { trigger: true });
                        return event.preventDefault();
                    },
                    error: function () {
                        console.log(arguments);
                    }
                });
            } else {
                /* Resetting the validation flag */
                this.form_still_valid = true;
            }
        },
        cancel: function (e) {
            App.navigate('/pipelines', { trigger: true });
            return e.preventDefault();
        }
    });

    window.Views.Pipelines.Single = EmeraldView.extend({
        template_name: 'pipelines-single',
        tagName: 'li',
        render: function () {
            this.$el.html(this.template({ model: this.model.toJSON() }));
            return this;
        }
    });

    window.Views.Pipelines.List = EmeraldView.extend({
        template_name: 'pipelines',
        render: function() {
            var collection = this.collection;

            this.$el.html(this.template({}));
            var $list = this.$("#pipelines ul");
            collection.each(function(pipeline) {
                var view = new window.Views.Pipelines.Single({
                    model: pipeline,
                    collection: collection
                });
                $list.append(view.render().el);
            });
            return this;
        }
    });

})(jQuery);
