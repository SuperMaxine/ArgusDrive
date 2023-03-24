const SqliteDB = require('../utils/sqlite').SqliteDB;
const file = "Auth.db";
const sqliteDB = new SqliteDB(file);
const deepCopy = require('deep-copy');

/**
 * 用户登录信息中间件
 */
module.exports = function () {
    return async function (ctx, next) {
        const sessionId = ctx.cookies.get('sessionId');
        if (ctx.originalUrl === 'register') {
            ctx.loginUser = {code: 0, message: '注册'};
            await next();
            return null;
        }
        if (!sessionId) {
            ctx.loginUser = {code: 1, message: '您还未登录'};
            await next();
            return null;
        }
        const session = await sqliteDB.queryData(`select * from sessionTable where sessionId = '${sessionId}'`);
        if (session.length === 0) {
            ctx.loginUser = {code: 2, message: '登录态已过期，请重新登录'};
            await next();
            return null;
        }
        let user = await sqliteDB.queryData(`select * from userSchema where username = '${session[0].username}'`);
        if (user.length === 0) {
            ctx.loginUser = {code: 3, message: '用户不存在'};
            await next();
            return null;
        }
        // user = ctx.$tools.deepClone(user);
        user = deepCopy(user);
        delete user.password;
        ctx.loginUser = {code: 0, data: user, message: '登录成功'};
        await next();
        return ctx.loginUser;
    };
};