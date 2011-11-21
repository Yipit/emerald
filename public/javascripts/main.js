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
});