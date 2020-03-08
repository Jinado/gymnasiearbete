const express = require("express");
const app = express();

// =======================================
//              MIDDLEWARE
const bodyParser = require("body-parser");
const path = require("path");
const { body, check, validationResult } = require('express-validator');
const fs = require("fs");
const jwt = require("jsonwebtoken");
const database = require("./private/modules/connect");
const hash = require("./private/modules/hash");
const auth = require("./private/modules/auth");
const secret = require("./private/modules/secret");
const cookieParser = require('cookie-parser');

// Cookie parser
app.use(cookieParser());

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))
 
// parse application/json
app.use(bodyParser.json())

// Middleware that serves everything in public as a static file
app.use(express.static(path.join(__dirname, '/public')));

// View Engine middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/public/ejs'));

//            END MIDDLEWARE
// =======================================

// =======================================
//                ROUTES
// ROOT route

app.get("/", auth.warnedOfCookies, (req, res) => {
    let tempErrors = [];
    let tempLoggedIn = {loggedIn: false};
    if(req.cookies.errorsAtLogin){ // Populate the error array if there were any errors on login
        tempErrors = req.cookies.errorsAtLogin;
    }

    if(req.cookies.loggedInToken){ // Check if the user is logged in or not
        tempLoggedIn = auth.verifyAndRetrieve(req.cookies.loggedInToken);
        if(tempLoggedIn === null){
            tempLoggedIn = {loggedIn: false};
        }
    }

    res.render("pages/index", {title: "Hem", loggedIn: tempLoggedIn.loggedIn, errors: tempErrors});
});

app.post("/login", [body("email").escape(), body("password").escape(), check("email", "Du måste ange en korrekt E-postadress").isEmail()], async (req, res) => {
    let result = validationResult(req);
    if(result.errors.length !== 0){
        // MaxAge is set so that the error only shows on the page once, if the page then reloads the error won't show again
        res.cookie('errorsAtLogin', result.errors, { httpOnly: true, sameSite: "Strict", maxAge: 1500});

        const loggedInToken = jwt.sign({loggedIn: false}, secret.jwtSecret);
        res.cookie('loggedInToken', loggedInToken, { httpOnly: true, sameSite: "Strict" });
    } else {
        // Check if the credentials match any in the database       
        const [rows, fields] = await database.runStatement("SELECT email, password, IF(site_admin, 'true', 'false') site_admin FROM users WHERE email LIKE ?", [req.body.email]);

        if(rows.length != 0){ // If the length of the row is not 0, it found a valid match
            // Compare the passwords using BCRYPTJS
            if(await hash.compare(req.body.password, rows[0].password)){
                const loggedInToken = jwt.sign({loggedIn: true, email: rows[0].email, siteAdmin: rows[0].site_admin}, secret.jwtSecret);
                res.cookie('loggedInToken', loggedInToken, { httpOnly: true, sameSite: "Strict" });
            } else {
                res.cookie('errorsAtLogin', [{msg: "Inkorrekt lösenord eller E-postadress"}], { httpOnly: true, sameSite: "Strict", maxAge: 1500});
            }
        } else {
            res.cookie('errorsAtLogin', [{msg: "Inkorrekt lösenord eller E-postadress"}], { httpOnly: true, sameSite: "Strict", maxAge: 1500});
        }
    }
    res.redirect("/");
});

app.post("/logout", (req, res) => {
    res.clearCookie('loggedInToken');
    res.redirect("/");
});

app.get("/create-account", auth.warnedOfCookies, async (req, res) => {
    let tempErrors = [];
    if(req.cookies.errorsAtSignUp){ // Populate the error array if there were any errors at sign up
        tempErrors = req.cookies.errorsAtSignUp;
    }

    // The cookie signUpCookie stores information about the current state of the sign up process by storing specific values
    // that decide wether or not some text fields should now be editable or not.
    if(req.cookies.signUpCookie){
        const tempSignUp = auth.verifyAndRetrieve(req.cookies.signUpCookie);
        if(tempSignUp !== null){
            res.render("pages/createAccount", {title: "Skapa ett konto", errors: tempErrors, secret: tempSignUp.secret, readonly: tempSignUp.readonly, compName: tempSignUp.compname, disabled: tempSignUp.disabled});
        } else {
            res.redirect("/");
        }
    } else {
        res.render("pages/createAccount", {title: "Skapa ett konto", errors: tempErrors, secret: "", readonly: "", compName: "", disabled: "disabled"});
    }
});

app.post("/checked-secret", body("companySecret").escape(), check("companySecret", "Du måste ange en korrekt företagskod").matches("^(?=.*[A-Za-z]*)(?=.*[0-9]*)(?=.{16,19})"), async (req, res) => {
    let result = validationResult(req);
    if(result.errors.length !== 0){
        // MaxAge is set so that the error only shows on the page once, if the page then reloads the error won't show again
        res.cookie('errorsAtSignUp', result.errors, { httpOnly: true, sameSite: "Strict", maxAge: 1500});
    } else {
        let secretCode = req.body.companySecret;
        let formattedSecret = secret.prepareForDB(secretCode); // Remove any dashes inside the string before using it in a SQL-statement

        const [rows, fields] = await database.runStatement("SELECT company FROM companies WHERE secret LIKE ?;", [formattedSecret]);
        if(rows.length !== 0){
            const signUpCookie = jwt.sign({secret: secretCode, readonly: "readonly", compname: rows[0].company, disabled: ""}, secret.jwtSecret);
            res.cookie('signUpCookie', signUpCookie, {httpOnly: true, sameSite: "Strict", maxAge: 5000});
        } else {
            res.cookie('errorsAtSignUp', [{msg: "Denna kod är ogiltig"}], { httpOnly: true, sameSite: "Strict", maxAge: 1500});
        }
    }
    res.redirect("/create-account");
});

// Makes sure this route is inaccessible if someone tries to access it with a GET request.
app.get("/checked-secret", auth.warnedOfCookies, (req, res) => {
    res.redirect("/create-account");
});

app.post("/create-account", [
    body("firstname").escape(),
    body("lastname").escape(),
    body("email").escape(),
    body("password").escape(),
    body("repeatPassword").escape(),
    body("seqQuestion").escape(),
    body("answer").escape(),
    check("firstname", "Du måste ange ett korrekt förnamn").isAlphanumeric().isLength({min: 2, max: 255}), // Using Alphanumeric to allow dashes (-) so names like "Ann-Christin" are allowed, should probably change for RegEx
    check("lastname", "Du måste ange ett korrekt efternamn").isAlphanumeric().isLength({min: 2, max: 255}),
    check("email", "Du måste ange en korrekt E-postadress").not().isEmpty().isEmail(),
    check("password", "Lösenordet måste vara minst 8 karaktärer långt, ha en versal, en gemen och en siffra").matches("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,255})"),
    check("repeatPassword", "Båda lösenorden måste matcha varandra").matches("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,255})"), // Will have to check if the passwords are equal to each other inside the route's callback
    check("seqQuestion", "Din säkerhetsfråga måste vara minst 10 karaktärer lång och max 150").isLength({min: 10, max: 150}),
    check("answer", "Ditt säkerhetssvar måste vara minst 2 karaktärer långt och max 150").isLength({min: 2, max: 150})
], async (req, res) => {
    let result = validationResult(req);
    if(result.errors.length !== 0){
        let tempErrors = result.errors;
        let counter = 0;
        for(let i = 0; i < tempErrors.length; i++){
            if(tempErrors[i].param !== "email"){
                counter++;
            }
        }

        if(counter === tempErrors.length){ // If it returns true, there's nothing wrong with the email adress according to express-validator
            // Check to see if that email is already registered
            let [rows, fields] = await database.runStatement("SELECT email FROM users WHERE email LIKE ?", [req.body.email]);
            if(rows.length > 0){
                if(tempErrors === undefined){
                    tempErrors = [{value: req.body.email, msg: "Denna E-postadress är upptagen", param: "email", location: "body"}];
                } else {
                    tempErrors.push({value: req.body.email, msg: "Denna E-postadress är upptagen", param: "email", location: "body"});
                }
            }
        }
        res.cookie('errorsAtSignUp', tempErrors, { httpOnly: true, sameSite: "Strict", maxAge: 1500});
    } else if (req.body.password !== req.body.repeatPassword) {
        if(req.cookies.errorsAtSignUp === undefined){
            let tempErrors = req.cookies.errorsAtSignUp;
            tempErrors = [{value: "****", msg: "Lösenorden stämmer ej överrens", param: "password", location: "body"}];
            res.cookie('errorsAtSignUp', tempErrors, { httpOnly: true, sameSite: "Strict", maxAge: 1500});
        } else {
            let tempErrors = req.cookies.errorsAtSignUp;
            tempErrors.push({value: "****", msg: "Lösenorden stämmer ej överrens", param: "password", location: "body"});
            res.cookie('errorsAtSignUp', tempErrors, { httpOnly: true, sameSite: "Strict", maxAge: 1500});
        }
    } else { // Everything is correct
        // Hash the password and the secret answer
        const hashedPass = await hash.hashString(req.body.password);
        const hashedAnswer = await hash.hashString(req.body.answer);

        sqlVariablesArray = [req.body.email, hashedPass, req.body.seqQuestion, hashedAnswer, req.body.firstname, req.body.lastname, req.body.company];

        // Check to see if that email is already registered
        let [rows, fields] = await database.runStatement("SELECT email FROM users WHERE email LIKE ?", [req.body.email]);
        if(rows.length > 0){
            if(req.cookies.errorsAtSignUp === undefined){
               let tempErrors = [{value: req.body.email, msg: "Denna E-postadress är upptagen", param: "email", location: "body"}];
               res.cookie('errorsAtSignUp', tempErrors, { httpOnly: true, sameSite: "Strict", maxAge: 1500});
            } else {
                let tempErrors = req.cookies.errorsAtSignUp;
                tempErrors.push({value: req.body.email, msg: "Denna E-postadress är upptagen", param: "email", location: "body"});
                res.cookie('errorsAtSignUp', tempErrors, { httpOnly: true, sameSite: "Strict", maxAge: 1500});
            }
            res.redirect("/create-account");
        } else {
            [rows, fields] = await database.runStatement("INSERT INTO users (email, password, security_question, answer, first_name, last_name, company) VALUES (?, ?, ?, ?, ?, ?, ?)", sqlVariablesArray);
            res.clearCookie('errorsAtSignUp');
            res.redirect("/");
            return;
        }
    }
    res.redirect("/create-account");
});

app.get("/my-pages", auth.warnedOfCookies, auth.authUser, async (req, res) => {
    let tempErrors = [];
    if(req.cookies.errorsAtMyPages){
        tempErrors = req.cookies.errorsAtMyPages;
    }

    const tempAccountToken = auth.verifyAndRetrieve(req.cookies.loggedInToken);

    const [userRows, userFields] = await database.runStatement("SELECT first_name, last_name, IF(site_admin, 'true', 'false') site_admin FROM users WHERE email LIKE ?", [tempAccountToken.email]);
    const [raspRows, raspFields] = await database.runStatement("SELECT name, string FROM raspberries WHERE email LIKE ?", [tempAccountToken.email]);
    res.render("pages/myPages", {title: "Mina sidor", errors: tempErrors, loggedIn: tempAccountToken.loggedIn, firstname: userRows[0].first_name, lastname: userRows[0].last_name, siteAdmin: userRows[0].site_admin, raspData: raspRows});
});

app.post("/raspberries/add", auth.warnedOfCookies, auth.authUser, [
    body("screenName").escape(),
    body("screenText").escape(),
    check("screenName", "Namnet kan ej vara tomt").not().isEmpty(),
], async (req, res) => {
    let result = validationResult(req);
    if(result.errors.length == 0){
        // Get the users mail adress
        const tempLoggedIn = auth.verifyAndRetrieve(req.cookies.loggedInToken);
        if(tempLoggedIn !== null){
            const [companyRows, companyFields] = await database.runStatement("SELECT company FROM users WHERE email LIKE ?;", [tempLoggedIn.email]);

            // Check if the name of the screen already exists in the database
            const [raspRows, raspFields] = await database.runStatement("SELECT name FROM raspberries WHERE email LIKE ?;", [tempLoggedIn.email]);
            let nameIsUnique = true;
            // Check if name is unique
            if(raspRows.length !== 0){
                raspRows.forEach(row => {
                    if(row.name === req.body.screenName){
                        nameIsUnique = false;
                    }
                });
            }

            // Add the PI if the name is unique
            if(nameIsUnique){
                await database.runStatement("INSERT INTO raspberries (email, company, name, string) VALUES (?, ?, ?, ?)", [tempLoggedIn.email, companyRows[0].company, req.body.screenName, req.body.screenText]);
                res.redirect("/my-pages?raspAdd=success");
            } else {
                res.cookie('errorsAtMyPages', [{msg: "Namnet är ej unikt"}], { httpOnly: true, sameSite: "Strict", maxAge: 1500});
                res.redirect("/my-pages");
            }
        } else { 
            res.redirect("/");
        }
    } else {
        res.cookie('errorsAtMyPages', result.errors, { httpOnly: true, sameSite: "Strict", maxAge: 1500});
        res.redirect("/my-pages");
    } 
});

app.post("/raspberries/delete", body("screenNameDel").escape(), auth.warnedOfCookies, auth.authUser, async (req, res) => {
    // Get the users mail adress
    const tempLoggedIn = auth.verifyAndRetrieve(req.cookies.loggedInToken);
    if(tempLoggedIn !== null){
        // Due to the fact that I am escaping the string one more time, each & changes to &amp; so I need to change it back first
        let screenName = req.body.screenNameDel.replace(/&amp;/g, "&");
        await database.runStatement("DELETE FROM raspberries WHERE email LIKE ? AND name LIKE ?", [tempLoggedIn.email, screenName]);
        res.redirect("/my-pages?delete=success");
    } else {
        res.redirect("/");
    }
});

app.get("/manage-companies", auth.warnedOfCookies, auth.isAdmin, async (req, res) => {
    let tempErrors = [];
    if(req.cookies.errorsAtManageCompanies){
        tempErrors = req.cookies.errorsAtManageCompanies;
    }

    const tempAccountToken = auth.verifyAndRetrieve(req.cookies.loggedInToken);
    // The below if-else statements are used to display different data on the /manage-companies page
    // depending on what actions the user has performed
    if(tempAccountToken !== null){
        const [rows, fields] = await database.runStatement("SELECT company FROM companies", null);
        if(req.query.delete === 'success'){
            res.render('pages/manageCompanies', {
                title: "Manage Companies",
                errors: tempErrors, 
                loggedIn: tempAccountToken.loggedIn, 
                companies: rows,
                add: 'fail', 
                delete: req.query.delete,
                secret: '',
                accounts: '',
                searchedCompany: null,
                genCode: 'XXXX-XXXX-XXXX-XXXX',
                disabled: 'disabled'});
        } else if (req.query.secret && req.query.accounts && req.query.company){
            res.render('pages/manageCompanies', {
                title: "Manage Companies",
                errors: tempErrors,  
                loggedIn: tempAccountToken.loggedIn, 
                companies: rows,
                add: 'fail', 
                delete: 'fail',
                secret: secret.makeReadable(req.query.secret),
                accounts: req.query.accounts,
                searchedCompany: req.query.company,
                genCode: 'XXXX-XXXX-XXXX-XXXX',
                disabled: 'disabled'});
        } else if (req.query.add === 'success'){
            res.render('pages/manageCompanies', {
                title: "Manage Companies",
                errors: tempErrors,  
                loggedIn: tempAccountToken.loggedIn, 
                companies: rows,
                add: req.query.add, 
                delete: 'fail',
                secret: '',
                accounts: '',
                searchedCompany: null,
                genCode: 'XXXX-XXXX-XXXX-XXXX',
                disabled: 'disabled'});
        } else if (req.query.genCode){
            res.render('pages/manageCompanies', {
                title: "Manage Companies", 
                errors: tempErrors, 
                loggedIn: tempAccountToken.loggedIn, 
                companies: rows,
                add: 'fail', 
                delete: 'fail',
                secret: '',
                accounts: '',
                searchedCompany: null,
                genCode: secret.makeReadable(req.query.genCode),
                disabled: ''});
        } else {
            res.render('pages/manageCompanies', {
                title: "Manage Companies", 
                errors: tempErrors, 
                loggedIn: tempAccountToken.loggedIn, 
                companies: rows,
                add: 'fail', 
                delete: 'fail',
                secret: '',
                accounts: '',
                searchedCompany: null,
                genCode: 'XXXX-XXXX-XXXX-XXXX',
                disabled: 'disabled'});
        }
    }else {
        res.redirect("/");
    }
});

// This route simply deletes a company from the database
app.post("/manage-companies/delete", auth.warnedOfCookies, auth.isAdmin, async (req, res) => {
    await database.runStatement("DELETE FROM companies WHERE company LIKE ?", [req.body.selectedCompany]);
    await database.runStatement("DELETE FROM users WHERE company LIKE ?", [req.body.selectedCompany]);
    await database.runStatement("DELETE FROM raspberries WHERE company LIKE ?", [req.body.selectedCompany]);
    res.redirect("/manage-companies?delete=success");
});

// This route generates a new and unique code for a new company being added to the database
app.post("/manage-companies/generate-code", auth.warnedOfCookies, auth.isAdmin, async (req, res) => {
    let secretCode = "";
    do { // I use a DO-WHILE loop to make sure the "generateCompanySecret" method gets run at least once
        secretCode = secret.generateCompanySecret();
    } while (!(await secret.isUnique(secretCode)));

    res.redirect(`/manage-companies?genCode=${secretCode}`);
});

// This route adds a company to the database. This route is only accessible after a valid, unique, company secret has been
// generated by the above route
app.post("/manage-companies/add", [
    body("addCompanySecret").escape(), 
    check("compname", "Namnet kan ej vara tomt").not().isEmpty(), 
    check("addCompanySecret", "Det måste finnas en företagskod att associera med företaget").not().isEmpty()
], auth.warnedOfCookies, auth.isAdmin, async (req, res) => {
    let result = validationResult(req);
    if(result.errors.length == 0){
        // Check if the name of the company already exists in the database
        const [rows, fields] = await database.runStatement("SELECT company FROM companies;", null);
        let nameIsUnique = true;
        // Check if name is unique
        if(rows.length !== 0){
            rows.forEach(row => {
                if(row.company === req.body.compname){
                    nameIsUnique = false;
                }
            });
        }

        if(nameIsUnique){
            await database.runStatement("INSERT INTO companies (company, secret) VALUE (?, ?);", [req.body.compname, secret.prepareForDB(req.body.addCompanySecret)]);
            res.redirect(`/manage-companies?add=success`);
        } else {
            if(req.cookies.errorsAtManageCompanies === undefined){
                res.cookie('errorsAtManageCompanies', [{msg: "Ett företag med detta namn är redan regristrerat"}], { httpOnly: true, sameSite: "Strict", maxAge: 1500});
                res.redirect(`/manage-companies`);
            } else {
                let tempErrors = req.cookies.errorsAtManageCompanies;
                tempErrors.push({msg: "Ett företag med detta namn är redan regristrerat"});
                res.cookie('errorsAtManageCompanies', tempErrors, { httpOnly: true, sameSite: "Strict", maxAge: 1500});
                res.redirect(`/manage-companies`);
            }
        }
    } else {
        res.cookie('errorsAtManageCompanies', result.errors, { httpOnly: true, sameSite: "Strict", maxAge: 1500});
        res.redirect(`/manage-companies`);
    }
});

// This route fetches some information about the company, and most importantly, its secret code
app.post("/manage-companies/info", auth.warnedOfCookies, auth.isAdmin, async (req, res) => {
    const [secretRows, secretFields] = await database.runStatement("SELECT secret FROM companies WHERE company LIKE ?", [req.body.selectedCompany]);
    const [accountRows, accountFields] = await database.runStatement("SELECT email FROM users WHERE company LIKE ?", [req.body.selectedCompany]);
    res.redirect(`/manage-companies?company=${req.body.selectedCompany}&secret=${secretRows[0].secret}&accounts=${accountRows.length}`);
});

// This route downloads a text file with a JSON formatted string onto the user's computer that shows them what data the webpage has on them.
app.post("/download", auth.authUser, async (req, res) => {
    if(req.cookies.loggedInToken){
        const loggedInToken = auth.verifyAndRetrieve(req.cookies.loggedInToken);
        if(loggedInToken !== null){
            let [rowsFetchedUserData, fieldsUserData] = await database.runStatement("SELECT * FROM users WHERE email LIKE ?", [loggedInToken.email]);
            let [rowsFetchedRaspData, fieldsRaspData] = await database.runStatement("SELECT * FROM raspberries WHERE email LIKE ?", [rowsFetchedUserData[0].email]);;
    
            // Remove all unnecessary data like passwords and user_id:s
            let rowsUserData = [];
            rowsFetchedUserData.forEach(el => {
                rowsUserData.push({email: el.email, security_question: el.security_question, first_name: el.first_name, last_name: el.last_name, company: el.company});
            });
    
            // Remove all unnecessary data like rasp_id:s
            let rowsRaspData = [];
            rowsFetchedRaspData.forEach(el => {
                rowsRaspData.push({email: el.email, company: el.company, name: el.name, text: el.string});
            });
            
            // Name the file with the user's email and the current date.
            let date = new Date();
            date = date.toISOString().slice(0,19);
            date = date.replace("T", "_").replace(/[^0-9-_]/g, "-");
            let writeStream = fs.createWriteStream(path.join(__dirname, "/private/data/", `${rowsUserData[0].email}_${date}.txt`), { encoding: 'utf8' });
            let dataArray = rowsUserData.concat(rowsRaspData);
    
            // Write the fetched user data to the file
            writeStream.write(JSON.stringify(dataArray), err => {if(err) {console.log(err);}});
            writeStream.end();
    
            // Download the file after the data has been written to it
            writeStream.on("finish", () => {
                res.download(path.join(__dirname, "/private/data/", `${rowsUserData[0].email}_${date}.txt`), `${rowsUserData[0].email}_${date}.txt`, err => {
                    if(err) {
                        console.log(err)
                    } else {
                        // Delete the file off of the server if there were no errors downloading it
                        fs.unlink(path.join(__dirname, "/private/data/", `${rowsUserData[0].email}_${date}.txt`), err => {if (err) console.log(err);});
                    }
                });
            });
        } else {
            res.redirect("/");
        }
    } else {
        res.redirect("/");
    }   
});

// 404 - Error
app.get("*", auth.warnedOfCookies, (req, res) => {
    const url = req.protocol + '://' + req.get('host') + req.originalUrl;
    let tempLoggedIn = false;
    if(req.cookies.loggedInToken){
        tempLoggedIn = auth.verifyAndRetrieve(req.cookies.loggedInToken);
    }
    res.render("errors/error404", {url: url, title: "404 - Page not found", loggedIn: tempLoggedIn});
});

app.post("*", auth.warnedOfCookies, (req, res) => {
    const url = req.protocol + '://' + req.get('host') + req.originalUrl;
    let tempLoggedIn = false;
    if(req.cookies.loggedInToken){
        tempLoggedIn = auth.verifyAndRetrieve(req.cookies.loggedInToken);
    }
    res.render("errors/error404", {url: url, title: "404 - Page not found", loggedIn: tempLoggedIn});
});
//
//              END ROUTES
// =======================================

app.listen(5000, () => console.log("Server listening on port 5000!"));