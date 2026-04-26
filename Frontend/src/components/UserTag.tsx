// === UserTag.tsx =============================================================
//
// Displays a user's basic profile information in a small, rounded button.
// Intended to be displayed within a flex-row container.
//
// Optionally clickable.
//
// =============================================================================

// -- third-party imports
import {
  cva,
} from "class-variance-authority";

import {
  X,
} from 'lucide-react';

// -- local imports
import {
  type User,
} from '@/types/APIProtocol';

import {
  cn,
} from "@/lib/utils"

export type EnumUserTagSize =
  | 'small'
  | 'medium'
  | 'large'
;

type EnumUserTagRole = 
  | 'default'
  | 'button'
;

interface UserTagPropsBase {
  size: EnumUserTagSize;
  className?: string;
  note?: string | React.JSX.Element;
}

// -- displays just username and email; optional functionality on click
interface UserTagPropsBrief extends UserTagPropsBase {
  variant: 'brief';
  user: User,
  onClick?: (user: User) => unknown;
}

// -- displays just username and email, with a delete button; optional functionality on click
interface UserTagPropsBriefDeleter extends Omit<UserTagPropsBrief, 'variant'> {
  variant: 'brief_deleter'
  onDelete: (user: User) => unknown;
}

// -- displays just username; optional functionality on click
interface UserTagPropsUsername extends UserTagPropsBase {
  variant: 'username';
  user: User;
  onClick?: (user: User) => unknown;
}

// -- displays just username, with a delete button; optional functionality on click
interface UserTagPropsUsernameDeleter extends Omit<UserTagPropsUsername, 'variant'> {
  variant: 'username_deleter'
  onDelete: (user: User) => unknown;
}

// -- displays just email; optional functionality on click
interface UserTagPropsEmail extends UserTagPropsBase {
  variant: 'email';
  email: string;
  onClick?: (email: string) => unknown;
}

// -- displays just email, with a delete button; optional functionality on click
interface UserTagPropsEmailDeleter extends Omit<UserTagPropsEmail, 'variant'> {
  variant: 'email_deleter'
  onDelete: (email: string) => unknown;
}

export type UserTagProps = 
  | UserTagPropsBrief
  | UserTagPropsBriefDeleter
  | UserTagPropsUsername
  | UserTagPropsUsernameDeleter
  | UserTagPropsEmail
  | UserTagPropsEmailDeleter
;

const userTagVariants = cva(
  "text-h3-text inline-block align-middle rounded-2xl bg-button-300 border-1 border-border font-semibold",
  {
    variants: {
      role: {
        default: "",
        button: "hover:cursor-pointer hover:text-gray-200 hover:bg-gray-600",
      },
      size: {
        small: "m-2 px-2 py-1 text-sm",
        medium: "m-4 px-4 py-2 text-md",
        large: "m-6 px-6 py-4 text-lg",
      }
    }
  }
);

// -- standardize size of lucide-react X icon across variant sizes
const getIconSizeByTagSize = (tagSize: EnumUserTagSize): number => {
  switch (tagSize) {
    case 'small':
      return 18;
    case 'medium':
      return 24;
    case 'large':
      return 32;
    default:
      // -- we should never get here
      throw new Error(`Unhandled case: ${tagSize}`);
  }// -- end switch (tagSize)
};

interface UserTagBaseProps extends UserTagPropsBase {
  role: EnumUserTagRole;
  onClick?: () => unknown;
}

const UserTagBase = ({
  size,
  role,
  className,
  note,
  onClick,
  children,
}: React.PropsWithChildren<UserTagBaseProps>): React.JSX.Element => {
  return (
    <div
      className={cn(userTagVariants({ size, role, className }))}
      onClick={onClick}
    >
      {children}
      {note}
    </div>
  );
};

export const UserTagBrief = ({
  user,
  onClick,
  ...baseProps
}: Omit<UserTagPropsBrief, 'variant'>): React.JSX.Element => {
  const {
    username,
  } = user;
  const email = (() => {
    switch (user.kind) {
      case 'permanent':
        return user.email;
      case 'temp':
        return '-';
      default:
        throw new Error(`Unrecognized user kind: ${user}`);
    }// -- end switch (user.kind)
  })();

  return (
    <UserTagBase
      {...baseProps}
      role={onClick ? 'button' : 'default'}
      onClick={onClick && (() => onClick(user))}
    >
      <span>{username} {`<${email}>`}</span>
    </UserTagBase>
  );
};

export const UserTagBriefDeleter = ({
  user,
  onClick,
  onDelete,
  ...baseProps
}: Omit<UserTagPropsBriefDeleter, 'variant'>): React.JSX.Element => {
  const {
    username,
  } = user;
  const email = (() => {
    switch (user.kind) {
      case 'permanent':
        return user.email;
      case 'temp':
        return '-';
      default:
        throw new Error(`Unrecognized user type ${user}`);
    }// -- end switch (user.kind)
  })();

  return (
    <UserTagBase
      {...baseProps}
      role={onClick ? 'button' : 'default'}
      onClick={onClick && (() => onClick(user))}
    >
      <button
        onClick={() => onDelete(user)}
        className="hover:cursor-pointer p-1 inline-block align-middle"
      >
        <X size={getIconSizeByTagSize(baseProps.size)} />
      </button>
      <span>{username} ({email})</span>
    </UserTagBase>
  );
};

export const UserTagUsername = ({
  user,
  onClick,
  ...baseProps
}: Omit<UserTagPropsUsername, 'variant'>): React.JSX.Element => {
  const {
    username
  } = user;

  return (
    <UserTagBase
      {...baseProps}
      role={onClick ? 'button' : 'default'}
      onClick={onClick && (() => onClick(user))}
    >
      <span>{username}</span>
    </UserTagBase>
  );
};

export const UserTagUsernameDeleter = ({
  user,
  onClick,
  onDelete,
  ...baseProps
}: Omit<UserTagPropsUsernameDeleter, 'variant'>): React.JSX.Element => {
  const {
    username,
  } = user;

  return (
    <UserTagBase
      {...baseProps}
      role={onClick ? 'button' : 'default'}
      onClick={onClick && (() => onClick(user))}
    >
      <button
        onClick={() => onDelete(user)}
        className="hover:cursor-pointer p-1 inline-block align-middle"
      >
        <X size={getIconSizeByTagSize(baseProps.size)} />
      </button>
      <span>{username}</span>
    </UserTagBase>
  );
};

// interface UserTagPropsEmail extends UserTagPropsBase {
export const UserTagEmail = ({
  email,
  onClick,
  ...baseProps
}: Omit<UserTagPropsEmail, 'variant'>): React.JSX.Element => {
  return (
    <UserTagBase
      {...baseProps}
      role={onClick ? 'button' : 'default'}
      onClick={onClick && (() => onClick(email))}
    >
      <span>{email}</span>
    </UserTagBase>
  );
};

export const UserTagEmailDeleter = ({
  email,
  onClick,
  onDelete,
  ...baseProps
}: Omit<UserTagPropsEmailDeleter, 'variant'>): React.JSX.Element => {
  return (
    <UserTagBase
      {...baseProps}
      role={onClick ? 'button' : 'default'}
      onClick={onClick && (() => onClick(email))}
    >
      <button
        onClick={() => onDelete(email)}
        className="hover:cursor-pointer p-1 inline-block align-middle"
      >
        <X size={getIconSizeByTagSize(baseProps.size)} />
      </button>
      <span>{email}</span>
    </UserTagBase>
  );
};

export const UserTag = (props: UserTagProps): React.JSX.Element => {
  switch (props.variant) {
    case 'brief':
      return (<UserTagBrief {...props} />);
    case 'brief_deleter':
      return (<UserTagBriefDeleter {...props} />);
    case 'username':
      return (<UserTagUsername {...props} />);
    case 'username_deleter':
      return (<UserTagUsernameDeleter {...props} />);
    case 'email':
      return (<UserTagEmail {...props} />);
    case 'email_deleter':
      return (<UserTagEmailDeleter {...props} />);
    default:
      // -- we should never get here
      throw new Error(`Unhandled variant: ${props}`);
  }// -- end switch (props.variant)
};
