$(function(){
    var socket = io.connect();
    socket.on('connected', function (data) {

        socket.on('BuildInstruction deleted', function(data){
            $(".clay.BuildInstruction.delete[rel=" + data.id + "]").parent().remove();
        });

        socket.on('BuildInstruction enqueued', function(data){
            $.gritter.add({
                title: "Build enqueued",
                text: "The build instruction #" + data.id + " has been added to the queue",
                image: window.emerald.domain + "/images/control_double_down.png"
            });
        });

        $(".clay.BuildInstruction.delete").live("click", function(e) {
            var id = $(this).attr("rel");
            socket.emit('delete BuildInstruction', {id: id});
            $(this).parent().animate({
                'opacity': 0.2,
            })
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
                    var msg = {
                        title: 'Build Scheduled!',
                        text: 'The instruction #' + id + ' has been scheduled!',
                        image: window.emerald.domain + "/images/control_double_up.png"
                    };
                    break;
            }
            $.gritter.add(msg);
            return e.preventDefault();
        });
    });
    socket.on('User deleted', function(data){
        $(".clay.User.delete[rel=" + data.id + "]").parent().remove();
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