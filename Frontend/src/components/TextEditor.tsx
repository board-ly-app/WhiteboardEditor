import { Html } from "react-konva-utils";
import Konva from "konva";

type TAWithClose = HTMLTextAreaElement & {
  __konvaInit?: boolean;
  __konvaClose?: () => void;
};

interface TextEditorProps {
  textNode: Konva.Text;
  onClose: (newText: string) => void;
}

const TextEditor = ({ textNode, onClose }: TextEditorProps) => {
  const textareaRef = { current: null as (HTMLTextAreaElement | null) };

  const initTextArea = (textarea: TAWithClose) => {
    const textPosition = textNode.position();

    textarea.value = textNode.text();
    textarea.style.position = "absolute";
    textarea.style.top = `${textPosition.y}px`;
    textarea.style.left = `${textPosition.x}px`;
    textarea.style.width = `${textNode.width()}px`;
    textarea.style.height = `${textNode.height()}px`;
    textarea.style.fontSize = `${textNode.fontSize()}px`;
    textarea.style.border = "none";
    textarea.style.padding = "0px";
    textarea.style.margin = "0px";
    textarea.style.overflow = "hidden";
    textarea.style.background = "none";
    textarea.style.outline = "none";
    textarea.style.resize = "none";
    textarea.style.lineHeight = String(textNode.lineHeight());
    textarea.style.fontFamily = textNode.fontFamily();
    textarea.style.transformOrigin = "left top";
    textarea.style.textAlign = textNode.align();
    const fill = textNode.fill();
    if (typeof fill === "string") textarea.style.color = fill;

    const rotation = textNode.rotation();
    if (rotation) textarea.style.transform = `rotateZ(${rotation}deg)`;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight + 3}px`;
    textarea.focus();

    let closed = false;
    // declare `close` first, assign later so we can call it from performClose
    let close: () => void = () => (closed = true);

    const performClose = (value: string) => {
      if (closed) return;
      closed = true;
      onClose(value);
      // remove listeners / cleanup
      close();
    };

    const handleOutsideClick = (e: MouseEvent) => {
      if (e.detail === 2) return; // allow double-clicks to edit again
      if (e.target !== textarea) performClose(textarea.value);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        performClose(textarea.value);
      } else if (e.key === "Escape") {
        performClose(textarea.value);
      }
    };

    const handleInput = () => {
      const scale = textNode.getAbsoluteScale().x;
      textarea.style.width = `${textNode.width() * scale}px`;
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight + textNode.fontSize()}px`;
    };

    textarea.addEventListener("keydown", handleKeyDown);
    textarea.addEventListener("input", handleInput);
    window.addEventListener("click", handleOutsideClick);

    close = () => {
      try {
        textarea.removeEventListener("keydown", handleKeyDown);
        textarea.removeEventListener("input", handleInput);
        window.removeEventListener("click", handleOutsideClick);
      } finally {
        textarea.__konvaInit = false;
        textarea.__konvaClose = undefined;
        closed = true;
      }
    };

    textarea.__konvaInit = true;
    textarea.__konvaClose = close;

    return close;
  };

  return (
    <Html>
      <textarea
        placeholder="Enter text here"
        ref={(elem) => {
          if (elem) {
            const e = elem as TAWithClose;
            textareaRef.current = elem;
            // Prevent double-init (React can call ref callback multiple times)
            if (!e.__konvaInit) {
              initTextArea(e);
              // IMPORTANT: do NOT call the returned close() here.
              // Instead it's stored on the element as __konvaClose.
            }
          } else {
            // ref cleared -> component unmount. cleanup if we have a stored close.
            const prev = textareaRef.current as TAWithClose | null;
            if (prev && prev.__konvaClose) prev.__konvaClose();
            textareaRef.current = null;
          }
        }}
        style={{
          minHeight: "1rem",
          position: "absolute",
        }}
      />
    </Html>
  );
};

export default TextEditor;
