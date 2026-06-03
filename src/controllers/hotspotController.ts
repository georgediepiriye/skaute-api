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

    let imageUrl = "";

    if (files?.image?.[0]) {
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            upload_preset: "skaute_hotspots",
            unsigned: true,
            folder: "skaute/hotspots",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          },
        );

        stream.end(files.image![0].buffer);
      });

      imageUrl = uploadResult.secure_url;
    }

    // ==========================
    // GALLERY IMAGES
    // ==========================

    const galleryUrls: string[] = [];

    if (files?.gallery?.length) {
      for (const image of files.gallery) {
        const uploadResult = await new Promise<any>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              upload_preset: "skaute_hotspots",
              unsigned: true,
              folder: "skaute/hotspots/gallery",
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            },
          );

          stream.end(image.buffer);
        });

        galleryUrls.push(uploadResult.secure_url);
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

    // ==========================
    // SAVE
    // ==========================

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
