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
  Button,
} from '@/components/ui/button';

export interface DeleteWhiteboardFormProps {
  onSubmit: () => unknown;
  onCancel: () => unknown;
  whiteboardAttribs: WhiteboardAttribs,
}

type ComponentStatus = 
  | { name: 'deletion_unconfirmed'; }
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

  if (confirmationKeyEntry === CONFIRMATION_KEY) {
    status = { name: 'deletion_confirmed' };
  } else {
    status = { name: 'deletion_unconfirmed' };
  }

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
          />
          <Button
            disabled={status.name === 'deletion_unconfirmed'}
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
