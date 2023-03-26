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

                // add onclick event
                fileItem.onclick = function () {
                    ajaxEvt('head', `${request.defaults.baseURL}/download?name=${data.data[i].fileName}`, null, downLoadAjaxEvt)
                }
                $(".file-list").append(fileItem);
            }
        } else {
            alert(data.message);
        }
    });
}

let download = document.querySelector('#download');

const requestUrl = 'https://supermaxine.xyz:10443/download?name=JUU1JUFBJTkyJUU0JUJEJTkzMS5tcDQ=.mp4';
function downloadEvt(url, fileName = '未知文件') {
    const el = document.createElement('a');
    el.style.display = 'none';
    el.setAttribute('target', '_blank');
    /**
     * download的属性是HTML5新增的属性
     * href属性的地址必须是非跨域的地址，如果引用的是第三方的网站或者说是前后端分离的项目(调用后台的接口)，这时download就会不起作用。
     * 此时，如果是下载浏览器无法解析的文件，例如.exe,.xlsx..那么浏览器会自动下载，但是如果使用浏览器可以解析的文件，比如.txt,.png,.pdf....浏览器就会采取预览模式
     * 所以，对于.txt,.png,.pdf等的预览功能我们就可以直接不设置download属性(前提是后端响应头的Content-Type: application/octet-stream，如果为application/pdf浏览器则会判断文件为 pdf ，自动执行预览的策略)
     */
    if (fileName && fileName === '未知文件') {
        el.setAttribute('download', fileName);
    } else {
        let file_info = /(.*)(\.[a-zA-Z0-9]+)$/.exec(fileName);
        el.setAttribute('download', decodeURIComponent(atob(file_info[1])) + file_info[2]);
    }
    el.href = url;
    console.log(el);
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
};

// 根据header里的contenteType转换请求参数
function transformRequestData(contentType, requestData) {
    requestData = requestData || {};
    if (contentType.includes('application/x-www-form-urlencoded')) {
        // formData格式：key1=value1&key2=value2，方式二：qs.stringify(requestData, {arrayFormat: 'brackets'}) -- {arrayFormat: 'brackets'}是对于数组参数的处理
        let str = '';
        for (const key in requestData) {
            if (Object.prototype.hasOwnProperty.call(requestData, key)) {
                str += `${key}=${requestData[key]}&`;
            }
        }
        return encodeURI(str.slice(0, str.length - 1));
    } else if (contentType.includes('multipart/form-data')) {
        const formData = new FormData();
        for (const key in requestData) {
            const files = requestData[key];
            // 判断是否是文件流
            const isFile = files ? files.constructor === FileList || (files.constructor === Array && files[0].constructor === File) : false;
            if (isFile) {
                for (let i = 0; i < files.length; i++) {
                    formData.append(key, files[i]);
                }
            } else {
                formData.append(key, files);
            }
        }
        return formData;
    }
    // json字符串{key: value}
    return Object.keys(requestData).length ? JSON.stringify(requestData) : '';
}

function ajaxEvt(method = 'get', url, params = null, cb, config = {}) {
    console.log("in ajaxEvt");
    console.log("ajaxEvt method: " + url);
    const _method = method.toUpperCase();
    const _config = Object.assign({
        contentType: ['POST', 'PUT'].includes(_method) ? 'application/x-www-form-urlencoded' : 'application/json;charset=utf-8',  // 请求头类型
        async: true,                                               // 请求是否异步-true异步、false同步
        token: 'token',                                             // 用户token
        range: '',
        responseType: ''
    }, config);
    const ajax = new XMLHttpRequest();

    const queryParams = transformRequestData(_config.contentType, params);
    const _url = `${url}${_method === 'GET' && queryParams ? '?' + queryParams : ''}`;

    ajax.open(_method, _url, _config.async);
    ajax.setRequestHeader('Authorization', _config.token);
    ajax.setRequestHeader('Content-Type', _config.contentType);
    _config.range && ajax.setRequestHeader('Range', _config.range);
    // responseType若不设置，会导致下载的文件可能打不开
    _config.responseType && (ajax.responseType = _config.responseType);
    // 获取文件下载进度
    ajax.addEventListener('progress', (progress) => {
        console.log(progress);
        const percentage = ((progress.loaded / progress.total) * 100).toFixed(2);
        const msg = `下载进度 ${percentage}%...`;
        console.log(msg);
    });
    // 如果前端报“xxx.net::ERR_CONTENT_LENGTH_MISMATCH 206 (Partial Content)”，可以考虑是否是后端的header设置不对(ajax.readyState=4 & ajax.status=0)
    ajax.onload = function () {
        // this指向ajax
        (typeof cb === 'function') && cb(this, url);
    };
    // send(string): string：仅用于 POST 请求
    ajax.send(queryParams);
    console.log("query params:\n", queryParams);
}

function arrayBufferEvt(response, i, resolve) {
    response.response.arrayBuffer().then(result => {
        resolve({i, buffer: result});
    });
}
// 合并buffer
function concatBuffer(list) {
    let totalLength = 0;
    for (let item of list) {
        totalLength += item.length;
    }
    // 实际上Uint8Array目前只能支持9位，也就是合并最大953M(999999999字节)的文件
    let result = new Uint8Array(totalLength);
    let offset = 0;
    for (let item of list) {
        result.set(item, offset);
        offset += item.length;
    }
    return result;
}
/**
 * ajax实现文件下载、获取文件下载进度
 * @param {String} method - 请求方法get/post
 * @param {String} url
 * @param {Object} [params] - 请求参数，{name: '文件下载'}
 * @param {Object} [config] - 方法配置
 */
function downLoadAjaxEvt(ajaxResponse, url) {
    const fileSize = ajaxResponse.getResponseHeader('Content-Length') * 1;
    // 两种解码方式，区别自行百度: decodeURIComponent/decodeURI（主要获取后缀名，否则某些浏览器会一律识别为txt，导致下载下来的都是txt）
    const fileName = decodeURIComponent((ajaxResponse.getResponseHeader('content-disposition') || '; filename="未知文件"').split(';')[1].trim().slice(9));
    console.log('文件名', fileName);

    // 5M为一片  浏览器并发请求一般6个
    const spliceSize = Math.ceil(fileSize / 6);
    const length = Math.ceil(fileSize / spliceSize);
    console.log('返回', length);
    const reqList = [];
    for (let i = 0; i < length; i++) {
        let start = i * spliceSize;
        let end = (i === length - 1) ?  fileSize - 1  : (i + 1) * spliceSize - 1;
        reqList.push(new Promise((resolve, reject) => {
            ajaxEvt('get', `${url}&time=${Date.now()+i}`, null, (response) => arrayBufferEvt(response, i, resolve), {responseType: 'blob', range: `bytes=${start}-${end}`})
        }));
    }
    Promise.all(reqList).then(res => {
        sortList(res);
        const arrBufferList = res.map(item => new Uint8Array(item.buffer));
        const allBuffer = concatBuffer(arrBufferList);
        const blob = new Blob([allBuffer]);
        const href = URL.createObjectURL(blob);
        downloadEvt(href, fileName);
        // 释放一个之前已经存在的、通过调用 URL.createObjectURL() 创建的 URL 对象
        URL.revokeObjectURL(href);
    })
}

// 数组排序
function sortList(_list) {
    const length = _list.length;
    for(let i = 0; i < length - 1; i++) {
        for(let j = i + 1; j < length; j++) {
            if (_list[i].i > _list[j].i) {
                let temp = null;
                temp = _list[j];
                _list[j] = _list[i];
                _list[i] = temp;
            }
        }
    }
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