import { Router } from "express";
import { authenticate } from "../middleware/Auth.middleware.js";
import { uploadArtworkImage } from "../middleware/Upload.middleware.js";
import {
  createArtwork,
  getMyArtworks,
  getMarketplace,
  deleteArtwork,
} from "../controller/Artwork.controller.js";

const router = Router();

router.get("/", authenticate, getMarketplace);
router.get("/mine", authenticate, getMyArtworks);
router.post("/", authenticate, uploadArtworkImage, createArtwork);
router.delete("/:id", authenticate, deleteArtwork);

export default router;