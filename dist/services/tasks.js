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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskInputError = void 0;
exports.dayOfWeek = dayOfWeek;
exports.toTaskView = toTaskView;
exports.listTasks = listTasks;
exports.createTask = createTask;
exports.updateTask = updateTask;
exports.findTasksForDeletion = findTasksForDeletion;
exports.deleteTasks = deleteTasks;
const EventModel_1 = require("../Models/EventModel");
// Task operations for the AI assistant. Every function is scoped to the
// signed-in user (groupId), matching the ownership rules in routes/events.ts.
/** Invalid input from the model or client; the message is safe to show to the model. */
class TaskInputError extends Error {
}
exports.TaskInputError = TaskInputError;
// Same palette as the frontend (src/lib/color.ts).
const COLORS = {
    black: "#111827",
    gray: "#111827",
    blue: "#2563eb",
    purple: "#7c3aed",
    pink: "#db2777",
    red: "#dc2626",
    orange: "#ea580c",
    yellow: "#ca8a04",
    green: "#16a34a",
    cyan: "#0891b2",
};
const DEFAULT_COLOR = COLORS.black;
const MAX_TITLE_LENGTH = 200;
const MAX_LIST_RESULTS = 50;
const MAX_DELETE_IDS = 20;
const DEFAULT_DURATION_MINUTES = 30;
const DAY_MINUTES = 24 * 60;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
// Stored dates are local wall-clock strings with no time zone, so all arithmetic
// is done in UTC on those numbers and formatted back the same way.
function parseWallClock(value) {
    const match = value.match(DATETIME_RE) || value.match(DATE_RE);
    if (!match)
        return null;
    const [year, month, day, hour = "0", minute = "0"] = match.slice(1);
    const date = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute));
    // Reject overflow such as 2026-02-30 or 25:00.
    if (date.getUTCFullYear() !== +year ||
        date.getUTCMonth() !== +month - 1 ||
        date.getUTCDate() !== +day ||
        date.getUTCHours() !== +hour ||
        date.getUTCMinutes() !== +minute) {
        return null;
    }
    return date;
}
const pad = (n) => String(n).padStart(2, "0");
const formatDate = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const formatDateTime = (d) => `${formatDate(d)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
const addMinutes = (d, minutes) => new Date(d.getTime() + minutes * 60000);
function dayOfWeek(date) {
    const parsed = parseWallClock(date.slice(0, 10));
    return parsed ? parsed.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }) : "";
}
function requireDate(value, field) {
    const parsed = typeof value === "string" && DATE_RE.test(value) ? parseWallClock(value) : null;
    if (!parsed)
        throw new TaskInputError(`${field} must be a valid date in YYYY-MM-DD format`);
    return parsed;
}
function requireDateTime(value, field) {
    const parsed = typeof value === "string" && DATETIME_RE.test(value) ? parseWallClock(value) : null;
    if (!parsed)
        throw new TaskInputError(`${field} must be a valid date and time in YYYY-MM-DDTHH:mm format (24-hour)`);
    return parsed;
}
function cleanTitle(value) {
    const title = typeof value === "string" ? value.trim() : "";
    if (!title)
        throw new TaskInputError("title is required");
    if (title.length > MAX_TITLE_LENGTH)
        throw new TaskInputError(`title must be ${MAX_TITLE_LENGTH} characters or fewer`);
    return title;
}
function resolveColor(value) {
    if (typeof value !== "string")
        throw new TaskInputError("color must be a string");
    const color = value.trim().toLowerCase();
    if (COLORS[color])
        return COLORS[color];
    if (/^#[0-9a-f]{6}$/.test(color))
        return color;
    throw new TaskInputError(`color must be one of ${Object.keys(COLORS).join(", ")} or a #RRGGBB hex code`);
}
function optionalString(value, field) {
    if (value === undefined || value === null || value === "")
        return undefined;
    if (typeof value !== "string")
        throw new TaskInputError(`${field} must be a string`);
    return value.trim();
}
function optionalBoolean(value, field) {
    if (value === undefined || value === null)
        return undefined;
    if (typeof value !== "boolean")
        throw new TaskInputError(`${field} must be true or false`);
    return value;
}
/** Converts a stored event into the shape shown to the model and the chat UI. */
function toTaskView(event) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const base = {
        id: String(event.id),
        title: String((_a = event.title) !== null && _a !== void 0 ? _a : ""),
        color: typeof event.backgroundColor === "string" ? event.backgroundColor : DEFAULT_COLOR,
    };
    const start = parseWallClock(String((_b = event.start) !== null && _b !== void 0 ? _b : ""));
    const end = parseWallClock(String((_c = event.end) !== null && _c !== void 0 ? _c : ""));
    if (event.allDay) {
        const startDay = start !== null && start !== void 0 ? start : parseWallClock(String((_d = event.startStr) !== null && _d !== void 0 ? _d : ""));
        if (!startDay)
            return Object.assign(Object.assign({}, base), { allDay: true, start: String((_e = event.start) !== null && _e !== void 0 ? _e : ""), end: String((_f = event.end) !== null && _f !== void 0 ? _f : "") });
        // Stored all-day ends are exclusive; show the inclusive last day.
        const lastDay = end && end > startDay ? addMinutes(end, -DAY_MINUTES) : startDay;
        return Object.assign(Object.assign({}, base), { allDay: true, start: formatDate(startDay), end: formatDate(lastDay) });
    }
    if (!start)
        return Object.assign(Object.assign({}, base), { allDay: false, start: String((_g = event.start) !== null && _g !== void 0 ? _g : ""), end: String((_h = event.end) !== null && _h !== void 0 ? _h : "") });
    return Object.assign(Object.assign({}, base), { allDay: false, start: formatDateTime(start), end: formatDateTime(end && end > start ? end : start) });
}
/** Validates a schedule and converts it to the stored event format used by the calendar. */
function buildSchedule(allDay, startInput, endInput) {
    if (allDay) {
        const startDay = requireDate(typeof startInput === "string" ? startInput.slice(0, 10) : startInput, "start");
        const lastDay = endInput === undefined ? startDay : requireDate(typeof endInput === "string" ? endInput.slice(0, 10) : endInput, "end");
        if (lastDay < startDay)
            throw new TaskInputError("end must be on or after start");
        const exclusiveEnd = addMinutes(lastDay, DAY_MINUTES);
        return {
            allDay: true,
            start: `${formatDate(startDay)}T00:00`,
            end: `${formatDate(exclusiveEnd)}T00:00`,
            startStr: formatDate(startDay),
            endStr: formatDate(exclusiveEnd),
        };
    }
    const start = requireDateTime(startInput, "start");
    const end = endInput === undefined ? addMinutes(start, DEFAULT_DURATION_MINUTES) : requireDateTime(endInput, "end");
    if (end <= start)
        throw new TaskInputError("end must be after start");
    return {
        allDay: false,
        start: formatDateTime(start),
        end: formatDateTime(end),
        startStr: formatDate(start),
        endStr: formatDate(end),
    };
}
// Same ID format as routes/events.ts.
function generateEventId() {
    return `event_${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
}
function listTasks(userId, args) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const from = optionalString(args.from, "from");
        const to = optionalString(args.to, "to");
        const query = (_a = optionalString(args.query, "query")) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        if (from)
            requireDate(from, "from");
        if (to)
            requireDate(to, "to");
        if (from && to && to < from)
            throw new TaskInputError("to must be on or after from");
        const events = yield EventModel_1.EventSchema.find({ groupId: userId });
        const tasks = events
            .map(toTaskView)
            .filter((task) => {
            const firstDay = task.start.slice(0, 10);
            const lastDay = task.end.slice(0, 10);
            if (from && lastDay < from)
                return false;
            if (to && firstDay > to)
                return false;
            if (query && !task.title.toLowerCase().includes(query))
                return false;
            return true;
        })
            .sort((a, b) => a.start.localeCompare(b.start));
        return {
            tasks: tasks.slice(0, MAX_LIST_RESULTS),
            total: tasks.length,
            truncated: tasks.length > MAX_LIST_RESULTS,
        };
    });
}
function createTask(userId, args) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const title = cleanTitle(args.title);
        const allDay = (_a = optionalBoolean(args.allDay, "allDay")) !== null && _a !== void 0 ? _a : false;
        const schedule = buildSchedule(allDay, args.start, optionalString(args.end, "end"));
        const color = args.color === undefined || args.color === null || args.color === "" ? DEFAULT_COLOR : resolveColor(args.color);
        const event = new EventModel_1.EventSchema(Object.assign(Object.assign({ id: generateEventId(), groupId: userId, title }, schedule), { url: "", editable: true, startEditable: true, durationEditable: true, resourceEditable: true, display: "block", overlap: true, constraint: "businessHours", backgroundColor: color, borderColor: "#efefef", textColor: "white", extendedProps: {}, source: null }));
        yield event.save();
        return toTaskView(event);
    });
}
function updateTask(userId, args) {
    return __awaiter(this, void 0, void 0, function* () {
        const id = optionalString(args.id, "id");
        if (!id)
            throw new TaskInputError("id is required");
        const existing = yield EventModel_1.EventSchema.findOne({ id, groupId: userId });
        if (!existing)
            throw new TaskInputError(`No task found with id ${id}`);
        const current = toTaskView(existing);
        const updates = {};
        if (args.title !== undefined)
            updates.title = cleanTitle(args.title);
        if (args.color !== undefined)
            updates.backgroundColor = resolveColor(args.color);
        const allDayInput = optionalBoolean(args.allDay, "allDay");
        const startInput = optionalString(args.start, "start");
        const endInput = optionalString(args.end, "end");
        if (allDayInput !== undefined || startInput !== undefined || endInput !== undefined) {
            const allDay = allDayInput !== null && allDayInput !== void 0 ? allDayInput : current.allDay;
            const switchingMode = allDay !== current.allDay;
            let start = startInput !== null && startInput !== void 0 ? startInput : current.start;
            let end = endInput;
            if (switchingMode && !allDay && !DATETIME_RE.test(start)) {
                // All-day -> timed without a time: default to 9:00.
                start = `${start.slice(0, 10)}T09:00`;
            }
            if (end === undefined && !switchingMode) {
                if (startInput === undefined) {
                    end = current.end;
                }
                else {
                    // Moving only the start keeps the task's length.
                    const oldStart = parseWallClock(current.start);
                    const oldEnd = parseWallClock(current.end);
                    const newStart = parseWallClock(allDay ? start.slice(0, 10) : start);
                    if (oldStart && oldEnd && newStart) {
                        const minutes = Math.max(0, Math.round((oldEnd.getTime() - oldStart.getTime()) / 60000));
                        const shifted = addMinutes(newStart, allDay ? minutes : minutes || DEFAULT_DURATION_MINUTES);
                        end = allDay ? formatDate(shifted) : formatDateTime(shifted);
                    }
                }
            }
            Object.assign(updates, buildSchedule(allDay, start, end));
        }
        if (Object.keys(updates).length === 0)
            throw new TaskInputError("Nothing to update; include at least one field to change");
        const updated = yield EventModel_1.EventSchema.findOneAndUpdate({ id, groupId: userId }, { $set: updates }, { new: true });
        if (!updated)
            throw new TaskInputError(`No task found with id ${id}`);
        return toTaskView(updated);
    });
}
function cleanIds(value) {
    if (!Array.isArray(value) || value.length === 0)
        throw new TaskInputError("ids must be a non-empty list of task ids");
    if (value.length > MAX_DELETE_IDS)
        throw new TaskInputError(`At most ${MAX_DELETE_IDS} tasks can be deleted at once`);
    if (!value.every((id) => typeof id === "string" && id.trim()))
        throw new TaskInputError("ids must be strings");
    return Array.from(new Set(value.map((id) => id.trim())));
}
/** Looks up the user's tasks for a delete request without deleting anything. */
function findTasksForDeletion(userId, idsInput) {
    return __awaiter(this, void 0, void 0, function* () {
        const ids = cleanIds(idsInput);
        const events = yield EventModel_1.EventSchema.find({ groupId: userId, id: { $in: ids } });
        const tasks = events.map(toTaskView);
        const found = new Set(tasks.map((task) => task.id));
        return { tasks, notFound: ids.filter((id) => !found.has(id)) };
    });
}
/** Deletes the user's own tasks with the given ids (after the user confirmed in the app). */
function deleteTasks(userId, idsInput) {
    return __awaiter(this, void 0, void 0, function* () {
        const { tasks } = yield findTasksForDeletion(userId, idsInput);
        if (tasks.length === 0)
            return [];
        yield EventModel_1.EventSchema.deleteMany({ groupId: userId, id: { $in: tasks.map((task) => task.id) } });
        return tasks;
    });
}
//# sourceMappingURL=tasks.js.map