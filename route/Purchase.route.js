import { Router } from "express";
import { authenticate } from "../middleware/Auth.middleware.js";
import {
  verifyPurchase,
  getMyPurchases,
  getMySales,
  downloadPurchase,
} from "../controller/Purchase.controller.js";

const router = Router();

router.post("/verify", authenticate, verifyPurchase);
router.get("/mine", authenticate, getMyPurchases);
router.get("/sales", authenticate, getMySales);
router.get("/:id/download", authenticate, downloadPurchase);

export default router;