const { toArray } = require('lodash')

module.exports = (config = []) => {
    let users = []
    config.forEach(c => {

        const { users: linuxUsers } = c
        users = users.concat(linuxUsers)
    })
    console.log(users);
    return toArray(new Set(users)).sort((a, b) => a - b)

}