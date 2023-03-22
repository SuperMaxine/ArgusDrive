const bcrypt = require('bcrypt'); // bcrypt加密

/**
 * 密码加密
 * @param {String} pass
 * @return {Object} {hash, salt}
 */
async function encrypt (pass) {
    // 生成salt的迭代次数
    const saltRounds = 10;
    // 随机生成salt（盐）
    const salt = await bcrypt.genSalt(saltRounds);
    // 获取hash值
    const hash = await bcrypt.hash(pass, salt);
    return {hash, salt};
}

/**
 * 密码带盐加密
 * @param {String} pass
 * @param salt
 * @return {String} hashPass
 */
async function encryptWithSalt (pass, salt) {
    return await bcrypt.hash(pass, salt);
}


module.exports = {
    encrypt,
    encryptWithSalt
};