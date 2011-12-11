$(function(){
    var socket = io.connect();
    socket.on('connected', function (data) {

        $("#new-build").modal();
        $.each(["BuildInstruction", "User"], function(index, ModelName){
            socket.on(ModelName + ' deleted', function(data){
                var selector = ".clay."+ModelName+".delete[rel=" + data.id + "]";
                console.log(selector);
                var $button = $(selector);
                $button.button('reset');
                $button.parents("tr").animate({opacity: 0}, function(){
                    $(this).remove();
                })
            });
            socket.on(ModelName + ' created', function(data){
                $.gritter.add({
                    title: ModelName + " created",
                    text: "#" + data.id,
                    image: window.emerald.domain + "/images/control_double_down.png"
                });
                $(".btn[emerald-action='run'][emerald-entity='BuildInstruction'][rel='"+data.id+"']").button('reset');
            });
        });

        socket.on('BuildInstruction enqueued', function(data){
            $.gritter.add({
                title: "Build enqueued",
                text: "The build instruction #" + data.id + " has been added to the queue",
                image: window.emerald.domain + "/images/control_double_down.png"
            });
            $(".btn[emerald-action='run'][emerald-entity='BuildInstruction'][rel='"+data.id+"']").button('reset');
        });

        $(".clay.BuildInstruction.delete").live("click", function(e) {
            var $self = $(this);
            var id = $self.attr("rel");
            $self.button('loading');
            socket.emit('delete BuildInstruction', {id: id});
            return e.preventDefault();
        });
        $(".btn[emerald-action='run']").die('click').live('click', function(e){
            var $self = $(this);

            var id = $self.attr("rel")
            var entity_name = $self.attr("emerald-entity");

            var key = "run " + entity_name;

            socket.emit(key, {id: id});

            switch (entity_name) {
                case 'BuildInstruction':
                    $self
                        .attr('data-loading-text', '')
                        .button('loading');
                    break;
            }

            return e.preventDefault();
        });
    });

    socket.on('connected', function (data) {
        $(".clay.User.delete").live("click", function() {
            var id = $(this).attr("rel");
            socket.emit('delete User', {id: id});
            $(this).parent().animate({
                'opacity': 0.2,
            })
            return false;
        });
    });

    $(".toggle-terminal").live("click", function(e) {
        var $term = $("#terminal");
        var height = ($("body").height() - 100) + "px";

        if ($term.hasClass("hidden")) {
            $term.css("height", "0px");
            $term.fadeIn("fast", function(){
                $(this)
                    .animate({
                        "height": height,
                        "padding-top": "17px"
                    })
                    .removeClass("hidden")
                    .addClass("visible");
            });
        } else {
            $term
                .animate({
                    "height": "0px",
                }, function(){
                    $(this)
                        .fadeOut("fast", function(){
                            $(this)
                                .css("padding-top", "0px")
                                .removeClass("visible")
                                .addClass("hidden");
                        });
                });
        }
        e.preventDefault();
    });
});