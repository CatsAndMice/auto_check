const execFn = require('./execFn.js')
const { trim, gt, eq } = require('lodash')
module.exports = (config, conn) => {
    return new Promise((resolve, reject) => {
        const exec = execFn(conn)
        conn.on('ready', async (err) => {
            if (err) reject(err)
            // 内存剩余比例
            const memPromise = exec('cat /proc/meminfo').then(result => {
                const resultSplitValues = result.split('\n') || []
                const memObj = {}
                resultSplitValues.forEach(value => {
                    if (!value) return
                    const [k, v] = value.split(':')
                    memObj[trim(k)] = trim(v)
                });

                const MemTotal = parseInt(memObj['MemTotal'])
                const MemAvailable = parseInt(memObj['MemAvailable'])
                return `${Math.trunc((MemAvailable / MemTotal) * 100)}%`
            })
            // 磁盘剩余比例
            const dfPromise = exec('df').then(result => {
                const resultSplitValues = result.split('\n') || []
                const dev = {}
                resultSplitValues.splice(1).forEach(value => {
                    if (!value) return
                    const cols = value.split(' ').filter(value => trim(value))
                    const include = cols[0].includes('/dev')
                    const size = parseInt(cols[1])
                    const use = cols[4]
                    if (include) {
                        const curSize = dev['/dev']
                        if (curSize) {
                            if (gt(size, curSize)) {
                                dev['/dev'] = size
                                dev.use = use
                                dev.name = cols[0]
                            }
                        } else {
                            dev['/dev'] = size
                            dev.use = use
                            dev.name = cols[0]
                        }
                    }
                });
                return dev.use
            })

            // 当前用户sudo权限是否有效
            const sudoPromise = exec(`echo "${config.password}" | sudo -S cat /etc/sudoers | grep ${config.username}`).then(result => {
                const isAll = result.includes('ALL=(ALL)')
                const isNoPasswd = result.includes('NOPASSWD:ALL')
                const isRoot = isAll && isNoPasswd
                console.log(result);
                return isRoot ? '正常' : '异常'
            })

            // 日志目录占用的磁盘空间大小是否超出10g
            const logsPromise = exec('du -s /u01/server_logs/*').then(result => {
                const max = 1024 * 1024 * 1024 * 10
                const resultSplitValues = result.split('\n') || []
                let res = ''
                const isGt = resultSplitValues.some(value => {
                    if (!value) return
                    res = value
                    return gt(parseInt(value), max)
                })
                return isGt ? `异常 磁盘空间:${(parseInt(res) / max).toFixed(2)}G` : '正常'
            })

            // root密码有效期
            const rootPromise = exec(`echo "${config.password}" | sudo -S chage -l root`).then(result => {
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
            })

            Promise.all([memPromise, dfPromise, sudoPromise, logsPromise, rootPromise]).then((result) => {
                const row = [config.host, ...result, config.env]
                resolve(row)
                conn.end()
            })

        }).connect({
            ...config,
            readyTimeout: 5000
        });
    })

}