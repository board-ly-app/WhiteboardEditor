import { Button } from "./ui/button";

export interface ConfirmTempToPermProps {
  onCancel: () => void
}

const ConfirmTempToPerm = ({
  onCancel
}: ConfirmTempToPermProps) => {
  const handleSubmit = () => {

  }
  
  return (
    <div>
      <form
        onSubmit={handleSubmit}
      >
        <h1>Logging in will transfer ownership of this whiteboard to your permanent account.</h1>
        <div className="flex flex-row justify-center pt-2 gap-2">
          <Button>Confirm</Button>
          <Button
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ConfirmTempToPerm;