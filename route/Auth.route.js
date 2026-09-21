import { register, login, me, logout } from "../controller/Auth.controller.js";
import { Router } from "express";
import { authenticate } from "../middleware/Auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, me);

export default router;