const axios = require("axios");

let taken
axios.post('http://172.30.64.13:2010/todo/apis/session/126/account-authorized', {
    account: "JA016743",
    password: "jingyu@2022",
    tenantId: 1
}, {
    Headers: { "Content-Type": "application/json" }
}).then(data => {
    const { data: result } = data
    taken = result.data

    console.log(taken);
})