import { Request, Response, NextFunction } from "express";
import * as hotspotService from "./services/hotspotService.js";
import httpStatus from "http-status";
import { v2 as cloudinary } from "cloudinary";
import config from "../config/config.js";

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

const uploadHotspotImage = async (
  file: Express.Multer.File,
  folder: string,
) => {
  const uploadResult = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    stream.end(file.buffer);
  });

  return uploadResult.secure_url;
};

const uploadHotspotImageDetails = async (
  file: Express.Multer.File,
  folder: string,
) => {
  const uploadResult = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    stream.end(file.buffer);
  });

  return {
    url: uploadResult.secure_url,
    publicId: uploadResult.public_id,
    resourceType: uploadResult.resource_type,
    format: uploadResult.format,
    bytes: uploadResult.bytes,
    width: uploadResult.width,
    height: uploadResult.height,
    uploadedAt: new Date(),
  };
};

export const getAllHotspots = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { hotspots, total, page, limit } =
      await hotspotService.getAllHotspots(req.query);
    res.status(httpStatus.OK).json({
      status: "success",
      results: hotspots.length,
      pagination: { total, page, pages: Math.ceil(total / limit) },
      data: { hotspots },
    });
  } catch (error) {
    next(error);
  }
};

export const getHotspotDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const hotspot = await hotspotService.getHotspotById(
      req.params.hotspotId as string,
    );
    if (!hotspot) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ status: "fail", message: "Venue not found" });
    }
    res.status(httpStatus.OK).json({ status: "success", data: { hotspot } });
  } catch (error) {
    next(error);
  }
};

export const createHotspot = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    console.log("Received hotspot creation request with body:", req.body);
    const files = req.files as {
      image?: Express.Multer.File[];
      gallery?: Express.Multer.File[];
    };

    // Parse FormData payload
    let hotspotData =
      typeof req.body.hotspotData === "string"
        ? JSON.parse(req.body.hotspotData)
        : { ...req.body };

    // ==========================
    // COVER IMAGE
    // ==========================

    let imageUrl =
      hotspotData.image ||
      hotspotData.coverImage ||
      "https://picsum.photos/seed/skaute-hotspot/1200/800";

    if (files?.image?.[0]) {
      imageUrl = await uploadHotspotImage(files.image[0], "skaute/hotspots");
    }

    // ==========================
    // GALLERY IMAGES
    // ==========================

    const galleryUrls: string[] = Array.isArray(hotspotData.gallery)
      ? hotspotData.gallery
      : [];

    if (files?.gallery?.length) {
      for (const image of files.gallery) {
        const imageUrl = await uploadHotspotImage(
          image,
          "skaute/hotspots/gallery",
        );
        galleryUrls.push(imageUrl);
      }
    }

    // ==========================
    // CLEAN DATA
    // ==========================

    hotspotData.image = imageUrl;

    hotspotData.gallery = galleryUrls;

    // Ensure GeoJSON shape
    hotspotData.location = {
      type: "Point",
      coordinates: hotspotData.location.coordinates,
      address: hotspotData.location.address,
      neighborhood: hotspotData.location.neighborhood,
      city: hotspotData.location.city || "Port Harcourt",
      state: hotspotData.location.state || "Rivers State",
    };

    // Remove client-only fields if any
    delete hotspotData.imageFile;
    delete hotspotData.galleryFiles;

    const newHotspot = await hotspotService.createHotspot(hotspotData);

    res.status(httpStatus.CREATED).json({
      status: "success",
      data: {
        hotspot: newHotspot,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateHotspot = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const files = req.files as {
      image?: Express.Multer.File[];
      gallery?: Express.Multer.File[];
    };

    const updateData =
      typeof req.body.hotspotData === "string"
        ? JSON.parse(req.body.hotspotData)
        : { ...req.body };

    if (files?.image?.[0]) {
      updateData.image = await uploadHotspotImage(
        files.image[0],
        "skaute/hotspots",
      );
    }

    if (files?.gallery?.length) {
      updateData.gallery = [];

      for (const image of files.gallery) {
        const imageUrl = await uploadHotspotImage(
          image,
          "skaute/hotspots/gallery",
        );
        updateData.gallery.push(imageUrl);
      }
    }

    if (updateData.location) {
      updateData.location = {
        type: "Point",
        ...updateData.location,
        city: updateData.location.city || "Port Harcourt",
        state: updateData.location.state || "Rivers State",
      };
    }

    delete updateData.imageFile;
    delete updateData.galleryFiles;

    const updatedHotspot = await hotspotService.updateHotspot(
      req.params.hotspotId as string,
      updateData,
    );

    res.status(httpStatus.OK).json({
      status: "success",
      data: {
        hotspot: updatedHotspot,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteHotspot = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await hotspotService.deleteHotspot(req.params.hotspotId as string);
    res.status(httpStatus.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
};

export const toggleHotspotActive = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const hotspot = await hotspotService.toggleHotspotActive(
      req.params.hotspotId as string,
      req.body.isActive,
    );

    res.status(httpStatus.OK).json({
      status: "success",
      data: {
        hotspot,
        isActive: hotspot.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createHotspotContribution = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    const rawPayload =
      typeof req.body.payload === "string"
        ? JSON.parse(req.body.payload || "{}")
        : req.body.payload || {};

    const payload = {
      ...rawPayload,
      email: req.body.email || rawPayload.email,
      name: req.body.name || rawPayload.name,
    };

    if (file) {
      payload.imageUrl = await uploadHotspotImage(
        file,
        "skaute/hotspots/contributions",
      );
    }

    const contribution = await hotspotService.createHotspotContribution({
      hotspotId: req.params.hotspotId as string,
      user: (req as any).user,
      ip: req.ip,
      type: req.body.type,
      payload,
    });

    res.status(httpStatus.CREATED).json({
      status: "success",
      message: "Update sent for review",
      data: { contribution },
    });
  } catch (error) {
    next(error);
  }
};

export const createHotspotSuggestion = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    const image = file
      ? await uploadHotspotImageDetails(file, "skaute/hotspot-suggestions")
      : undefined;

    const suggestion = await hotspotService.createHotspotSuggestion({
      data: req.body,
      image,
      user: (req as any).user,
    });

    res.status(httpStatus.CREATED).json({
      status: "success",
      message: "Hotspot suggestion submitted for review",
      data: {
        suggestion: {
          id: suggestion._id,
          title: suggestion.title,
          category: suggestion.category,
          status: suggestion.status,
          location: suggestion.location,
          contact: suggestion.contact,
          note: suggestion.note,
          image: suggestion.image?.url ? suggestion.image : undefined,
          createdAt: suggestion.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const castHotspotVibeCheck = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const hotspot = await hotspotService.castVibe(
      req.params.hotspotId,
      req.user._id,
      req.body.vibe,
    );

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Vibe recorded successfully",
      data: {
        hotspotId: hotspot._id,

        vibeCheck: hotspot.vibeCheck,

        status: hotspot.status,
      },
    });
  } catch (error) {
    next(error);
  }
};
