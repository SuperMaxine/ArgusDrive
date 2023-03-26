const Koa = require('koa');
const bodyParser = require('koa-body-parser');
const Router = require('koa-router');
const static = require('koa-static');
const views = require('koa-views')
const session = require('koa-session');
const fs = require('fs');
const http = require("http");
const https = require("https");
const uuid = require('uuid');
const multiparty = require('multiparty');
const formidable = require('formidable');
const SqliteDB = require('./utils/sqlite').SqliteDB;
const {encrypt, encryptWithSalt} = require('./utils/bcrypt.js');
const loginUser = require('./middleware/loginUser');
const path = require("path");


const app = new Koa();
let router = new Router();
const sqliteDB = new SqliteDB("Auth.db");


const host = '0.0.0.0', http_port = 8080, https_port = 443;
const HOSTNAME = `${host}:${https_port}`;
const SERVER_PATH = `${__dirname}/upload`;
// http.createServer(app.callback()).listen(http_port);
const options = {
    key: fs.readFileSync(`${__dirname}/privkey.pem`, "utf8"),
    cert: fs.readFileSync(`${__dirname}/fullchain.pem`, "utf8")
};
https.createServer(options, app.callback()).listen(https_port);


router.post('/register', async (ctx, next) => {
    const data = ctx.request.body;
    const crypt = await encrypt(data.password);
    await sqliteDB.insertData('insert into userSchema(username, password, email) values(?, ?, ?)', [[data.username, crypt.hash, data.email]]);
    await sqliteDB.insertData('insert into salt(username, salt) values(?, ?)', [[data.username, crypt.salt]]);

    // 确认userSchema表和salt表中是否有刚刚注册的用户
    const user = await sqliteDB.queryData(`select * from userSchema where username = '${data.username}'`);
    const salt = await sqliteDB.queryData(`select * from salt where username = '${data.username}'`);
    if (user.length > 0 && salt.length > 0) {
        ctx.response.body = {
            code: 0,
            message: '注册成功'
        };
    }
});

router.post('/login', async (ctx, next) => {
    const data = ctx.request.body;
    try {
        // 从数据库中获取盐
        const salt = await sqliteDB.queryData(`select * from salt where username = '${data.username}'`);
        // 从数据库中获取用户信息
        const user = await sqliteDB.queryData(`select * from userSchema where username = '${data.username}'`);
        if (salt.length === 0 || user.length === 0) {
            ctx.response.body = {
                code: 1,
                message: '用户不存在'
            };
            return;
        }

        // noinspection ES6RedundantAwait
        const hashPass = await encryptWithSalt(data.password, salt[0].salt);
        if (user[0].password === hashPass) {
            // 生成session
            const sessionObj = {
                username: data.username,
                sessionId: uuid.v4(),
                createTime: new Date().getTime()
            }

            // 检查session是否过期
            const session = await sqliteDB.queryData(`select * from sessionTable where username = '${data.username}'`);
            if (session.length > 0) {
                // 将session从数据库中删除
                await sqliteDB.executeSql(`delete from sessionTable where username = '${data.username}'`);
            }

            // 将session存入数据库
            await sqliteDB.insertData('insert into sessionTable(username, sessionId, createTime) values(?, ?, ?)', [[sessionObj.username, sessionObj.sessionId, sessionObj.createTime]]);
            // 将session存入cookie
            ctx.cookies.set('sessionId', sessionObj.sessionId, {
                maxAge: 1000 * 60 * 60 * 24 * 7,
                httpOnly: true
            });
            ctx.cookies.set('username', data.username, {
                maxAge: 1000 * 60 * 60 * 24 * 7,
                httpOnly: true
            });
            ctx.response.body = {
                code: 0,
                message: '登录成功'
            };
        } else {
            ctx.response.body = {
                code: 1,
                message: '用户名或密码错误'
            };
        }
    } catch (e) {
        ctx.response.body = {
            code: 1,
            message: '登录失败，未知原因'
        };
        // throw e;
    }
});

router.get('/', async (ctx, next) => {
    // 渲染login.html
    await ctx.render('login');
});

router.get('/fileManage', async (ctx, next) => {
    // 检查用户是否登录
    console.log(ctx.loginUser)
    if (ctx.loginUser.code !== 0) {
        // await ctx.render('login');
        ctx.status = 301;
        ctx.redirect('/');
        return;
    }
    const files = await sqliteDB.queryData(`select * from fileSchema where username = '${ctx.loginUser.data[0].username}'`);
    console.log("files", files)
    // 渲染fileManage.html
    await ctx.render('fileManage', {
        username: ctx.loginUser.data[0].username,
        files: files
    });
});

router.get('/list', async (ctx, next) => {
    const files = await sqliteDB.queryData(`select * from fileSchema where username = '${ctx.loginUser.data[0].username}'`);
    ctx.response.body = {
        code: 0,
        message: '获取文件列表成功',
        data: files
    };
});

router.post('/uploaded', async (ctx, next) => {
    try {
        console.log("in uploaded")
        const {
            b64_filename,
            suffix
        } = ctx.request.body;
        const dirPath = `${SERVER_PATH}/${b64_filename}.${suffix}`;
        console.log("dirPath", dirPath)
        const fileList = fs.readdirSync(dirPath);
        fileList.sort((a, b) => {
            const reg = /_([\d+])/;
            return reg.exec(a)[1] - reg.exec(b)[1];
        });
        ctx.body = {
            code: 0,
            message: '获取成功',
            fileList: fileList
        }
    } catch (err) {
        ctx.body = {
            code: 0,
            message: '获取失败'
        }
    }
});

//利用multiparty插件解析前端传来的form-data格式的数据，并上传至服务器
const multipartyUpload = function multipartyUpload(req, autoUpload) {
    let config = {
        maxFieldsSize: 200 * 1024 * 1024
    }
    if (autoUpload) config.uploadDir = SERVER_PATH;
    return new Promise((resolve, reject) => {
        new multiparty.Form(config).parse(req, (err, fields, files) => {
            if (err) {
                reject(err);
                return;
            }
            resolve({
                fields,
                files
            });
        });
    });
}

//检测文件是否已经存在
const exists = function exists(path) {
    return new Promise((resolve, reject) => {
        fs.access(path, fs.constants.F_OK, err => {
            if (err) {
                resolve(false);
                return;
            }
            resolve(true);
        });
    });
}

//将传进来的文件数据写入服务器
//form-data格式的数据将以流的形式写入
//BASE64格式数据则直接将内容写入
const writeFile = function writeFile(serverPath, file, isStream) {
    return new Promise((resolve, reject) => {
        if (isStream) {
            try {
                let readStream = fs.createReadStream(file.path);
                let writeStream = fs.createWriteStream(serverPath);
                readStream.pipe(writeStream);
                readStream.on('end', () => {
                    resolve({
                        result: true,
                        message: '上传成功！'
                    });
                    fs.unlinkSync(file.path);
                });
            } catch (err) {
                resolve({
                    result: false,
                    message: err
                })
            }
        } else {
            fs.writeFile(serverPath, file, err => {
                if (err) {
                    resolve({
                        result: false,
                        message: err
                    })
                    return;
                }
                resolve({
                    result: true,
                    message: '上传成功！'
                });
            });
        }
    });
}

//定义延迟函数
const delay = function delay(interval) {
    typeof interval !== 'number' ? interval = 1000 : null;
    return new Promise((resolve, reject) => {
        setTimeout(function () {
            resolve();
        }, interval);
    });
}

const mergeFiles = function mergeFiles(hash, username, count) {
    return new Promise(async (resolve, reject) => {
        const dirPath = `${SERVER_PATH}/${hash}`;
        if (!fs.existsSync(dirPath)) {
            reject('还没上传文件，请先上传文件');
            return;
        }
        const files = fs.readdirSync(dirPath);
        if (files.length < count) {
            reject('文件还未上传完成，请稍后再试');
            return;
        }

        // 判断${SERVER_PATH}/${username}文件夹是否存在，不存在则创建
        const userDir = `${SERVER_PATH}/${username}`;
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir);
        }

        let suffix;
        files.sort((a, b) => {
            const reg = /_(\d+)/;
            return reg.exec(a)[1] - reg.exec(b)[1];
        }).forEach(item => {
            !suffix ? suffix = /\.([0-9a-zA-Z]+)$/.exec(item)[1] : null;
            //将每个文件读取出来并append到以hash命名的新文件中
            fs.appendFileSync(`${SERVER_PATH}/${username}/${hash}.${suffix}`, fs.readFileSync(`${dirPath}/${item}`));
            fs.unlinkSync(`${dirPath}/${item}`); //删除切片文件
        });

        // 将session存入数据库
        await sqliteDB.insertData('insert into fileSchema(username, fileName) values(?, ?)', [[username, `${hash}.${suffix}`]]);

        await delay(1000); //等待1秒后删除新产生的文件夹
        fs.rmdirSync(dirPath);

        resolve({
            path: `${HOSTNAME}/upload/${username}/${hash}.${suffix}`,
            filename: `${hash}.${suffix}`
        })
    });
}

router.post('/upload_chunk', async (ctx, next) => {
    try {
        console.log("in upload_chunk")
        let {
            files,
            fields
        } = await multipartyUpload(ctx.req, false);
        let file = (files && files.file[0]) || {};
        let filename = (fields && fields.filename[0]) || '';
        let [, hash] = /^([^_]+)_(\d+)/.exec(filename);
        const dirPath = `${SERVER_PATH}/${hash}`;
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath);
        }
        const filePath = `${dirPath}/${filename}`;
        const isExists = await exists(filePath);
        if (isExists) {
            ctx.body = {
                code: 0,
                message: '文件已经存在',
                originalFilename: filename,
                serverPath: filePath.replace(__dirname, HOSTNAME)
            }
            return;
        }
        await writeFile(filePath, file, true);
        ctx.body = {
            code: 0,
            message: '文件上传成功',
            serverPath: filePath.replace(__dirname, HOSTNAME)
        }
    } catch (err) {
        ctx.body = {
            code: 1,
            message: err
        }
    }
});

//合并切片文件
router.post('/upload_merge', async (ctx, next) => {
    console.log("in upload_merge")
    // const {
    //     hash,
    //     count
    // } = await parsePostParams(ctx.req);
    const {
        hash,
        count
    } = ctx.request.body;
    console.log("hash: " + hash + " count: " + count)
    const username = ctx.loginUser.data[0].username;
    console.log("username: " + username)
    const {
        path,
        filename
    } = await mergeFiles(hash, username, count);
    ctx.body = {
        code: 0,
        message: '文件上传成功',
        path,
        filename
    }
});


function createFileResHeader(fileName, size) {
    return {
        // 告诉浏览器这是一个需要以附件形式下载的文件（浏览器下载的默认行为，前端可以从这个响应头中获取文件名：前端使用ajax请求下载的时候，后端若返回文件流，此时前端必须要设置文件名-主要是为了获取文件后缀，否则前端会默认为txt文件）
        'Content-Disposition': 'attachment; filename=' + encodeURIComponent(fileName),
        // 告诉浏览器是二进制文件，不要直接显示内容
        'Content-Type': 'application/octet-stream',
        // 下载文件大小（HEAD请求时，主要获取Content-Length）
        'Content-Length': size,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'X-Requested-With',
        'Access-Control-Allow-Methods': 'PUT,POST,GET,DELETE,OPTIONS',
        //如果不暴露header，那就Refused to get unsafe header "Content-Disposition"
        "Access-Control-Expose-Headers":'Content-Disposition'
    }
}

function getRange(range) {
    let start = 0;
    let end = 0;
    if (range) {
        const arr = range.split('-');
        start = Number(arr[0].split('=')[1]);
        end = Number(arr[1]);
    }
    return {
        start,
        end
    }
}

// 大文件下载 - 分片下载  (head请求不会返回响应体)
router.get('/download', async (ctx, next) => {
    console.log("in download");
    // 获取文件路径
    const fileName = ctx.query.name;
    let filePath = path.join(__dirname, `./upload/${ctx.loginUser.data[0].username}/${fileName}`)
    console.log("filePath:", filePath);
    // 1、 判断文件是否存在
    try {
        fs.accessSync(filePath);
        console.log("文件存在");
    } catch (error) {
        // next.send({
        //     status: 201,
        //     message: '下载的文件资源不存在'
        // });
        ctx.body = {
            code: 1,
            message: '下载的文件资源不存在'
        }
    }

    try {
        // 获取文件大小
        const size = fs.statSync(filePath).size;
        const range = ctx.headers['range'];
        const {start, end} = getRange(range);
        if (!range) {
            // 2、 head请求同时请求头中不带range字段，返回文件大小，前端根据文件大小去决定要分成几段
            ctx.res.writeHead(200, Object.assign({'Accept-Ranges': 'bytes'}, createFileResHeader(fileName, size)));
        } else {
            const resHeaderParams = {};
            // 3、检查请求范围
            if (start >= size || end >= size) {
                ctx.res.status = 416;
                resHeaderParams['Content-Range'] = `bytes */${size}`;
            } else {
                // 4、返回206：客户端表明自己只需要目标URL上的部分资源的时候返回的
                ctx.res.status = 206;
                resHeaderParams['Content-Range'] = `bytes ${start}-${end ? end : size - 1}/${size}`;
            }
            /**
             * 这里不能使用res.writeHead前端会报: xxx.net::ERR_CONTENT_LENGTH_MISMATCH 206 (Partial Content)（一个请求的时候正常，多个并发请求的时候就会报这个，原因暂时未知）
             * res.writeHead 和res.setHeader 啥区别，官网没有给出明确说明，https://blog.csdn.net/qq_45515863/article/details/103213937
             */
            // res.writeHead(res.status, Object.assign({'Accept-Ranges': 'bytes'}, createFileResHeader(fileName, size), resHeaderParams), 200);
            ctx.res.statusCode = 206;
            ctx.res.setHeader("Accept-Ranges", "bytes");
            ctx.res.setHeader("Content-Range", `bytes ${start}-${end ? end : size - 1}/${size}`);
            ctx.res.setHeader("Content-Disposition", 'attachment; filename=' + encodeURIComponent(fileName));
            ctx.res.setHeader("Content-Type", "application/octet-stream");
        }
        // 5、返回部分文件
        // fs.createReadStream(filePath, {start, end}).pipe(ctx.res);
        ctx.body = fs.createReadStream(filePath, {start, end})
        console.log("返回部分文件");
    } catch (err) {
        // next.send({
        //     status: 201,
        //     message: err
        // })
        ctx.body = {
            code: 1,
            message: err
        }

    }
});


app.use(static(__dirname + '/resources'));
app.use(views(__dirname + '/public', { extension: "ejs" }));
app.keys = [uuid.v4()];
app.use(session({
    key: "koa:sess",
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    rolling: true
}, app))
app.use(bodyParser());
app.use(loginUser());
app.use(router.routes());
app.use(router.allowedMethods());