const express = require("express");
const app = express();

// =======================================
//              MIDDLEWARE
const bodyParser = require("body-parser");
const path = require("path");
const { check, validationResult } = require('express-validator');
const expressSession = require("express-session");
const fs = require("fs");
const database = require("./private/modules/connect");
const hash = require("./private/modules/hash");
const auth = require("./private/modules/auth");


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

function resetSignUpSessions(req){
    req.session.secret = "";
    req.session.readonly = "";
    req.session.compName = "";
    req.session.disabled = "disabled";
}
//             END FUNCTIONS
// =======================================

// =======================================
//                ROUTES
// ROOT route

app.get("/", (req, res) => {
    resetSignUpSessions(req);

    res.render("pages/index", {title: "Hem", loggedIn: req.session.loggedIn, errors: req.session.errors});
    req.session.errors = null;
});

app.post("/login", [check("email", "Du måste ange en korrekt E-postadress").isEmail()], async (req, res) => {
    resetSignUpSessions(req);

    let result = validationResult(req);
    if(result.errors.length !== 0){
        req.session.errors = result.errors;
        req.session.loggedIn = false;
    } else {
        // Check if the credentials match any in the database
        req.session.loggedIn = false;
        
        sqlVariablesArray = [req.body.email]; // Skickar med värdet som en array då metoden kräver detta
        const [rows, fields] = await database.runStatement("SELECT email, password FROM users WHERE email LIKE ?", [req.body.email]);

        if(rows.length != 0){ // If the length of the row is not 0, it found a valid match
            // Compare the passwords using BCRYPTJS
            if(await hash.compare(req.body.password, rows[0].password)){
                req.session.loggedIn = true;
                req.session.email = rows[0].email;
            }
        }
        req.session.errors = null;
    }
    res.redirect("/");
});

app.post("/logout", (req, res) => {
    resetSignUpSessions(req);

    req.session.loggedIn = false;
    req.session.email = null;
    res.redirect("/");
});

app.get("/create-account", async (req, res) => {
    res.render("pages/createAccount", {title: "Skapa ett konto", secret: req.session.secret, readonly: req.session.readonly, compName: req.session.compName, disabled: req.session.disabled});
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

        sqlVariablesArray = [formattedSecret]; // Skickar med värdet som en array då metoden kräver detta
        const [rows, fields] = await database.runStatement("SELECT company FROM companies WHERE secret LIKE ?;", sqlVariablesArray);
        if(rows.length !== 0){
            req.session.secret = secret;
            req.session.readonly = "readonly";
            req.session.compName = rows[0].company;
            req.session.disabled = "";

            res.redirect("/create-account");
        } else {
            res.redirect("/create-account");
        }
    }
});

app.get("/checked-secret", (req, res) => {
    resetSignUpSessions(req);
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
        let counter = 0;
        for(let i = 0; i < req.session.errors.length; i++){
            if(req.session.errors[i].param !== "email"){
                counter++;
            }
        }

        if(counter === req.session.errors.length){ // If it returns true, there's nothing wrong with the email adress according to express-validator
            // Check to see if that email is already registered
            let [rows, fields] = await database.runStatement("SELECT email FROM users WHERE email LIKE ?", [req.body.email]);
            if(rows.length > 0){
                if(req.session.errors === undefined){
                    req.session.errors = [{value: req.body.email, msg: "Denna E-postadress är upptagen", param: "email", location: "body"}];
                } else {
                    req.session.errors.push({value: req.body.email, msg: "Denna E-postadress är upptagen", param: "email", location: "body"});
                }
            }
        }
        console.log(req.session.errors);
    } else if (req.body.password !== req.body.repeatPassword) {
        if(req.session.errors === undefined){
            req.session.errors = [{value: "****", msg: "Lösenorden stämmer ej överrens", param: "password", location: "body"}];
        } else {
            req.session.errors.push({value: "****", msg: "Lösenorden stämmer ej överrens", param: "password", location: "body"});
        }
    } else { // Everything is correct
        // Hash the password and the secret answer
        const hashedPass = await hash.hashPass(req.body.password);
        const hashedAnswer = await hash.hashAnswer(req.body.answer);

        sqlVariablesArray = [req.body.email, hashedPass, req.body.seqQuestion, hashedAnswer, req.body.firstname, req.body.lastname, req.body.company];

        // Check to see if that email is already registered
        let [rows, fields] = await database.runStatement("SELECT email FROM users WHERE email LIKE ?", [req.body.email]);
        if(rows.length > 0){
            if(req.session.errors === undefined){
                req.session.errors = [{value: req.body.email, msg: "Denna E-postadress är upptagen", param: "email", location: "body"}];
            } else {
                req.session.errors.push({value: req.body.email, msg: "Denna E-postadress är upptagen", param: "email", location: "body"});
            }
            console.log(req.session.errors);
            res.redirect("/create-account");
        } else {
            [rows, fields] = await database.runStatement("INSERT INTO users (email, password, security_question, answer, first_name, last_name, company) VALUES (?, ?, ?, ?, ?, ?, ?)", sqlVariablesArray);
            res.redirect("/");
        }
    }

});

app.get("/my-pages", async (req, res) => {
    resetSignUpSessions(req);
    const [rows, fields] = await database.runStatement("SELECT first_name, last_name FROM users WHERE email LIKE ?", [req.session.email]);
    res.render("pages/myPages", {title: "Mina sidor", loggedIn: req.session.loggedIn, firstname: rows[0].first_name, lastname: rows[0].last_name});
});

app.post("/download", async (req, res) => {
    if(req.session.loggedIn){
        let [rowsFetchedUserData, fieldsUserData] = await database.runStatement("SELECT * FROM users WHERE email LIKE ?", [req.session.email]);
        let [rowsFetchedRaspData, fieldsRaspData] = await database.runStatement("SELECT * FROM raspberries WHERE email LIKE ?", [rowsFetchedUserData[0].email]);;

        // Remove all unnecessary data like passwords and user_id:s
        let rowsUserData = [];
        rowsFetchedUserData.forEach(el => {
            rowsUserData.push({email: el.email, security_question: el.security_question, first_name: el.first_name, last_name: el.last_name, company: el.company});
        });

        // Remove all unnecessary data like rasp_id:s
        let rowsRaspData = [];
        rowsFetchedRaspData.forEach(el => {
            rowsRaspData.push({email: el.email, string: el.string});
        });
        
        let date = new Date();
        date = date.toISOString().slice(0,19);
        date = date.replace("T", "_").replace(/[^0-9-_]/g, "-");
        let writeStream = fs.createWriteStream(path.join(__dirname, "/private/data/", `${rowsUserData[0].email}_${date}.txt`), { encoding: 'utf8' });
        let dataArray = rowsUserData.concat(rowsRaspData);

        // Skriv datan till filen
        writeStream.write(JSON.stringify(dataArray), err => {if(err) {console.log(err);}});
        writeStream.end();

        // Ladda ner filen EFTER att filen är skriven
        writeStream.on("finish", () => {
            res.download(path.join(__dirname, "/private/data/", `${rowsUserData[0].email}_${date}.txt`), `${rowsUserData[0].email}_${date}.txt`, err => {
                if(err) {
                    console.log(err)
                } else {
                    // Delete the file if there were no errors downloading it
                    fs.unlink(path.join(__dirname, "/private/data/", `${rowsUserData[0].email}_${date}.txt`), err => {if (err) console.log(err);});
                }
            });
        });
    } else {
        res.redirect("/");
    }
});

app.get("/test", async (req, res) => {
    resetSignUpSessions(req);
    res.send(generateSecret());
});

// 404 - Error
app.get("*", (req, res) => {
    resetSignUpSessions(req);
    const url = req.protocol + '://' + req.get('host') + req.originalUrl;
    res.render("errors/error404", {url: url, title: "404 - Page not found", loggedIn: req.session.loggedIn});
});

app.post("*", (req, res) => {
    resetSignUpSessions(req);
    const url = req.protocol + '://' + req.get('host') + req.originalUrl;
    res.render("errors/error404", {url: url, title: "404 - Page not found", loggedIn: req.session.loggedIn});
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