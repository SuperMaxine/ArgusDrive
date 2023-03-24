const Koa = require('koa');
const bodyParser = require('koa-body-parser');
const Router = require('koa-router');
const views = require('koa-views')
const session = require('koa-session');
const fs = require('fs');
const http = require("http");
const https = require("https");
const uuid = require('uuid');
const SqliteDB = require('./utils/sqlite').SqliteDB;
const {encrypt, encryptWithSalt} = require('./utils/bcrypt.js');
const loginUser = require('./middleware/loginUser');


const app = new Koa();
let router = new Router();
const sqliteDB = new SqliteDB("Auth.db");


const host = '0.0.0.0', http_port = 8080, https_port = 443;
http.createServer(app.callback()).listen(http_port);
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

        // 生成session
        // const sessionId = uuid.v4();
        // const createTime = new Date().getTime();
        const sessionObj = {
            username: data.username,
            sessionId: uuid.v4(),
            createTime: new Date().getTime()
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
        
        // noinspection ES6RedundantAwait
        const hashPass = await encryptWithSalt(data.password, salt[0].salt);
        if (user[0].password === hashPass) {
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
        await ctx.render('login');
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