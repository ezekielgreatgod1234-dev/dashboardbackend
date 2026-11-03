import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";
import Artwork from "../model/Artwork.model.js";
import Purchase from "../model/Purchase.model.js";
import cloudinary from "../config/cloudinary.js";

// POST /purchases/verify  { artworkId, reference }
// Called after the Paystack popup succeeds. We never trust the browser:
// we ask Paystack directly whether the payment really happened.
const verifyPurchase = async (req, res) => {
  try {
    const { artworkId, reference } = req.body;

    if (!artworkId || !reference || !mongoose.isValidObjectId(artworkId)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "artworkId and reference are required",
        status: false,
      });
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: "Payments are not configured on the server",
        status: false,
      });
    }

    const artwork = await Artwork.findById(artworkId);
    if (!artwork) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "Artwork not found",
        status: false,
      });
    }

    if (artwork.seller.toString() === req.user.id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "You can't buy your own artwork",
        status: false,
      });
    }

    // Same reference sent twice (e.g. retry / refresh) -> return the same purchase
    const existing = await Purchase.findOne({ reference });
    if (existing) {
      if (existing.buyer.toString() === req.user.id) {
        return res.status(StatusCodes.OK).json({
          message: "Purchase already confirmed",
          purchaseId: existing.id,
          status: true,
        });
      }
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "This payment reference has already been used",
        status: false,
      });
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );
    const result = await paystackRes.json();

    if (!paystackRes.ok || !result.status || result.data?.status !== "success") {
      return res.status(StatusCodes.PAYMENT_REQUIRED).json({
        message: "Payment was not successful",
        status: false,
      });
    }

    const { amount, currency, metadata } = result.data;

    if (
      currency !== "NGN" ||
      amount !== artwork.price * 100 ||
      String(metadata?.artworkId) !== artwork.id
    ) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Payment does not match this artwork",
        status: false,
      });
    }

    const purchase = await Purchase.create({
      artwork: artwork._id,
      artworkTitle: artwork.title,
      buyer: req.user.id,
      buyerName: req.user.fullName,
      seller: artwork.seller,
      amount: amount / 100,
      reference,
    });

    res.status(StatusCodes.CREATED).json({
      message: "Payment confirmed. You can now download the artwork once.",
      purchaseId: purchase.id,
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

// GET /purchases/mine  (everything I've paid for)
const getMyPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find({ buyer: req.user.id })
      .sort({ createdAt: -1 })
      .populate("artwork");

    res.status(StatusCodes.OK).json({
      purchases: purchases
        .filter((p) => p.artwork)
        .map((p) => ({
          id: p.id, // purchase id (used for the download)
          artworkId: p.artwork.id,
          title: p.artwork.title,
          description: p.artwork.description,
          price: p.amount,
          image: p.artwork.previewUrl,
          seller: p.artwork.sellerName,
          downloaded: p.downloaded,
          downloadedAt: p.downloadedAt,
          purchasedAt: p.createdAt,
        })),
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

// GET /purchases/sales  (my artworks that others have bought)
const getMySales = async (req, res) => {
  try {
    const sales = await Purchase.find({ seller: req.user.id }).sort({ createdAt: -1 });

    res.status(StatusCodes.OK).json({
      sales: sales.map((s) => ({
        id: s.id,
        title: s.artworkTitle,
        buyer: s.buyerName,
        price: s.amount,
        createdAt: s.createdAt,
      })),
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

// GET /purchases/:id/download
// ONE paid copy = ONE download. The "downloaded" flag is flipped atomically in the
// database BEFORE the file is sent, so two requests can never both succeed.
const downloadPurchase = async (req, res) => {
  let claimed = null;

  const release = () =>
    Purchase.updateOne(
      { _id: claimed._id },
      { downloaded: false, downloadedAt: null }
    ).catch(console.log);

  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "Purchase not found",
        status: false,
      });
    }

    claimed = await Purchase.findOneAndUpdate(
      { _id: id, buyer: req.user.id, downloaded: false },
      { downloaded: true, downloadedAt: new Date() },
      { new: true }
    );

    if (!claimed) {
      const existing = await Purchase.findOne({ _id: id, buyer: req.user.id });
      if (!existing) {
        return res.status(StatusCodes.NOT_FOUND).json({
          message: "Purchase not found",
          status: false,
        });
      }
      return res.status(StatusCodes.FORBIDDEN).json({
        message:
          "This artwork has already been downloaded. Buy it again to download another copy.",
        status: false,
      });
    }

    const artwork = await Artwork.findById(claimed.artwork);
    if (!artwork) {
      await release();
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "Artwork no longer exists",
        status: false,
      });
    }

    const signedUrl = cloudinary.url(artwork.originalPublicId, {
      resource_type: "image",
      type: "authenticated",
      sign_url: true,
      secure: true,
      format: artwork.originalFormat,
    });

    const upstream = await fetch(signedUrl);
    if (!upstream.ok) {
      await release(); // buyer shouldn't lose their download because Cloudinary failed
      return res.status(StatusCodes.BAD_GATEWAY).json({
        message: "Could not fetch the original file. Please try again.",
        status: false,
      });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    const safeName = artwork.title.replace(/[^a-z0-9-_ ]/gi, "").trim() || "artwork";

    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/octet-stream"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}.${artwork.originalFormat}"`
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.send(buffer);
  } catch (error) {
    console.log(error);
    if (claimed && !res.headersSent) await release();
    if (!res.headersSent) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: "Oops something went wrong",
        status: false,
      });
    }
  }
};

export { verifyPurchase, getMyPurchases, getMySales, downloadPurchase };