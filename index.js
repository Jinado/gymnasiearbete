const express = require("express");
const app = express();

// =======================================
//              MIDDLEWARE
const bodyParser = require("body-parser");
const path = require("path");

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))
 
// parse application/json
app.use(bodyParser.json())

// Middleware that serves everything in public as a static file (due to this, the "/" route isn't necessary)
app.use(express.static(path.join(__dirname, '/public')));

// View Engine middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/public/ejs'));

//            END MIDDLEWARE
// =======================================



// =======================================
//                ROUTES
// ROOT route
app.get("/", (req, res) => {
    if(req.query.login === "success"){
        res.render("pages/index", {title: "Homepage", loggedIn: true});
    } else {
        res.render("pages/index", {title: "Homepage", loggedIn: false});
    }
});

app.post("/login", (req, res) => {
    const credentials = req.body;
    if(credentials.email === "johannes.emmoth@gmail.com" && credentials.password === "password123"){
        res.redirect("/?login=success");
    } else {
        res.redirect("/")
    }
});

// 404 - Error
app.get("*", (req, res) => {
    const url = req.protocol + '://' + req.get('host') + req.originalUrl;
    res.render("errors/error404", {url: url, title: "404 - Page not found"});
});
//
//              END ROUTES
// =======================================

app.listen(5000, () => console.log("Server listening on port 5000!"));

/*
    Use "lt -p 5000 -s ga-jinado" to run the localtunnel,
    then write the command "node index.js" in a separate terminal to
    start the server.
*/