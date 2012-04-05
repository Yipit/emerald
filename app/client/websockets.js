(function($){

    /* Socket io client is funny. You can't pass options parameter
     * if you don't inform the uri one. So, it's the code that realizes
     * from where we are being called */
    var port = window.location.port;
    var uri = window.location.protocol + '//' +
            window.document.domain + (port ? ':' + port : '');

    window.socket = io.connect(uri, {
        'reconnect': true,
        'reconnection delay': 500,
        'max reconnection attempts': 10
    });

    window.socket.on('BuildInstruction created', function(data){
        $.gritter.add({
            title: 'A new build instruction was added to emerald',
            text: 'Now you can run builds on "'+data.name+'"',
            image: window.emerald.domain + "/images/ico_success.png"
        });
    });

    window.socket.on('BuildInstruction enqueued', function(data){
        $.gritter.add({
            title: '"' + data.name + '" was enqueued',
            text: "The build instruction #" + data.id + " has been added to the queue",
            image: window.emerald.domain + "/images/control_double_down.png"
        });
    });

    window.socket.on('BuildInstruction deleted', function(data){
        $.gritter.add({
            title: 'Someone deleted the instruction "' + data.instruction.name + '"',
            text: "Don't worry, any queued builds of that given instruction were aborted",
            image: window.emerald.domain + "/images/ico_abort.png"
        });
    });

    window.socket.on('Build aborted', function(data){
        $.gritter.add({
            title: '"' + data.instruction.name + '" was aborted',
            text: "The build instruction #" + data.instruction.id + " has been successfully aborted",
            image: window.emerald.domain + "/images/ico_abort.png"
        });
    });

    window.socket.on('Build aborted', function(data){
        $.gritter.add({
            title: '"' + data.instruction.name + '" was aborted',
            text: "The build instruction #" + data.instruction.id + " has been successfully aborted",
            image: window.emerald.domain + "/images/ico_abort.png"
        });
    });

    window.socket.on('General error', function(data){
        $.gritter.add({
            title: data.title || 'A general error happened',
            text: data.text || 'the server did not send further information, please check the logs',
            image: window.emerald.domain + "/images/ico_abort.png"
        });
    });

    window.socket.on('Build finished', function(data){
        $.gritter.add({
            title: '"' + data.instruction.name + '" has finished',
            text: "The build instruction #" + data.instruction.id + " has finished",
            image: window.emerald.domain + "/images/ico_success.png"
        });
    });

    window.socket.on('Repository being fetched', function(data){
        var title = [
            "Fetching changes for",
            data.instruction.name,
            "-", data.phase, ":",
            data.percentage
        ].join(" ");

        $("title").text(title);
    });

    window.socket.on('Repository finished fetching', function(data){
        $("title").text("Emerald - Continuous Integration");
    });


    window.socket.on('Build output', function (data) {
        $('#live-code').append(data.appended + "\n");
        $('#live-code').scrollTo('max');
    });


})(jQuery);
