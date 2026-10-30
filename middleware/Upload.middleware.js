import multer from "multer";
import { StatusCodes } from "http-status-codes";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPG, PNG or WEBP images are allowed"));
  },
});

// Wrapped so upload errors come back as clean JSON instead of crashing the request
const uploadArtworkImage = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      const message =
        err.code === "LIMIT_FILE_SIZE" ? "Image must be 10MB or less" : err.message;
      return res.status(StatusCodes.BAD_REQUEST).json({ message, status: false });
    }
    next();
  });
};

export { uploadArtworkImage };