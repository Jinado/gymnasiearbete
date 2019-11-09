const express = require("express");
const app = express();

// =======================================
//              MIDDLEWARE
const bodyParser = require("body-parser");
const path = require("path");
const { check, validationResult } = require('express-validator');
const expressSession = require("express-session");
const database = require("./connect");

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
//               FUNCTIONS
// Returns a random integer between 0 and max (excluding max).
// Therefore, random(3) returns either 0, 1, or 2 
// and random(1) would always return 0
function random(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

// Generates a secret to be associated with a specific company
// when that company is added to the database by an admin
// account for the first time.
function generateSecret(){
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let secret = "";
    for(let i = 0; i < 16; i++){
        secret += alphabet[random(alphabet.length)];
    }

    return secret;
}
//             END FUNCTIONS
// =======================================

// =======================================
//                ROUTES
// ROOT route

app.get("/", (req, res) => {
    res.render("pages/index", {title: "Homepage", loggedIn: req.session.loggedIn, errors: req.session.errors});
    res.end();
    req.session.errors = null;
});

app.post("/login", [check("email", "Du måste ange en korrekt E-postadress").isEmail()], async (req, res) => {
    let result = validationResult(req);
    if(result.errors.length !== 0){
        req.session.errors = result.errors;
        req.session.loggedIn = false;
    } else {
        // Check if the credentials match any in the database
        req.session.loggedIn = false;
        let sql = `SELECT email, password FROM users WHERE email LIKE \'${req.body.email}\' AND password LIKE \'${req.body.password}\';`

        const [rows, fields] = await database.fetchData(sql);

        if(rows.length != 0){ // If the length of the row is not 0, it found a valid match
            req.session.loggedIn = true;
            let email = rows[0].email;
        }
        req.session.errors = null;
    }
    res.redirect("/");
});

app.post("/logout", (req, res) => {
    req.session.loggedIn = false;
    res.redirect("/");
});

app.get("/create-account", async (req, res) => {
    res.render("pages/createAccount", {title: "Skapa ett konto", secret: "", readonly: "", compName: "", disabled: "disabled"});
});

app.post("/checked-secret", check("companySecret", "Du måste ange en korrekt företagskod").matches("^(?=.*[A-Za-z]*)(?=.*[0-9]*)(?=.{16,19})"), async (req, res) => {
    let result = validationResult(req);
    if(result.errors.length !== 0){
        req.session.errors = result.errors;
        console.log(result.errors);
    } else {
        let secret = req.body.companySecret; 
        let splitSecret = secret.split("-"); // Make sure to remove any dashes before using the secret in a SQL query
        let formattedSecret = "";
        splitSecret.forEach(part => {
            formattedSecret += part;
        });

        const [rows, fields] = await database.fetchData(`SELECT company FROM companies WHERE secret LIKE \'${formattedSecret}\'`);
        if(rows.length !== 0){
            res.render("pages/createAccount", {title: "Skapa ett konto", secret: secret, readonly: "readonly", compName: rows[0].company, disabled: ""});
        } else {
            res.redirect("/create-account");
        }
    }
});

app.get("/checked-secret", (req, res) => {
    res.redirect("/create-account");
});

app.post("/create-account", [
    check("firstname", "Du måste ange ett korrekt förnamn").isAlphanumeric().isLength({min: 2, max: 255}), // Using Alphanumeric to allow dashes (-) so names like "Ann-Christin" are allowed
    check("lastname", "Du måste ange ett korrekt efternamn").isAlphanumeric().isLength({min: 2, max: 255}),
    check("email", "Du måste ange en korrekt E-postadress").isEmail(),
    check("password", "Lösenordet måste vara minst 8 karaktärer långt, ha en versal, en gemen och en siffra").matches("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,255})"),
    check("repeatPassword", "Lösenordet måste stämma den samma i båda fältet").isLength({min: 8, max: 255}), // Will have to check if the passwords are equal to each other inside the route's callback
    check("seqQuestion", "Din säkerhetsfråga måste vara minst 10 karaktärer lång och max 150").isLength({min: 10, max: 150}),
    check("answer", "Ditt säkerhetssvar måste vara minst 2 karaktärer långt och max 150").isLength({min: 2, max: 150})
], async (req, res) => {
    let result = validationResult(req);
    if(result.errors.length !== 0){
        req.session.errors = result.errors;
        console.log("Oops");
    } else if (req.body.password !== req.body.repeatPassword) {
        req.session.error = "Lösenorden stämmer ej överrens"
    } else { // Everything is correct
        console.log("You did good");
    }
});

app.get("/test", (req, res) => {
    res.send(generateSecret());
});

// 404 - Error
app.get("*", (req, res) => {
    const url = req.protocol + '://' + req.get('host') + req.originalUrl;
    res.render("errors/error404", {url: url, title: "404 - Page not found", loggedIn: req.session.loggedIn, errors: req.session.errors});
});

app.post("*", (req, res) => {
    const url = req.protocol + '://' + req.get('host') + req.originalUrl;
    res.render("errors/error404", {url: url, title: "404 - Page not found", loggedIn: req.session.loggedIn, errors: req.session.errors});
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