import jwt from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        message: "Authentication required",
        status: false,
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWTSECRET);

    req.user = decoded;
    next();
  } catch (error) {
    console.log(error);
    return res.status(StatusCodes.UNAUTHORIZED).json({
      message: "Invalid token",
      status: false,
    });
  }
};

export { authenticate };