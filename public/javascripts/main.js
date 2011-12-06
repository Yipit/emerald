$(function(){
    var socket = io.connect();

    socket.on('BuildInstruction deleted', function(data){
        $(".clay.BuildInstruction.delete[rel=" + data.id + "]").parent().remove();
    });

    socket.on('connected', function (data) {
        $(".clay.BuildInstruction.delete").live("click", function() {
            var id = $(this).attr("rel");
            socket.emit('delete BuildInstruction', {id: id});
            $(this).parent().animate({
                'opacity': 0.2,
            })
            return false;
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