(function($){$(function(){

    function get_template(name){
        var selector = "script#template-" + name;
        var raw = $(selector).html();
        return _.template(raw);
    }
    window.EmeraldView = Backbone.View.extend({
        initialize: function(){
            _.bindAll(this, 'render');
            this.model && this.model.bind('change', this.render);
            this.collection && this.collection.bind('reset', this.render);
            this.template = get_template(this.template_name);
        },
        render: function(){
            var rendered = this.template(this.model.toJSON());
            $(this.el).html(rendered);
            return this;
        }
    });
    window.BuildInstruction = Backbone.Model.extend({});
    window.Build = Backbone.Model.extend({});

    window.BuildInstructions = Backbone.Collection.extend({
        model: window.BuildInstruction,
        url: '/instructions.json'
    });
    window.Builds = Backbone.Collection.extend({
        model: window.Build
    });

    window.DashboardView = EmeraldView.extend({
        template_name: 'dashboard'
    });

    window.BuildListView = EmeraldView.extend({
        tagName: 'li',
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
        template_name: 'instruction',
        tagName: 'li',
        className: 'instruction'
    });

    /*
    window.b1 = new Build({
        status: "0",
        signal: "null",
        error: "",
        output: "This is\nthe\build output\n",
        pid: "23",
        stage: "4",
        commit: "7ffac0bf9d22e490653d1f891276809a",
        message: "some commit message",
        author_name: "Gabriel Falcao",
        author_email: "gabriel@nacaolivre.org",
        build_started_at: "Mon, 02 Jan 2012 18:00:52 GMT",
        build_finished_at: "Mon, 02 Jan 2012 18:02:30 GMT",
        fetching_started_at: "Mon, 02 Jan 2012 18:00:00 GMT",
        fetching_finished_at: "Mon, 02 Jan 2012 18:00:52 GMT",
        gravatar: "https://secure.gravatar.com/avatar/3fa0df5c54f5ac0f8652d992d7d24039?s=50",
        style_name: "success"
    });

    window.b2 = new Build({
        status: "132",
        signal: "null",
        error: "Failed",
        output: "This is\nthe\build output\n",
        pid: "23",
        stage: "4",
        commit: "a049128a725f7053167bf98755d30803",
        message: "typo on something",
        author_name: "Gabriel Falcao",
        author_email: "gabriel@nacaolivre.org",
        build_started_at: "Mon, 02 Jan 2012 18:00:52 GMT",
        build_finished_at: "Mon, 02 Jan 2012 18:02:30 GMT",
        fetching_started_at: "Mon, 02 Jan 2012 18:00:00 GMT",
        fetching_finished_at: "Mon, 02 Jan 2012 18:00:52 GMT",
        gravatar: "https://secure.gravatar.com/avatar/3fa0df5c54f5ac0f8652d992d7d24039?s=50",
        style_name: "failure"
    });

    window.i1 = new BuildInstruction({
        name: "Emerald Unit Tests",
        description: "Asserting that basic business rules\nare working perfectly in emerald",
        repository_address: "git@github.com:Yipit/emerald.git",
        branch: "master",
        build_script: 'npm install\njake unit',
        last_build: b1,
        last_success: b1,
        last_failure: b2,
    });

    window.i2 = new BuildInstruction({
        name: "Emerald Functional Tests",
        description: "Asserting that basic business rules\nare working perfectly in emerald",
        repository_address: "git@github.com:Yipit/emerald.git",
        branch: "master",
        build_script: 'npm install\njake functional',
        last_build: b1,
        last_success: b1,
        last_failure: b2,
    });
    */
    window.instructions = new BuildInstructions();
    window.dashboard = new BuildListView({collection: instructions});
    $("body").append(dashboard.render().el);
    instructions.fetch()

})})(jQuery);