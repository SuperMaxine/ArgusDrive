$(function () {
    $("#login-form").submit(function (event) {
        event.preventDefault();
        // send login request
        $.ajax({
            url: "/login",
            type: "POST",
            data: {
                username: $("#login-username").val(),
                password: $("#login-password").val()
            }
        }).done(function (data) {
            if (data.code === 0) {
                alert(data.message);
                // $("#login-username").val("");
                // $("#login-password").val("");

                // jump to /fileManage
                window.location.href = "/fileManage";
            } else {
                alert(data.message);
            }
        });
    });

    $("#register-form").submit(function (event) {
        event.preventDefault();
        // send register request
        $.ajax({
            url: "/register",
            type: "POST",
            data: {
                username: $("#register-username").val(),
                password: $("#register-password").val(),
                email: $("#register-email").val()
            }
        }).done(function (data) {
            if (data.code === 0) {
                alert(data.message);
                $("#register-username").val("");
                $("#register-password").val("");
                $("#register-email").val("");
            } else {
                alert(data.message);
            }
        });
    });
});
