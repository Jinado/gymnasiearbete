const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const jwtSecret = require("./secret");

module.exports = {
    authUser: (req, res, next) => {
        // Check if there is a token cookie
        if(req.cookies.token){
            jwt.verify(req.cookies.token, jwtSecret, (err, token) => {
                if(!err){
                    next();
                }else{
                    res.send(err.message);
                }
            });
        }else{
            res.send("No token provided!");
        }
    },
    loginUser: async credentials =>{
        // Hämta användarna
        const users = require("./users");

        // Kollar om användaren finns
        const user = users.filter(u => u.email === credentials.email);

        if(user.length === 1){
            // CHECK PASSWORD AGAINST DATABASE
            const success = await bcrypt.compare(credentials.password, user[0].password);
            if(success){
                const token = jwt.sign({email: user[0].email}, jwtSecret, {expiresIn: "7d"});
                return [token, success];
            }
        }

        return ["no token", false];
    },
    verifyAndRetrieve: recievedCookie => {
        try {
            result = jwt.verify(recievedCookie, jwtSecret);
            return result;
        } catch (error) {
            return null;
        }
    },
    warnedOfCookies: (req, res, next) => {
        if(!req.cookies.warnedOfCookies){
            const url = req.protocol + '://' + req.get('host') + req.originalUrl;
            res.cookie('warnedOfCookies', {warned: true}, {httpOnly: true, sameSite: "Strict"});
            res.render("pages/warnCookie", {url: url});
        } else {
            next();
        }
    }
}