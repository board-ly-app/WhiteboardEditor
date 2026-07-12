// -- std imports
import {
  useState,
  useCallback,
} from 'react';

import {
  LoaderCircle,
} from 'lucide-react';

// -- local imports
import {
  type WhiteboardIdType,
} from '@/types/WebSocketProtocol';

import {
  type Whiteboard,
} from '@/types/APIProtocol';

import {
  cn,
} from "@/lib/utils"

import {
  type ButtonStatus,
  Button,
} from '@/components/ui/button';

import { AppModal } from '@/components/ui/app-modal';

import {
  useWhiteboardQuery,
} from '@/hooks/useWhiteboardQuery';

const FORM_ID = 'delete-whiteboard-form';

export interface DeleteWhiteboardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whiteboardId: WhiteboardIdType;
  onSubmit: () => Promise<unknown>;
}

type ComponentStatus =
  | { name: 'pending'; }
  | { name: 'error'; }
  | { name: 'default'; whiteboardAttribs: Whiteboard; }
  | { name: 'deletion_unconfirmed'; whiteboardAttribs: Whiteboard; }
  | { name: 'deletion_confirmation_pending'; progress: number; whiteboardAttribs: Whiteboard; }
  | { name: 'deletion_confirmed'; whiteboardAttribs: Whiteboard; }
;

export const DeleteWhiteboardForm = ({
  open,
  onOpenChange,
  whiteboardId,
  onSubmit,
}: DeleteWhiteboardFormProps) => {
  // The confirmation key is a user input that confirms that the user really
  // intends to carry out the intended action
  const CONFIRMATION_KEY = 'Delete';
  const [confirmationKeyEntry, setConfirmationKeyEntry] = useState<string>('');
  const [deleteButtonStatus, setDeleteButtonStatus] = useState<ButtonStatus>('enabled');

  const {
    isLoading: whiteboardIsLoading,
    isFetching: whiteboardIsFetching,
    error: whiteboardError,
    data: whiteboardAttribs,
  } = useWhiteboardQuery(whiteboardId);

  const handleConfirmationKeyEntryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();

      setConfirmationKeyEntry(e.currentTarget.value);
    },
    [setConfirmationKeyEntry]
  );// -- end handleConfirmationKeyEntryChange

  const handleSubmit = useCallback((ev: React.FormEvent<HTMLFormElement>) => {
      ev.preventDefault();

      setDeleteButtonStatus('pending');

      onSubmit()
        .finally(() => {
          setDeleteButtonStatus('enabled');
        });
    },
    [onSubmit, setDeleteButtonStatus]
  );// -- end handleSubmit

  // -- derived state
  let status : ComponentStatus;

  if (whiteboardError) {
    status = { name: 'error' };
  } else if (whiteboardIsLoading || whiteboardIsFetching || (! whiteboardAttribs)) {
    status = { name: 'pending' };
  } else if (confirmationKeyEntry === '') {
    status = {
      name: 'default',
      whiteboardAttribs,
    };
  } else if (confirmationKeyEntry === CONFIRMATION_KEY) {
    status = {
      name: 'deletion_confirmed',
      whiteboardAttribs,
    };
  } else if (CONFIRMATION_KEY.substring(0, confirmationKeyEntry.length) === confirmationKeyEntry) {
    const progress = confirmationKeyEntry.length / CONFIRMATION_KEY.length;

    status = {
      name: 'deletion_confirmation_pending',
      whiteboardAttribs,
      progress,
    };
  } else {
    status = {
      name: 'deletion_unconfirmed',
      whiteboardAttribs,
    };
  }

  const confirmationKeyEntryClassnameBase = "placeholder:italic outline-2 rounded-sm p-1";
  let whiteboardData: Whiteboard;
  let confirmationKeyEntryClassname : string;

  switch (status.name) {
    case 'error':
      return (
        <AppModal
          open={open}
          onOpenChange={onOpenChange}
          title="Delete Whiteboard (error)"
        >
          <p>Error: could not load whiteboard info</p>
        </AppModal>
      );
    case 'pending':
      return (
        <AppModal
          open={open}
          onOpenChange={onOpenChange}
          title="Delete Whiteboard (loading)"
        >
          <LoaderCircle />
        </AppModal>
      );
    case 'default':
    {
      whiteboardData = status.whiteboardAttribs;
      confirmationKeyEntryClassname = cn(
        confirmationKeyEntryClassnameBase,
      );
    }
    break;
    case 'deletion_confirmed':
    {
      whiteboardData = status.whiteboardAttribs;
      confirmationKeyEntryClassname = cn(
        confirmationKeyEntryClassnameBase,
        "outline-green-600",
      );
    }
    break;
    case 'deletion_confirmation_pending':
    {
      const {
        progress,
      } = status;
      whiteboardData = status.whiteboardAttribs;
      const colorStart = 100;
      const colorLimit = 600;
      const colorStep = 100;
      const colorScale = (colorLimit - colorStart);
      const colorLevel = (Math.floor(
        (progress * colorScale) / colorStep
      ) * colorStep) + colorStart;

      confirmationKeyEntryClassname = cn(
        confirmationKeyEntryClassnameBase,
        `outline-green-${colorLevel}`,
      );
    }
    break;
    case 'deletion_unconfirmed':
    {
      whiteboardData = status.whiteboardAttribs;
      confirmationKeyEntryClassname = cn(
        confirmationKeyEntryClassnameBase,
        "outline-red-600"
      );
    }
    break;
    default:
      throw new Error(`Unrecognized status "${status}"`);
  }// -- end status.name

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete "${whiteboardData.name}"?`}
      footer={
        <>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            form={FORM_ID}
            disabled={status.name !== 'deletion_confirmed'}
            status={deleteButtonStatus}
            type="submit"
            variant="destructive"
          >
            Delete
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-2">
        <p>
          This action cannot be undone. Please type "{CONFIRMATION_KEY}" below to
          confirm.
        </p>
        <input
          type="text"
          autoComplete="off"
          name="confirmationKeyEntry"
          placeholder={CONFIRMATION_KEY}
          value={confirmationKeyEntry}
          onChange={handleConfirmationKeyEntryChange}
          className={confirmationKeyEntryClassname}
        />
      </form>
    </AppModal>
  );
};// -- end DeleteWhiteboardForm
