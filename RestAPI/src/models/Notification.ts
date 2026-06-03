import {
  Schema,
  model,
  Types,
  type Document,
  type Model,
} from "mongoose";

import type {
  ViewDocument,
  DocumentViewMethods,
  DocumentVirtualBase,
} from './Model';

import {
  type IUser,
  type IUserPublicView,
  type IUserAttribView
} from './User';

import {
  type ICanvas,
  type ICanvasPublicView,
  type ICanvasAttribView,
} from './Whiteboard';

export type NotificationIdType = Types.ObjectId;

export type NotificationTypeEnum = 
  | "request_canvas_edit_permission"
;

// === INotificationModel ======================================================
//  
// Base notification model, 
// 
// ==================================================================================
export interface INotificationModel {
  kind: NotificationTypeEnum;
  createdAt: Date;
}

// === Base Data Transfer Objects ======================================

// -- User with id and other basic document info
export type INotificationDocument = ViewDocument<INotificationModel>;

// -- Notification, excluding sensitive fields
export type NotificationProtectedFields = "";
export type INotificationPublicView = Omit<INotificationDocument, NotificationProtectedFields>;

// -- Public view, excluding vector attributes
// -- In this case, there are no vector attributes
export type INotificationAttribView = INotificationPublicView;

export type INotificationVirtual = DocumentVirtualBase;

export type NotificationModelType = Model<INotificationDocument, {}, {}, INotificationVirtual>;

// -- Notification as a Mongo document
export type INotification = 
  & INotificationDocument
  & DocumentViewMethods<INotification, INotificationPublicView, INotificationAttribView>
  & Document <Types.ObjectId>
;
// -- End INotification

// === IRequestCanvasEditPermissionNotification ================================
// 
// Represents a registered user account with persistent identity and login credentials.
//
// =============================================================================
export interface IRequestCanvasEditPermissionNotificationModel <UserType, CanvasType>
extends INotificationModel {
  kind: 'request_canvas_edit_permission';
  grantee: UserType;
  canvas: CanvasType;
}

// -- define protected fields for later omission from public view
type RequestCanvasEditPermissionNotificationProtectedFields =
  ""
;

// === Permanent Notification Transfer Objects =================================

// -- Request canvas edit permission notification with id and other basic document info
export type IRequestCanvasEditPermissionNotificationDocument <UserType, CanvasType>
  = ViewDocument<IRequestCanvasEditPermissionNotificationModel <UserType, CanvasType>>;

// -- User, excluding sensitive fields
export type IRequestCanvasEditPermissionNotificationPublicView
  = Omit<
    IRequestCanvasEditPermissionNotificationDocument <IUserPublicView, ICanvasPublicView>,
    RequestCanvasEditPermissionNotificationProtectedFields
  >;

// -- Public view, excluding vector attributes
// -- In this case, there are no vector attributes
export type IRequestCanvasEditPermissionNotificationAttribView
  = Omit<
    IRequestCanvasEditPermissionNotificationDocument <IUserAttribView, ICanvasAttribView>,
    RequestCanvasEditPermissionNotificationProtectedFields
  >;

export type IRequestCanvasEditPermissionNotificationVirtual = DocumentVirtualBase;

export type RequestCanvasEditPermissionNotificationModelType
  = Model<
    IRequestCanvasEditPermissionNotificationDocument <Types.ObjectId, Types.ObjectId>,
    {}, {}, IRequestCanvasEditPermissionNotificationVirtual
  >;

// -- Request canvas edit permission notification as a Mongo document
export type IRequestCanvasEditPermissionNotification <UserType, CanvasType> = 
  & IRequestCanvasEditPermissionNotificationDocument <UserType, CanvasType>
  & DocumentViewMethods<
    IRequestCanvasEditPermissionNotification <UserType, CanvasType>, 
    IRequestCanvasEditPermissionNotificationPublicView,
    IRequestCanvasEditPermissionNotificationAttribView
  >
  & Document <Types.ObjectId>
;
// -- End IRequestCanvasEditPermissionNotification

export type INotificationType <UserType, CanvasType> =
  | IRequestCanvasEditPermissionNotification <UserType, CanvasType>
;

// === notificationSchema ======================================================
//
// Defines how notifications are stored/interacted with.
//
// =============================================================================
const notficiationSchema = new Schema<
  INotificationType <Types.ObjectId, Types.ObjectId>,
  NotificationModelType,
  {}, {},
  INotificationVirtual
>(
  // -- fields
  {
    kind: { type: String, enum: ['request_canvas_edit_permission'], required: true },
    createdAt: { type: Schema.Types.Date, required: true },
  },
  {
    // -- options
    discriminatorKey: 'kind',
    // --- do not commit data not defined in schema
    strict: true,
    // --- do not omit empty fields
    minimize: false,

    // -- data transformation
    toObject: {
      virtuals: true,
    },
    toJSON: {
      virtuals: true,
    },
  }
);// -- end notficiationSchema

// === permanentUserSchema ==============================================================
//
// Defines how permanent user objects are stored/interacted with.
//
// =============================================================================
notficiationSchema.discriminator(
  'request_canvas_edit_permission',
  new Schema<
    IRequestCanvasEditPermissionNotification <Types.ObjectId, Types.ObjectId>,
    RequestCanvasEditPermissionNotificationModelType,
    {}, {},
    IRequestCanvasEditPermissionNotificationVirtual
  >
  (
  // -- fields
  {
    grantee:    { type: Schema.Types.ObjectId, ref: 'User', required: true, },
    canvas:     { type: Schema.Types.ObjectId, ref: 'Canvas', required: true, }
  },
  {
    toJSON: {
      virtuals: true,
    },
    // -- instance methods
    methods: {
      // -- Data transfer mappings
      async populateAttribs(): Promise<IRequestCanvasEditPermissionNotification <IUserAttribView, ICanvasAttribView>> {
        // nothing to populate
        await this.populate(['grantee', 'canvas']);

        (this.grantee as unknown as IUser).populateAttribs();
        (this.canvas as unknown as ICanvas <Types.ObjectId>).populateAttribs();

        return this as unknown as IRequestCanvasEditPermissionNotification <IUserAttribView, ICanvasAttribView>;
      },
      async populateFull(): Promise<IRequestCanvasEditPermissionNotification <IUserPublicView, ICanvasPublicView>> {
        return await this.populate(['grantee', 'canvas']);
      },
      toPublicView(): IRequestCanvasEditPermissionNotificationPublicView {
        return this.toObject({ virtuals: true }) as unknown as IRequestCanvasEditPermissionNotificationPublicView;
      },// -- end toPublicView
      toAttribView(): IRequestCanvasEditPermissionNotificationAttribView {
        return this.toObject({ virtuals: true }) as unknown as IRequestCanvasEditPermissionNotificationPublicView;
      },// -- end toAttribView
    },
  },
));// -- end schema 'request_canvas_edit_permission'

notficiationSchema.virtual('id').get(function() {
  return this._id;
});

// -- Notification Model
export const Notification = model<INotificationType <Types.ObjectId, Types.ObjectId>>(
  "Notification", notficiationSchema, "notifications"
);
