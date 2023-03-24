$(function () {
    // 点击上传按钮时触发
    $("#upload-btn").click(function () {
        // 获取文件选择器中的文件
        var file = $("#file-input")[0].files[0];
        if (file) {
            // 显示上传进度框
            showProgress("上传中");
            // TODO：使用AJAX将文件上传到服务器，并在上传完成后隐藏进度框
            // 可以使用XMLHttpRequest或jQuery的$.ajax()方法实现
        } else {
            alert("请选择要上传的文件");
        }
    });

    // 点击文件列表中的文件项时触发
    $(".file-item").click(function () {
        // 获取文件名
        var fileName = $(this).find(".card-title").text();
        // 显示下载进度框
        showProgress("下载中：" + fileName);
        // TODO：使用AJAX从服务器下载文件，并在下载完成后隐藏进度框
        // 可以使用XMLHttpRequest或jQuery的$.ajax()方法实现
    });

    // 更新上传或下载进度
    function updateProgress(progress) {
        // 更新进度条
        $(".progress-bar").css("width", progress + "%");
        $(".progress-bar").attr("aria-valuenow", progress);
    }

    // 显示上传或下载进度框
    function showProgress(title){
        // 设置进度框标题
        $(".progress-box h4").text(title);
        // 初始化进度条
        $(".progress-bar").css("width", "0%");
        $(".progress-bar").attr("aria-valuenow", 0);
        // 添加遮罩层
        var overlay = $("<div class='overlay'></div>");
        $(".container").append(overlay);
        // 显示进度框
        $(".progress-box").show();
    }

    // 隐藏上传或下载进度框
    function hideProgress(){
        // 隐藏进度框
        $(".progress-box").hide();
        // 移除遮罩层
        $(".overlay").remove();
    }

})