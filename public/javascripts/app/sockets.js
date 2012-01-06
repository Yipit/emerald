(function($){
    window.socket = io.connect();
    window.socket.on('BuildInstruction created', function(data){
        $.gritter.add({
            title: "An instruction was created",
            text: "#" + data.id,
            image: window.emerald.domain + "/images/control_double_down.png"
        });
    });

    window.socket.on('BuildInstruction enqueued', function(data){
        $.gritter.add({
            title: '"' + data.name + '" was enqueued',
            text: "The build instruction #" + data.id + " has been added to the queue",
            image: window.emerald.domain + "/images/control_double_down.png"
        });
    });

    window.socket.on('Build aborted', function(data){
        $.gritter.add({
            title: '"' + data.instruction.name + '" was aborted',
            text: "The build instruction #" + data.instruction.id + " has been successfully aborted",
            image: window.emerald.domain + "/images/ico_abort.png"
        });
    });
})(jQuery);
