const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// const DB = DB || {}; //ReferenceError: Cannot access 'DB' before initialization
const DB = {};

/**
 * SqliteDB
 * @param file
 * @constructor
 */
DB.SqliteDB = function (file) {
    DB.db = new sqlite3.Database(file);

    DB.exist = fs.existsSync(file);
    if (!DB.exist) {
        console.log("Creating db file!");
        fs.openSync(file, 'w');
    }
};

/**
 * 打印错误信息
 * @param err
 */
DB.printErrorInfo = function (err) {
    console.log("Error Message:" + err.message + " ErrorNumber:" + err.errno);
};

/**
 * 创建表
 * @param sql
 */
DB.SqliteDB.prototype.createTable = function (sql) {
    DB.db.serialize(function () {
        DB.db.run(sql, function (err) {
            if (null != err) {
                DB.printErrorInfo(err);
                return;
            }
        });
    });
};

/**
 * 插入数据
 * @param sql
 * @param objects
 * tilesData format; [[level, column, row, content], [level, column, row, content]]
 */
DB.SqliteDB.prototype.insertData = function (sql, objects) {
    DB.db.serialize(function () {
        const stmt = DB.db.prepare(sql);
        for (let i = 0; i < objects.length; ++i) {
            stmt.run(objects[i]);
        }

        stmt.finalize();
    });
};

/**
 * 查询数据
 * @param sql
 * @param callback
 */
DB.SqliteDB.prototype.queryData = function (sql, callback) {
    DB.db.all(sql, function (err, rows) {
        if (null != err) {
            DB.printErrorInfo(err);
            return;
        }

        // 处理返回数据
        if (null != callback) {
            callback(rows);
        }
    });
};

/**
 * 执行sql语句
 * @param sql
 */
DB.SqliteDB.prototype.executeSql = function (sql) {
    DB.db.run(sql, function (err) {
        if (null != err) {
            DB.printErrorInfo(err);
        }
    });
};

/**
 * 关闭数据库
 */
DB.SqliteDB.prototype.close = function () {
    DB.db.close();
};

exports.SqliteDB = DB.SqliteDB;