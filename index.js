const express = require("express");
const app = express();

// =======================================
//              MIDDLEWARE
const bodyParser = require("body-parser");
const path = require("path");
const { check, validationResult } = require('express-validator');
const expressSession = require("express-session");

// Express validator and session middleware
app.use(expressSession({
    secret: "HSFJ12321ASKJSAgdgAF#%gdu!!hjahfj!!kaQWABNFJWgdgs%Af56##21jSNBJFKSA76412MLFNIJUF",
    saveUninitialized: false,
    resave: false
}));

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
    res.render("pages/index", {title: "Homepage", loggedIn: req.session.loggedIn, errors: req.session.errors});
    req.session.errors = null;
});

app.post("/login", [check("email", "Du måste ange en korrekt E-postadress").isEmail()], (req, res) => {
    let result = validationResult(req);
    if(result.errors.length !== 0){
        req.session.errors = result.errors;
        req.session.loggedIn = false;
    } else {
        // Check if the credentials match any in the database
        req.session.loggedIn = false;
        if(req.body.email === "johannes.emmoth@gmail.com" && req.body.password === "password123"){
            req.session.loggedIn = true;
        }

        req.session.errors = null;
    }
    res.redirect("/");
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
    Use "lt -p 5000 -s ga-johannes" to run the localtunnel,
    then write the command "node index.js" in a separate terminal to
    start the server.
*/