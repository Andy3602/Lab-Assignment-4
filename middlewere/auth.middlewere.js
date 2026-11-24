const jwt = require("jsonwebtoken");
const auth = (req, res, next) => {
  try {
    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : authorization;
    if (!token) return res.status(401).send({ msg: "Login First" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "coding");
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).send({ msg: "Invalid or expired token" });
  }
};

module.exports = { auth };
