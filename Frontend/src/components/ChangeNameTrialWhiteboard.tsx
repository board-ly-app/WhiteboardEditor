import { useState } from "react";
import { Button } from "./ui/button";

export interface ChangeNameTrialWhiteboardProps {
  onConfirm: (name: string) => void;
  onSkip: () => void;
}

const ChangeNameTrialWhiteboard = ({
  onConfirm,
  onSkip
}: ChangeNameTrialWhiteboardProps) => {
  const [localNameEntry, setLocalNameEntry] = useState<string>('');

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (localNameEntry.trim()) {
      onConfirm(localNameEntry.trim());
    }
  };

  return (
    <div>
      <form 
        onSubmit={handleFormSubmit}
      >
        <h1>Change the name of your trial whiteboard?</h1>
        <input
          type="text"
          placeholder="Enter new name"
          value={localNameEntry}
          onChange={(e) => setLocalNameEntry(e.target.value)}
          className={"border p-2 w-full my-2 rounded-md"}
        />
        <div className="flex flex-row justify-center pt-2 gap-2">
          <Button
            type="submit"
          >
            Confirm
          </Button>
          <Button
            type="button"
            onClick={onSkip}
          >
            Skip for now
          </Button>
        </div>
      </form>
    </div>
  );
}

export default ChangeNameTrialWhiteboard;