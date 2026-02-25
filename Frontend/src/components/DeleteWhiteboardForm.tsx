// -- std imports
import {
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

export const DeleteWhiteboardForm = ({
  onSubmit,
  onCancel,
  whiteboardAttribs,
}: DeleteWhiteboardFormProps) => {
  const handleSubmit = useCallback((ev: React.FormEvent<HTMLFormElement>) => {
      ev.preventDefault();

      onSubmit();
    },
    [onSubmit]
  );

  return (
    <form
      onSubmit={handleSubmit}
    >
      <h1>Are you sure you want to delete "{whiteboardAttribs.name}"?</h1>
      <div className="flex flex-row justify-center pt-2 gap-2">
        <Button type="submit" variant="destructive">Yes</Button>
        <Button onClick={onCancel}>No</Button>
      </div>
    </form>
  );
};// -- end DeleteWhiteboardForm
