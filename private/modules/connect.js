connObj = {
    host: "192.168.1.208",
    user: "galaptop", // gamain is standard user
    password: "Timtaga.Ihyli!Ctwba.",
    database: "gymnasiearbete"
};

module.exports = {
    // Hämta data från databasen med en custom SQL-statement.
    runStatement: async (sqlStatement, queries) =>{
        const mysql = require("mysql2/promise");
        const conn = await mysql.createConnection(connObj);
        const result = await conn.execute(sqlStatement, queries);

        return result;
    }
}