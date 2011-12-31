$(function(){
    var socket = io.connect();
    $("#new-build").modal({show: false, keyboard: false});

    $.each(["BuildInstruction", "User"], function(index, ModelName){
        socket.on(ModelName + ' deleted', function(data){
            var selector = ".clay."+ModelName+".delete[rel=" + data.id + "]";
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
            $("a[emerald-action='run'][emerald-entity='BuildInstruction'][rel='"+data.id+"']").button('reset');
        });
    });

    socket.on('BuildInstruction enqueued', function(data){
        $.gritter.add({
            title: "Build enqueued",
            text: "The build instruction #" + data.id + " has been added to the queue",
            image: window.emerald.domain + "/images/control_double_down.png"
        });
        $("a[emerald-action='run'][emerald-entity='BuildInstruction'][rel='"+data.id+"']").button('reset');
    });
    socket.on('Build started', function(data){
        var $instruction = $("[data-instruction-id="+data.instruction.__id__+"]");
        var $bg = $instruction.find(".build-status");
        $bg.removeClass("warning").addClass("info");
        $instruction.find(".last-build").html("<strong>Building now</strong>");
        $("#terminal").html("");
    });
    socket.on('Build finished', function(data){
        var $instruction = $("[data-instruction-id="+data.instruction.__id__+"]");
        var $bg = $instruction.find(".build-status");

        if ((parseInt(data.build.status || "0") == 0) && ((data.build.signal + "") == "null")) {
            $bg.removeClass("info").addClass("success");
        } else {
            $bg.removeClass("info").addClass("error");
        }
        $instruction.find(".last-build").html("<strong>Finished just now</strong>");
    });

    socket.on('Build output', function(data){
        var $terminal = $("#terminal-wrapper");
        $terminal.fadeIn();
        $terminal.find("#terminal").html($terminal.find("#terminal").html() + data.output);
    });

    socket.on('Repository being fetched', function(data){
        var $pb = $("#progress-bar");
        $pb.fadeIn();
        $pb.find(".gif").show();
        $pb.find(".label").text(data.percentage);
        $pb.find(".bar").css("width", data.percentage);
        $pb.find(".status").text(data.instruction.name+": "+data.phase);
    });
    socket.on('Repository finished fetching', function(data){
        var $pb = $("#progress-bar");
        $pb.fadeOut();
        $pb.find(".gif").hide();
        $pb.find(".label").text("0%");
        $pb.find(".bar").css("width", '0%');
        $pb.find(".status").text("Finished");
    });
    socket.on('disconnect', function(){
        var $pb = $("#progress-bar");
        $pb.fadeOut();
        $pb.find(".gif").hide();
        $pb.find(".label").text("0%");
        $pb.find(".bar").css("width", '0%');
        $pb.find(".status").text("Finished");
    });
    $(".clay.BuildInstruction.delete").live("click", function(e) {
        var $self = $(this);
        var id = $self.attr("rel");
        $self.button('loading');
        socket.emit('delete BuildInstruction', {id: id});
        return e.preventDefault();
    });
    $("a[emerald-action='run']").die('click').live('click', function(e){
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


    $(".clay.User.delete").live("click", function() {
        var id = $(this).attr("rel");
        socket.emit('delete User', {id: id});
        $(this).parent().animate({
            'opacity': 0.2,
        })
        return false;
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