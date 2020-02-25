/* ============================== DOCUMENTATION FOR BELOW CODE =====================================
FUNCTION - _VERIFYANDRETRIEVE: A private function that is used to verify a cookie containing a JSON
Web Token as well as retrieving its data and returning it to the caller.

METHOD - AUTHUSER: Checks to see if a user is logged in. Used as middleware in routes.

METHOD - LOGINUSER: Unfinished function that will later be used to log a user in, to outsource some
of the code in index.js.

METHOD - VERIFYANDRETRIEVE: A public method which is a copy of the private _verifyAndRetrieve
function. The code needed to be written this way so that I could use this function in another
method inside this file.

METHOD - WARNEDOFCOOKIES: This is middleware to check if a user has been warned that this website
uses cookies.

METHOD - ISADMIN: This is middleware that checks if a user has admin privileges.
==================================================================================================== */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const secret = require("./secret");

const _verifyAndRetrieve = recievedCookie => {
    try {
        result = jwt.verify(recievedCookie, secret.jwtSecret);
        return result;
    } catch (error) {
        return null;
    }
};

module.exports = {
    authUser: (req, res, next) => {
        // Check if there is a token cookie
        if(req.cookies.loggedInToken){
            jwt.verify(req.cookies.loggedInToken, secret.jwtSecret, (err, token) => {
                if(!err){
                    next();
                }else{
                    res.send(err.message);
                }
            });
        }else{
            res.redirect("/");
        }
    },
    verifyAndRetrieve: _verifyAndRetrieve,
    warnedOfCookies: (req, res, next) => {
        if(!req.cookies.warnedOfCookies){
            const url = req.protocol + '://' + req.get('host') + req.originalUrl;
            res.cookie('warnedOfCookies', {warned: true}, {httpOnly: true, sameSite: "Strict"});
            res.render("pages/warnCookie", {url: url});
        } else {
            next();
        }
    },
    isAdmin: (req, res, next) =>{
        if(req.cookies.loggedInToken){
            const tempLoggedIn = _verifyAndRetrieve(req.cookies.loggedInToken);
            if(tempLoggedIn.siteAdmin === 'true'){
                next();
            } else {
                res.redirect("/my-pages");
            }
        } else {
            res.redirect("/my-pages");
        }
    }
}