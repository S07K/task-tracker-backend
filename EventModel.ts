const mongoose = require('mongoose');
const Schema = mongoose.Schema;

export interface EventType {
    id: string;
    groupId: string;
    allDay: boolean;
    start: string;
    end: string;
    startStr: string;
    endStr: string;
    title: string;
    url: string;
    classNames: string[];
    editable: boolean | null;
    startEditable: boolean | null;
    durationEditable: boolean | null;
    resourceEditable: boolean | null;
    display: 'auto' | 'block' | 'list-item' | 'background' | 'inverse-background' | 'none';
    overlap: boolean;
    constraint: string | object;
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    extendedProps: {
      [key: string]: any;
    };
    source: string | null;
}

const eventSchema = new Schema({
  id: { type: String, required: true, unique: true },
  groupId: { type: String },
  allDay: { type: Boolean, required: true },
  start: { type: String, required: true },
  end: { type: String },
  startStr: { type: String, required: true },
  endStr: { type: String, required: true },
  title: { type: String, required: true },
  url: { type: String },
  classNames: { type: [String], default: [] },
  editable: { type: Boolean, default: null },
  startEditable: { type: Boolean, default: null },
  durationEditable: { type: Boolean, default: null },
  resourceEditable: { type: Boolean, default: null },
  display: {
    type: String,
    enum: ['auto', 'block', 'list-item', 'background', 'inverse-background', 'none'],
    default: 'auto'
  },
  overlap: { type: Boolean, default: true },
  constraint: { type: Schema.Types.Mixed, default: null },
  backgroundColor: { type: String },
  borderColor: { type: String },
  textColor: { type: String },
  extendedProps: { type: Schema.Types.Mixed, default: {} },
  source: { type: String, default: null }
});

export const EventSchema = mongoose.model('Event', eventSchema);