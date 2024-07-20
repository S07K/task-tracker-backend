"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const EventModel_1 = require("../Models/EventModel");
const utils_1 = __importDefault(require("./utils"));
const authMiddleware = require("../middleware/auth");
const { apiResponse } = utils_1.default;
const express = require("express");
const app = express.Router();
const ifEventExists = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const event = yield EventModel_1.EventSchema.findOne({
        id: id,
    });
    if (event) {
        return true;
    }
    else {
        return false;
    }
});
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
app.post("/addEvent", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (yield ifEventExists(req.user.id)) {
            res.send(apiResponse({
                message: "Event already exists",
                error: {
                    message: "Event already exists",
                    code: "409",
                },
            }));
            return;
        }
        const NewEvent = new EventModel_1.EventSchema({
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
        res.send(apiResponse({
            message: "Event added successfully",
            event: NewEvent,
        }));
    }
    catch (error) {
        res.send(apiResponse({
            message: "Error in adding event",
            error: {
                message: error.message,
                code: "500",
            },
        }));
    }
}));
// get all Events route
app.get("/getAllEvents", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const AllEvents = yield EventModel_1.EventSchema.find({ groupId: req.user.id });
        res.send(apiResponse({
            message: "All events fetched successfully",
            events: AllEvents,
        }));
    }
    catch (error) {
        res.send(apiResponse({
            message: "Error in fetching events",
            error: {
                message: error.message,
                code: "500",
            },
        }));
    }
}));
// delete event route
app.delete("/deleteEvent/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (yield ifEventExists(req.params.id)) {
            yield EventModel_1.EventSchema.deleteOne({
                id: req.params.id,
            });
            const allEvents = yield EventModel_1.EventSchema.find();
            res.send(apiResponse({
                message: "Event deleted successfully",
                events: allEvents,
            }));
        }
        else {
            res.send(apiResponse({
                message: "Event does not exist",
                error: {
                    message: "Event does not exist",
                    code: "404",
                },
            }));
        }
    }
    catch (error) {
        res.send(apiResponse({
            message: "Error in deleting event",
            error: {
                message: error.message,
                code: "500",
            },
        }));
    }
}));
//search event by id
app.get("/searchEvent/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const event = yield EventModel_1.EventSchema.findOne({
            id: req.params.id,
        });
        if (event) {
            res.send(apiResponse({
                message: "Event found",
                event: event,
            }));
        }
        else {
            res.send(apiResponse({
                message: "Event not found",
                error: {
                    message: "Event not found",
                    code: "404",
                },
            }));
        }
    }
    catch (error) {
        res.send(apiResponse({
            message: "Error in searching event",
            error: {
                message: error.message,
                code: "500",
            },
        }));
    }
}));
//Update event by id
app.patch("/updateEvent/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const event = yield EventModel_1.EventSchema.updateOne({
            id: req.params.id,
        }, req.body);
        if (event) {
            res.send(apiResponse({
                message: "Event Updated successfully",
                event: event,
            }));
        }
        else {
            res.send(apiResponse({
                message: "Event not found",
                error: {
                    message: "Event not found",
                    code: "404",
                },
            }));
        }
    }
    catch (error) {
        res.send(apiResponse({
            message: "Error in searching event",
            error: {
                message: error.message,
                code: "500",
            },
        }));
    }
}));
// search event
app.post("/searchEvent/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const events = yield EventModel_1.EventSchema.find(req.body);
        if (events) {
            res.send(apiResponse({
                message: "Events found",
                events: events,
            }));
        }
        else {
            res.send(apiResponse({
                message: "Events not found",
                error: {
                    message: "Events not found",
                    code: "404",
                },
            }));
        }
    }
    catch (error) {
        res.send(apiResponse({
            message: "Error in searching events",
            error: {
                message: error.message,
                code: "500",
            },
        }));
    }
}));
const eventRouter = app;
exports.default = eventRouter;
//# sourceMappingURL=events.js.map