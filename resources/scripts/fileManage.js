let request = axios.create();
request.defaults.baseURL = 'https://supermaxine.xyz:10443';
request.defaults.headers['Content-Type'] = 'mutipart/form-data';
request.defaults.transformRequest = (data, headers) => {
    let contentType = headers['Content-Type'];
    if (contentType === 'application/x-www-form-urlencoded') return Qs.stringify(data);
    return data;
}

request.interceptors.response.use(response => {
    return response.data;
});

function updateFileList() {
    request.get('/list').then(data => {
        if (data.code === 0) {
            console.log(data);
            $(".file-list").html("");
            for (let i = 0; i < data.data.length; i++) {
                let fileItem = document.createElement("li");
                fileItem.className = "card file-item";
                let cardBody = document.createElement("div");
                cardBody.className = "card-body";
                let cardTitle = document.createElement("h5");
                cardTitle.className = "card-title";
                let file_info = /(.*)(\.[a-zA-Z0-9]+)$/.exec(data.data[i].fileName);
                cardTitle.innerText = decodeURIComponent(atob(file_info[1])) + file_info[2];
                cardBody.appendChild(cardTitle);
                fileItem.appendChild(cardBody);
                $(".file-list").append(fileItem);
            }
        } else {
            alert(data.message);
        }
    });
}

$(function () {
    $(document).ready(function () {
       console.log("window is ready");
       $.ajax({
           url: "\list",
              type: "GET"
       }).done(function (data) {
              if (data.code === 0) {
                console.log(data);
                updateFileList();
              } else {
                alert(data.message);
              }
       });
    });

    // 点击上传按钮时触发
    $("#upload-btn").click(async function () {

        const retrieveHash = function retriveHash(file) {
            return new Promise((resolve, reject) => {
                console.log("file", file)
                let fr = new FileReader();
                fr.readAsArrayBuffer(file);
                fr.onload = (ev) => {
                    const suffix = /\.([0-9a-zA-Z]+)$/.exec(file.name)[1];
                    // filename = file.name - suffix
                    const filename = file.name.slice(0, file.name.length - suffix.length - 1);
                    let b64_filename = btoa(encodeURIComponent(filename));
                    resolve({
                        // hash,
                        b64_filename,
                        suffix
                    });
                };
            });
        };

        let complete = 0;
        const uploadComplete = function uploadComplete(hash, count) {
            console.log('upload complete, hash: ' + hash + ', count: ' + count);
            complete++;
            let progress = (complete / count * 100).toFixed(2);
            updateProgress(progress);
            if (complete < count) return;
            updateProgress('100');
            // hideProgress();
            setTimeout(() => {
                // request.post('/upload_merge', {
                //     hash,
                //     count
                // }, {
                //     headers: {
                //         'Content-Type': 'application/x-www-form-urlencoded'
                //     }
                // }).then(res => {
                //     console.log(res);
                //     // alert('上传成功了');
                // }).catch(err => {
                //     console.log(err);
                // });
                $.ajax({
                    url: "/upload_merge",
                    type: "POST",
                    data: {
                        'hash': hash,
                        'count': count
                    }
                }).done(function (data) {
                    console.log("upload merge done");
                    if (data.code === 0) {
                        console.log("upload merge success");
                        console.log(data);
                        updateFileList();
                        hideProgress();
                    } else {
                        alert(data.message);
                    }
                });
            }, 3000);
        }


        // 获取文件选择器中的文件
        var file = $("#file-input")[0].files[0];
        if (file) {
            // 显示上传进度框
            showProgress("上传中");
            // TODO：使用AJAX将文件上传到服务器，并在上传完成后隐藏进度框
            // 可以使用XMLHttpRequest或jQuery的$.ajax()方法实现
            let {
                // hash,
                b64_filename,
                suffix
            } = await retrieveHash(file);

            $(".filename").text(file.name);

            let fileList = null;
            $.ajax({
                url: "/uploaded",
                type: "POST",
                data: {
                    'b64_filename': b64_filename,
                    'suffix': suffix
                }
            }).done(function (data) {
                if (data.code === 0) {
                    console.log(data);
                    fileList = data.fileList;
                } else {
                    alert(data.message);
                }
            });

            let maxSize = 100 * 1024; //100k
            let count = Math.ceil(file.size / maxSize);
            //限制切片的数量不能超过20个，并重新计算每个切片的大小
            if (count > 20) {
                maxSize = file.size / 20;
                count = 20;
            }

            let index = 0;
            let chunks = [];
            while (index < count) {
                chunks.push({
                    file: file.slice(index * maxSize, (index + 1) * maxSize),
                    // filename: `${hash}_${index+1}.${suffix}`
                    filename: `${b64_filename}_${index+1}.${suffix}`
                });
                index++;
            }

            chunks.forEach((item, index) => {
                //如果已经上传过就不再上传了
                if (fileList && fileList.length > 0 && fileList.includes(item.filename)) {
                    // uploadComplete(hash, count);
                    uploadComplete(b64_filename, count);
                    return;
                }
                let formData = new FormData();
                formData.append('file', item.file);
                formData.append('filename', item.filename);
                request.post('/upload_chunk', formData).then(res => {
                    // uploadComplete(hash, count);
                    uploadComplete(b64_filename, count);
                    // console.log(res);
                    // alert('上传成功了');
                }).catch(err => {
                    console.log(err);
                });
            });



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