import { EventSchema, Event } from "../Models/EventModel";
import utils from "./utils";
const authMiddleware = require("../middleware/auth");
const { apiResponse } = utils;

const express = require("express");
const app = express.Router();

const ifEventExists = async (id: string) => {
  const event = await EventSchema.findOne({
    id: id,
  });
  if (event) {
    return true;
  } else {
    return false;
  }
};

app.use(authMiddleware);

// add event route
function generateEventId() {
    // Get current timestamp in milliseconds
    const timestamp = Date.now();
    
    // Generate a random number between 1000 and 9999
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    
    // Combine timestamp and random number to form the event ID
    const eventId = `event_${timestamp}${randomNum}`;
    
    return eventId;
  }
  app.post("/addEvent", async (req: any, res: any) => {
    try {
      if (await ifEventExists(req.user.id)) {
        res.send(
          apiResponse({
            message: "Event already exists",
            error: {
              message: "Event already exists",
              code: "409",
            },
          })
        );
        return;
      }
      const NewEvent = new EventSchema({
        id: generateEventId(),
        groupId: req.body.id || "1",
        allDay: req.body.allDay || false,
        start: req.body.start,
        end: req.body.end,
        startStr: req.body.startStr,
        endStr: req.body.endStr,
        title: req.body.title,
        url: req.body.url,
        // classNames: req.body.classNames || [],
        editable: req.body.editable || true,
        startEditable: req.body.startEditable || true,
        durationEditable: req.body.durationEditable || true,
        resourceEditable: req.body.resourceEditable || true,
        display: req.body.display || "block",
        overlap: req.body.overlap || true,
        constraint: req.body.constraint || "businessHours",
        backgroundColor: req.body.backgroundColor,
        borderColor: req.body.borderColor || "#efefef",
        textColor: req.body.textColor || "white",
        extendedProps: req.body.extendedProps || {},
        source: req.body.source || null,
      });
      NewEvent.save();
      res.send(
        apiResponse({
          message: "Event added successfully",
          event: NewEvent,
        })
      );
    } catch (error: any) {
      res.send(
        apiResponse({
          message: "Error in adding event",
          error: {
            message: error.message,
            code: "500",
          },
        })
      );
    }
  });
  
  // get all Events route
  app.get("/getAllEvents", async (req: any, res: any) => {
    try {
      const AllEvents: Event[] = await EventSchema.find({groupId: req.user.id});
  
      res.send(
        apiResponse({
          message: "All events fetched successfully",
          events: AllEvents,
        })
      );
    } catch (error: any) {
      res.send(
        apiResponse({
          message: "Error in fetching events",
          error: {
            message: error.message,
            code: "500",
          },
        })
      );
    }
  });
  
  // delete event route (only the signed-in user's own events)
  app.delete("/deleteEvent/:id", async (req: any, res: any) => {
    try {
      const result = await EventSchema.deleteOne({
        id: req.params.id,
        groupId: req.user.id,
      });
      if (result.deletedCount > 0) {
        const userEvents = await EventSchema.find({ groupId: req.user.id });
        res.send(
          apiResponse({
            message: "Event deleted successfully",
            events: userEvents,
          })
        );
      } else {
        // Same response for missing and not-owned events, so IDs can't be probed.
        res.send(
          apiResponse({
            message: "Event does not exist",
            error: {
              message: "Event does not exist",
              code: "404",
            },
          })
        );
      }
    } catch (error: any) {
      res.send(
        apiResponse({
          message: "Error in deleting event",
          error: {
            message: error.message,
            code: "500",
          },
        })
      );
    }
  });
  
  //search event by id
  app.get("/searchEvent/:id", async (req: any, res: any) => {
    try {
      const event = await EventSchema.findOne({
        id: req.params.id,
      });
      if (event) {
        res.send(
          apiResponse({
            message: "Event found",
            event: event,
          })
        );
      } else {
        res.send(
          apiResponse({
            message: "Event not found",
            error: {
              message: "Event not found",
              code: "404",
            },
          })
        );
      }
    } catch (error: any) {
      res.send(
        apiResponse({
          message: "Error in searching event",
          error: {
            message: error.message,
            code: "500",
          },
        })
      );
    }
  });
  
  // fields a client may change on its own event (never id or groupId)
  const UPDATABLE_FIELDS = [
    "title",
    "allDay",
    "start",
    "end",
    "startStr",
    "endStr",
    "url",
    "backgroundColor",
    "borderColor",
    "textColor",
  ];

  //Update event by id (only the signed-in user's own events)
  app.patch("/updateEvent/:id", async (req: any, res: any) => {
    try {
      const updates: Record<string, any> = {};
      UPDATABLE_FIELDS.forEach((field) => {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      });
      const event = await EventSchema.findOneAndUpdate(
        { id: req.params.id, groupId: req.user.id },
        { $set: updates },
        { new: true }
      );
      if (event) {
        res.send(
          apiResponse({
            message: "Event Updated successfully",
            event: event,
          })
        );
      } else {
        // Same response for missing and not-owned events, so IDs can't be probed.
        res.send(
          apiResponse({
            message: "Event not found",
            error: {
              message: "Event not found",
              code: "404",
            },
          })
        );
      }
    } catch (error: any) {
      res.send(
        apiResponse({
          message: "Error in searching event",
          error: {
            message: error.message,
            code: "500",
          },
        })
      );
    }
  });
  
  // search event
  app.post("/searchEvent/", async (req: any, res: any) => {
    try {
      const events = await EventSchema.find(req.body);
      if (events) {
        res.send(
          apiResponse({
            message: "Events found",
            events: events,
          })
        );
      } else {
        res.send(
          apiResponse({
            message: "Events not found",
            error: {
              message: "Events not found",
              code: "404",
            },
          })
        );
      }
    } catch (error: any) {
      res.send(
        apiResponse({
          message: "Error in searching events",
          error: {
            message: error.message,
            code: "500",
          },
        })
      );
    }
  });

  const eventRouter =  app
  export default eventRouter;