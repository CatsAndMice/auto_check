const { Client } = require('ssh2');
const configs = require('./config.json');
const linuxCheck = require('./linuxCheck.js');
const fs = require('fs');
const path = require('path');
const nodeXlsx = require('node-xlsx');
const getUsers = require('./getUsers.js');
const linuxCheckLowUser = require('./linuxCheckLowUser.js');

const promises = [],
    linuxLowUser = []

const users = getUsers(configs)
const tables = [
    ['服务器ip', '内存剩余比例应大于20%且小于60%', '磁盘剩余比例应小于70%', '当前用户sudo权限是否有效', '日志目录占用的磁盘空间大小是否超出10g', 'root密码有效期', '环境']
]

const lowUser = [
    ['服务器ip', ...users, '环境']
]

configs.forEach((config) => {
    const conn = new Client();
    promises.push(linuxCheck(config, conn))
})

Promise.all(promises).then((data) => {
    data.forEach((d) => {
        if (Array.isArray(d)) {
            tables.push(d)
        }
    })

    configs.forEach((config) => {
        const conn = new Client();
        linuxLowUser.push(linuxCheckLowUser(config, conn, users))
    })

    Promise.all(linuxLowUser).then(data => {
        // console.log(data);
        lowUser.push(...data)
        console.log(lowUser);
        const buffer = nodeXlsx.build([{ name: '巡检', data: tables }, { name: '低权限用户密码有效期', data: lowUser }])
        const file = path.join(__dirname, '/server.xlsx')
        fs.writeFileSync(file, buffer, 'utf-8')
    })
})
