import { Request, Response, NextFunction } from "express";
import * as hotspotService from "./services/hotspotService.js";
import httpStatus from "http-status";

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
    const newHotspot = await hotspotService.createHotspot(req.body);
    res
      .status(httpStatus.CREATED)
      .json({ status: "success", data: { hotspot: newHotspot } });
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
    // req.user._id is populated via your auth protection middleware layer
    const updatedHotspot = await hotspotService.castVibe(
      req.params.hotspotId,
      req.user._id,
      req.body.vibe,
    );
    res.status(httpStatus.OK).json({
      status: "success",
      message: "Vibe check counted successfully",
      data: {
        currentVibe: updatedHotspot.vibeCheck.currentVibe,
        totalActiveVotes: updatedHotspot.vibeCheck.votes.length,
      },
    });
  } catch (error) {
    next(error);
  }
};
