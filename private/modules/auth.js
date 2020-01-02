const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const secret = require("./secret");

module.exports = {
    authUser: (req, res, next) => {
        // Check if there is a token cookie
        if(req.cookies.token){
            jwt.verify(req.cookies.token, secret, (err, token) => {
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
                const token = jwt.sign({email: user[0].email}, secret, {expiresIn: "7d"});
                return [token, success];
            }
        }

        return ["no token", false];
    }
}