const Koa = require('koa');
const bodyParser = require('koa-body-parser');
const Router = require('koa-router');
const koastatic = require('koa-static');
const fs = require('fs');
const http = require("http");
const https = require("https");
const SqliteDB = require('./utils/sqlite').SqliteDB;
const file = "Auth.db";
const sqliteDB = new SqliteDB(file);
const {encrypt, encryptWithSalt} = require('./utils/bcrypt.js');

const app = new Koa();
let router = new Router();

// 检查sqlite数据库是否存在，不存在则创建
if (!sqliteDB.exist) {
    console.log("Creating db file!");
    fs.openSync(file, 'w');
    // 创建用户表
    sqliteDB.createTable(`create table if not exists userSchema(
        username varchar(255) primary key,
        password varchar(255) not null,
        email varchar(255) not null
    )`);

    // 创建session表
    sqliteDB.createTable(`create table if not exists sessionTable(
        username varchar(255) primary key,
        sessionId varchar(255) not null,
        createTime varchar(255) not null
    )`);

    // 创建用户密码加密盐表
    sqliteDB.createTable(`create table if not exists salt(
        username varchar(255) primary key,
        salt varchar(255) not null
    )`);
}

const host = '0.0.0.0', http_port = 8080, https_port = 443;
http.createServer(app.callback()).listen(http_port);
const options = {
    key: fs.readFileSync(`${__dirname}/privkey.pem`, "utf8"),
    cert: fs.readFileSync(`${__dirname}/fullchain.pem`, "utf8")
};
https.createServer(options, app.callback()).listen(https_port);

router.post('/register', async (ctx, next) => {
    const data = ctx.request.body;
    console.log(ctx.request.body);
    const crypt = await encrypt(data.password);
    await sqliteDB.insertData('insert into userSchema(username, password, email) values(?, ?, ?)', [[data.username, crypt.hash, data.email]]);
    // 把盐存进数据库
    await sqliteDB.insertData('insert into salt(username, salt) values(?, ?)', [[data.username, crypt.salt]]);
    ctx.response.body = {
        code: 0,
        message: '注册成功'
    };
});

router.post('/login', async (ctx, next) => {
    const data = ctx.request.body;
    // 从数据库中获取盐
    let salt = null;
    await sqliteDB.queryData(`select * from salt where username = '${data.username}'`, function (rows) {
        salt = rows[0].salt;
    });
    const hashPass = encryptWithSalt(data.password, salt);
    // 从数据库中获取用户信息
    let user = null;
    await sqliteDB.queryData(`select * from userSchema where username = '${data.username}'`, function (rows) {
        user = rows[0];
    });
    if (user.password === hashPass) {
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
});

router.get('/', async (ctx, next) => {
    // 自动跳转到login.html
    ctx.redirect('/login.html');
});

app.use(koastatic('./public'));
app.use(bodyParser());
app.use(router.routes());
app.use(router.allowedMethods());