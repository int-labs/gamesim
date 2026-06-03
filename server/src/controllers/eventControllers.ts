import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import Event from "../models/events"; // Adjust the path as necessary
import Simulation from "../models/simulations"; // Assuming Simulation model exists
import { getPaginationQuery } from "../utils/paginationHelper"; // Assuming you have a pagination helper

// Get all events with pagination and filtering
export const getAllEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page, skip, limit, filters } = getPaginationQuery(req);

    // Find events and populate simulationId
    const events = await Event.find(filters)
      .skip(skip)
      .limit(limit)
      .populate("simulationType");

    const totalCount = await Event.countDocuments(filters);

    res.status(200).json({
      events,
      data: events,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (err) {
    next(err); // Pass error to global handler
  }
};

const createEventSchema = z.object({
  simulationTypeId: z.string().min(1, "Simulation type must be selected"),
  eventName: z.string().min(1, "Event name must be filled"),
  question: z.string().min(1, "Question must be filled"),
  choices: z.array(
    z.object({
      key: z.string().min(1, "Key must be filled"),
      title: z.string().min(1, "Title must be filled"),
      description: z.string().min(1, "Description must be filled"),
      config: z.array(
        z.object({
          year: z.number().min(1, "Year must be filled"),
          impacts: z.array(
            z.object({
              paramCode: z.string().min(1, "Param code must be filled"),
              value: z.number({ message: "Impact value must be a number" }),
              impactedProducts: z.array(z.string()),
            })
          ),
          energyCost: z.number().min(0, "Energy cost must be a number"),
          financialCost: z.number().min(0, "Financial cost must be a number"),
        })
      ),
    })
  ),
});

// Create a new event
export const createEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const eventData = req.body;

    // Check if the simulationId exists in the Simulation collection
    // const simulation = await Simulation.findById(eventData.simulationId);
    // if (!simulation) {
    //   res.status(400).json({ error: 'Invalid simulationId' });
    //   return;
    // }

    const validationResult = createEventSchema.safeParse(eventData);

    if (!validationResult.success) {
      console.log("validationResult", validationResult.error);

      res
        .status(400)
        .json({ error: { message: validationResult.error.message } });
      return;
    }

    // Check for duplicate eventName
    const existingEvent = await Event.findOne({
      eventName: eventData.eventName,
    });
    if (existingEvent) {
      res.status(400).json({ error: "Event name already exists" });
      return;
    }

    // Create a new event instance
    const newEvent = new Event({
      ...validationResult.data,
      choices: validationResult.data.choices.map((choice) => {
        // console.log("choice", choice);

        const config = choice.config.reduce(
          (acc, curr) => {
            acc[curr.year] = {
              ...curr,
              impacts: curr.impacts.map((impact) => ({
                ...impact,
                impactedProducts: impact.impactedProducts.map(
                  (p) => new mongoose.Types.ObjectId(p)
                ),
              })),
            };
            return acc;
          },
          {} as Record<number, any>
        );

        return {
          ...choice,
          config,
        };
      }),
      simulationTypeId: new mongoose.Types.ObjectId(eventData.simulationTypeId),
    });

    // Save the new event to the database
    const savedEvent = await newEvent.save();

    // Respond with the saved event data
    res.status(201).json(savedEvent);
  } catch (err) {
    // Pass the error to the next middleware
    next(err);
  }
};

// Get an event by simulationId or simulationName
export const getEventBySimulationIdOrName = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId, simulationName, eventName } = req.params;

    let filter: any = {}; // Start with an empty filter

    if (simulationId) {
      // If simulationId is provided, use it to filter events
      filter.simulationId = simulationId;
    } else if (simulationName) {
      // If simulationName is provided, find the simulationId first and then filter events
      const simulation = await Simulation.findOne({ simulationName }).select(
        "_id"
      ); // Select only _id field
      if (!simulation) {
        res.status(404).json({ error: "Simulation not found" });
        return;
      }
      filter.simulationId = simulation._id;
    }

    if (eventName) {
      filter.eventName = eventName; // If eventName is provided, filter by it
    }

    const event = await Event.findOne(filter).populate(
      "simulationId",
      "simulationName"
    ); // Populate simulationId with simulationName

    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    res.status(200).json(event);
  } catch (err) {
    next(err);
  }
};

const updateEventSchema = z.object({
  eventName: z.string().min(1, "Event name must be filled"),
  question: z.string().min(1, "Question must be filled"),
  imgUrl: z.string().optional(),
  choices: z.array(
    z.object({
      key: z.string().min(1, "Key must be filled"),
      title: z.string().min(1, "Title must be filled"),
      description: z.string().min(1, "Description must be filled"),
      config: z.array(
        z.object({
          year: z.number().min(1, "Year must be filled"),
          impacts: z.array(
            z.object({
              paramCode: z.string().min(1, "Param code must be filled"),
              value: z.number({ message: "Impact value must be a number" }),
              impactedProducts: z.array(z.string()),
            })
          ),
          financialCost: z.number().min(0, "Financial cost must be a number"),
          energyCost: z.number().min(0, "Energy cost must be a number"),
        })
      ),
    })
  ),
});

// Update an event by eventName
export const updateEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { eventId } = req.params;
    const eventData = req.body;

    const validationResult = updateEventSchema.safeParse(eventData);

    if (!validationResult.success) {
      console.log("validationResult", validationResult.error);

      res
        .status(400)
        .json({ error: { message: validationResult.error.message } });
      return;
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      eventId,
      {
        ...validationResult.data,
        choices: validationResult.data.choices.map((choice) => ({
          ...choice,
          config: choice.config.reduce(
            (acc, curr) => {
              acc[curr.year] = curr;
              return acc;
            },
            {} as Record<number, any>
          ),
        })),
      },
      {
        new: true,
      }
    );

    if (!updatedEvent) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    res.status(200).json(updatedEvent);
  } catch (err) {
    next(err);
  }
};

// Delete an event by eventName
export const deleteEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { eventName } = req.params;
    const deletedEvent = await Event.findOneAndDelete({ eventName });

    if (!deletedEvent) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    res.status(200).json({ message: "Event deleted" });
  } catch (err) {
    next(err);
  }
};

// Get an event by ID
export const getEventById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);

    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    res.status(200).json(event);
  } catch (err) {
    next(err);
  }
};
