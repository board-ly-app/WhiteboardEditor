// -- std imports
import {
  useState,
  useCallback,
} from 'react';

// -- local imports
import {
  type WhiteboardAttribs,
} from '@/types/WebSocketProtocol';

import {
  cn,
} from "@/lib/utils"

import {
  Button,
} from '@/components/ui/button';

export interface DeleteWhiteboardFormProps {
  onSubmit: () => unknown;
  onCancel: () => unknown;
  whiteboardAttribs: Pick<WhiteboardAttribs, 'id' | 'name'>;
}

type ComponentStatus = 
  | { name: 'default'; }
  | { name: 'deletion_unconfirmed'; }
  | { name: 'deletion_confirmation_pending'; }
  | { name: 'deletion_confirmed'; }
;

export const DeleteWhiteboardForm = ({
  onSubmit,
  onCancel,
  whiteboardAttribs,
}: DeleteWhiteboardFormProps) => {
  // The confirmation key is a user input that confirms that the user really
  // intends to carry out the intended action
  const CONFIRMATION_KEY = 'Delete';
  const [confirmationKeyEntry, setConfirmationKeyEntry] = useState<string>('');

  const handleConfirmationKeyEntryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();

      setConfirmationKeyEntry(e.currentTarget.value);
    },
    [setConfirmationKeyEntry]
  );// -- end handleConfirmationKeyEntryChange

  const handleSubmit = useCallback((ev: React.FormEvent<HTMLFormElement>) => {
      ev.preventDefault();

      onSubmit();
    },
    [onSubmit]
  );// -- end handleSubmit

  // -- derived state
  let status : ComponentStatus;

  if (confirmationKeyEntry === '') {
    status = { name: 'default' };
  } else if (confirmationKeyEntry === CONFIRMATION_KEY) {
    status = { name: 'deletion_confirmed' };
  } else if (CONFIRMATION_KEY.substring(0, confirmationKeyEntry.length) === confirmationKeyEntry) {
    status = { name: 'deletion_confirmation_pending' };
  } else {
    status = { name: 'deletion_unconfirmed' };
  }

  const confirmationKeyEntryClassnameBase = "placeholder:italic outline-2 rounded-sm p-1";
  let confirmationKeyEntryClassname : string;

  switch (status.name) {
    case 'default':
    {
        confirmationKeyEntryClassname = cn(
          confirmationKeyEntryClassnameBase,
        );
    }
    break;
    case 'deletion_confirmed':
    {
        confirmationKeyEntryClassname = cn(
          confirmationKeyEntryClassnameBase,
          "outline-green-600",
        );
    }
    break;
    case 'deletion_confirmation_pending':
    {
        confirmationKeyEntryClassname = cn(
          confirmationKeyEntryClassnameBase,
          "outline-green-100",
        );
    }
    break;
    case 'deletion_unconfirmed':
    {
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
    <div>
      <form
        onSubmit={handleSubmit}
      >
        <h1>If you want to delete "{whiteboardAttribs.name}", please type "{CONFIRMATION_KEY}" below.</h1>
        <div className="flex flex-row justify-center pt-2 gap-2">
          <input
            type="text"
            name="confirmationKeyEntry"
            placeholder={CONFIRMATION_KEY}
            value={confirmationKeyEntry}
            onChange={handleConfirmationKeyEntryChange}
            className={confirmationKeyEntryClassname}
          />
          <Button
            disabled={status.name !== 'deletion_confirmed'}
            type="submit"
            variant="destructive"
          >
            Delete
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </div>
  );
};// -- end DeleteWhiteboardForm
