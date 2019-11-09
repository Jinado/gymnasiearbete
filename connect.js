connObj = {
    host: "192.168.1.208",
    user: "gamain",
    password: "Timtaga.Ihyli!Ctwba.",
    database: "gymnasiearbete"
};

module.exports = {
    fetchData: async sql =>{
        const mysql = require("mysql2/promise");
        const conn = await mysql.createConnection(connObj);
        const [rows, fields] = await conn.execute(sql, [2, 2]);

        return [rows, fields];
    }
}
