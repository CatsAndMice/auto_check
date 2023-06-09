const execFn = require('./execFn.js')
const { trim, eq, flattenDeep } = require('lodash')
const { to } = require('await-to-js')

module.exports = (config, conn, user = []) => {
    return new Promise((resolve, reject) => {
        const exec = execFn(conn)
        conn.on('ready', async (err) => {
            if (err) reject(err)

            const checkUsername = async (username) => {
                const [err, result] = await to(exec(`echo "${config.password}" | sudo -S chage -l ${username}`))
                if (err) return
                const resultSplitValues = result.split('\n') || []
                const account = {}
                resultSplitValues.forEach(value => {
                    if (!value) return
                    // 返回的结果存在英文或中文
                    const [k, v] = value.includes(':') ? value.split(':') : value.split('：')
                    account[trim(k)] = trim(v)
                });
                const nevers = [account['密码过期时间'] || account['Password expires'], account['密码失效时间'] || account['Password inactive'], account['帐户过期时间'] || account['Account expires']]
                const isNoAllIsNever = nevers.some(never => {
                    return !eq(never, '从不') && !eq(never, 'never')
                })
                return isNoAllIsNever ? '异常' : '正常'
            }


            // 低权限用户密码有效期
            const userPromise = exec(`echo "${config.password}" | sudo -S cut -d: -f1 /etc/passwd`).then(async result => {
                const resultSplitValues = result.split('\n') || []
                const userStatus = user.map(async (u) => {
                    if (resultSplitValues.includes(u)) {
                        return await checkUsername(u)
                    }

                    return ''
                })
                const [err, status] = await to(Promise.all(userStatus))
                return status
            })

            Promise.all([userPromise]).then((result) => {
                const row = [config.host, ...flattenDeep(result), config.env]
                resolve(row)
                conn.end()
            })

        }).connect({
            ...config,
            readyTimeout: 5000
        });
    })

}