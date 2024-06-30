import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { EventSchema, EventType } from "./EventModel";
dotenv.config();
const mongoose = require("mongoose");
const MONGODB_URL = process.env.MONGODB_URL;
const APP_URL = process.env.APP_URL;
const app = express();

function logger(req: Request, res: Response, next: NextFunction) {
  console.log(`${req.method} ${req.url}`);
  next();
}

app.use(logger);

app.use(cors({ origin: APP_URL }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//mongo db connection
main().catch((err) => console.log("Error in MongoDB connection", err));

async function main() {
  await mongoose.connect(MONGODB_URL);
  console.log("MogoDB connected!");
  // use `await mongoose.connect('mongodb://user:password@127.0.0.1:27017/test');` if your database has auth enabled
}

const apiResponse = (details: any) => {
  interface ApiResponse {
    message: string;
    events?: any;
    error?: {
      message: string;
      code: string;
    };
  }

  if (details.error) {
    const response: ApiResponse = {
      message: details.error.message || "",
      error: {
        message: details.error.message || "",
        code: details.error.code || "",
      },
    };
    return response;
  } else {
    const response: ApiResponse = {
      message: details.message || "",
      events: details.events || {},
    };
    return response;
  }
};

const ifEventExists = async (id: string) => {
  const event = await EventSchema.findOne({
    id: id,
  });
  if (event) {
    // console.log('Event exists', event);
    return true;
  } else {
    // console.log('Event does not exist');
    return false;
  }
};

// api routes

// add event route
app.post("/addEvent", async (req, res) => {
  try {
    if (await ifEventExists(req.body.id)) {
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
    const startDate = new Date(req.body.start)
      .toISOString()
      .replace(/T.*$/, "");
    console.log("startDate", startDate);
    const endDate = new Date(req.body.end).toISOString().replace(/T.*$/, "");
    const NewEvent = new EventSchema({
      id: req.body.id || "1",
      groupId: req.body.groupId || "1",
      allDay: req.body.allDay || false,
      start: startDate || new Date().toISOString().replace(/T.*$/, ""),
      end: endDate || null,
      startStr: req.body.startStr || "2021-06-01",
      endStr: req.body.endStr || "2021-06-01",
      title: req.body.title || "New Event",
      url: req.body.url || "https://www.google.com",
      classNames: req.body.classNames || [],
      editable: req.body.editable || null,
      startEditable: req.body.startEditable || null,
      durationEditable: req.body.durationEditable || null,
      resourceEditable: req.body.resourceEditable || null,
      display: req.body.display || "auto",
      overlap: req.body.overlap || true,
      constraint: req.body.constraint || null,
      backgroundColor: req.body.backgroundColor || "blue",
      borderColor: req.body.borderColor || "blue",
      textColor: req.body.textColor || "white",
      extendedProps: req.body.extendedProps || {},
      source: req.body.source || null,
    });
    NewEvent.save();
    res.send(
      apiResponse({
        message: "Event added successfully",
        events: NewEvent,
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
app.get("/getAllEvents", async (req, res) => {
  try {
    const AllEvents: EventType[] = await EventSchema.find();

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

// delete event route
app.delete("/deleteEvent/:id", async (req, res) => {
  try {
    if (await ifEventExists(req.params.id)) {
      await EventSchema.deleteOne({
        id: req.params.id,
      });
      const allEvents = await EventSchema.find();
      res.send(
        apiResponse({
          message: "Event deleted successfully",
          events: allEvents,
        })
      );
    } else {
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
app.get("/searchEvent/:id", async (req, res) => {
  try {
    const event = await EventSchema.findOne({
      id: req.params.id,
    });
    if (event) {
      res.send(
        apiResponse({
          message: "Event found",
          events: event,
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

// search event
app.post("/searchEvent/", async (req, res) => {
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

app.listen(5001, () => {
  console.log("Server listening on port 5001");
});
