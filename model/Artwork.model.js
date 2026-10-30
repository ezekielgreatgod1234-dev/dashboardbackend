import mongoose from "mongoose";

const artworkSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 100 }, // in Naira

    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sellerName: { type: String, required: true },

    // PUBLIC: low-res, watermarked copy. This is the only image the browser ever sees.
    previewUrl: { type: String, required: true },
    previewPublicId: { type: String, required: true },

    // PRIVATE: the full-resolution original, stored as an "authenticated" Cloudinary asset.
    // It has no public URL — only the server can fetch it.
    originalPublicId: { type: String, required: true },
    originalFormat: { type: String, required: true },

    status: { type: String, enum: ["Active"], default: "Active" },
  },
  { timestamps: true }
);

const Artwork = mongoose.model("Artwork", artworkSchema);

export default Artwork;