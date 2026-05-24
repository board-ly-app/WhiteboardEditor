import { useRef, useCallback } from "react";
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
  const textareaRef = useRef<TAWithClose | null>(null);

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

    const handleBlur = () => {
      performClose(textarea.value);
    }
    
    textarea.addEventListener("blur", handleBlur);
    textarea.addEventListener("keydown", handleKeyDown);
    textarea.addEventListener("input", handleInput);
    window.addEventListener("click", handleOutsideClick);

    close = () => {
      try {
        textarea.removeEventListener("keydown", handleKeyDown);
        textarea.removeEventListener("input", handleInput);
        textarea.removeEventListener("blur", handleBlur);
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

  // Stable ref callback — useCallback with [] prevents React from treating it
  // as a new function on every parent re-render, which would otherwise call the
  // old cleanup (null) and new init (element) on every re-render, resetting
  // textarea.value to the stale textNode.text() and jumping the cursor.
  const handleRef = useCallback((elem: HTMLTextAreaElement | null) => {
    if (elem) {
      const e = elem as TAWithClose;
      textareaRef.current = e;
      if (!e.__konvaInit) {
        initTextArea(e);
      }
    } else {
      const prev = textareaRef.current;
      if (prev?.__konvaClose) prev.__konvaClose();
      textareaRef.current = null;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Html>
      <textarea
        placeholder="Enter text here"
        ref={handleRef}
        style={{
          minHeight: "1rem",
          position: "absolute",
        }}
      />
    </Html>
  );
};

export default TextEditor;
