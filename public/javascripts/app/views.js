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
            var data = {};
            if (this.model) {
                data = this.model.toJSON();
            }

            var rendered = this.template(data);
            $(this.el).html(rendered);
            return this;
        },
        className: 'row'
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
        className: 'instruction',
        events: {
            'click .do-schedule': 'run'
        },
        run: function(e){
            window.socket.emit('run BuildInstruction', {id: this.model.get('__id__')});
            return e.preventDefault();
        }
    });

    window.DetailedBuildView = EmeraldView.extend({
        template_name: 'detailed-build',
        className: 'build'
    });

    window.InstructionManagementView = EmeraldView.extend({
        template_name: 'instruction-management'
    });

})})(jQuery);