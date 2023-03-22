const SqliteDB = require('../utils/sqlite').SqliteDB;
const file = "Auth.db";
const sqliteDB = new SqliteDB(file);
const deepCopy = require('deep-copy');

/**
 * 用户登录信息中间件
 */
module.exports = function () {
    return async function (ctx, next) {
        const sessionId = ctx.cookies.get('session_id');
        if (!sessionId) {
            ctx.loginUser = {code: 1, message: '您还未登录'};
            await next();
            return null;
        }
        let session = null;
        await sqliteDB.queryData(`select * from sessionTable where sessionId = '${sessionId}'`, function (rows) {
            session = rows[0];
        });
        if (!session) {
            ctx.loginUser = {code: 2, message: '登录态已过期，请重新登录'};
            await next();
            return null;
        }
        let user = null;
        await sqliteDB.queryData(`select * from userSchema where username = '${session.username}'`, function (rows) {
            user = rows[0];
        });
        if (!user) {
            ctx.loginUser = {code: 3, message: '用户不存在'};
            await next();
            return null;
        }
        // user = ctx.$tools.deepClone(user);
        user = deepCopy(user);
        delete user.password;
        ctx.loginUser = {code: 0, data: user, message: '用户不存在'};
        await next();
        return ctx.loginUser;
    };
};