/* ================================== DOCUMENTATION FOR BELOW CODE =========================================
OBJECT - CONNOBJ: A JavaScript objecting containing information needed to connect to the MySQL database. 

METHOD - RUNSTATEMENT: Takes a SQL-statement as its first argument, and then an array of values (or null for 
nothing) as its second argument. The values stored inside the "queries" array will then replace, in 
the order they come, the question marks inside the SQL-statement, if any. This is done to avoid 
SQL-injection.
============================================================================================================= */

connObj = {
    host: "192.168.1.208",
    user: "gamain",
    password: "Timtaga.Ihyli!Ctwba.",
    database: "gymnasiearbete"
};

module.exports = {
    runStatement: async (sqlStatement, queries) =>{
        const mysql = require("mysql2/promise");
        const conn = await mysql.createConnection(connObj);
        const result = await conn.execute(sqlStatement, queries);

        return result;
    }
}
