$(function(){
    var socket = io.connect();

    $("div.build.warning.block-message pre").effect("pulsate", {times: 50}, 1000);
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
});