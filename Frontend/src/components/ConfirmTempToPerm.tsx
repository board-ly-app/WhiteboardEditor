import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";

export interface ConfirmTempToPermProps {
  onCancel: () => void
}

const ConfirmTempToPerm = ({
  onCancel
}: ConfirmTempToPermProps) => {
  const navigate = useNavigate();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const url = new URL(window.location.href);
    const segments = url.pathname.split('/');
    const whiteboardId = segments.pop() || segments.pop();
    
    if (!whiteboardId) {
      console.error("No whiteboardId found in URL");
      return;
    }

    navigate(`/login/?transfer_temp_whiteboard=${whiteboardId}&redirect=/whiteboard/${whiteboardId}`);
  }
  
  return (
    <div>
      <form
        onSubmit={handleSubmit}
      >
        <h1>Logging in will transfer ownership of this whiteboard to your permanent account.</h1>
        <div className="flex flex-row justify-center pt-2 gap-2">
          <Button
            type="submit"
          >
            Confirm
          </Button>
          <Button
            type="button"
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