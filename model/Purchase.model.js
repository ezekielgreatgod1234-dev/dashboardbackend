import mongoose from "mongoose";

// One document = one paid copy = one download.
// Paying again for the same artwork creates a NEW purchase with a fresh download.
const purchaseSchema = new mongoose.Schema(
  {
    artwork: { type: mongoose.Schema.Types.ObjectId, ref: "Artwork", required: true },
    artworkTitle: { type: String, required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    buyerName: { type: String, required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true }, // in Naira
    reference: { type: String, required: true, unique: true }, // Paystack reference

    downloaded: { type: Boolean, default: false },
    downloadedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

purchaseSchema.index({ buyer: 1, downloaded: 1 });

const Purchase = mongoose.model("Purchase", purchaseSchema);

export default Purchase;