import { StatusCodes } from "http-status-codes";
import Artwork from "../model/Artwork.model.js";
import cloudinary, { uploadBuffer } from "../config/cloudinary.js";

const formatArtwork = (art) => ({
  id: art.id,
  title: art.title,
  description: art.description,
  price: art.price,
  image: art.previewUrl, // watermarked, low-res preview only
  seller: art.sellerName,
  status: art.status,
  createdAt: art.createdAt,
});

const destroyOriginal = (publicId) =>
  cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    type: "authenticated",
    invalidate: true,
  });

const destroyPreview = (publicId) =>
  cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    type: "upload",
    invalidate: true,
  });

// POST /artworks  (multipart/form-data: title, description, price, image)
const createArtwork = async (req, res) => {
  const { title, description, price } = req.body;

  if (!title || !description || !price || !req.file) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "Please fill all fields and upload an image",
      status: false,
    });
  }

  const numericPrice = Number(price);
  if (!Number.isInteger(numericPrice) || numericPrice < 100) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "Price must be a whole number of at least ₦100",
      status: false,
    });
  }

  let original;
  let preview;

  try {
    // 1) Private, full-resolution original. "authenticated" means Cloudinary
    //    gives it NO public URL, so nobody can open or download it.
    original = await uploadBuffer(req.file.buffer, {
      folder: "artvault/originals",
      resource_type: "image",
      type: "authenticated",
    });

    // 2) Public preview: shrunk, low quality and watermarked at upload time,
    //    so the clean image is never stored publicly.
    preview = await uploadBuffer(req.file.buffer, {
      folder: "artvault/previews",
      resource_type: "image",
      type: "upload",
      transformation: [
        { width: 800, height: 800, crop: "limit", quality: "auto:low" },
        {
          overlay: {
            font_family: "Arial",
            font_size: 64,
            font_weight: "bold",
            text: "ArtVault",
          },
          color: "#ffffff",
          opacity: 45,
          gravity: "center",
        },
      ],
    });

    const artwork = await Artwork.create({
      title,
      description,
      price: numericPrice,
      seller: req.user.id,
      sellerName: req.user.fullName,
      previewUrl: preview.secure_url,
      previewPublicId: preview.public_id,
      originalPublicId: original.public_id,
      originalFormat: original.format,
    });

    res.status(StatusCodes.CREATED).json({
      message: "Artwork added",
      artwork: formatArtwork(artwork),
      status: true,
    });
  } catch (error) {
    console.log(error);
    // Don't leave orphaned files in Cloudinary if something failed halfway
    if (original) await destroyOriginal(original.public_id).catch(() => {});
    if (preview) await destroyPreview(preview.public_id).catch(() => {});

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Could not upload artwork",
      status: false,
    });
  }
};

// GET /artworks/mine
const getMyArtworks = async (req, res) => {
  try {
    const artworks = await Artwork.find({ seller: req.user.id }).sort({ createdAt: -1 });

    res.status(StatusCodes.OK).json({
      artworks: artworks.map(formatArtwork),
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

// DELETE /artworks/:id
const deleteArtwork = async (req, res) => {
  try {
    const artwork = await Artwork.findById(req.params.id);

    if (!artwork) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "Artwork not found",
        status: false,
      });
    }

    if (artwork.seller.toString() !== req.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        message: "You can only delete your own artworks",
        status: false,
      });
    }

    await Promise.all([
      destroyOriginal(artwork.originalPublicId).catch(console.log),
      destroyPreview(artwork.previewPublicId).catch(console.log),
    ]);
    await artwork.deleteOne();

    res.status(StatusCodes.OK).json({ message: "Artwork deleted", status: true });
  } catch (error) {
    console.log(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Oops something went wrong",
      status: false,
    });
  }
};

export { createArtwork, getMyArtworks, deleteArtwork };