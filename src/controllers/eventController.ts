import { Request, Response, NextFunction } from "express";
import * as eventService from "./services/eventService.js";
import httpStatus from "http-status";
import { IUser } from "../models/User.js";
import logger from "../utils/logger.js";
import config from "../config/config.js";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

export const createEvent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Parse the data sent via FormData
    let eventData =
      typeof req.body.eventData === "string"
        ? JSON.parse(req.body.eventData)
        : { ...req.body };

    let imageUrl = "https://picsum.photos/seed/skaute/1200/800";

    // 2. Handle Image Upload to Cloudinary
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "skaute_events",
            // Keep the transformation settings
            eager: [
              {
                width: 1200,
                crop: "limit",
                quality: "auto",
                fetch_format: "auto",
              },
            ],
            // FIXED: Removed eager_async completely.
            // This stops the SDK from injecting "eager_async=0" into the production signature string.
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          },
        );
        stream.end(req.file!.buffer);
      });

      // Extract the eager transformed secure URL
      imageUrl = (uploadResult as any).eager[0].secure_url;
    }

    // 3. Prepare the final data object
    eventData.image = imageUrl;

    // Remove client-side helper fields that shouldn't go to the DB
    delete eventData.imageFile;
    delete eventData.locationCoords;

    // 4. Handle Online vs Physical logic
    if (eventData.eventFormat === "online") {
      delete eventData.location;
      eventData.isOnline = true;
    }

    const user = (req as any).user;
    const organizerId = user._id.toString();

    // 5. Save to Database via Service
    const newEvent = await eventService.createNewEvent(eventData, organizerId);

    res.status(httpStatus.CREATED).json({
      status: "success",
      data: { event: newEvent },
    });
  } catch (error) {
    next(error);
  }
};

export const updateEvent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    const user = (req as any).user as IUser;

    // Handle online format logic same as creation
    if (updateData.eventFormat === "online") {
      updateData.location = null;
      updateData.isOnline = true;
    }

    const updatedEvent = await eventService.updateEvent(
      id as string,
      updateData,
      user._id.toString(),
    );

    res.status(httpStatus.OK).json({
      status: "success",
      data: { event: updatedEvent },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllEvents = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { events, total, page, limit } = await eventService.getAllEvents(
      req.query,
    );

    const response = {
      status: "success",
      results: events.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
      data: { events },
    };

    res.status(httpStatus.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const getNearbyEvents = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { distance, lng, lat } = req.query;

    const events = await eventService.findNearbyEvents(
      Number(lng),
      Number(lat),
      Number(distance || 10),
    );

    res.status(httpStatus.OK).json({
      status: "success",
      results: events.length,
      data: { events },
    });
  } catch (error) {
    next(error);
  }
};

export const getEvent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const event = await eventService.getEventById(req.params.id as string);

    if (!event) {
      return res.status(httpStatus.NOT_FOUND).json({
        status: "fail",
        message: "No event found with that ID",
      });
    }

    res.status(httpStatus.OK).json({
      status: "success",
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};

export const getManagementDashboardData = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const eventId = req.params.id as string;
    const user = (req as any).user as IUser;

    logger.info(`Management Access: User=${user.email} EventID=${eventId}`);
    const managementData = await eventService.getManagementDashboardData(
      eventId,
      user._id.toString(),
    );

    res.status(httpStatus.OK).json({
      status: "success",
      data: managementData,
    });
  } catch (error: any) {
    logger.error(
      `Management Access Failed: ${error.message} | User=${(req as any).user?.email}`,
    );
    next(error);
  }
};
export const addCoOrganizer = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const eventId = req.params.eventId as string;
    const { email, permissions } = req.body;
    const user = (req as any).user;

    const updatedEvent = await eventService.addPartnerToEvent(
      eventId,
      email,
      permissions,
      user._id.toString(),
    );

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Partner added successfully",
      data: { event: updatedEvent },
    });
  } catch (error) {
    next(error);
  }
};

export const removeCoOrganizer = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { eventId, partnerId } = req.params;
    const user = (req as any).user;

    const updatedEvent = await eventService.removePartnerFromEvent(
      eventId as string,
      partnerId as string,
      user._id.toString(),
    );

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Partner removed successfully",
      data: { event: updatedEvent },
    });
  } catch (error) {
    next(error);
  }
};

export const getEventBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const event = await eventService.getEventBySlug(req.params.slug as string);

    if (!event) {
      return res.status(httpStatus.NOT_FOUND).json({
        status: "fail",
        message: "No event found with that custom link",
      });
    }

    res.status(httpStatus.OK).json({
      status: "success",
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};

export const createDiscountCode = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const updatedEvent = await eventService.addDiscountToEvent(
      id as string,
      req.body,
      user._id.toString(),
    );

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Discount code active",
      data: { event: updatedEvent },
    });
  } catch (error) {
    next(error);
  }
};
export const deleteDiscountCode = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id, discountId } = req.params;
    const user = (req as any).user;

    const updatedEvent = await eventService.removeDiscountCode(
      id as string,
      discountId as string,
      user._id.toString(),
    );

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Discount code deleted successfully",
      data: { event: updatedEvent },
    });
  } catch (error) {
    next(error);
  }
};

export const validateDiscountCode = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params; // eventId
    const { code, tierName } = req.body;

    const discount = await eventService.verifyDiscountCode(
      id as string,
      code as string,
      tierName as string,
    );

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Discount applied successfully",
      discount: {
        code: discount.code,
        discountPercentage: discount.discountPercentage,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const toggleSoldOutStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { tierId } = req.body;
    const user = (req as any).user;

    const updatedEvent: any = await eventService.toggleEventSoldOut(
      id as string,
      user._id.toString(),
      tierId as string | undefined,
    );

    const isNowSoldOut = tierId
      ? updatedEvent.ticketTiers.id(tierId).isSoldOut
      : updatedEvent.isSoldOut;

    res.status(httpStatus.OK).json({
      status: "success",
      message: isNowSoldOut ? "Marked as Sold Out" : "Sales resumed",
      data: updatedEvent,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCoOrganizerPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id: eventId } = req.params;
    const { coOrganizerId, permissions } = req.body;
    const user = (req as any).user as IUser;

    const updatedEvent = await eventService.updateCoOrganizerPermissions(
      eventId as string,
      coOrganizerId,
      permissions,
      user._id.toString(),
    );

    res.status(httpStatus.OK).json({
      status: "success",
      data: { event: updatedEvent },
    });
  } catch (error) {
    next(error);
  }
};
