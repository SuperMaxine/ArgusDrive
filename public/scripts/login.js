$(function () {
    $("#login-form").submit(function (event) {
        event.preventDefault();
        // TODO: login logic
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
            }
        });
    });
});
