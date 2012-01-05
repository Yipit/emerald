(function($){
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
            var rendered = this.template(data);
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
        },
        /* utility functions */
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
            this.$("article.instruction").addClass('running');
            this.$('.buildlog .title').after(this.make_build_li(build));
        },
        update_latest_build: function(build, instruction){
            var element = this.make_build_li(build);

            var $article = this.$("article.instruction");
            var $last_build = this.$(".last-build");
            var $li = this.$("li[id='clay:Build:id:" + build.__id__ + "']");

            $article.removeClass('running').addClass(build.style_name);

            $last_build.html(this.make_build_li(build));

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