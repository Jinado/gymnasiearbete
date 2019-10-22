const mysql = require("mysql");

const conn = mysql.createConnection({
    host: "192.168.1.208",
    user: "gamain",
    password: "Timtaga.Ihyli!Ctwba.",
    database: "gymnasiearbete"
});


exports.conn = conn;

conn.connect(err => {
    if(err) throw err;
    console.log("Connected!");
});