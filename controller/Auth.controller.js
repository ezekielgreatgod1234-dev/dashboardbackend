import User from "../model/User.model.js";
import { StatusCodes } from "http-status-codes";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";


const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, fullName: user.fullName, email: user.email, role: user.role },
    process.env.JWTSECRET,
    { expiresIn: "7d" }
  );
};

const formatUser = (user) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  gender: user.gender,
  country: user.country,
  dateOfBirth: user.dateOfBirth,
  role: user.role,
});

const register = async (req, res) => {
  try {
    const { fullName, email, gender, country, dateOfBirth, password } =
      req.body;

    if (!fullName || !email || !gender || !country || !dateOfBirth || !password) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Please input all fields",
        status: false,
      });
    }

    if (password.length < 6) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Password must contain at least 6 characters",
        status: false,
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Email already exist",
        status: false,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName,
      email,
      gender,
      country,
      dateOfBirth,
      password: hashedPassword,
    });

    const token = generateToken(user);

    res.status(StatusCodes.CREATED).json({
      message: "Account has been created",
      token,
      user: formatUser(user),
      status: true,
    });
  } catch (error) {
    console.log(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Oops something went wrong",
      status: false,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Please input all fields",
        status: false,
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "User not found",
        status: false,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        message: "Invalid credentials",
        status: false,
      });
    }

    const token = generateToken(user);

    res.status(StatusCodes.OK).json({
      message: "Login successful",
      user: formatUser(user),
      token,
      status: true,
    });
  } catch (error) {
    console.log(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Oops something went wrong",
      status: false,
    });
  }
};

// Used by the frontend on page load / refresh to verify the stored
// token is still valid and to rehydrate the logged-in user.
const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "User not found",
        status: false,
      });
    }

    res.status(StatusCodes.OK).json({
      message: "User fetched",
      user: formatUser(user),
      status: true,
    });
  } catch (error) {
    console.log(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Oops something went wrong",
      status: false,
    });
  }
};

// JWTs are stateless, so there's nothing to invalidate server-side —
// this endpoint just gives the frontend a clean call to make before
// it clears the token locally.
const logout = async (req, res) => {
  res.status(StatusCodes.OK).json({
    message: "Logged out",
    status: true,
  });
};

export { register, login, me, logout };